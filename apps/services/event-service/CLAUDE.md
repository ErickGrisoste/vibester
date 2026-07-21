# Event Service

> Contexto específico do microserviço de eventos (festas, shows, agenda de estabelecimentos) do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este serviço não tem `AppError`, não tem Kafka (nem produtor, nem consumidor), valida env manualmente (sem Zod) e usa Zod só nas rotas — é o mais próximo do `user-service` em estilo de rota, mas com particularidades próprias (ver Segurança/Performance). Não copie padrões de outro serviço para cá sem verificar contra o código deste diretório.

---

## Responsabilidade do Serviço

O `event-service` é responsável exclusivamente por:

- criação e detalhes de eventos (`Event`: nome, categoria, organizador, local, foto, datas, coordenadas, link de ingresso, vínculo com um `establishmentId`);
- descoberta de eventos: por proximidade geográfica (`/events/nearby`), por estabelecimento, por semana (`/events/week`) e em destaque (`/events/featured`, controlado por `isFeatured`);
- check-in/check-out de presença de usuários em eventos (`EventCheckIn`) e contagem de confirmados (`totalConfirmed`).

O `establishmentId` de um evento é apenas uma string recebida do chamador — este serviço **não valida** se o estabelecimento existe de fato (não há chamada síncrona nem consumo de evento Kafka do `establishment-service` para isso). Da mesma forma, `userId` no check-in é um identificador opaco confiado ao chamador; este serviço não possui dados de perfil.

Nunca adicione regras de negócio de autenticação, perfil de usuário, estabelecimento (cadastro, avaliação, movimento) ou pagamento aqui. Se uma feature parece pertencer a outro domínio, ela deve ser feita no serviço correspondente e comunicada via Kafka.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/cors`, `@fastify/jwt`, `@fastify/swagger` (+ `swagger-ui`)
- **`@fastify/type-provider-zod`** — todas as rotas usam `app.withTypeProvider<ZodTypeProvider>()` com schemas Zod declarados no topo de `src/controllers/event.controller.ts` (mesmo padrão do `user-service`; diferente do `establishment-service`, que usa JSON Schema puro).
- Prisma 7 com `@prisma/adapter-pg` (driver adapter sobre `pg.Pool`, `max: 5` — menor que o pool do `auth-service`, `max: 10`)
- PostgreSQL
- Redis (`ioredis`) — usado **apenas** como cache-aside de leitura (`cacheAside` em `src/config/redis.ts`); diferente do `establishment-service`, aqui não há deduplicação de requisições em voo (`inFlight`) nem uso de Redis como store de rate limit (não há `@fastify/rate-limit` neste serviço).
- **Sem Kafka**: não há `kafkajs` nas dependências, nem pasta `src/kafka/`. O serviço não produz nem consome nenhum evento — isso é uma exceção real dentro do monorepo (os outros três serviços documentados produzem e/ou consomem Kafka). Ao criar um evento ou fazer check-in, nenhum outro serviço (feed, notification) é avisado de forma assíncrona hoje.
- **Sem Zod para validação de env**: `src/config/env.ts` usa um helper manual `required(key)` que lança `Error` se a variável obrigatória estiver ausente — mais simples que o `safeParse` do `establishment-service` e sem qualquer validação de formato (não checa se `DATABASE_URL` é uma URL válida, por exemplo).
- **Sem `AppError`**: erros esperados são `throw new Error("mensagem em português")` (ex.: `"Evento não encontrado"`, `"Usuário já fez check-in neste evento"`), comparados por igualdade de string no controller (`error.message === "..."`) ou por código do Prisma (`P2025`, `P2002`) — mesmo estilo do `establishment-service`, sem introduzir uma classe de erro nova.
- Vitest para testes (unit co-localizado em `src/services/__tests__` + integration via `app.inject`), `ioredis-mock` para mockar Redis

Não introduza um ORM alternativo, outro cliente Redis, `AppError`, Kafka ou `@fastify/rate-limit` sem necessidade real e alinhamento explícito — reutilize o que já existe.

---

## Estrutura de Pastas

```
src/
  config/        env.ts (validação manual via required()), redis.ts (cacheAside, nearbyKey, invalidateNearbyCache), swagger.ts
  controllers/   event.controller.ts       → único arquivo, contém TODOS os schemas Zod e TODAS as rotas de /events (não há um controller por feature)
  services/      createEvent, listEvents (geolocalização + Haversine), getEventDetails, getEventsByEstablishment,
                 getFeaturedEvents, getEventsByWeek, toggleFeatured, checkIn, listUserCheckIns, checkUserCheckIn
    __tests__/   → testes unitários co-localizados (Vitest), um arquivo por service
  prisma/        index.ts                  → singleton do PrismaClient com adapter pg.Pool (max 5)
  types/         event.types.ts (inputs de create/update/list), fastify-jwt.d.ts (augmenta payload/user do @fastify/jwt)
  generated/prisma/client/                 → cliente Prisma gerado, comitado no repo (diferente dos outros serviços, que ignoram essa pasta no .gitignore)
  generate-spec.ts                         → script auxiliar (fora do runtime) que gera um openapi.json estático a partir das rotas
  routes.ts                                → GET /health (checa db + redis), registra eventRoutes com prefix /events
  server.ts                                → bootstrap Fastify, CORS, JWT, swagger, listen na porta 3334
tests/
  helpers/       fastify.test.helper.ts    → buildServer (registra JWT com secret fixo "test-secret") + generateToken
  integration/    event.integration.spec.ts → mocka Prisma inline via vi.mock + vi.hoisted, mocka Redis via ioredis-mock
  mocks/          prisma.client.ts          → mock de Prisma não referenciado por nenhum teste hoje (arquivo órfão — o spec de integração define seu próprio mock inline); não assuma que ele está em uso antes de alterá-lo
  setup/          vitest.setup.ts           → mocka src/config/env com valores fixos de teste
```

Não existe `prisma/migrations/` neste repositório (nem comitado, nem presente localmente) — ver seção Infra.

### Padrão de uma feature nova

1. Se precisar de input/output novo, adicionar em `types/event.types.ts`.
2. `services/<feature>.service.ts` — uma classe, um método por operação (ou funções soltas como `calculateDistance` em `listEvents.service.ts` quando fizer sentido reaproveitar fora da classe). Erros esperados são `throw new Error("mensagem em português")` ou deixam o Prisma lançar (`P2025` para not-found, `P2002` para conflito de unicidade) — **não introduza `AppError`** aqui sem alinhar com os demais serviços do monorepo, que já divergem entre si nesse ponto.
3. Em `controllers/event.controller.ts`: declarar o schema Zod do `body`/`params`/`querystring`/`response` no topo do arquivo (junto aos demais), registrar a rota via `router.get/post/patch/delete(...)` com `app.withTypeProvider<ZodTypeProvider>()`, e no handler fazer `try/catch` que:
   - mapeia mensagens de erro conhecidas (`error.message === "Evento não encontrado"`) para o status HTTP correto;
   - qualquer erro não mapeado vira `request.log.error(error)` + `500 { message: "Error <ação em inglês>" }` genérico — mensagens de domínio (404/409) ficam em português, a mensagem de fallback do 500 fica em inglês; siga essa mesma inconsistência já existente em vez de tentar unificar o idioma sozinho no meio de uma tarefa não relacionada.
4. Se a rota for uma mutação sensível (cria/altera dado, ex. `POST /`, `PATCH /:eventId/featured`), adicionar `preHandler: [authenticate]` (função local já definida no topo do controller) e `security: [{ bearerAuth: [] }]` no schema — mas veja a seção de Segurança antes de assumir que isso é suficiente.
5. Toda leitura pesada/frequente deve passar por `cacheAside(key, ttlSeconds, fetchFn)` (ver padrão de chaves `event:id:*`, `event:establishment:*`, `event:featured`, `event:week:*`, `events:nearby:*`), e toda mutação que invalida um desses dados deve apagar a(s) chave(s) correspondente(s) — ver o alerta de invalidação inconsistente na seção de Performance antes de assumir que isso já está garantido em todos os fluxos.
6. Testes unitários do service (em `src/services/__tests__`, mockando Prisma/Redis via `vi.mock` + `vi.hoisted`) + teste de integração da rota em `tests/integration/event.integration.spec.ts`.

---

## Segurança — obrigatório em qualquer alteração

1. **Check-in e check-out (`POST`/`DELETE /:eventId/checkin`) não têm `preHandler: [authenticate]`** — são as únicas rotas de mutação do serviço sem JWT. O `userId` vem só do body (`checkInBodySchema`, `z.string().uuid()`), sem qualquer verificação de que o chamador é de fato esse usuário. Hoje, qualquer chamador com acesso de rede ao serviço pode fazer check-in/check-out de **qualquer** `userId` em **qualquer** evento, e consultar `GET /checkins/:userId` ou `GET /:eventId/checkin/:userId` para qualquer usuário. Ao alterar esse fluxo, não assuma que existe alguma verificação de identidade por trás — se for expor a rota diretamente a clientes finais (e não só via gateway/BFF confiável), essa checagem precisa ser adicionada como parte da tarefa.
2. **`authenticate` só verifica que o token é válido, nunca quem é o titular.** Mesmo nas rotas que já têm `preHandler: [authenticate]` (`POST /` criar evento, `PATCH /:eventId/featured`), `request.user` (payload do JWT) nunca é lido em nenhum service ou controller — não há checagem de papel (role) nem de dono do recurso. Qualquer token válido pode criar um evento para qualquer `establishmentId` ou alternar o destaque de qualquer evento. Se uma rota nova precisar restringir por dono/role, isso precisa ser implementado do zero — não existe hoje.
3. **`establishmentId` não é validado contra o `establishment-service`** — um evento pode ser criado com um `establishmentId` inexistente ou de outro tenant sem erro. Se essa integridade passar a importar, ela precisa vir de fora (gateway) ou de um evento Kafka que hoje não existe.
4. **Validação de entrada via Zod é obrigatória** em toda rota nova (`body`/`params`/`querystring`), seguindo os schemas já existentes (`.uuid()`, `.url()`, `.datetime()`, `.date()`, `min`/`max` de string) — é a primeira defesa contra payload malformado.
5. **Erros internos nunca vazam para o cliente**: qualquer exceção não mapeada vira `request.log.error(error)` + `500 { message: "..." }` genérico em inglês — nunca stack trace ou detalhe interno na resposta.
6. **Mapeamento de erro por igualdade de string é frágil**: os `if (error.message === "Evento não encontrado")` no controller dependem do texto exato lançado no service. Se renomear uma mensagem de erro em um service, o controller correspondente para de mapear para o status certo (vira 500 silenciosamente) — ao alterar uma mensagem de erro, atualize os dois lados juntos.
7. **CORS**: `origin` vem de `env.allowedOrigins` (`ALLOWED_ORIGINS`, separado por vírgula), com fallback hardcoded para `"https://vibester.com.br"` se a env não for definida — nunca hardcode `*` nem abra a lista no código; garanta que `ALLOWED_ORIGINS` esteja setado explicitamente em cada ambiente de deploy.
8. **Segredos**: `JWT_SECRET` e `DATABASE_URL` são obrigatórios (`required()` lança na subida do processo se ausentes) — nunca hardcode um valor default para eles fora dos testes (que usam `"test-secret"` fixo em `tests/helpers/fastify.test.helper.ts` e `tests/setup/vitest.setup.ts`). Este serviço não tem `.env.example` — se for criar um, siga o padrão de placeholders do `auth-service`.
9. Antes de fechar qualquer tarefa que mexa em check-in, autenticação ou nas rotas de criação/destaque de evento, considere sugerir `/security-review` ao usuário, dado o gap de autorização descrito nos itens 1 e 2.

---

## Performance — obrigatório em qualquer alteração

Este serviço sustenta descoberta de eventos (geolocalização, destaque, agenda semanal) e check-in em alta concorrência. Ao alterar código:

1. **Cache-aside é o padrão para leitura**: `cacheAside(key, ttlSeconds, fetchFn)` já cobre detalhes do evento (`event:id:{id}`, 300s), eventos por estabelecimento (`event:establishment:{id}`, 120s), destaque (`event:featured`, 60s), semana (`event:week:{data}`, 120s) e proximidade (`events:nearby:{lat}:{lon}:{raio}`, 90s, chave arredondada a ~1km via `nearbyKey`). Toda leitura nova de alto tráfego deve seguir o mesmo padrão. Diferente do `establishment-service`, **não há deduplicação de requisições em voo** — várias requisições concorrentes para a mesma chave fria podem gerar múltiplas queries simultâneas ao Postgres (cache stampede); se isso virar um problema real em produção, reaproveite o padrão `inFlight` já existente no `establishment-service` em vez de inventar um novo.
2. **Invalidação de cache é inconsistente entre mutações — cuidado ao tocar em qualquer uma delas**:
   - `createEvent.service.ts` invalida corretamente `event:establishment:{id}` e todas as chaves `events:nearby:*` (via `invalidateNearbyCache`) depois de criar o evento.
   - `checkIn.service.ts` tem a invalidação de `event:id:{eventId}` **comentada** (`//await redis.del(...)`) tanto em `checkIn` quanto em `checkOut` — ou seja, `totalConfirmed` retornado por `GET /:eventId` pode ficar desatualizado por até 300s (TTL do cache de detalhes) após cada check-in/check-out. Se for mexer nesse fluxo, descomente/corrija essa invalidação em vez de assumir que o cache já está correto.
   - `toggleFeatured.service.ts` **não invalidação nenhuma cache** — nem `event:id:{id}` nem `event:featured`. Alternar `isFeatured` pode demorar até 60s (lista de destaque) ou 300s (detalhe) para refletir.
   - Ao adicionar uma mutação nova, identifique todas as chaves de leitura afetadas e invalide todas explicitamente — não copie apenas o padrão de uma mutação vizinha sem checar se ela já tem esse bug.
3. **Busca geoespacial (`listEvents.service.ts`) é bounding-box (usando o índice composto `@@index([latitude, longitude])`) + Haversine exato em memória** — mesmo padrão do `establishment-service`: funciona no volume atual, mas não escala linearmente para milhões de eventos porque o bounding box ainda faz `findMany` sem paginação antes de filtrar em memória. Se for expandir esse fluxo (raio maior, mais filtros, mais volume), considere sinalizar a necessidade de uma extensão espacial (PostGIS/`earthdistance`) antes de simplesmente aumentar o alcance da query atual.
4. **Listagens sem paginação**: `getEventsByEstablishment`, `getFeaturedEvents`, `getEventsByWeek` e `listUserCheckIns` fazem `findMany` sem `take`/`skip` — aceitável no volume atual, mas nenhuma delas está preparada para um estabelecimento/usuário com milhares de eventos/check-ins. Qualquer expansão significativa de volume nessas listagens deve nascer paginada, não ser otimizada depois.
5. **Transações atômicas via `$transaction` em array** (`checkIn`/`checkOut` fazem `create`/`delete` do `EventCheckIn` + `increment`/`decrement` de `totalConfirmed` numa única transação) — reutilize essa forma para qualquer nova mutação que precise atualizar múltiplas linhas relacionadas de forma atômica, em vez de escritas sequenciais.
6. **Pool de conexões do Postgres é compartilhado e pequeno** (`max: 5` em `src/prisma/index.ts`) — não abra pools adicionais; se o serviço crescer em tráfego (o `hpa.yaml` já permite até 4 réplicas), reavalie esse valor junto com o limite de conexões do Postgres antes de simplesmente aumentar réplicas.
7. **Sem Kafka**: efeitos colaterais de criação/check-in não são propagados de forma assíncrona a outros serviços hoje — se uma feature nova precisar notificar feed/notification sobre um evento novo ou um check-in, isso ainda precisa ser desenhado (produtor Kafka), não existe hoje.
8. Ao adicionar rota nova, pense no custo em alta volumetria (milhões de eventos/check-ins) desde o design da query, não como otimização posterior.

---

## Testes

- `npm test` (`vitest run`) — roda testes unitários (`src/**/*.test.ts`, co-localizados em `src/services/__tests__`) e de integração (`tests/**/*.spec.ts`)
- `npm run test:coverage` — cobertura de `src/services`, `src/controllers`, `src/routes.ts` com thresholds mínimos: **70% linhas, 70% funções, 60% branches** — não reduza esses thresholds para fazer um PR passar; escreva o teste que falta.
- Testes de integração (`tests/integration/event.integration.spec.ts`) mockam Prisma **inline** via `vi.mock("../../src/prisma/index", ...)` + `vi.hoisted`, e Redis via `ioredis-mock` — não usam o arquivo `tests/mocks/prisma.client.ts` (que hoje não é referenciado por nenhum teste; verifique antes de assumir que ele está em uso ou de removê-lo).
- `tests/helpers/fastify.test.helper.ts` registra JWT com secret fixo `"test-secret"` — se uma rota nova depender de `authenticate`, gere um token válido com `generateToken(app)` (assina `{ sub: "test-user-id" }`) no teste.
- `tests/setup/vitest.setup.ts` mocka `src/config/env` com valores fixos — qualquer env nova usada em `env.ts` deve ser adicionada aqui também, senão os testes que dependem dela vão quebrar silenciosamente ou usar `undefined`.

Toda feature nova precisa de: teste unitário do service (incluindo os branches de erro por mensagem/código Prisma), e teste de integração da rota (incluindo o caso autenticado/não autenticado quando a rota usar `authenticate`, e os casos de cache hit/miss quando a rota usar `cacheAside`).

---

## Variáveis de Ambiente

Toda variável de ambiente é lida em `src/config/env.ts` através do helper `required(key)` (lança `Error` na subida do processo se a variável obrigatória estiver ausente) ou de um acesso direto a `process.env` com fallback (`PORT`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `ALLOWED_ORIGINS`) — não leia `process.env` diretamente em outro arquivo; centralize em `env.ts`, seguindo esse mesmo padrão (sem validação de formato via Zod, diferente do `establishment-service`). Propague qualquer variável nova no `k8s/deployment.yaml` (via `envFrom.secretRef`/`configMapRef`). Este serviço não tem `.env.example` — se for criar um, siga o padrão de placeholders do `auth-service`.

---

## Infra deste Serviço

- `Dockerfile`: build em 2 estágios (`builder` roda `prisma generate` + `npm run build`; `runtime` copia `dist/`, o cliente Prisma gerado e `prisma/` + `prisma.config.ts`); `CMD` roda `prisma migrate deploy && node dist/server.js` — **porém não existe `prisma/migrations/` neste repositório** (nem comitado no git, nem presente localmente; `.gitignore` tem `/prisma/migrations`). Isso significa que `prisma migrate deploy` hoje não tem nenhuma migration para aplicar — o schema real do banco em produção precisa ter sido criado por outro meio (`prisma db push`, script manual, ou migrations geradas fora deste checkout). Antes de assumir que o deploy automático cria/atualiza o schema a partir de uma migration nova, confirme como o schema de produção foi de fato provisionado, e considere gerar e comitar uma migration real (`prisma migrate dev`) em vez de depender de `db push` para mudanças de schema que forem além do ambiente local.
- `src/generated/prisma/client/` é **comitado no repositório** (diferente dos outros três serviços documentados, que ignoram essa pasta) — ao rodar `prisma generate` localmente, cheque o diff antes de commitar, para não versionar uma geração acidentalmente divergente do `schema.prisma`.
- `k8s/`: `deployment.yaml` (`replicas: 1`, probes em `/health` tanto para readiness quanto para liveness — não há um endpoint `/health/ready` separado como no `establishment-service`), `hpa.yaml` (min 1 / max 4 réplicas, CPU 70% / memória 80%, com `stabilizationWindowSeconds` assimétrico: 60s scale-up / 120s scale-down), `pdb.yaml` (`minAvailable: 1`), `service.yaml` (ClusterIP). Sem `networkpolicy.yaml` neste serviço.
- `GET /health` retorna `503` apenas se o Postgres estiver indisponível — se o Redis estiver indisponível, o campo `redis` reporta `"unavailable"` mas o status HTTP continua `200`/`"ok"` (o serviço é projetado para degradar sem cache, não para ficar indisponível por causa do Redis). Não mude esse comportamento sem entender que ele é intencional (cache é best-effort neste serviço).
- `SWAGGER_ENABLED` controla se `/docs` fica exposto — verifique esse flag antes de assumir que a documentação Swagger está sempre disponível em produção. `src/generate-spec.ts` é um script auxiliar (fora do runtime do servidor) que força `SWAGGER_ENABLED=true` para gerar um `openapi.json` estático a partir das mesmas rotas.
