# Auth Service

> Contexto específico do microserviço de autenticação do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.

---

## Responsabilidade do Serviço

O `auth-service` é responsável exclusivamente por:

- registro de contas (fluxo com verificação de email por código);
- verificação de email e criação definitiva da conta (`Access`);
- login e emissão de token JWT.

Ele **não** possui dados de perfil do usuário (nome público, avatar, bio etc.) — isso é responsabilidade do `user-service` (`PROFILE_SERVICE_URL`). O auth-service apenas guarda credenciais (`accountId`, `username`, `email`, `passwordHash`) na tabela `accesses`.

Nunca adicione regras de negócio de perfil, feed, eventos ou pagamento aqui. Se uma feature parece pertencer a outro domínio, ela deve ser feita no serviço correspondente e comunicada via Kafka.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/cors`, `@fastify/rate-limit`, `@fastify/swagger` (+ `swagger-ui`)
- Prisma 7 com `@prisma/adapter-pg` (driver adapter sobre `pg.Pool`, não a engine padrão)
- PostgreSQL
- Redis (`ioredis`) — usado como store temporário do fluxo de verificação de email (`pending:reg:{email}`), com TTL
- Kafka (`kafkajs`) — produtor apenas (`auth.email.verification`), sem consumidores neste serviço
- `bcryptjs` para hash de senha, `jsonwebtoken` para JWT
- `zod` está nas dependências, mas a validação de schema atual é feita via JSON Schema do Fastify (`schema.body`) nas rotas — se for adicionar validação nova, veja a seção de Convenções antes de decidir entre os dois.
- Vitest para testes (unit + integration com `app.inject`), k6 para testes de carga/stress

Não introduza um ORM alternativo, outro cliente Redis/Kafka, ou uma lib de hashing/JWT diferente sem necessidade real — reutilize o que já existe.

---

## Estrutura de Pastas

```
src/
  config/        env.ts, redis.ts, swagger.ts        → configuração/infra, sem lógica de negócio
  controllers/   *.controller.ts                      → HTTP-only: parse do body, chama service, mapeia erro → status code
  services/      *.service.ts                          → regra de negócio, acesso a Prisma/Redis/Kafka/fetch externo
  errors/        app-error.ts                          → AppError(message, statusCode)
  kafka/         producer.ts                           → singleton lazy do producer
  prisma/        index.ts                              → singleton do PrismaClient com adapter pg.Pool
  types/         *.types.ts                             → interfaces de input/output por feature
  routes.ts                                            → registro de rotas + schema Fastify (JSON Schema, tags Swagger, rate limit por rota)
  server.ts                                            → bootstrap Fastify, plugins, connect/disconnect de infra, graceful shutdown
tests/
  unit/                 → mocka Prisma/Redis/Kafka/bcrypt/jwt (ver tests/mocks)
  integration/           → sobe app via app.inject (tests/helpers/fastify.test.helper.ts), com mocks de infra
  integration-real/      → contra infra real (config própria: vitest.integration.config.ts, singleFork)
  mocks/, factories/, helpers/  → utilitários compartilhados de teste
  k6/                    → cenários de performance/stress/breakpoint
```

### Padrão de uma feature nova

1. `types/<feature>.types.ts` — interfaces de input/output.
2. `services/<feature>.service.ts` — uma classe, lógica de negócio, lança `AppError(message, statusCode)` para erros esperados.
3. `controllers/<feature>.controller.ts` — uma classe, instancia o(s) service(s) como `private readonly`, try/catch que:
   - repassa `AppError` como `{ error: error.message }` com `error.statusCode`;
   - loga qualquer outro erro (`request.log.error(error)`) e responde `500 { error: "Erro interno do servidor" }` genérico (nunca vaza stack/mensagem interna ao cliente).
4. `routes.ts` — registra a rota com `schema` completo (tags, summary, description, `body` e `response` em JSON Schema, incluindo os status de erro documentados) e `config.rateLimit` próprio quando o endpoint é sensível (auth, escrita, envio de email).
5. Testes unitários do service e do controller + teste de integração da rota em `tests/integration`.

Mensagens de erro voltadas ao usuário são em **português**, curtas, sem detalhes de implementação.

---

## Segurança — obrigatório em qualquer alteração

Este é o serviço de autenticação: qualquer falha de segurança aqui compromete toda a plataforma. Ao adicionar ou alterar qualquer código:

1. **Nunca retornar `passwordHash` ou qualquer segredo** em uma resposta HTTP, log, ou evento Kafka. Sempre usar `select` do Prisma para restringir campos quando não precisar da entidade inteira (ex.: `select: { id: true }` já usado em `register.service.ts`).
2. **Senhas sempre via `bcryptjs`** (`hash`/`compare`), nunca comparação direta ou hashing próprio. Manter o custo de hash atual (10) a menos que haja justificativa explícita para mudar.
3. **JWT**: sempre assinar com `env.jwtSecret` e `expiresIn` configurável via env; nunca hardcode secret; nunca incluir dados sensíveis no payload (hoje só `userId`/`accountId`, manter minimalista).
4. **Rate limiting por rota**: toda rota nova de autenticação, envio de email/código, ou qualquer endpoint que possa ser usado para enumeração de usuários ou brute-force **precisa** de um `config.rateLimit` dedicado (seguir o padrão de `env.rateLimit<Feature>Max`), além do rate limit global do `server.ts`.
5. **Enumeração de usuários**: nunca revelar se um email/username existe através de mensagens de erro diferentes (ex.: login usa a mesma mensagem genérica "Usuário ou senha inválidos" para usuário inexistente e senha errada — manter esse padrão em qualquer fluxo novo).
6. **Códigos de verificação**: gerar com `randomInt`/`randomUUID` de `node:crypto` (nunca `Math.random`), sempre com TTL no Redis, e invalidar (`redis.del`) imediatamente após uso bem-sucedido.
7. **Validação de entrada**: todo body de rota precisa de JSON Schema no Fastify (`required`, tipos, `format: "email"`, `minLength`/`maxLength`) — é a primeira camada de defesa contra payload malformado/malicioso.
8. **Chamadas HTTP externas** (ex.: `profileServiceUrl`): sempre com timeout via `AbortController` (`env.fetchTimeoutMs`), nunca fetch sem timeout. Em caso de falha após efeitos colaterais já aplicados (ex.: conta já criada), fazer rollback explícito (ver `email-verification.service.ts`, que deleta o `Access` criado se o profile service falhar).
9. **Erros internos nunca vazam para o cliente**: qualquer exceção não esperada deve virar `500 { error: "Erro interno do servidor" }` genérico; detalhes vão só para `request.log.error`.
10. **CORS**: `origin` sempre vindo de `env.corsOrigin`, nunca hardcode `*` ou lista aberta em código.
11. **Segredos**: nunca commitar `.env` real, JWT secret, credenciais de DB/Kafka/Redis. `.env.example` deve conter apenas placeholders.
12. Antes de fechar qualquer tarefa que mexa em autenticação, registro, verificação ou tokens, rode mentalmente (ou peça) uma checagem de segurança — se a alteração for sensível o suficiente, considere sugerir `/security-review` ao usuário.

---

## Performance — obrigatório em qualquer alteração

O serviço é projetado para alta concorrência (auth é hot path). Ao alterar código:

1. **Nunca introduzir N+1**: uma verificação de existência (`findFirst` com `OR`) é suficiente; não faça uma query por campo. Use `select` para trazer só os campos necessários.
2. **Reaproveitar conexões/singletons existentes**: Prisma (`src/prisma/index.ts`), Redis (`src/config/redis.ts`) e Kafka producer (`src/kafka/producer.ts`) já são singletons lazy — nunca instancie um novo `PrismaClient`, `Redis` ou `Kafka` client em um service/controller. Se precisar de um novo client de infra, siga o mesmo padrão singleton lazy + `connect`/`disconnect` explícitos.
3. **Operações de I/O em paralelo quando não há dependência entre elas** (`Promise.all`), nunca sequenciais sem necessidade.
4. **Redis para estado efêmero/hot data** (como o fluxo de verificação de email) em vez de ida ao Postgres, sempre com TTL explícito — nunca deixar chave sem expiração.
5. **Kafka para efeitos colaterais assíncronos** (disparo de email, eventos para outros serviços) em vez de chamada síncrona bloqueante, seguindo a diretriz da raiz de preferir comunicação orientada a eventos.
6. **Timeout em toda chamada de rede externa** (`fetchTimeoutMs`) para não segurar conexões/threads do event loop em caso de serviço downstream lento.
7. **Índices únicos do Prisma** (`@unique` em `accountId`, `username`, `email`) sustentam os `findFirst`/`create` atuais — qualquer novo campo de busca frequente precisa de índice equivalente na migration.
8. **Pool de conexões do Postgres é compartilhado** (`pool` em `src/prisma/index.ts`, `max: 10`) — não abra pools adicionais; ajuste o `max` existente com cautela e apenas se houver dado real de saturação.
9. Ao adicionar rota nova, sempre pensar no custo em alta volumetria (milhões de contas) desde o design da query, não como otimização posterior.
10. Para mudanças que impactam hot path (login, register, verify-email), considerar rodar/atualizar os cenários de `tests/k6` (`performance.js`, `stress.js`, `breakpoint.js`) quando a alteração for relevante o suficiente.

---

## Testes

- `npm test` — unit + integration (mocka Prisma/Redis/Kafka/bcrypt/jwt via `tests/mocks`)
- `npm run test:coverage` — cobertura focada em `src/services`, `src/controllers`, `src/routes.ts`
- `npm run test:integration` — roda contra `tests/integration-real` (infra real, `singleFork`, timeout de 30s) — não confundir com `tests/integration` (que usa mocks + `app.inject`)
- `tests/k6/run.sh` — testes de carga/stress/breakpoint

Toda feature nova precisa de: teste unitário do service, teste unitário do controller (incluindo o branch de erro), e teste de integração da rota. Reaproveite os mocks/factories existentes em vez de criar variantes ad-hoc.

---

## Variáveis de Ambiente

Todo valor de configuração novo deve passar por `src/config/env.ts` (nunca ler `process.env` direto em outro arquivo), com um default sensato quando fizer sentido, e ser propagado no `k8s/deployment.yaml` (via `env` direto, `configMapKeyRef` para config compartilhada entre serviços, ou `secretRef`/`envFrom` para segredo) e no `.env.example` (com placeholder, nunca valor real).

---

## Infra deste Serviço

- `Dockerfile`: build multi-stage simples (`npm install --ignore-scripts` → `prisma generate` → `tsc` → `npm prune --omit=dev`); start roda `prisma migrate deploy` antes do `npm start` — qualquer migration nova precisa ser compatível com deploy automático sem intervenção manual.
- `k8s/`: `deployment.yaml` (probes em `/health`, recursos limitados, `RollingUpdate` com `maxUnavailable: 1`), `hpa.yaml` (min 2 / max 6 réplicas, CPU 60% / memória 75%), `pdb.yaml`, `service.yaml`. Qualquer nova env var sensível deve ir via secret, nunca em texto plano no manifest.
- Métricas Prometheus estão desabilitadas (`prometheus.io/scrape: "false"`) — se for adicionar observabilidade, isso precisa ser revisitado explicitamente, não assumido como já ativo.
