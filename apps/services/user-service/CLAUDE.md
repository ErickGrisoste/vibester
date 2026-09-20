# User Service

> Contexto específico do microserviço de usuários (perfis, seguidores) do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este serviço segue vários padrões diferentes do `auth-service` (Zod em vez de JSON Schema, sem `AppError`, CORS desabilitado, etc.). Não copie convenções de outro serviço para cá sem verificar contra o código deste diretório.

---

## Responsabilidade do Serviço

O `user-service` é responsável exclusivamente por:

- perfil público do usuário (`UserProfile`: nome, username, avatar, bio, contadores);
- relacionamento de seguidores (`UserFollow`: follow/unfollow, listagem de seguidores/seguidos, checagem de follow);
- busca de perfis por nome/username;
- bloqueio entre usuários e denúncias de perfil/publicação (`UserBlock`, `ContentReport`), e limpeza desses dados quando a conta é excluída (`user.deleted`).

Ele **não** possui credenciais (senha, email de login) — isso é responsabilidade do `auth-service`. O perfil é criado automaticamente ao consumir o evento `user.registered` do Kafka (ver `src/kafka/consumer.ts`), nunca via chamada síncrona do auth-service.

Nunca adicione regras de negócio de autenticação, feed, posts ou pagamento aqui. Se uma feature parece pertencer a outro domínio, ela deve ser feita no serviço correspondente e comunicada via Kafka.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/cors`, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/swagger` (+ `swagger-ui`)
- **`@fastify/type-provider-zod`** — validação de body/params/querystring e geração de OpenAPI feitas via schemas **Zod**, não JSON Schema manual (diferente do `auth-service`). Toda rota nova deve seguir esse padrão: `app.withTypeProvider<ZodTypeProvider>()`, schemas Zod declarados antes das rotas, `validatorCompiler`/`serializerCompiler` já registrados em `server.ts`.
- Prisma 7 com `@prisma/adapter-pg` (driver adapter sobre `pg.Pool`, mesmo padrão do auth-service)
- PostgreSQL
- Redis (`ioredis`) — usado para **cache-aside** de leitura (`cacheAside` em `src/config/redis.ts`) e como **store do rate limit** (`@fastify/rate-limit` com `redis` em vez de memória local — importante para funcionar corretamente com múltiplas réplicas)
- Kafka (`kafkajs`) — **produtor e consumidor** neste serviço (diferente do auth-service, que só produz): consome `user.registered` para criar perfil e o tópico `posts` (`post.created`/`post.deleted`, envelope do post-service) para manter `totalPosts` — idempotente por `eventId` no Redis, decremento nunca abaixo de zero —, produz `user.followed`/`user.unfollowed`
- OpenTelemetry (`@opentelemetry/sdk-node` + auto-instrumentations) — tracing distribuído opcional, ativado só se `OTEL_EXPORTER_OTLP_ENDPOINT` estiver definido (`src/config/tracing.ts`)
- Vitest para testes (unit + integration), `ioredis-mock` para mockar Redis nos testes

Não introduza um ORM alternativo, outro cliente Redis/Kafka, ou volte a usar JSON Schema puro nas rotas — reutilize o que já existe.

---

## Estrutura de Pastas

```
src/
  config/        env.ts, redis.ts, swagger.ts, tracing.ts   → configuração/infra, sem lógica de negócio
  controllers/   profile.controller.ts                       → define as ZodTypeProvider routes (schemas + handlers inline), registra prefixo /users
  services/      *.service.ts                                 → regra de negócio, acesso a Prisma/Redis/Kafka
    __tests__/                                                → testes unitários co-localizados (Vitest)
  kafka/         producer.ts (singleton lazy), consumer.ts    → producer envia eventos de follow/unfollow; consumer cria perfil a partir de user.registered e atualiza totalPosts a partir de posts
  prisma/        index.ts                                     → singleton do PrismaClient com adapter pg.Pool
  types/         profile.types.ts                             → interfaces de input por operação (sem output types formais — response é o próprio retorno do Prisma)
  routes.ts                                                   → /health, /ready, registra profileRoutes com prefix /users
  server.ts                                                   → bootstrap Fastify, plugins, connect/disconnect de infra, graceful shutdown
tests/
  helpers/               → tests/helpers/fastify.test.helper.ts (buildServer via setupRoutes)
  integration/            → mocka Prisma (vi.mock) e Redis (ioredis-mock) via vi.mock, chama app.inject
  integration-real/       → contra infra real (vitest.integration.config.ts, singleFork, timeout 30s)
  mocks/                  → mocks compartilhados (ex.: prisma.client.ts)
  setup/                  → vitest.setup.ts
```

### Padrão de uma feature nova

1. Se precisar de input/output type novo, adicionar em `types/profile.types.ts` (ou um novo arquivo `<feature>.types.ts` seguindo o mesmo padrão, se o domínio for diferente de perfil).
2. `services/<feature>.service.ts` — uma classe, um método por operação, lógica de negócio e acesso a dados. Sem uma classe de erro dedicada aqui (não existe `AppError` neste serviço) — deixe a exceção propagar e trate no controller.
3. Em `controllers/profile.controller.ts` (ou um controller novo, se o domínio justificar): declarar o schema Zod do body/params/querystring/response **antes** da função de rota, registrar a rota com `router.get/post/put(...)` usando `app.withTypeProvider<ZodTypeProvider>()`, e no handler fazer `try/catch` que loga (`request.log.error(error)`) e responde um `500 { message: "Error <ação em inglês>" }` genérico — siga o padrão de mensagens em **inglês** já usado neste arquivo (diferente do auth-service, que usa português; não misture os dois no mesmo serviço).
4. Toda mutação (`POST`/`PUT`) que altera contadores ou dados compartilhados entre múltiplos perfis deve:
   - usar `prismaClient.$transaction` quando mais de uma linha precisa mudar de forma atômica (ver `increaseFollower`/`decreaseFollower`);
   - invalidar (`redis.del`) todas as chaves de cache afetadas após a transação, com `.catch(() => {})` (nunca deixar falha de cache derrubar a resposta);
   - disparar evento Kafka relevante **depois** da transação confirmada, nunca antes.
5. Toda leitura pesada/frequente (perfil por id, listagem de seguidores/seguidos) deve passar por `cacheAside(key, ttlSeconds, fetchFn)` em vez de ir direto ao Prisma.
6. Testes unitários do service (em `src/services/__tests__`) + teste de integração da rota em `tests/integration` (mockando Prisma e Redis como em `profile.integration.spec.ts`).

---

## Segurança — obrigatório em qualquer alteração

1. **Este serviço é interno (ClusterIP), sem acesso direto de browser** — por isso o CORS está com `origin: false` no `server.ts`. Não reative CORS aberto sem entender a implicação: se uma rota nova precisar ser exposta a browsers, isso deve passar por um gateway/BFF, não por abrir CORS aqui.
2. **`@fastify/jwt` está registrado mas ainda não é aplicado como `preHandler`** em nenhuma rota (há um `TODO` explícito em `server.ts`). Isso significa que hoje **qualquer chamador que alcance o serviço pode informar qualquer `accountId`/`followerId`/`followingId` no body** — a confiança está na rede interna/gateway, não em verificação de identidade. Ao adicionar uma rota nova ou alterar uma existente:
   - nunca assuma que `accountId` do body foi validado como "o usuário autenticado atual" — isso ainda não é verdade neste serviço;
   - se a rota nova expõe uma ação sensível (ex.: deletar perfil, alterar dado de outro usuário), sinalize explicitamente ao usuário que falta autenticação aqui antes de expor a rota publicamente, e considere aplicar `request.jwtVerify()`/`preHandler` como parte da tarefa em vez de adicionar mais uma rota confiando apenas no body.
3. **Validação de entrada via Zod é obrigatória** em toda rota nova (`body`/`params`/`querystring`), incluindo `.uuid()`, `.email()`, `.url()`, limites de tamanho (`min`/`max`) e `.refine()` para invariantes entre campos (ver `followerActionSchema` impedindo `followerId === followingId`). Isso é a primeira defesa contra payload malformado.
4. **Nunca expor o campo interno `id`/`userID` do Prisma como está** — sempre mapear para `accountId` na resposta (ver `toProfileResponse`), mantendo o mesmo identificador público usado pelo auth-service.
5. **Rate limit em rotas de mutação sensíveis a abuso** (ex.: follow/unfollow) deve ter `config.rateLimit` próprio com `keyGenerator` baseado no ator da ação (`followerId`), não só no IP — isso evita que um usuário só seja limitado coletivamente por IP compartilhado (NAT, proxy) e limita abuso direcionado por conta.
6. **Erros internos nunca vazam para o cliente**: qualquer exceção não esperada vira `500 { message: "..." }` genérico; detalhes vão só para `request.log.error`.
7. **`/ready` não deve vazar detalhes de infraestrutura** além de `db`/`cache` booleanos — não adicione stack trace, connection string ou versão de dependência na resposta do readiness check.
8. **Segredos**: `JWT_SECRET`, `DATABASE_URL`, `KAFKA_BROKERS` sempre via env/secret do k8s, nunca hardcode. Este serviço não tem `.env.example` — se for criar um, siga o padrão de placeholders do `auth-service`.

---

## Performance — obrigatório em qualquer alteração

O serviço sustenta leitura de perfil e follow/unfollow em alta concorrência (hot path de rede social). Ao alterar código:

1. **Cache-aside é o padrão para leitura**: toda leitura de perfil/seguidores/seguidos deve usar `cacheAside` com TTL curto (hoje 60s) em vez de bater direto no Postgres. Se adicionar uma leitura nova de alto tráfego, siga o mesmo padrão em vez de criar uma variante própria.
2. **Schema de resposta de rota cacheada usa `z.coerce.date()`, nunca `z.date()`**: o que volta do Redis é JSON, então toda data chega como **string**. Com `z.date()` a rota funciona na primeira chamada (Prisma devolve `Date`) e responde **500 "Response doesn't match the schema"** durante todo o TTL seguinte — foi exatamente o que aconteceu com `GET /users/:accountId/followers`. O mock de `cacheAside` em `tests/integration/profile.integration.spec.ts` não revive datas de propósito, para reproduzir isso.
3. **Cache é fire-and-forget na escrita** (`redis.set(...).catch(() => {})` dentro de `cacheAside`, `redis.del(...).catch(() => {})` nas mutações) — nunca faça o cache bloquear ou falhar a resposta principal; Redis indisponível deve degradar para ir direto ao banco, nunca derrubar a request.
4. **Transações atômicas só quando necessário**: use `$transaction` para múltiplas escritas relacionadas (contadores de followers/following), mas rode as operações independentes dentro dela com `Promise.all` (já feito em `increaseFollower`/`decreaseFollower`) em vez de sequenciais.
5. **Evitar N+1**: uma query com `select` restrito aos campos necessários (ver `getFollowers.service.ts`, `searchProfiles.service.ts`) em vez de trazer a entidade inteira ou fazer uma query por item de lista. `UserFollow` não tem relação declarada com `UserProfile`, então listagem de gente é sempre **duas** consultas — a do relacionamento e um `findMany` com `userID: { in: [...] }` da página — como em `GetFollowersService.hydrate` e `BlockService.listBlocked`; nunca um `findUnique` de perfil por linha.
6. **Paginação obrigatória em listagens que crescem sem limite**: `search` pagina com `take`/`skip` e `$transaction` para `findMany` + `count` em paralelo; seguidores/seguidos e bloqueios paginam **por cursor** em `createdAt` (`getFollowers.service.ts`, `block.service.ts`), que é o padrão para lista de tamanho ilimitado — `OFFSET` fica mais caro a cada página. Qualquer endpoint novo de listagem deve nascer paginado — nunca um `findMany` sem `take`.
7. **Busca por nome/username (`searchProfiles.service.ts`) hoje usa `contains`/`mode: insensitive`** (equivalente a `ILIKE %q%`), que não escala bem para milhões de perfis (sem uso de índice). Se for expandir a busca (mais campos, mais volume, ranking), considere sinalizar a necessidade de um índice trigram (`pg_trgm`) ou motor de busca dedicado antes de simplesmente aumentar o alcance da query atual.
8. **Reaproveitar singletons de infra**: Prisma (`src/prisma/index.ts`), Redis (`src/config/redis.ts`) e Kafka producer (`src/kafka/producer.ts`) — nunca instancie um novo client dentro de um service/controller.
9. **Kafka para efeitos assíncronos**: eventos de follow/unfollow são publicados após a transação confirmada, nunca de forma síncrona bloqueando a resposta ao cliente.
10. **Limite de memória do processo é explícito**: `--max-old-space-size=384` no `CMD` do Dockerfile e no `command` do `k8s/deployment.yaml`, alinhado ao limite de memória do pod (512Mi). Se uma mudança aumentar significativamente o uso de memória (ex.: cache local grande, buffers), reavalie esse valor e o `resources.limits.memory` do deployment juntos.
11. Ao adicionar rota nova, pense no custo em alta volumetria (milhões de perfis/relações de follow) desde o design da query, não como otimização posterior.

---

## Testes

- `npm test` — unit (`src/**/*.test.ts` em `__tests__`) + integration (`tests/**/*.spec.ts`), mocka Prisma via `vi.mock` e Redis via `ioredis-mock`
- `npm run test:coverage` — cobertura de `src/services`, `src/controllers`, `src/routes.ts` com thresholds mínimos: **70% linhas, 70% funções, 60% branches** — não reduza esses thresholds para fazer um PR passar; escreva o teste que falta.
- `npm run test:integration` — roda contra `tests/integration-real` (infra real, `singleFork`, timeout 30s) — não confundir com `tests/integration` (mocks + `app.inject`)

Toda feature nova precisa de: teste unitário do service (incluindo transações e invalidação de cache), teste de integração da rota (schema Zod validando corretamente body/params/querystring, incluindo casos de erro 400/404/500), e — se mexer no consumer — um teste equivalente ao `tests/integration/user.consumer.spec.ts`.

---

## Variáveis de Ambiente

Todo valor de configuração novo deve passar por `src/config/env.ts` (nunca ler `process.env` direto em outro arquivo, com exceção pontual já existente em `src/config/redis.ts` e `src/prisma/index.ts`, que leem `REDIS_URL`/`DATABASE_URL` diretamente — não replique esse padrão para novas variáveis, centralize em `env.ts`), com default sensato quando fizer sentido, e propagado no `k8s/deployment.yaml` (via `env`, `configMapRef`/`configMapKeyRef` para config compartilhada, ou `secretRef`/`envFrom` para segredo).

---

## Infra deste Serviço

- `Dockerfile`: build em 3 estágios (`deps` → `builder` com `prisma generate` + `tsc` → `production` com `npm ci --omit=dev` e `dist`/`prisma`/`prisma.config.ts`/`.prisma` copiados). `CMD` roda `npx prisma migrate deploy && node ...dist/server.js` (mesmo padrão do auth-service) — migrations pendentes são aplicadas automaticamente a cada start do container. O `prisma.config.ts` precisa estar na imagem para o CLI achar a `datasource.url` (Prisma 7 não lê mais `url` do `schema.prisma`) — se o arquivo sumir da imagem de novo, `migrate deploy` falha com "datasource.url property is required".
- `CMD` carrega tracing via `--require ./dist/config/tracing.js` antes do `server.js` — qualquer novo entrypoint/script precisa preservar esse `--require` se tracing distribuído for esperado em produção.
- `k8s/`: `deployment.yaml` tem `startupProbe` (`/health`), `livenessProbe` (`/health`) e **`readinessProbe` separado em `/ready`** (checa DB + Redis) — ao adicionar uma nova dependência de infra crítica (novo banco, cache, fila), atualize `/ready` em `routes.ts` para refletir a saúde real do serviço.
- `hpa.yaml`: min 1 / max 4 réplicas, CPU 70% / memória 80%, com `behavior` assimétrico (scale-up rápido, scale-down com `stabilizationWindowSeconds: 300` para evitar oscilação).
- Sem `.env.example` neste serviço hoje — se for adicionar uma env var nova relevante para rodar localmente, considere criar um alinhado ao padrão do `auth-service`.

---

## Listagem de seguidores e seguidos

`GET /users/:accountId/followers` e `GET /users/:accountId/following` (`getFollowers.service.ts`) são a fonte das listas que o app abre ao tocar nos contadores do perfil. As duas devolvem a mesma forma:

```
{ data: [{ accountId, name, username, avatarUrl, followers, followedAt }], nextCursor }
```

- **Perfil já vem hidratado** (nome, @, avatar e contador de seguidores), para o cliente não precisar buscar perfil por item. São duas consultas por página, nunca N+1 (ver §4 de Performance).
- **Paginação por cursor**: `?limit` (1–50, padrão 30) e `?cursor` = o `nextCursor` da página anterior, que é o `followedAt` do último item em ISO. `nextCursor: null` significa fim da lista. Ordem: follow mais recente primeiro.
- **Cache só na primeira página no tamanho padrão**, sob as chaves `user:followers:<id>`/`user:following:<id>` — as mesmas que `increaseFollower`/`decreaseFollower` já invalidam. Página com cursor ou `limit` fora do padrão vai direto ao banco de propósito: cachear sob outra chave deixaria entrada órfã, servindo lista desatualizada depois de um follow.
- **Follow cujo perfil não existe** (perfil ainda não criado pelo consumer, ou conta em exclusão) permanece na lista com os campos nulos em vez de ser filtrado — filtrar encurtaria a página e faria o cursor pular registros.
- **Não filtra bloqueio**: o `UserFollow` de quem bloqueou já foi desfeito no `BlockService.block`, e o cliente ainda filtra pelo próprio estado de bloqueio antes de exibir.

---

## Bloqueio, denúncia e exclusão de conta (requisitos da App Store)

Rotas em `controllers/safety.controller.ts` (prefixo `/users`), **todas autenticadas**: o id de quem age sai do JWT (`controllers/auth.ts` → `request.jwtVerify()`, mesmo `JWT_SECRET` do auth-service), nunca do corpo. Sem token válido: 401.

- `POST /blocks { blockedId }` → 201. Cria `UserBlock` (idempotente) e desfaz o follow **nas duas direções** via `EditProfileService.decreaseFollower` (contadores, cache e `user.unfollowed` iguais a um unfollow comum). `DELETE /blocks/:blockedId` → 200. `GET /blocks?limit&cursor` → perfis bloqueados paginados por `createdAt` (índice `blockerId, createdAt`). `GET /blocks/:accountId/status` → `{ blocking, blockedBy }`.
- `POST /profile/followers/increase` agora responde **403** quando há bloqueio em qualquer direção.
- `POST /reports { targetType: USER|POST, targetId, targetOwnerId (obrigatório em POST), reason, details? }` → 201 `{ id, created }`. Grava `ContentReport` (unique por denunciante+alvo: repetir não duplica nem reenvia) e publica `content.reported`, que o notification-service manda para `MODERATION_EMAIL`. Se o publish falhar a denúncia é apagada e o erro sobe — denúncia sem aviso ficaria invisível. Não é possível denunciar o próprio perfil/post (400). `status` (`OPEN/ACTIONED/DISMISSED`) existe para a moderação; ainda não há rota que o altere.
- **Consumidor `user.deleted`** (`handleUserDeletedEvent` → `UserDeletionService`): desfaz follows em páginas de 500 (publica `user.unfollowed` antes de apagar, decrementa contadores dos outros perfis com `updateMany` por página), apaga bloqueios de/para a conta, denúncias feitas por ela e contra o perfil, e o `UserProfile`. Idempotente; erro de banco sobe para o Kafka reentregar.
- Env: `RATE_LIMIT_BLOCK_MAX` (30/min), `RATE_LIMIT_REPORT_MAX` (20/min), por IP. Migração `20260914000000_add_userblock_contentreport`.
