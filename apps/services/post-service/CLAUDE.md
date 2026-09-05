# Post Service

> Contexto específico do microserviço de posts (publicações, curtidas, comentários) do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este serviço é o mais diferente dos três já documentados (`auth-service`, `user-service`, `establishment-service`). Não usa PostgreSQL/Prisma — usa **Cassandra** (DataStax Astra) com modelagem "query-first" (tabelas denormalizadas por padrão de leitura). Não tem `AppError`, tem `HttpError`. Não tem nenhuma autenticação (nem JWT registrado). Não copie convenções de outro serviço para cá sem verificar contra o código deste diretório.

---

## Responsabilidade do Serviço

O `post-service` é responsável exclusivamente por:

- criação, leitura, atualização de legenda e remoção (soft delete) de posts (`Post`);
- listagem paginada de posts por usuário e por estabelecimento;
- curtidas (`PostLike`): curtir/descurtir e listar curtidas por post/usuário;
- comentários (`Comment`): criar, listar, editar e remover (soft delete);
- geração de URLs pré-assinadas para upload direto de mídia (imagem e vídeo) ao Cloudflare R2 — cada URL é assinada com o `contentType` do arquivo, ver [`docs/midias-no-post.md`](docs/midias-no-post.md).

Ele **não** possui dados "vivos" de perfil de usuário ou de estabelecimento — cada post guarda uma cópia denormalizada (`userUsername`, `userProfilePicture`, `userVerified`, `establishmentName`, `establishmentLogo`, `establishmentCategory`) recebida no momento da criação, sem sincronização posterior. Se esses dados mudarem no `user-service`/`establishment-service`, os posts já criados **não** são atualizados automaticamente — não assuma que essas cópias estão sempre em dia.

Nunca adicione regras de negócio de autenticação, perfil, feed (agregação/ranqueamento) ou estabelecimento aqui. Se uma feature parece pertencer a outro domínio, ela deve ser feita no serviço correspondente e comunicada via Kafka.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/cors` (`origin: true`, aberto para qualquer origem — diferente dos outros serviços, que restringem ou desabilitam CORS), `@fastify/helmet` (com `contentSecurityPolicy: false`), `@fastify/compress`, `@fastify/rate-limit` (global, em memória), `@fastify/multipart` (registrado com limites de 10MB/20 arquivos, mas **nenhuma rota usa `request.file()`/`request.parts()` hoje** — configuração morta, ver Segurança).
- **Cassandra** (`cassandra-driver`) apontando para **DataStax Astra** via secure connect bundle (`src/config/cassandra.ts`) — este é o banco principal do serviço, **não** PostgreSQL/Prisma como nos outros três serviços já documentados. Modelagem é "query-first": uma tabela por padrão de acesso (`posts_by_id`, `posts_by_user`, `posts_by_establishment`, etc.), não normalizada.
- Migrations são arquivos `.cql` em `migrations/` (`V00N__nome.cql`), aplicadas por um runner próprio (`scripts/migrate.ts`), que registra versões executadas numa tabela `schema_migrations` no próprio keyspace — não é Prisma Migrate.
- Redis (`ioredis`) — usado só para **cache-aside** de leitura (`cacheAside` em `src/config/redis.ts`); o rate limit **não** usa Redis como store (fica em memória local do processo — ver Segurança/Performance sobre o impacto disso ao escalar horizontalmente).
- Kafka (`kafkajs`) — **produtor apenas** (`src/kafka/producer.ts`, singleton lazy que faz `require("kafkajs")` dentro da função em vez de import no topo — não replique esse padrão sem necessidade, é inconsistente com o resto do arquivo que já usa `import type`); tópicos publicados: `posts` (`post.created`, `post.content.updated`, `post.deleted`, `post.stats.updated`), `post.liked`, `post.unliked`, `post.commented`. Sem consumidores.
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — geração de URLs pré-assinadas (PUT) para o cliente subir a imagem direto no R2 (`src/config/r2.ts`, `src/services/upload.service.ts`). É o único fluxo de upload de fato exposto por rota hoje.
- `sharp` — usado só dentro de `UploadService.uploadImages` (redimensiona para 1080px e converte para `.webp`), mas **esse método não é chamado por nenhum controller/rota** — é código morto hoje (só há teste para `generatePresignedUrls`, não para `uploadImages`). Se for implementar upload via multipart no futuro, reaproveite esse método em vez de escrever um novo.
- `zod` é usado para: validação de env (`src/config/env.ts`), validação de `params` dentro dos controllers (`postIdParamsSchema`, `userIdParamsSchema`, `establishmentIdParamsSchema`, `generateUploadUrlsSchema` em `src/schema/post.schema.ts`, chamados via `.parse()`). O body das rotas de escrita passa por **duas camadas**: primeiro o JSON Schema do Fastify em `routes.ts` (forma e tipos), depois Zod no controller para as regras que o JSON Schema não expressa — em `POST /posts` e `POST /posts/upload-url`, `createPostSchema`/`generateUploadUrlsSchema` validam o vínculo entre campos (`media` **ou** `imageUrls`, `contentType` compatível com `type`), que a URL da mídia pertence ao bucket, e normalizam o formato legado para o novo. Ao mexer num, confira o outro: o Fastify roda antes e um `required` desatualizado rejeita o payload antes do Zod ver.
- Vitest para testes (unit co-localizado em `__tests__` + integration em `tests/integration`), `ioredis-mock` disponível como dependência de teste.

Não introduza um ORM alternativo, outro cliente Redis/Kafka/S3, nem volte a usar PostgreSQL/Prisma neste serviço sem alinhar com o time — reutilize o que já existe.

---

## Estrutura de Pastas

```
src/
  config/        cassandra.ts, redis.ts (cacheAside), r2.ts, env.ts, swagger.ts
  controller/    post.controller.ts, like.controller.ts, comment.controller.ts   → classes, métodos bind() registrados em routes.ts
  services/      post.service.ts, like.service.ts, comment.service.ts, upload.service.ts
    __tests__/                                                                    → testes unitários co-localizados (Vitest)
  repository/    base.repository.ts (wrapper de execute() com prepared statements),
                 post.repository.ts, like.repository.ts, comment.repository.ts     → um método por tabela denormalizada/query
  errors/        http.error.ts                                                    → HttpError(message, statusCode)
                 error.handler.ts                                                 → setErrorHandler compartilhado (server.ts e helper de teste)
  kafka/         producer.ts                                                      → singleton lazy, produtor apenas
  schema/        post.schema.ts                                                   → schemas Zod de params e do body de POST /posts e /posts/upload-url (ver Stack)
  types/         post.types.ts, comment.type.ts (singular — inconsistente, cuidado ao criar arquivo novo), like.types.ts
  utils/         cursor.ts                                                        → cursor opaco (base64url) para paginação keyset de posts
                 media.ts                                                         → conversão UDT media_item <-> domínio + fallback de image_urls legado
  routes.ts                                                                       → registra todas as rotas + schema JSON Schema completo por rota
  server.ts                                                                       → bootstrap Fastify, plugins, error handler global, connect/disconnect de infra
migrations/      V00N__*.cql                                                      → schema do Cassandra, versionado manualmente
scripts/migrate.ts                                                                → runner de migration próprio (não Prisma)
tests/
  helpers/       fastify.test.helper.ts    → buildServer registra só `routes` (sem cors/helmet/rate-limit/multipart)
  integration/   *.spec.ts por feature (post/like/comment)
  setup/         vitest.setup.ts           → mocka `src/config/env` inteiro (evita exigir env reais do Astra/R2 em teste)
```

`docker-compose.test.yml` só sobe Redis — não há Cassandra nem Kafka reais disponíveis para teste; qualquer teste precisa mockar `repository`/`producer`.

### Padrão de uma feature nova

1. Tipos em `types/<feature>.types.ts` (siga o plural, exceto se for tocar em `comment.type.ts`, que já está no singular por herança do código existente).
2. `repository/<feature>.repository.ts` — classe que estende `BaseRepository`, um método por tabela/query CQL. **Ao adicionar um campo ou contador novo, replique manualmente em todas as tabelas denormalizadas relevantes** (`_by_id`, `_by_user`, `_by_establishment`) — não existe transação/`BATCH` atômico entre elas hoje (ver Performance).
3. `services/<feature>.service.ts` — classe, injeta repositórios via construtor, lança `HttpError(message, statusCode)` para erros esperados, dispara `producer.send(...)` **depois** de persistir.
4. `controller/<feature>.controller.ts` — classe, um método por rota, `.bind(this)` no registro em `routes.ts`; use os schemas Zod de `schema/post.schema.ts` (`.parse()`) para `params`, mas siga o padrão de JSON Schema do Fastify para `body`/`querystring`/`response` na própria definição da rota.
5. `routes.ts` — registrar com `schema` completo (tags, summary, description, `body`/`params`/`querystring`/`response` por status) e `config.rateLimit` dedicado (`rate_limit_write_max` para escrita, `rate_limit_like_max` para like/unlike) quando a rota for de mutação.
6. Testes unitários do service em `src/services/__tests__` + teste de integração da rota em `tests/integration`.

---

## Segurança — obrigatório em qualquer alteração

1. **Este serviço não tem nenhuma autenticação** — nem `@fastify/jwt` está registrado. Todo `userId` vem direto do `body`/`params` da requisição, sem qualquer verificação de identidade. Isso é ainda mais aberto do que o `user-service` (que ao menos registra `@fastify/jwt`, mesmo sem aplicá-lo). Não assuma que a rede interna/gateway resolve isso sozinha — se for expor uma rota nova ou uma rota sensível diretamente a clientes, sinalize essa lacuna explicitamente antes de prosseguir.
2. **`PATCH /posts/:postId` e `DELETE /posts/:postId` não recebem nem verificam `userId` algum** (ver `post.controller.ts` → `updateCaption`/`softDelete` e `post.service.ts`) — qualquer chamador que souber o `postId` pode editar a legenda ou apagar o post de **qualquer** usuário. Compare com `comment.service.ts`, que **verifica** `comment.userId !== currentUserId` e responde `403` antes de editar/deletar (`update`/`softDelete` em `CommentService`). Ao mexer nessas rotas de post, siga o padrão de `CommentService` (receber `userId` no body e validar contra o dono) em vez de assumir que está coberto.
3. **Comentários já verificam propriedade corretamente**: `update`/`softDelete` em `comment.service.ts` comparam `comment.userId` com o `userId` do body e retornam `403` em caso de divergência — mantenha esse padrão em qualquer mutação de comentário nova.
4. **Likes**: `unlikePost` exige que exista um `like` daquele `userId` específico antes de remover (`findLikeByPostAndUser`), o que restringe a ação ao "dono" da curtida na prática — mas, como não há verificação de identidade, qualquer chamador pode enviar qualquer `userId` no body e curtir/descurtir em nome de outro usuário.
5. **CORS totalmente aberto** (`origin: true` em `server.ts`) — aceita qualquer origem. Diferente dos outros três serviços (lista explícita ou CORS desabilitado). Não assuma que isso é intencional para produção sem confirmar antes de tocar nesse trecho.
6. **Upload de imagem nunca passa pelo processo do serviço**: o único fluxo ativo é `POST /posts/upload-url`, que gera uma URL pré-assinada (`PutObjectCommand` + `getSignedUrl`, expira em 5 min) para o cliente fazer o `PUT` direto no R2. O post-service nunca vê o binário, então **não há validação de mimetype/tamanho do lado do servidor** para essas imagens — a única defesa é o que o cliente/R2 aplicarem no `PUT`. `@fastify/multipart` está registrado em `server.ts` (limite 10MB/20 arquivos) mas nenhuma rota o usa hoje — não assuma que esse limite protege algo em produção.
7. **Erros**: o `setErrorHandler` global (`server.ts`) trata `ZodError` (400 com lista de `field`/`message`), `HttpError` (usa o `statusCode` da própria instância), erros do Fastify com `statusCode < 500` (repassados como estão) e qualquer outro erro vira `500 { message: "Internal server error" }` com log via `app.log.error({ err: error })`. Siga esse contrato: lance `HttpError` para erros esperados, deixe o resto propagar.
8. **Segredos**: credenciais do Astra (`ASTRA_CLIENT_ID`/`ASTRA_CLIENT_SECRET`/`ASTRA_TOKEN`/o bundle) e do R2 (`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`) sempre via env/secret do k8s, nunca hardcode. `.env.example` já lista todas como placeholder vazio.
9. **Rate limit é global e em memória** (`@fastify/rate-limit` sem store Redis, diferente do `user-service`) — funciona hoje porque `replicas: 1` está fixo no `k8s/deployment.yaml`. Se este serviço ganhar autoscaling no futuro, o limite deixa de ser efetivo (cada pod conta separadamente) — migre para um store Redis antes de aumentar réplicas.

---

## Performance — obrigatório em qualquer alteração

1. **Modelagem "query-first" do Cassandra**: cada padrão de leitura tem sua própria tabela denormalizada (`posts_by_id`/`posts_by_user`/`posts_by_establishment`, `comments_by_id`/`_by_post`/`_by_user`, `likes_by_post`/`_by_user`). Toda escrita (criar/atualizar/deletar/contador) precisa de **fan-out manual** para todas as tabelas relevantes via `Promise.all` — ao adicionar um campo ou uma tabela denormalizada nova, replique a mudança em todos os métodos de escrita correspondentes do repository, senão as views ficam inconsistentes entre si.
2. **Sem transação atômica entre tabelas denormalizadas** (nenhum uso de `BATCH`/LWT do Cassandra) — uma falha parcial no meio de um `Promise.all` pode deixar `posts_by_id` e `posts_by_user` divergentes (ex.: `total_likes` diferente entre as views), e o código atual não faz rollback nem retry nesse cenário. Considere isso ao avaliar a robustez de qualquer alteração nesse fluxo.
3. **Contadores (`total_likes`/`total_comments`) são read-modify-write manual** (lê o post, soma/subtrai 1 em memória, escreve de volta) em vez de usar uma coluna `counter` nativa do Cassandra — sob curtidas/comentários concorrentes no mesmo post há risco real de leitura desatualizada e incremento perdido (race condition clássica). Se o volume de interações simultâneas por post crescer, considere migrar para uma tabela de `counter` dedicada em vez de manter esse padrão.
4. **Paginação cursor-based (keyset) já existe só para posts**: `findByUser`/`findByEstablishment` em `post.repository.ts` usam `(created_at, post_id) < (?, ?)` com cursor opaco (`src/utils/cursor.ts`, `encodeCursor`/`decodeCursor`, exposto no header `X-Next-Cursor`). Siga esse padrão para qualquer nova listagem de posts que cresça sem limite.
5. **Curtidas e comentários NÃO têm paginação real, apesar da rota anunciar uma**: `routes.ts` declara `querystring: paginationQuerystring` (com `cursor`) em `GET /posts/:postId/likes`, `GET /users/:userId/likes`, `GET /posts/:postId/comments`, `GET /users/:userId/comments` — mas `LikeController`/`CommentController` **nunca leem** `request.query.cursor` (nem `limit`, no caso de likes/comments), e os repositories fazem apenas `LIMIT ?` fixo (padrão 50) sem cláusula de cursor. Um post com mais de 50 curtidas ou comentários hoje **não tem como paginar além da primeira página**. Se for tocar nesse fluxo, implemente cursor real (mesmo padrão de `post.repository.ts`) antes de assumir que já está resolvido.
6. **Cache-aside** (`cacheAside` em `src/config/redis.ts`, TTL 300s para post por id, 120s para listagens por usuário/estabelecimento) é o padrão para leitura pesada — toda leitura nova de alto tráfego deve seguir esse padrão em vez de ir direto ao Cassandra.
7. **Invalidação de cache é best-effort** (`redis.del(...)` dentro de `try/catch`, loga e segue) — nunca deixe uma falha de cache derrubar a escrita principal.
8. **`isLiked` nunca é cacheado junto do post** — é calculado em tempo de leitura por `viewerId` (`attachIsLiked` em `post.service.ts`, comentário explícito no código sobre por quê), já que o cache de posts é compartilhado entre todos os viewers. Preserve essa separação ao adicionar um campo novo que dependa do usuário autenticado.
9. **Upload de mídia nunca passa pelo processo Node** (fluxo 100% via URL pré-assinada) — bom para escalabilidade, já que não há I/O de arquivo no service; preserve esse padrão em vez de reintroduzir upload via multipart/`sharp` sem necessidade real.
10. **Concorrência limitada nas chamadas ao R2** (`PRESIGN_CONCURRENCY = 5` em `upload.service.ts`, `runWithConcurrency` processa em lotes) — evita saturar o client S3 ao gerar até 20 URLs de uma vez; siga o mesmo padrão para qualquer operação nova em lote contra o R2.
11. Ao adicionar rota nova, pense no custo em alta volumetria (milhões de posts/curtidas/comentários) desde o design da tabela/query Cassandra, não como otimização posterior — Cassandra penaliza fortemente `ALLOW FILTERING`/scans; qualquer padrão de acesso novo provavelmente precisa de uma tabela denormalizada nova, não de uma query ad-hoc sobre uma tabela existente.

---

## Testes

- `npm test` — `vitest run` (config padrão `vitest.config.ts`): roda unit (`src/**/*.test.ts`) + integration (`tests/integration/**/*.spec.ts`) juntos.
- `npm run test:unit` — só unit, via `vitest.unit.config.ts`.
- `npm run test:integration` — só integration, via `vitest.integration.config.ts` (`fileParallelism: false`, execução sequencial, timeout 30s).
- `npm run test:coverage` — `vitest.coverage.config.ts`, thresholds mínimos **70% linhas, 70% funções, 60% branches** sobre `src/services`, `src/controller`, `src/routes.ts` — não reduza para fazer um PR passar.
- `tests/setup/vitest.setup.ts` mocka `src/config/env` inteiro (evita exigir as env vars obrigatórias do Astra/R2 durante os testes).
- `docker-compose.test.yml` só sobe Redis — não há Cassandra nem Kafka reais nos testes; repository e producer precisam ser mockados (`vi.mock`) nos testes de integração.
- `tests/helpers/fastify.test.helper.ts` monta um app minimalista que registra **só** `routes` (sem cors/helmet/rate-limit/multipart) — se uma rota nova depender de algum desses plugins, o teste de integração pode não refletir o comportamento real de produção.

Toda feature nova precisa de: teste unitário do service (incluindo o fan-out para as tabelas denormalizadas e os branches de erro/`HttpError`) e teste de integração da rota.

---

## Variáveis de Ambiente

Toda variável de ambiente é validada por `zod` em `src/config/env.ts` (`envSchema.safeParse(process.env)`, processo encerra com `process.exit(1)` se inválida) — mesmo padrão do `establishment-service`. Não leia `process.env` direto em outro arquivo do `src/`, com a exceção já existente de `scripts/migrate.ts` (roda fora do runtime do server, antes de qualquer conexão, e lê `process.env` diretamente). Propague no `k8s/deployment.yaml` (`secretRef: post-service-secret` para credenciais Astra/R2, `configMapRef: redis-env` para Redis) e no `.env.example` (placeholders vazios, nunca valor real).

---

## Infra deste Serviço

- `Dockerfile`: build em 2 estágios (`builder` com `npm install` + `npm run build` + `npm prune --omit=dev`; `runtime` copia `node_modules`/`dist`/`migrations`/`package.json`). `CMD` roda `node dist/scripts/migrate.js && node dist/src/server.js` — as migrations `.cql` são aplicadas automaticamente no start do container (mesmo padrão de `auth-service`/`establishment-service`), usando o runner próprio de `scripts/migrate.ts`, que registra as versões executadas na tabela `schema_migrations` do keyspace.
- `k8s/`: só existem `deployment.yaml` e `service.yaml` — **sem `hpa.yaml`, sem `pdb.yaml`, sem `networkpolicy.yaml`**, diferente dos três serviços já documentados. `replicas: 1` está fixo — o serviço não escala horizontalmente hoje (ver nota de rate limit em memória em Segurança/Performance antes de simplesmente aumentar réplicas).
- O secure connect bundle do Astra é montado via `Secret` + `Volume` (`astra-secure-connect-bundle` em `/etc/astra/secure-connect-bundle.zip`) — `ASTRA_SECURE_CONNECT_BUNDLE` no deployment aponta para o **caminho do arquivo montado**, não para o conteúdo do bundle.
- `readinessProbe` e `livenessProbe` apontam **ambos** para `/health`, que checa Redis **e** Cassandra juntos (`Promise.all` em `routes.ts`). Uma degradação temporária do Cassandra/Astra derruba tanto readiness quanto liveness ao mesmo tempo, podendo causar restart do pod mesmo com o processo Node saudável — diferente do padrão dos outros serviços (que separam `/health` de `/ready`). Se for mexer em health checks, considere separar liveness (processo vivo) de readiness (dependências ok).
- Sem métricas Prometheus e sem tracing OpenTelemetry configurados — observabilidade hoje é só log estruturado (Pino do Fastify, mais alguns `console.error` pontuais em `redis.ts`/`post.service.ts` para falhas de cache). Se for adicionar observabilidade, isso precisa ser criado do zero, não assumido como já ativo.
- Swagger (`/docs`) é sempre registrado em `server.ts`, sem flag de ambiente (`SWAGGER_ENABLED`) para desligá-lo — diferente do `establishment-service`; não assuma que a documentação fica oculta em produção.
