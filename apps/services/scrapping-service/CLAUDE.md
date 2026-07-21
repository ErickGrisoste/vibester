# Scrapping Service

> Contexto específico do microserviço de scraping/estimativa de movimento de estabelecimentos do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este serviço é, na prática, um **worker com cron interno** (não um serviço HTTP CRUD como os outros três já documentados). A superfície HTTP existe apenas como camada auxiliar (health check, consulta pontual, endpoint utilitário de descoberta de lugares) — o núcleo do serviço é o job agendado em `src/jobs/movement.job.ts`. Não infle este documento com convenções de rota que não existem; e não copie padrões de `env.ts`/segurança de outro serviço sem verificar contra o código real aqui (este serviço, por exemplo, **não valida env em runtime**, diferente do `establishment-service`).

---

## Responsabilidade do Serviço

O `scrapping-service` é responsável exclusivamente por:

- rodar, a cada hora (`0 * * * *`, cron via `node-cron`, timezone `env.timezone`), um job que:
  1. busca a lista de estabelecimentos abertos no `establishment-service` via HTTP (`GET {ESTABLISHMENT_SERVICE_URL}/establishments/open`, ver `EstablishmentClient.listOpenEstablishments`);
  2. para cada estabelecimento com `googlePlaceId`, consulta a SerpAPI (engine `google_maps`) para obter popularidade ao vivo (`live_busyness_score`) e o histórico horário do dia (`popular_times`);
  3. calcula o nível de movimento (`VERY_LOW`…`VERY_HIGH`/`UNAVAILABLE`) a partir do score (`MovementService.mapScoreToMovementLevel`);
  4. quando não há score ao vivo, tenta uma **estimativa por histórico** (`getFallbackScore`: média dos últimos 7 dias para o mesmo dia da semana/hora, tabela `popular_times_daily`), marcando o registro como `isEstimated: true` / `source: "ESTIMATED"`;
  5. persiste o resultado em `current_popularity` (upsert, 1 linha por estabelecimento) e o histórico horário em `popular_times_daily`;
  6. publica um evento Kafka `establishment.movement.updated` no tópico `establishments` para cada estabelecimento processado (ver seção Kafka do `establishment-service/CLAUDE.md` — este serviço é o produtor daquele evento);
  7. remove registros de `popular_times_daily` com mais de 7 dias no início de cada execução (`cleanOldPopularTimesDaily`).
- expor uma superfície HTTP secundária (Fastify), protegida por JWT (exceto `/health`):
  - `GET /health` — checagem de banco (`SELECT 1`);
  - `GET /places/:placeId/popularity` — consulta pontual à SerpAPI por `placeId` (não passa pelo pipeline do job, não grava nada no banco);
  - `GET /movements/:establishmentId` — lê o último `current_popularity` já persistido (com cache em memória de 5 min);
  - `GET /places/nearby` — busca lugares próximos via Google Places Nearby Search (`bar`/`night_club`/`restaurant`/`cafe`), usada para descobrir candidatos a estabelecimento — não cria nada no banco, apenas retorna a lista.

**Importante**: hoje este serviço **só produz** eventos Kafka de movimento — não existe nenhuma chamada HTTP síncrona (`PATCH`/`POST`) deste serviço para o `establishment-service` no código atual (o único fetch para lá é o `GET /establishments/open` de leitura). Se o `establishment-service/CLAUDE.md` mencionar um caminho HTTP síncrono de atualização de movimento vindo daqui, verifique o código de ambos os lados antes de assumir que ele ainda existe — não reintroduza uma chamada `PATCH` "para bater com a documentação" sem confirmar a necessidade.

Nunca adicione regras de negócio de perfil de estabelecimento, autenticação, feed ou pagamento aqui. Se uma feature parece pertencer a outro domínio, ela deve ser feita no serviço correspondente e comunicada via Kafka.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/cors`, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/swagger` (+ `swagger-ui`) — usados só pela superfície HTTP secundária, não pelo job.
- **`node-cron`** — agendamento do job principal (`src/jobs/movement.job.ts`), único serviço do monorepo documentado até agora que roda um cron **dentro do próprio processo** (não há `CronJob` do Kubernetes).
- Prisma 7 com `@prisma/adapter-pg` (driver adapter sobre `pg.Pool`), mesmo padrão dos outros serviços — mas com uma particularidade: o `generator client` em `prisma/schema.prisma` usa `output = "../src/generated/prisma"` (client gerado dentro de `src/`, não no local padrão do `node_modules`), o que exige um passo extra de cópia no `Dockerfile` (ver seção Infra).
- PostgreSQL — únicas tabelas: `current_popularity` (estado atual, 1 linha por estabelecimento) e `popular_times_daily` (histórico horário, usado para a estimativa de fallback).
- Kafka (`kafkajs`) — **produtor apenas** (`establishments` / `establishment.movement.updated`), sem consumidor neste serviço (mesmo padrão do `auth-service`).
- **Sem Redis** — diferente do `user-service`/`establishment-service`; o cache é só em memória (`TTLCache`, `src/utils/cache.ts`), usado em `SerpApiService` (30 min por `placeId`) e em `MovementService.getMovementByEstablishmentId` (5 min por `establishmentId`).
- `zod` — usado **apenas** para validar a querystring de `GET /places/nearby` (`src/schemas/nearby-places.schema.ts`); **não** é usado para validar `env` (diferente do `establishment-service`) nem as demais rotas, que usam JSON Schema do Fastify.
- `src/utils/retry.ts` (`fetchWithTimeout`) — wrapper próprio sobre o `fetch` global com timeout (`AbortSignal.timeout`, default 10s) e retry com backoff exponencial (default 3 tentativas, 500ms/1s/2s) — é o único mecanismo de HTTP usado neste serviço (SerpAPI, Google Places e a chamada interna ao `establishment-service`); não há `axios`/`got`/`undici` client dedicado.
- `src/utils/logger.ts` (`AppLogger`/`consoleLogger`) — logger mínimo próprio (JSON em `stdout`/`stderr`), usado pelo job e por `MovementService`/`SerpApiService`, desacoplado do `app.log` do Fastify (para que o job funcione mesmo fora do contexto de uma request). Os controllers HTTP (`movement.controller.ts`, `place.controller.ts`), porém, ainda usam `console.error` puro em vez desse logger — inconsistência real do código atual, não um padrão a copiar para arquivo novo: prefira `AppLogger`/`request.log` em código novo.

Não introduza um ORM alternativo, outro cliente Kafka, Redis, ou uma lib de scheduling diferente de `node-cron` sem necessidade real — reutilize o que já existe.

---

## Estrutura de Pastas

```
src/
  clients/       establishment.client.ts        → HTTP client para o establishment-service (só leitura: GET /establishments/open)
  config/        env.ts, swagger.ts             → configuração/infra; env.ts NÃO valida nada em runtime (ver Segurança)
  controllers/   movement.controller.ts, place.controller.ts  → funções exportadas (não classes), try/catch inconsistente entre elas (ver Segurança #4)
  jobs/          movement.job.ts                → agenda o cron (node-cron) que chama MovementService; guarda isRunning para não sobrepor execuções
  kafka/         producer.ts                    → singleton lazy do producer (mesmo padrão do auth-service)
  prisma/        index.ts                       → singleton do PrismaClient com adapter pg.Pool; lê DATABASE_URL/DB_POOL_MAX direto de process.env (não de config/env.ts — ver Variáveis de Ambiente)
  schemas/       nearby-places.schema.ts        → único schema Zod do serviço (querystring de /places/nearby)
  services/      movement.service.ts             → orquestra o job: busca estabelecimentos, chama SerpAPI, calcula nível, persiste, publica Kafka
                 serpapi.service.ts               → integração com SerpAPI (engine google_maps), cache TTL de 30 min
                 google-places.service.ts         → integração com Google Places Nearby Search, com paginação (next_page_token) e sleep de 2s entre páginas
    __tests__/                                   → testes unitários co-localizados (Vitest)
  types/         google-places.type.ts, place.type.ts, popularity.type.ts, serpapi.type.ts, fastify-jwt.d.ts
                 → cuidado: parte destes arquivos está desatualizada/não é importada em lugar nenhum (ver nota abaixo) — SerpApiService e MovementService declaram seus próprios tipos locais em vez de importar de types/serpapi.type.ts ou types/popularity.type.ts
  routes.ts                                      → registra /health, /places/:placeId/popularity, /movements/:establishmentId, /places/nearby
  server.ts                                      → bootstrap Fastify, connect do Kafka producer, start do movement job, graceful shutdown (para o job antes de fechar Kafka/DB)
  generate-spec.ts                               → script utilitário para gerar o JSON do OpenAPI (não faz parte do runtime)
prisma/
  schema.prisma, migrations/                     → CurrentPopularity, PopularTimesDaily
tests/
  helpers/       fastify.test.helper.ts          → buildServer via routes(), assina token de teste
  integration/   scrapping.integration.spec.ts   → único arquivo, cobre as 4 rotas via app.inject, mocka services/Prisma
  setup/         vitest.setup.ts                 → mocka src/config/env globalmente para todos os testes
scripts/
  test-update-movement.ts                        → script manual para rodar o job uma vez contra infra real (não é teste, sem assertions)
```

Existem dois arquivos soltos fora de `src/` que **não** fazem parte do padrão a seguir: `teste.ts` (raiz do serviço) é um script de debug praticamente idêntico a `scripts/test-update-movement.ts` — não o trate como referência de padrão, e prefira remover/consolidar em vez de duplicar na próxima limpeza.

### Padrão de uma feature nova

Depende do tipo de mudança:

1. **Novo dado extraído/persistido pelo job** (ex.: mais um campo do SerpAPI): adicionar no tipo local de `serpapi.service.ts` (ou no service novo, se for outra fonte), mapear em `MovementService`, e migrar `prisma/schema.prisma` com índice equivalente se o campo for usado em filtro/agregação (seguir `@@index([establishmentId, dayOfWeek, hour])` como referência). Adicionar teste unitário em `src/services/__tests__/movement.service.test.ts` seguindo o padrão de mocks já existente (`vi.hoisted` + `vi.mock` de `prisma/index` e `kafka/producer`).
2. **Nova fonte externa de scraping** (ex.: outra API além de SerpAPI/Google Places): criar `services/<fonte>.service.ts` com sua própria classe, sempre usando `fetchWithTimeout` (nunca `fetch` cru) e cache `TTLCache` se a chamada for repetitiva/cara. Nunca deixe uma falha dessa fonte derrubar o loop principal do job — sempre dentro do `try/catch` por estabelecimento em `MovementService.updateMovementLevelsFromSavedEstablishments`.
3. **Nova rota HTTP**: schema em JSON Schema (seguindo `routes.ts`) ou Zod (seguindo `nearby-places.schema.ts`, se a validação for mais rica que tipos simples) + `onRequest: [authenticate]` se a rota expõe dado sensível ou é cara de rodar (padrão de `config.rateLimit` dedicado em `/places/nearby`, que é uma chamada paga à Google). Controller como função exportada, com `try/catch` retornando `500 { message: "..." }` genérico (seguir `getPlacePopularity`, não a ausência de try/catch de `getMovementByEstablishmentId`).
4. Testes: unitário do service + teste de integração da rota em `tests/integration/scrapping.integration.spec.ts` (arquivo único hoje — pode crescer, mas siga a mesma estrutura de mocks já usada nele).

---

## Segurança — obrigatório em qualquer alteração

1. **`src/config/env.ts` não valida nada em runtime**: todo valor é lido de `process.env` com `as string`/cast direto, sem `zod.safeParse` nem qualquer checagem de presença (diferente do `establishment-service`, que falha rápido com `process.exit(1)` se a env for inválida). Isso significa que, hoje, faltar `JWT_SECRET`, `SERP_API_KEY` ou `GOOGLE_API_KEY` não impede o processo de subir — a falha só aparece depois, em runtime (ex.: `GooglePlacesService` lança `"GOOGLE_API_KEY não configurada"` só quando a rota é chamada). Ao adicionar uma env var nova crítica, pelo menos documente a dependência aqui; não assuma que existe uma validação de boot que ainda não existe.
2. **`CORS_ORIGIN` tem fallback para `"*"`** (`env.corsOrigin = process.env.CORS_ORIGIN || "*"`) — ao contrário dos outros serviços documentados, aqui o próprio código já cai para CORS aberto se a env não estiver setada. Garanta que `CORS_ORIGIN` esteja sempre definida no secret/config do k8s de produção; não dependa desse default para produção.
3. **JWT aplicado seletivamente**: todas as rotas exceto `/health` usam `onRequest: [authenticate]` (`src/routes.ts`), que faz `request.jwtVerify()` num try/catch e `reply.send(err)` em caso de falha. Preserve exatamente esse padrão (mesma função `authenticate`) em qualquer rota nova que precise de autenticação — não reimplemente a verificação inline.
4. **Tratamento de erro inconsistente entre controllers, real e não intencional**: `getPlacePopularity` e `searchNearbyPlaces` têm `try/catch` e devolvem `500 { message: "..." }` genérico; `getMovementByEstablishmentId` **não tem** `try/catch` — uma falha do Prisma nessa rota vira erro não tratado pelo handler global padrão do Fastify. Ao tocar em qualquer um desses controllers, alinhe para o padrão com `try/catch` + mensagem genérica (nunca vazar stack/erro interno do Prisma na resposta).
5. **Chamadas a APIs externas sempre via `fetchWithTimeout`** (`src/utils/retry.ts`), nunca `fetch` cru — é o que garante timeout (10s) e retry com backoff em toda chamada a SerpAPI, Google Places e ao `establishment-service`.
6. **Nunca logar a `URL` completa das chamadas a SerpAPI/Google Places**: `SERP_API_KEY` e `GOOGLE_API_KEY` vão como querystring (`api_key=`/`key=`) na própria URL montada em `serpapi.service.ts`/`google-places.service.ts`. Hoje nenhum log imprime essa URL — se for adicionar log de request/debug nesses services, nunca logue `url.toString()` diretamente (logue no máximo o `placeId`/tipo buscado).
7. **Validação de entrada**: `GET /places/nearby` valida via Zod (`nearbyPlacesQuerySchema`, com `min`/`max`/`default` para lat/lng/radius) antes de chamar a Google API — qualquer parâmetro novo dessa rota deve entrar no schema Zod, não ser lido direto de `request.query`. As demais rotas usam JSON Schema do Fastify nos `params`; siga o schema já presente em `routes.ts`.
8. **Segredos**: `JWT_SECRET`, `DATABASE_URL`, `SERP_API_KEY`, `GOOGLE_API_KEY`, `KAFKA_BROKERS` sempre via secret do k8s (`scrapping-service-secret`), nunca hardcode. Este serviço não tem `.env.example` — se for criar um, siga o padrão de placeholders do `auth-service`.
9. **Evento Kafka publicado (`establishment.movement.updated`) não deve carregar dado sensível** — hoje carrega só `establishmentId`, `level`, `source` e, opcionalmente, `category`; não adicione campos internos (ex.: `googlePlaceId` cru, dados de billing da SerpAPI) ao payload sem necessidade real do lado consumidor.

---

## Performance — obrigatório em qualquer alteração

Este serviço tem uma característica diferente dos outros três: o "hot path" não é uma request HTTP de alta concorrência, é um **job em lote que roda uma vez por hora e paga por chamada externa** (SerpAPI e Google Places são APIs pagas/limitadas). Performance aqui é tanto sobre latência quanto sobre **custo e consumo de cota das APIs externas**.

1. **O loop principal do job é sequencial de propósito** (`for...of` em `MovementService.updateMovementLevelsFromSavedEstablishments`, `await` por estabelecimento, sem `Promise.all`) — isso evita rajadas simultâneas contra a SerpAPI (rate limit/custo por chamada) e mantém o `try/catch` isolado por estabelecimento. Não paralelize esse loop com `Promise.all` sem antes considerar o rate limit real da SerpAPI; se for preciso ganhar throughput, prefira concorrência limitada (ex.: fila com N workers) a paralelismo irrestrito.
2. **Falha em um estabelecimento nunca derruba os demais**: o `try/catch` dentro do loop (`this.logger.error("[ERRO] Falha ao atualizar ${establishment.name}", error)`) garante isolamento — preserve esse padrão ao adicionar qualquer etapa nova dentro do loop.
3. **A busca inicial de estabelecimentos (`listOpenEstablishments`) não está dentro desse `try/catch`**: uma falha nessa única chamada HTTP (com até 3 retries e backoff de `fetchWithTimeout`, ou seja, até ~3.5s de espera antes de desistir) aborta a execução inteira do job daquela hora — não há fallback parcial nesse ponto. Se for tornar essa chamada mais resiliente, pense em cachear a última lista bem-sucedida como fallback, em vez de simplesmente aumentar o número de retries (o que só atrasa ainda mais a falha).
4. **`isRunning` (boolean, em `movement.job.ts`) impede sobreposição de execuções**: se uma rodada demorar mais de uma hora, a próxima é pulada (log de aviso) em vez de rodar em paralelo — preserve essa guarda ao alterar a frequência do cron ou a lógica do job.
5. **Réplica única, sem lock distribuído**: `k8s/deployment.yaml` fixa `replicas: 1` e não existe `HorizontalPodAutoscaler` neste serviço. Isso não é incidental — o cron roda **dentro do processo** (`node-cron`), então subir mais réplicas faria o job hourly rodar uma vez por réplica, duplicando chamadas pagas à SerpAPI/Google e duplicando eventos Kafka de movimento. **Nunca aumente `replicas` deste deployment sem antes** extrair o job para um `CronJob` dedicado do Kubernetes ou adicionar um lock distribuído (ex.: advisory lock do Postgres, ou uma chave no Redis se ele for introduzido).
6. **Cache em memória (`TTLCache`) não é compartilhado entre réplicas/processos** e é perdido a cada restart — está OK com réplica única, mas não deve ser usado como argumento para aumentar réplicas sem resolver o ponto 5 acima; e não deve ser tratado como fonte de verdade (é só para reduzir chamadas repetidas dentro da janela de TTL).
7. **Publicação Kafka é síncrona dentro do loop** (`await kafkaProducer.send(...)` em `saveCurrentPopularity`, logo após o `upsert`) — cada estabelecimento só avança para o próximo depois do ack do broker. Aceitável no volume atual (job horário, não é request de usuário), mas se o número de estabelecimentos crescer para milhares, considere agrupar em batches (`messages: [...]` já suporta múltiplas mensagens por `send`) em vez de um `send` por estabelecimento.
8. **`cleanOldPopularTimesDaily` roda em toda execução do job** (antes do loop principal) e depende do índice `@@index([capturedDate])` — se o volume de `popular_times_daily` crescer muito além do horizonte de 7 dias mantido, considere particionamento por data em vez de só aumentar a frequência/alcance do `deleteMany`.
9. **`getFallbackScore` depende do índice composto `@@index([establishmentId, dayOfWeek, hour])`** — qualquer nova consulta de agregação sobre `popular_times_daily` deve reaproveitar esse índice (mesma combinação de colunas) em vez de introduzir uma nova consulta sem índice de suporte.
10. **`$transaction([...])` em forma de array** (não callback interativo) é usada em `savePopularTimesDaily` para tornar o delete+insert do dia atômico — mantenha a forma de array para transações simples como essa; não troque por `$transaction(async (tx) => ...)` sem necessidade, pois isso mantém a conexão aberta por mais tempo.
11. **Reaproveitar singletons**: Prisma (`src/prisma/index.ts`, pool com `max` configurável via `DB_POOL_MAX`, default 10) e Kafka producer (`src/kafka/producer.ts`, lazy singleton) — nunca instancie um novo `PrismaClient`/`Kafka` client dentro de um service.

---

## Testes

- `npm test` — Vitest, roda `src/**/*.test.ts` (unitários co-localizados em `__tests__`) + `tests/**/*.spec.ts` (integração via `app.inject`).
- `npm run test:coverage` — cobertura de `src/services`, `src/controllers`, `src/routes.ts`, com thresholds mínimos **70% linhas, 70% funções, 60% branches** (mesmo padrão dos outros serviços) — não reduza para fazer um PR passar.
- `tests/setup/vitest.setup.ts` faz `vi.mock('../../src/config/env', ...)` **globalmente para todos os testes** (via `setupFiles`) — qualquer teste que precise de um valor de env diferente do default ali definido precisa remockar localmente (ver `vi.hoisted` + `vi.mock` no topo de `serpapi.service.test.ts`/`google-places.service.test.ts`), não editar o mock global para um caso específico.
- `tests/integration/scrapping.integration.spec.ts` é hoje o único arquivo de integração, cobrindo as 4 rotas (`/health`, `/places/:placeId/popularity`, `/movements/:establishmentId`, `/places/nearby`) com mocks de `SerpApiService`, `MovementService`, `GooglePlacesService` e `prisma` — siga o mesmo padrão de mocks (`vi.hoisted` + `vi.mock`) ao adicionar uma rota nova.
- **Não há teste para `src/jobs/movement.job.ts`** (agendamento do cron, guarda `isRunning`, wiring do `node-cron`) — se for alterar a lógica de agendamento/concorrência do job, considere adicionar um teste unitário para isso; hoje só o corpo do job (`MovementService.updateMovementLevelsFromSavedEstablishments`) é testado.
- `scripts/test-update-movement.ts` (e o `teste.ts` da raiz, que é praticamente duplicado) rodam o job uma vez contra infra real — são scripts de debug manual, não fazem parte de `npm test` e não têm assertions; não confunda com os testes reais ao avaliar cobertura.

Toda feature nova no pipeline do job precisa de: teste unitário no `MovementService` cobrindo o caminho feliz, o fallback por histórico, o caso `UNAVAILABLE`, e o isolamento de falha por estabelecimento (seguir os testes já existentes em `movement.service.test.ts`). Toda rota nova precisa de teste de integração cobrindo autenticado/não autenticado (quando aplicável) e o branch de erro.

---

## Variáveis de Ambiente

- Todas as env vars são lidas em `src/config/env.ts`, mas **sem validação/zod/fail-fast** — diferente do `establishment-service`. Ao adicionar uma env var nova, prefira centralizá-la em `env.ts` mesmo assim (não leia `process.env` direto em outro arquivo novo), e considere se vale a pena adicionar uma checagem de presença explícita, já que hoje nenhuma existe.
- **Exceção já existente** (não replique para variáveis novas): `src/prisma/index.ts` importa `"dotenv/config"` por conta própria e lê `process.env.DATABASE_URL`/`process.env.DB_POOL_MAX` diretamente, em vez de importar `env` de `config/env.ts` — mesmo tipo de exceção pontual observada no `user-service`.
- `JWT_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` (`env.jwtExpiresIn`/`env.jwtRefreshExpiresIn`) são lidas em `env.ts` mas **não são usadas em lugar nenhum do código** — este serviço só verifica tokens (`request.jwtVerify()`), nunca assina/emite JWT, então não há `expiresIn` a aplicar. Não assuma que essas variáveis têm efeito hoje; se for implementar emissão de token aqui (não é o padrão atual), é nesse ponto que elas passariam a ser usadas.
- `CORS_ORIGIN` tem fallback para `"*"` no código (ver Segurança #2) — defina explicitamente em produção.
- `KAFKA_BROKERS` tem default `"kafka:9092"` embutido no `env.ts`; as demais (`JWT_SECRET`, `DATABASE_URL`, `SERP_API_KEY`, `GOOGLE_API_KEY`, `ESTABLISHMENT_SERVICE_URL`, `TZ`) não têm default e, se ausentes, só quebram em uso (ver Segurança #1).
- Sem `.env.example` neste serviço hoje — se for criar um, siga o padrão de placeholders do `auth-service`.
- Propague toda env nova no `k8s/deployment.yaml` (hoje tudo vem via `envFrom: secretRef: scrapping-service-secret` — não há `configMapRef` neste serviço, diferente dos outros).

---

## Infra deste Serviço

- `Dockerfile`: build em 2 estágios (`builder` → `production`). Como o `generator client` do Prisma usa `output = "../src/generated/prisma"` (dentro de `src/`, não no local padrão), o `builder` precisa copiar manualmente esse diretório gerado para `dist/src/generated/prisma` depois do `tsc` (`RUN mkdir -p dist/src/generated && cp -r src/generated/prisma dist/src/generated/prisma`) — se o `output` do generator mudar, esse passo do Dockerfile precisa mudar junto, senão o build quebra silenciosamente em runtime (client ausente).
- O estágio `production` recria um `prisma.config.mjs` mínimo via `printf` inline no próprio `Dockerfile` (não copia o `prisma.config.ts` do repo) — necessário só para o `prisma migrate deploy` funcionar na imagem final. Se `prisma.config.ts` mudar (ex.: novo caminho de schema/migrations), esse bloco `printf` precisa ser atualizado manualmente em conjunto.
- `CMD` roda `prisma migrate deploy && node dist/src/server.js` — migration aplicada automaticamente no start do container (mesmo padrão do `auth-service`/`establishment-service`, diferente do `user-service`).
- `k8s/`: só existem `deployment.yaml` e `service.yaml` — **não há** `hpa.yaml`, `pdb.yaml`, `NetworkPolicy` nem `CronJob` neste serviço. `replicas: 1` fixo (ver Performance #5 — não é um detalhe incidental, é uma dependência real do design atual do job). Probes (`readinessProbe`/`livenessProbe`) apontam ambas para `/health` (checagem só de banco), sem endpoint `/ready` separado.
- `docker-compose.yml` local só sobe Postgres (`scrapping_db`, porta host `5435`) — não sobe Kafka nem nenhum outro serviço; para rodar o job localmente contra Kafka/establishment-service reais, aponte `KAFKA_BROKERS`/`ESTABLISHMENT_SERVICE_URL` para uma infra compartilhada (ex.: subida por outro serviço do monorepo).
- CI/CD (`.github/workflows/scrapping-service.yml`): só roda `npm test` (sem um passo separado de `test:integration` ou `test:coverage` no pipeline), builda e publica no GHCR, e faz deploy via `kubectl set image deployment/scrapping-service ...` — não usa Helm nem `kubectl apply` de manifests neste workflow.
