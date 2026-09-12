# Establishment Service

> Contexto específico do microserviço de estabelecimentos (bares, baladas, casas noturnas) do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este serviço tem convenções próprias, diferentes tanto do `auth-service` quanto do `user-service` (sem `AppError`, sem `@fastify/type-provider-zod` nas rotas, com Prometheus, upload para R2, NetworkPolicy). Não copie padrões de outro serviço para cá sem verificar contra o código deste diretório.

---

## Responsabilidade do Serviço

O `establishment-service` é responsável exclusivamente por:

- cadastro/perfil de estabelecimentos (nome, bio, endereço, categoria, fotos, localização, horário de funcionamento);
- listagem/busca de estabelecimentos com filtros (categoria, avaliação, texto, geolocalização) e paginação;
- avaliação média (`averageRating`) e nível de movimento (`nivelMovimento`) do estabelecimento;
- upload de foto de perfil para o Cloudflare R2.

O **nível de movimento** é atualizado por duas vias que já convivem no código — mantenha as duas ao evoluir esse fluxo, não assuma que só uma existe:
1. **HTTP síncrono**: `PATCH /establishments/:id/movement`, chamado pelo `scrapping-service` a cada hora;
2. **Kafka assíncrono**: consumidor do tópico `establishments`, evento `establishment.movement.updated` (`src/kafka/consumer.ts`), que também pode atualizar a `category`.

Nunca adicione regras de negócio de autenticação, perfil de usuário, feed ou pagamento aqui. Se uma feature parece pertencer a outro domínio, ela deve ser feita no serviço correspondente e comunicada via Kafka.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/cors`, `@fastify/jwt`, `@fastify/multipart` (upload de arquivo), `@fastify/rate-limit`, `@fastify/swagger` (+ `swagger-ui`)
- **Schemas de rota em JSON Schema puro** (não `@fastify/type-provider-zod`, apesar de `zod` estar nas dependências) — `zod` aqui é usado só para: validação de env (`src/config/env.ts`, `safeParse`), validação pontual extra dentro de um controller (`getEstablishmentParamsSchema` em `establishment.controller.ts`) e validação de payload de evento Kafka (`movementUpdatedSchema` em `src/kafka/consumer.ts`). Ao adicionar rota nova, siga o padrão JSON Schema de `routes.ts` para `schema.body`/`querystring`/`params`/`response` — não migre a rota para Zod isoladamente sem alinhar o serviço inteiro.
- Prisma 7 com `@prisma/adapter-pg` (driver adapter sobre `pg.Pool`, mesmo padrão dos outros serviços)
- PostgreSQL
- Redis (`ioredis`) — cache-aside (`cacheAside` em `src/config/redis.ts`), com **deduplicação de requisições em voo** (`inFlight` Map) para evitar cache stampede quando várias requisições concorrentes pedem a mesma chave ainda não cacheada
- Kafka (`kafkajs`) — **consumidor** de `establishments` (`EstablishmentKafkaConsumer`, com retry de conexão exponencial simples); este serviço não produz eventos hoje
- `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` — upload de imagens para **Cloudflare R2** (compatível com S3), client em `src/config/r2.ts`
- `prom-client` — métricas Prometheus expostas em `GET /metrics` (contador de requisições + histograma de duração), únicas neste serviço entre os já documentados
- Vitest para testes (unit co-localizado em `__tests__` + integration), `ioredis-mock` para mockar Redis

Não introduza um ORM alternativo, outro cliente Redis/Kafka/S3, ou migre as rotas para `type-provider-zod` sem alinhar com o time — reutilize o que já existe.

---

## Estrutura de Pastas

```
src/
  config/        env.ts (zod safeParse), redis.ts (cacheAside + inFlight), r2.ts, swagger.ts, metrics.ts
  controllers/   establishment.controller.ts   → funções de rota exportadas (não classes), try/catch por função
    __tests__/                                  → testes unitários co-localizados
  services/      establishment.service.ts (classe com métodos static), listEstablishment.service.ts (classe de instância, busca geoespacial "nearby"), upload.service.ts (classe com métodos static, R2)
    __tests__/                                  → testes unitários co-localizados
  kafka/         client.ts (Kafka client singleton), consumer.ts (EstablishmentKafkaConsumer, com retry)
  prisma/        index.ts                       → singleton do PrismaClient com adapter pg.Pool
  types/         establishment.types.ts          → interfaces de input/output/filtros/paginação
  routes.ts                                     → /health, /health/ready, registra todas as rotas de /establishments
  server.ts                                     → bootstrap Fastify, CORS, JWT + decorator `authenticate`, rate limit, /metrics, error handler global, start do consumer Kafka
prisma/
  data/places.ts, seeds/                        → dados e scripts de seed para desenvolvimento local (SerpApi para horários)
tests/
  helpers/               → fastify.test.helper.ts (buildServer registrando JWT + establishmentRoutes)
  integration/            → tests/integration/*.spec.ts
  mocks/                  → tests/mocks/prisma.client.ts
  setup/                  → vitest.setup.ts (unit) e vitest.integration.setup.ts (integration)
```

Existem **duas implementações de distância Haversine** (`calculateDistance` em `establishment.service.ts` e em `listEstablishment.service.ts`) — são a mesma fórmula duplicada em dois arquivos por histórico do código, não um padrão a seguir. Se for tocar em lógica de geolocalização, reutilize uma das duas em vez de criar uma terceira cópia.

### Padrão de uma feature nova

1. Adicionar tipos em `types/establishment.types.ts` (input/output/filtros).
2. `services/<feature>.service.ts` — pode ser classe com métodos `static` (padrão de `EstablishmentService`, hoje o mais usado) ou classe de instância (padrão de `ListEstablishmentsService`) — siga o estilo do service mais próximo do domínio que você está tocando. Erros esperados são lançados como `new Error("CODIGO_OU_MENSAGEM")` (ver `"ESTABLISHMENT_NOT_FOUND"`, `"INVALID_RATING"`) ou deixam o Prisma lançar (`P2025` para not-found em `update`/`delete`) — **não introduza uma classe `AppError`** neste serviço sem alinhar com os outros dois padrões já existentes no monorepo.
3. Controller como **função exportada** (não classe) em `controllers/establishment.controller.ts`, com `try/catch` que:
   - checa mensagens/códigos de erro conhecidos (`error.message === "..."`, `(error as NodeJS.ErrnoException).code === "P2025"`) e mapeia para o status HTTP correto;
   - qualquer erro não mapeado vira `console.error(...)` + `500 { message: "Internal server error" }` (ou `"Erro interno no servidor"` — o serviço mistura inglês e português nas mensagens existentes; ao escrever uma rota nova, prefira consistência com as rotas vizinhas do mesmo grupo, mas não é obrigatório unificar o restante do arquivo).
4. `routes.ts` — registrar com `schema` em JSON Schema (tags, summary, description, `body`/`querystring`/`params`/`response`, incluindo status de erro). Se a rota for sensível (escreve dado que afeta reputação/confiança do estabelecimento, como rating), aplicar `onRequest: [fastify.authenticate]` e `security: [{ bearerAuth: [] }]` no schema (ver `PATCH /establishments/:id/rating`). Rotas chamadas apenas por outro serviço interno (como `movement`) podem ficar sem `authenticate` — isso já é o padrão atual, mas dependa do NetworkPolicy para restringir quem alcança a rota, não confie só na ausência de exposição pública.
5. Testes unitários do service e do controller (`__tests__` co-localizado) + teste de integração da rota em `tests/integration`.

---

## Segurança — obrigatório em qualquer alteração

1. **`authenticate` (JWT) é aplicado seletivamente por rota** via `onRequest: [fastify.authenticate]` — diferente do `user-service` (que registra o plugin mas não aplica em nenhuma rota). Ao adicionar uma rota de mutação nova, decida explicitamente se ela precisa de `authenticate`: se a ação altera dado sensível/reputacional e pode ser chamada por um usuário final, ela precisa; se é uma integração interna (scrapping, outro serviço), documente isso na `description` do schema e garanta que o `NetworkPolicy` (`k8s/networkpolicy.yaml`) restrinja quem alcança a porta do serviço.
2. **Rate limit é global e por identidade**, não só por IP: o `keyGenerator` em `server.ts` decodifica o `sub` do JWT do header `Authorization` quando presente, e cai para `request.ip` caso contrário. Preserve esse padrão em qualquer configuração de rate limit específica de rota nova.
3. **Rate limit é desabilitado inteiramente quando `NODE_ENV === "test"`** — não adicione lógica de segurança que dependa do rate limit estar sempre ativo; escreva testes assumindo que ele pode estar ausente.
4. **Upload de arquivo (`/establishments/:id/photo`) tem validação em camadas** — mantenha todas ao alterar esse fluxo:
   - `@fastify/multipart` limita `fileSize`/`files` na configuração global (`MAX_FILE_SIZE = 5MB`, `files: 1`);
   - o controller valida `mimetype` contra uma allowlist (`ALLOWED_MIME_TYPES`) antes de processar, e drena (`file.file.resume()`) o stream rejeitado para não travar a conexão;
   - o controller também mede o tamanho manualmente durante o streaming (`totalSize` no evento `data`) e destrói o stream (`FILE_TOO_LARGE`) se ultrapassar o limite — essa é uma defesa em profundidade contra clientes que mintam o `Content-Length`; não remova essa checagem confiando só no limite do `@fastify/multipart`.
5. **Nunca vazar credenciais do R2** (`r2_access_key_id`, `r2_secret_access_key`) em log, resposta ou erro — só a `publicUrl` derivada de `r2_public_url` deve ser exposta.
6. **Validação de entrada obrigatória** em toda rota nova: `params`/`querystring`/`body` no JSON Schema da rota, e quando o valor vier como string (querystring) e precisar virar número/data, valide explicitamente (`isNaN`, range) antes de usar — como já feito em `listEstablishmentsController` para `latitude`/`longitude`/`minRating`/`page`/`limit`.
7. **Erros internos nunca vazam para o cliente**: qualquer exceção não mapeada vira `500 { message: "Internal server error" }` genérico; detalhes vão só para `console.error`. (Idealmente migrar para `request.log.error` como nos outros serviços, mas seguir o padrão já presente no arquivo que você está editando.)
8. **CORS**: `origin` só é aberto para uma lista explícita vinda de `env.CORS_ORIGIN` (split por vírgula) — nunca hardcode `*` ou lista aberta no código.
9. **Segredos**: `JWT_SECRET`, `DATABASE_URL`, `SERP_API_KEY`, credenciais R2 sempre via env/secret do k8s, nunca hardcode. Este serviço não tem `.env.example` — se for criar um, siga o padrão de placeholders do `auth-service`.
10. **`NetworkPolicy`** (`k8s/networkpolicy.yaml`) já restringe egress a Kafka, Postgres, Redis e HTTPS externo (para o R2, que é fora do cluster). Qualquer nova dependência de rede externa (nova API, novo serviço interno) precisa de uma entrada de egress correspondente aqui, senão a chamada será bloqueada em produção mesmo que funcione localmente.

---

## Performance — obrigatório em qualquer alteração

Este serviço sustenta buscas geoespaciais e listagens de estabelecimentos em alta concorrência. Ao alterar código:

1. **Cache-aside com deduplicação de requisições em voo é o padrão**: use `cacheAside(key, ttlSeconds, fetchFn)` para toda leitura pesada/repetida (perfil, lista, "abertos agora", "próximos"). O `inFlight` Map dentro de `cacheAside` já evita que N requisições simultâneas para a mesma chave gerem N queries ao banco — não duplique essa lógica manualmente em um service novo, reaproveite `cacheAside`.
2. **Busca geoespacial hoje é bounding box + Haversine em memória, sem índice espacial** (`BOUNDING_BOX_DEG` em `establishment.service.ts`, `deltaLat`/`deltaLon` em `listEstablishment.service.ts`) — funciona para o volume atual, mas **não escala linearmente para milhões de estabelecimentos**: o bounding box ainda faz `findMany` sem paginação no banco antes de filtrar/ordenar em memória. Se for expandir esse fluxo (raio maior, mais filtros, mais volume), considere sinalizar a necessidade de uma extensão espacial (PostGIS / `earthdistance`) com índice geográfico antes de simplesmente aumentar o alcance da query atual.
3. **Invalidação de cache é sempre best-effort** (`redis.del(...).catch(() => {})`) — nunca deixe uma falha de invalidação de cache derrubar a resposta de uma mutação.
4. **`invalidateNearbyEstablishmentCache` usa `redis.keys("establishments:nearby:*")`** — `KEYS` é O(N) e bloqueia o Redis proporcionalmente ao total de chaves; está ok no volume atual, mas se o namespace de chaves crescer muito, considere migrar para um padrão de invalidação por índice (ex.: `SCAN` ou manter um `SET` das chaves ativas) antes de aumentar a frequência de chamadas dessa função.
5. **Evitar N+1**: uma query com `include`/`select` restrito (ver `getEstablishmentProfile` trazendo `openingHours` via `include` numa única query) em vez de N queries por relação.
6. **Paginação obrigatória em listagens**: `listEstablishments` já pagina (`take`/`skip` + `count` em paralelo via `Promise.all` no caminho sem geolocalização) — qualquer endpoint novo de listagem deve nascer paginado.
7. **Consultas SQL raw (`$queryRaw`) só quando o Prisma Client não expressa bem a lógica** (ver `listOpenEstablishments`, que usa SQL puro para checar janela de horário com virada de dia) — mantenha esse padrão isolado e comentado, evite espalhar SQL raw por outros services sem necessidade equivalente.
8. **Índices do Prisma** (`category`, `averageRating`, `[latitude, longitude]`, `name`) sustentam os filtros atuais — qualquer novo campo de filtro/ordenação frequente precisa de índice equivalente na migration.
9. **Upload para R2 é sempre via stream** (`Upload` do `@aws-sdk/lib-storage` consumindo um `Readable`/`PassThrough`), nunca carregando o arquivo inteiro em memória antes de enviar — preserve esse padrão em qualquer novo endpoint de upload.
10. **Métricas Prometheus (`/metrics`) já capturam método/rota/status/duração de toda requisição** via hooks globais (`onRequest`/`onResponse` em `server.ts`) — não adicione instrumentação duplicada por rota; se precisar de uma métrica de negócio nova (ex.: uploads por minuto), registre um `Counter`/`Histogram` novo em `src/config/metrics.ts` e reutilize o `register` existente.

---

## Testes

- `npm test` — unit (`src/**/__tests__/*.test.ts` + `tests/**/*.spec.ts`, excluindo `tests/integration/**`)
- `npm run test:integration` — roda `tests/integration/**/*.spec.ts` (timeout 30s, execução sequencial via `sequence: { concurrent: false }`)
- `npm run test:coverage` — usa `vitest.coverage.config.ts` com `projects` (`unit` + `integration` no mesmo run) e thresholds mínimos: **70% linhas, 70% funções, 60% branches** sobre `src/services`, `src/controllers`, `src/routes.ts` — não reduza esses thresholds para fazer um PR passar.
- `tests/helpers/fastify.test.helper.ts` registra JWT no app de teste com um secret fixo (`unit-test-secret-key-min-length`) — se uma rota nova depender de `authenticate`, gere um token válido com esse mesmo secret no teste.

Toda feature nova precisa de: teste unitário do service (incluindo os branches de erro por código/mensagem), teste unitário do controller, e teste de integração da rota (incluindo o caso autenticado/não autenticado, se aplicável).

---

## Variáveis de Ambiente

Toda variável de ambiente é validada por `zod` em `src/config/env.ts` (`envSchema.safeParse(process.env)`, processo encerra com `process.exit(1)` se inválida) — ao adicionar uma env var nova, adicione-a ao `envSchema` com o tipo/validação correta (`z.string().url()`, `z.coerce.number()`, `z.enum([...])`, etc.) em vez de ler `process.env` direto em outro arquivo. Propague no `k8s/deployment.yaml` (via `envFrom`/`secretRef`/`configMapRef`) e, se a variável for de rede externa nova, atualize também o `k8s/networkpolicy.yaml`.

---

## Infra deste Serviço

- `Dockerfile`: build em 2 estágios; `prisma generate` roda no build com uma `DATABASE_URL` **placeholder** (não a real — o schema não depende de conexão real para gerar o client); `CMD` roda `npx prisma migrate deploy && node dist/server.js` (mesmo padrão do `auth-service`: migration aplicada automaticamente no start do container, diferente do `user-service`).
- `k8s/`: `deployment.yaml` (`replicas: 1`, `readinessProbe` em `/health/ready` checando DB + Redis, `livenessProbe` em `/health`), `hpa.yaml` (`minReplicas: 1` / `maxReplicas: 4`, CPU 70% / memória 80%, `stabilizationWindowSeconds` assimétrico: 60s scale-up / 120s scale-down — mesmo padrão do `event-service`), `pdb.yaml` (`minAvailable: 1`), `service.yaml`, e **`networkpolicy.yaml`** (único entre os serviços documentados até agora — restringe ingress/egress a nível de pod).
- `SWAGGER_ENABLED` controla se a documentação Swagger fica exposta — verifique esse flag antes de assumir que `/docs` está sempre disponível em produção.
- Sem `.env.example` neste serviço hoje — se for adicionar uma env var nova relevante para rodar localmente, considere criar um alinhado ao padrão do `auth-service`.
