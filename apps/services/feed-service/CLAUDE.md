# Feed Service

> Contexto específico do microserviço de feed (timeline agregada) do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este é o único serviço do monorepo que não usa PostgreSQL/Prisma — a persistência é **Cassandra via DataStax Astra** (Cassandra gerenciado na nuvem), modelada em tabelas wide-partition com TTL nativo em vez de Postgres + cache Redis. `ioredis`/`ioredis-mock` estão no `package.json` mas **não são usados em lugar nenhum do `src`** — não assuma que há cache Redis aqui. Validação de payload é feita com **Zod nos eventos Kafka** (`src/schema/events/*`), mas com **JSON Schema puro do Fastify nas rotas HTTP** (`routes.ts`) — os dois padrões coexistem por domínio (evento vs. rota), não por preferência livre.

---

## Responsabilidade do Serviço

O `feed-service` é responsável exclusivamente por:

- montar e servir a **timeline personalizada** de um usuário (`GET /feed/:userId`), paginada por cursor opaco — cronológica ou rankeada conforme o experimento (ver "Feed rankeado na rota");
- **fan-out on write**: ao consumir eventos de outros domínios (post criado, evento criado, follow/unfollow), duplicar (desnormalizar) o item na partição de feed de cada seguidor — e, no caso de post, também na do próprio autor (`addPostToAuthorFeed`, gravada antes do fan-out, para quem publica ver o post no feed) —, já com todos os dados de exibição embutidos (autor, estabelecimento, evento) para que a leitura seja uma única query por partição, sem joins;
- manter cópias auxiliares desnormalizadas por domínio (`posts_by_user`, `events_by_id`, `events_by_user`) e índices reversos (`feed_entries_by_post`) que permitem propagar updates/likes/deleções de um item para todas as cópias já distribuídas nos feeds dos seguidores;
- manter as relações de follow **localmente** (`followers_by_user`, `followers_by_establishment`), como cache de leitura rápida para o fan-out — a fonte de verdade do relacionamento social continua sendo `user-service`/`establishment-service`; este serviço só espelha o necessário para decidir "para quem distribuir".

Este serviço **não** possui lógica de criação de posts, eventos, perfis ou estabelecimentos — ele só reage a eventos Kafka publicados por esses domínios (ver `src/kafka/consumer.ts`) e serve a leitura agregada. Nunca adicione regra de negócio de autenticação, criação de conteúdo ou pagamento aqui.

**Os handlers de evento (`event.created`/`event.confirmed`/`event.unconfirmed`) não têm produtor real hoje**: `apps/services/event-service` não depende de `kafkajs` e não tem pasta `src/kafka/` — não publica nada. `events_by_id`, `events_by_user` e `attendees_by_event` neste serviço existem para um fluxo que ainda não foi implementado do lado produtor. Não assuma que esses handlers são exercitados em produção; ao alterá-los, valide via teste (mock), não observando tráfego real.

**`total_confirmed` agora é recomputado e propagado (Fase 7)**: `EventAttendanceService.handleEventConfirmed`/`handleEventUnconfirmed` chamam um método privado `syncTotalConfirmed(eventId)` após criar/remover em `attendees_by_event`. Esse método releitura `EventAttendeesRepository.findAttendeesByEvent(eventId)` (equivalente a um `COUNT`), grava o total em `EventsByIdRepository.updateTotalConfirmed` e propaga para **todas** as cópias já distribuídas em `feed_by_user` via `FeedRepository.updateEventConfirmedCount` (novo método, mesmo padrão de `updatePostStats`/`updatePostContent`), buscando as entradas em `feed_entries_by_post` (`findByItemId`) e aplicando via `runFanout` — mesmo padrão de `FeedFanoutService.handlePostStatsUpdated` para `total_likes`/`total_comments`.
**Limitação de concorrência aceita conscientemente**: como a contagem vem de releitura (não de um contador atômico dedicado), duas confirmações/cancelamentos concorrentes para o mesmo evento têm uma janela de corrida em que o valor final gravado pode não refletir ambas (last-write-wins entre as duas leituras+updates) — documentado em comentário no próprio `syncTotalConfirmed`. Aceitável dado o volume esperado (confirmação de presença não deve se aproximar da concorrência de curtidas em post viral); se isso mudar, a correção correta é um contador atômico (counter table/LWT), não mais releituras.

**Soft delete: ligado para posts, não para eventos (Fase 7 — decisão explícita)**: `FeedFanoutService.handlePostDeleted` agora chama `PostsByUserRepository.softDelete` (em vez de `delete`) — a cópia canônica do post em `posts_by_user` passa a ser marcada `is_deleted = true` em vez de fisicamente removida (ainda expira via TTL de 30 dias). A cópia já distribuída em `feed_by_user` continua sendo `DELETE` físico imediato do feed de cada seguidor — isso **não muda**, só a cópia canônica do autor passa a soft delete. Consequência corrigida: `PostsByUserRepository.findRecentPostsByUser` (usada por `FollowService.addRecentPostsToFollowerFeed` para migrar histórico recente ao novo seguidor) não filtra `is_deleted` no CQL (coluna não-indexada, sem `ALLOW FILTERING`) — `addRecentPostsToFollowerFeed` agora filtra em código de aplicação (`.filter((post) => !post.isDeleted)`, mesmo padrão do `post-service`, `PostRepository.findByUser`/`findByEstablishment`) antes de migrar para o feed do novo seguidor.
`events_by_id.softDelete`/`events_by_user.softDelete` **permanecem não ligados de propósito** — não existe hoje nenhum evento Kafka real de "evento excluído/editado" chegando neste serviço (ver acima: `event-service` não publica nada), então ligar esse soft delete exigiria inventar um fluxo Kafka especulativo sem produtor real. Fica como código morto documentado, não removido, para o dia em que esse fluxo existir.

**Bug corrigido: `is_liked` nunca era gravado no feed** (`post.liked`/`post.unliked` descartados em silêncio). O post-service publica **todo** evento — inclusive nos tópicos próprios como `post.liked`/`post.unliked` — através de `publishEvent()` (`post-service/src/kafka/events.ts`), sempre embrulhado no envelope `{eventId, eventType, occurredAt, data}`. `directTopicHandlers` validava a mensagem crua direto contra o schema Zod, sem desembrulhar — `postId` nunca estava na raiz, o Zod lançava e a mensagem era descartada (`kafka_handler_error_total` incrementava, mas sem nenhum efeito visível além do log). Um segundo problema empilhava: o post-service manda `likedByUserId`, e o schema exigia `userId`. Corrigido em duas partes: `post.liked`/`post.unliked` saíram de `directTopicHandlers` e foram para o roteamento de envelope genérico (`handlers`, mesmo caminho de `post.created`/`post.stats.updated`) — `unwrapEventData` (`src/kafka/envelope.ts`) continua existindo e é aplicado ao que resta em `directTopicHandlers` (hoje só `user.followed`/`user.unfollowed`, que chegam sem envelope) como passthrough defensivo, não como o mecanismo que resolve `post.liked`/`post.unliked`; `postLikedSchema` (`src/schema/events/post-liked.schema.ts`) passou a aceitar `likedByUserId` (preferencial) com fallback para `userId` (eventos antigos). Como o consumer descartava a mensagem desde sempre (não só após algum deploy específico), likes anteriores à correção não têm `is_liked = true` no feed — `scripts/backfill-feed-likes.ts` (`npm run backfill:feed-likes`, ver seção "Estrutura de Pastas" acima) reconstrói isso a partir de `likes_by_post` do post-service, uma vez, manualmente.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/jwt`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/swagger` (+ `swagger-ui`). CORS e rate limit são registrados juntos por `registerCorsAndRateLimit` (`src/plugins.ts`, Fase 6): CORS por allowlist via `CORS_ALLOWED_ORIGINS` (fallback `origin: true` com `app.log.warn` se ausente) e rate limit global via `RATE_LIMIT_MAX` (padrão 300/min). **Diferente do `post-service`, o rate limit aqui usa o store em memória padrão do `@fastify/rate-limit` (sem `redis`)** — este serviço não usa Redis para nada (ver abaixo), então o contador é por réplica do pod, não compartilhado; aceitável hoje porque `replicas: 1` (ver seção Segurança).
- **`cassandra-driver`** contra **DataStax Astra** (Cassandra gerenciado, cloud) — client singleton lazy em `src/config/cassandra.ts` (`getCassandraClient`), autenticado por `secureConnectBundle` + token (`credentials: { username: "token", password: env.astra_token }`). Todo repositório roda queries via `BaseRepository.execute` (`src/repositories/base.repository.ts`), que sempre usa `{ prepare: true }` (prepared statements) — não chame `getCassandraClient().execute` direto fora de um repositório que estenda `BaseRepository`.
- Kafka (`kafkajs`) — **consumidor** neste serviço (`KafkaConsumer` em `src/kafka/consumer.ts`, singleton `kafka` em `src/kafka/client.ts`). Este serviço **não publica eventos** — não instancie um producer aqui. `src/kafka/producer.ts` (código morto, nunca importado em lugar nenhum do `src`, resquício de um fluxo de feed que nunca foi implementado) foi **removido na Fase 7**, junto com o script órfão `mock:post` do `package.json` (apontava para `src/scripts/publishPostCreated.ts`, que não existe — `src/scripts/` nunca existiu nesta árvore).
- `zod` — usado **só** para validar o `data` dos eventos Kafka (`src/schema/events/*.schema.ts`) antes de chamar o service correspondente (`FeedFanoutService`/`FollowService`/`EventAttendanceService`). As rotas HTTP (`routes.ts`) usam JSON Schema puro do Fastify, como no `auth-service`/`establishment-service` — não migre a rota de feed para Zod isoladamente.
- `uuid`, `@faker-js/faker` — usados por scripts de desenvolvimento/seed, não em código de produção do `src` (ver `scripts/seed-feed.sh`, que popula o feed via `kubectl exec` publicando eventos Kafka reais em vez de chamar a API).
- `ioredis`/`ioredis-mock` estão nas dependências mas **não há nenhum uso de Redis no `src`** — nem cache, nem rate limit. O papel que Redis cumpre em `user-service`/`establishment-service` (cache-aside) é substituído aqui pelo próprio modelo de dados do Cassandra: partições por usuário + **TTL nativo** (`USING TTL` em praticamente todo `INSERT`) fazem o papel de "cache com expiração automática" (ver `src/services/ttl_service.ts`).
- Vitest para testes (unit + integration), mockando sempre `getCassandraClient` (nunca infra real) na suíte padrão (`npm test`). Existe também `tests/integration-real` (Cassandra real via `docker-compose.test.yml`, rodada via `npm run test:integration` / `vitest.integration.config.ts`), no mesmo padrão dos outros serviços — este documento já afirmou o contrário no passado; se voltar a divergir do código, o código manda.
- `prom-client` (Fase 8) — métricas Prometheus expostas em `GET /metrics`, ver `src/metrics/registry.ts` e a seção "Infra deste Serviço" abaixo para a lista completa. Mesma versão usada pelo `post-service`.

Não introduza Prisma/Postgres, um segundo client Cassandra, ou volte a usar Redis sem antes confirmar que o modelo de TTL do Cassandra não resolve o caso de uso.

---

## Estrutura de Pastas

```
src/
  config/        env.ts (validado por zod, process.exit(1) no boot se inválido), cassandra.ts (client Astra singleton), swagger.ts
  errors/        http.error.ts (HttpError(message, statusCode)), error.handler.ts (registerErrorHandler compartilhado
                 entre server.ts e o helper de teste — mesmo padrão do post-service)
  controllers/   feed.controller.ts                    → única rota (getFeedByUser), sem try/catch (erro propaga pro errorHandler
                 global), valida limit/cursor manualmente
  services/      Decomposto por sub-domínio (era uma única FeedService de ~800 linhas até a Fase 4
                 do plano de refatoração — não recrie uma classe única com todos os handlers):
                   feed-read.service.ts                  → FeedReadService: getFeedByUser (única leitura do serviço)
                   feed-fanout.service.ts                 → FeedFanoutService: reage a post/evento criado/editado/curtido/excluído
                                                             e distribui (fan-out) para os feeds dos seguidores
                   follow.service.ts                      → FollowService: follow/unfollow de usuário/estabelecimento, migra ou
                                                             remove histórico recente de posts/eventos do feed do seguidor
                   event-attendance.service.ts             → EventAttendanceService: confirmar/cancelar presença em evento
                   feed-writer.service.ts                  → FeedWriterService: addItemToUserFeed, a única primitiva de escrita
                                                             ("colocar este item no feed deste usuário") usada pelos 3 services acima —
                                                             nunca duplique essa lógica dentro de um dos services específicos
                 feed-item.mapper.ts                       → funções puras de mapeamento (payload Kafka/linha Cassandra ↔ domínio):
                                                             toFeedItem, toEventItem, toPost, rowToPost, rowToEvent, postToFeedItem,
                                                             eventToFeedItem — única fonte desses mapeamentos, não duplique em nenhum service
                 ttl_service.ts                           → FeedTtlService, calcula TTL por tipo de item / data do evento
  repositories/  um por tabela Cassandra, todos estendem BaseRepository:
                   feed.repository.ts                    → feed_by_user (leitura do feed, insert/update/delete de item já distribuído)
                   feed_entries.repository.ts             → feed_entries_by_post (índice reverso post/evento → quem tem no feed)
                   posts_by_user.repository.ts            → posts_by_user (cópia canônica dos posts do autor, TTL 30 dias)
                   events_by_id.repository.ts             → events_by_id (evento por id, para reidratar ao distribuir depois)
                   events_by_user.repository.ts            → events_by_user (eventos por autor, usado no fan-out de novo seguidor)
                   followers_by_user.repository.ts         → followers_by_user (espelho local de quem segue um usuário)
                   followers_by_establishment.repository.ts→ followers_by_establishment (idem para estabelecimentos)
                   attendees_by_event.repository.ts        → attendees_by_event (quem confirmou presença)
                   base.repository.ts                      → execute(query, params) com prepare:true sobre o client singleton,
                                                             instrumentado com cassandra_query_duration_seconds (Fase 8, tabela
                                                             extraída da própria query, ver src/metrics/registry.ts)
  kafka/         client.ts (singleton), consumer.ts (assinatura de tópicos + dispatch para FeedFanoutService/FollowService/
                 EventAttendanceService, injetados via construtor) — sem producer.ts (removido na Fase 7, era código morto).
                 envelope.ts → unwrapEventData(raw), passthrough se `raw` não tiver o formato de envelope
                 {eventType, data} (usado hoje só sobre o que resta em directTopicHandlers — user.followed/
                 user.unfollowed —, que já chegam sem envelope; não é o que resolve post.liked/unliked, ver acima).
                 catch de handleMessage incrementa kafka_handler_error_total (topic/eventType) — ver src/metrics/registry.ts
  schema/events/ um schema Zod por payload de evento Kafka (post-created, post-deleted, post-liked/unliked, post-content/stats-updated,
                 follow, event-confirmance, event-unconfirmance, kafka-event → envelope genérico {eventId, eventType, occurredAt, data})
  types/         feed.types.ts (FeedItem, FeedItemType), post.types.ts (Post), event.type.ts (Event)
  metrics/       registry.ts (Fase 8) → Registry do prom-client + toda métrica do serviço (única fonte — não crie
                 Counter/Histogram solto em outro arquivo): http_request_duration_seconds/http_requests_total,
                 cassandra_query_duration_seconds, cassandra_fanout_partial_failure_total, kafka_handler_error_total,
                 rate_limit_exceeded_total
  utils/         media.ts                                → conversão UDT media_item <-> domínio + fallback de image_urls legado
                 fanout.ts                                → runFanout() — Promise.allSettled + log de falha parcial +
                                                             cassandra_fanout_partial_failure_total (Fase 8), usado em toda
                                                             propagação multi-linha (ver Performance #4)
  routes.ts      /health (liveness) + /ready (readiness, Cassandra crítico — Fase 8) + /metrics (Prometheus — Fase 8) +
                 GET /feed/:userId (schema JSON Schema, onRequest com jwtVerify + checagem de dono)
  plugins.ts     registerCorsAndRateLimit() → CORS (allowlist via env / fallback origin:true) + @fastify/rate-limit
                 (global, em memória — sem Redis; onExceeded incrementa rate_limit_exceeded_total, Fase 8) +
                 registerHttpMetrics() (Fase 8) → hook onResponse, grava http_request_duration_seconds/http_requests_total
  server.ts      bootstrap Fastify, registerCorsAndRateLimit, registerHttpMetrics, JWT, swagger, registerErrorHandler,
                 inicia o KafkaConsumer antes do listen, shutdown gracioso em SIGTERM/SIGINT (fecha Fastify,
                 KafkaConsumer.stop(), Cassandra)
  generate-spec.ts  script standalone (não referenciado em package.json scripts) que gera o JSON do OpenAPI para um arquivo
migrations/      *.cql versionadas (V000..V012 — V010/V011/V012 adicionam o UDT media_item e a coluna media em
                 feed_by_user/posts_by_user), aplicadas por scripts/migrate.ts (runner próprio, sem Flyway/Liquibase)
scripts/         migrate.ts (roda .cql pendentes e registra em feed_keyspace.schema_migrations), seed-feed.sh (seed manual
                 via Kafka real), backfill-feed-likes.ts (npm run backfill:feed-likes, POST_KEYSPACE=<keyspace do
                 post-service> — reconstrói feed_by_user.is_liked a partir de likes_by_post para likes anteriores à
                 correção de post.liked/unliked acima; idempotente, execução manual única)
tests/
  unit/          um arquivo de teste por service/repository: feed-read.service.unit.spec.ts, feed-fanout.service.unit.spec.ts,
                 feed-item.mapper.unit.spec.ts, feed.repository.unit.spec.ts (paginação por created_at, empate na fronteira),
                 followers.repository.unit.spec.ts (paginação por cursor em followers_by_user/_by_establishment, Fase 5),
                 feed-fanout.batch.unit.spec.ts (fan-out em lote: poucas/muitas páginas, concorrência por lote limitada a
                 FANOUT_BATCH_SIZE, Fase 5), fanout.unit.spec.ts (runFanout isolado), feed.ttl.unit.spec.ts — mocka
                 getCassandraClient (FollowService/EventAttendanceService ainda não têm spec unitário dedicado, só
                 integração mockada abaixo — ver Testes). kafka.consumer.unit.spec.ts cobre a instrumentação de
                 kafka_handler_error_total no catch de handleMessage **e** o roteamento real de post.liked/post.unliked
                 via handleMessage (envelope como o post-service publica de fato, incluindo o mapeamento
                 likedByUserId → userId) — o gap de cobertura do parsing/roteamento completo do consumer que existia
                 antes (ver tests/integration-real/feed.consumer.real.spec.ts) está parcialmente fechado por esses
                 casos, não pelo resto do dispatch. envelope.unit.spec.ts cobre unwrapEventData isolado (envelope
                 real do post-service e payload cru do user-service). post-liked.schema.unit.spec.ts cobre
                 likedByUserId/userId (preferência e fallback) isolado do consumer. backfill-feed-likes.unit.spec.ts
                 cobre o script de backfill (paginação, idempotência, entrada ausente em feed_entries_by_post) —
                 mockando client/repositories, sem Cassandra real.
  integration/    feed.integration.spec.ts (app.inject na rota, via FeedReadService, + /health, /ready, /metrics — Fase 8),
                 plugins.integration.spec.ts (CORS allowlist/fallback + rate limit dentro/fora do limite e por réplica,
                 Fase 6) e três specs "consumer" simulando o KafkaConsumer chamando o service certo diretamente:
                 feed-fanout.consumer.spec.ts (inclui múltiplos seguidores e falha parcial real em handlePostStatsUpdated,
                 Fase 9), follow.consumer.spec.ts (inclui follow/unfollow de estabelecimento no mesmo nível de usuário,
                 Fase 9), event-attendance.consumer.spec.ts — todos mockam getCassandraClient, nenhum roda contra
                 Cassandra real
  integration-real/ feed.integration.real.spec.ts, feed.consumer.real.spec.ts (agora instancia os 3 services de consumer
                   separadamente) — mesma cobertura, mas contra Cassandra real (docker-compose.test.yml), rodados só via
                   `npm run test:integration`, nunca em `npm test`
  helpers/, setup/  fastify.test.helper.ts (buildServer + makeAuthHeader, registra o errorHandler), cassandra.test.helper.ts
                   (truncateFeedTables, usado só por integration-real), vitest.setup.ts (mocka src/config/env globalmente)
```

### Padrão de uma feature nova

1. **Nova tabela/consulta Cassandra**: modele a partition key em torno do padrão de leitura (ex.: `feed_by_user` particiona por `user_id` porque a leitura é sempre "feed de um usuário"), adicione uma migration `.cql` nova em `migrations/` com o próximo número de versão (`VNNN__descricao.cql`) e rode `npm run migrate` — não edite uma migration já aplicada em produção.
2. Crie um `*.repository.ts` novo estendendo `BaseRepository`, um método por operação, sempre com `?` parametrizado (nunca concatenar valor na query CQL) e `USING TTL ?` explícito em todo `INSERT` que representa um item de feed/conteúdo com expiração esperada.
3. Se o dado vem de um evento Kafka novo: crie um schema Zod em `src/schema/events/<evento>.schema.ts`, registre o handler em `src/kafka/consumer.ts` — decida explicitamente se ele entra no `topics`/`handlers` (convenção de envelope genérico `{eventId, eventType, occurredAt, data}`, ex. `posts`, `post.liked`, `post.unliked`) ou em `directTopicHandlers` (payload cru, sem envelope, ex. `user.followed`/`user.unfollowed`). **Confirme com o serviço produtor qual convenção ele usa de verdade antes de escolher** — o post-service publica **todo** evento através de `publishEvent()` (inclusive em tópicos próprios como `post.liked`/`post.unliked`), sempre embrulhado no envelope, enquanto o user-service manda `user.followed`/`user.unfollowed` com payload cru. `post.liked`/`post.unliked` ficaram muito tempo em `directTopicHandlers` assumindo payload cru — na prática chegavam embrulhados, o Zod nunca validava e a mensagem era descartada em silêncio (`is_liked` nunca era gravado no feed; ver bug documentado acima, seção "Responsabilidade do Serviço"). `directHandler(unwrapEventData(rawEvent))` (`src/kafka/envelope.ts`) existe como salvaguarda para o que continua em `directTopicHandlers`, mas não é um substituto para confirmar a convenção real do produtor — não assuma que basta chamar `unwrapEventData` em vez de escolher o caminho certo (`handlers` vs. `directTopicHandlers`) para o evento novo. **A duplicidade `user.followed`/`user.unfollowed` foi resolvida na Fase 7**: investigamos o produtor real (`user-service`, `src/services/editProfile.service.ts`, métodos `increaseFollower`/`decreaseFollower`) e ele publica direto nos tópicos `user.followed`/`user.unfollowed` com payload cru (`{followerId, followingId}`/`{followerId, followedId}`) — convenção `directTopicHandlers`, nunca o envelope genérico `{eventId, eventType, data}` sobre o tópico `users`. As duas entradas redundantes em `handlers` (que tratavam esses mesmos eventos como `eventType` do tópico `users`) foram removidas; só `directTopicHandlers["user.followed"/"user.unfollowed"]` permanece. `followSchema` (`src/schema/events/follow.schema.ts`) já aceitava as duas formas (`followedId` novo e `followingId` legado do `user-service`), então nada mudou no schema.
   `establishment.followed`/`establishment.unfollowed` continuam só em `handlers` (envelope), sem duplicidade — mas **não há ambiguidade a resolver porque não há produtor**: `establishment-service` não tem nenhuma feature de "seguir estabelecimento" hoje (nem REST, nem Kafka) e não publica nada (confirmado por busca exaustiva no serviço + seu próprio `CLAUDE.md`, que já afirma "este serviço não produz eventos"). Essas duas entradas ficam como código especulativo para uma feature que ainda não existe do lado produtor — se a feature for implementada, confirme a convenção real antes de assumir que o envelope genérico é a certa.
4. Lógica de negócio nova entra no service do sub-domínio certo — não crie uma classe nova nem misture responsabilidades: leitura do feed é `FeedReadService`, reação a post/evento criado/editado/curtido/excluído é `FeedFanoutService`, follow/unfollow é `FollowService`, confirmação de presença é `EventAttendanceService`. Escrever um item no feed de alguém (a primitiva `feed_by_user` + `feed_entries_by_post`) sempre passa por `FeedWriterService.addItemToUserFeed`, injetado nos três primeiros — nunca duplique essa escrita direto num repository dentro de um service. TTL de qualquer item novo deve passar por `FeedTtlService.getTtl`/`calculateEventTTL` (`src/services/ttl_service.ts`), nunca hardcode um TTL novo solto num repository. Se a mudança envolve converter payload/linha do Cassandra para um tipo de domínio (`FeedItem`/`Post`/`Event`), a função vai em `src/services/feed-item.mapper.ts`, não como método privado novo em algum service — é a única fonte desses mapeamentos hoje.
5. Se a mudança afeta o formato do item de feed, atualize `feedItemSchema` em `routes.ts` (resposta HTTP) e o schema Zod correspondente em `src/schema/events/post-created.schema.ts` — os dois precisam ficar coerentes com `FeedItem` (`src/types/feed.types.ts`). **Eventos têm um único `itemType` (`EVENT`)** — não existe `EVENT_USER`/`EVENT_ESTABLISHMENT` porque, por regra de produto, **só estabelecimentos criam eventos** hoje; `distributeEventToFollowers` (`src/services/feed-fanout.service.ts`) sempre busca seguidores em `followers_by_establishment` para esse tipo, sem precisar de um discriminante de tipo de autor. Se usuários comuns passarem a poder criar eventos, essa premissa (`authorId` de evento = sempre um estabelecimento) precisa ser revisitada explicitamente antes de qualquer mudança nesse fluxo — não assuma que ela continua válida sem confirmar a regra de negócio primeiro.

   > **Campo novo vindo de outro serviço: este serviço vai primeiro.** O schema de evento é um `z.discriminatedUnion`, que **descarta campo desconhecido em silêncio** — sem erro, sem log. Se o produtor (ex.: `post-service`) começar a publicar um campo antes deste serviço saber lê-lo, o dado some sem deixar rastro. O mesmo vale na saída: o `feedItemSchema` de `routes.ts` é usado pelo Fastify para serializar a resposta, então campo ausente ali é removido do JSON, mesmo estando na linha do Cassandra.
6. Toda feature nova precisa de: teste unitário do service em `tests/unit` (mockando `getCassandraClient`) e, se mexer na rota, teste de integração em `tests/integration/feed.integration.spec.ts`. Se adicionar um handler novo de evento Kafka, siga o padrão dos specs "consumer" já existentes (`tests/integration/feed-fanout.consumer.spec.ts`/`follow.consumer.spec.ts`/`event-attendance.consumer.spec.ts`): teste chamando o método do service diretamente, com o payload já validado, não o parsing do Kafka em si.

---

## Segurança — obrigatório em qualquer alteração

1. **`GET /feed/:userId` já valida que o usuário autenticado só pode ler o próprio feed**: o `onRequest` em `routes.ts` faz `request.jwtVerify()` e depois compara `request.user.accountId !== request.params.userId` (403 se divergir). Preserve essa checagem em qualquer rota nova de leitura de feed — nunca confie apenas no `userId` da URL sem comparar com o token.
2. **CORS é configurável via `CORS_ALLOWED_ORIGINS`** (env, lista separada por vírgula) — `registerCorsAndRateLimit` (`src/plugins.ts`) usa a lista quando definida; **sem ela, cai em `origin: true`** (aceita qualquer origem) com `app.log.warn(...)`. Nenhum valor foi configurado em produção ainda — enquanto a env var não for definida no k8s, o comportamento efetivo continua sendo o mesmo `origin: true` de antes. Definir a lista de origens de produção é uma decisão de produto, não técnica — não invente valores. Mesmo padrão (allowlist com fallback documentado) já usado no `post-service`.
3. **`@fastify/rate-limit` está registrado globalmente** (`registerCorsAndRateLimit`, `global: true`, `max` vindo de `RATE_LIMIT_MAX` — padrão 300 req/min, ver `src/config/env.ts`) — cobre `GET /feed/:userId`, hoje a única rota pública. **Diferente do `post-service`, aqui o rate limit usa o store padrão em memória do processo do `@fastify/rate-limit` (sem `redis`)** — decisão deliberada, consistente com este serviço não usar Redis para nada (ver seção "Stack e Dependências"). **Limitação aceita e não escondida**: com múltiplas réplicas, o contador é **por réplica**, não compartilhado — um cliente distribuído entre réplicas pode efetivamente atingir `RATE_LIMIT_MAX * N réplicas` antes de ser bloqueado em qualquer uma delas. Hoje isso não é um problema prático porque `k8s/deployment.yaml` roda com `replicas: 1` (rate limit efetivamente global). Se este serviço passar a rodar com múltiplas réplicas (o plano de refatoração prevê isso numa fase futura), reavalie se um store compartilhado (Redis, só para o rate limit, como já feito no `post-service`) se torna necessário — não é bloqueante agora, mas não deve ser esquecido silenciosamente quando `replicas` deixar de ser 1.
4. **Payload de todo evento Kafka é validado por Zod antes de qualquer efeito colateral** (`schema.parse(data)` dentro dos handlers de `consumer.ts`) — mantenha isso para qualquer evento novo; nunca passe `data` bruto do Kafka direto para um método de `FeedFanoutService`/`FollowService`/`EventAttendanceService` sem passar por um schema Zod dedicado.
5. **Erros de mensagem Kafka nunca derrubam o consumer**: `handleMessage` envolve o parse + dispatch em `try/catch` e só faz `console.error` — preserve esse isolamento por mensagem (uma mensagem malformada ou um handler que lança exceção não deve parar o consumo das próximas). Como consequência, **hoje não há dead-letter queue nem retry** — uma mensagem que falha é efetivamente descartada após o commit automático do `kafkajs`; se a confiabilidade de algum evento novo for crítica, isso precisa ser resolvido explicitamente (DLQ, retry manual), não assumido como já coberto.
6. **Nunca vazar credenciais Astra** (`astra_token`, conteúdo do `secure connect bundle`) em log, resposta HTTP ou mensagem de erro — o consumer ainda usa `console.error(error)`; ao adicionar logging novo, não inclua o objeto `env` inteiro.
7. **Erros internos nunca vazam para o cliente**: `FeedController` não tem mais try/catch próprio — qualquer exceção propaga para o `errorHandler` global (`src/errors/error.handler.ts`, registrado em `server.ts` e no helper de teste `tests/helpers/fastify.test.helper.ts`), que responde `500 { message: "Internal server error" }` para erro genérico (`ZodError` vira `400`, `HttpError` usa seu próprio `statusCode`) e loga via `app.log.error`. Lance `HttpError(message, statusCode)` (`src/errors/http.error.ts`) para erro de domínio esperado em vez de um `try/catch` novo no controller.
8. **Segredos**: `JWT_SECRET`, `ASTRA_TOKEN`, o secure connect bundle (montado via `k8s/deployment.yaml` como `Secret` em `/secure-connect`) sempre via env/secret do k8s — nunca hardcode.

---

## Performance — obrigatório em qualquer alteração

Este serviço existe para servir timeline em alta concorrência com baixa latência de leitura. Ao alterar código:

1. **Leitura do feed é sempre uma única query de partição na maioria dos casos** (`SELECT * FROM feed_by_user WHERE user_id = ? [AND created_at < ?] LIMIT limit+1`, `FeedRepository.findByUser`) — a paginação por cursor (`created_at`) evita `OFFSET`/`SKIP`, que não existe em Cassandra. **A busca por `limit + 1`, não `limit`, é proposital**: `created_at` não é único (a `PRIMARY KEY` também tem `item_id` como clustering column, mas a paginação não usa isso), então sem essa linha extra de "espiada" um corte de página no meio de um grupo de itens com `created_at` idêntico apagava o restante do grupo silenciosamente — a próxima página, com `created_at < cursor`, excluía o grupo inteiro, não só o que já tinha sido servido. Quando a espiada revela empate na fronteira, `extendPageAcrossTiedTimestamps` faz **uma segunda query** (`WHERE created_at = ?`, com teto `MAX_TIED_TIMESTAMP_GROUP`) para trazer o grupo completo antes de responder — isso só acontece quando há empate real (raro), então o caso comum continua sendo 1 única query. Qualquer leitura nova de listagem paginada deve considerar esse mesmo risco se o campo de cursor não for garantidamente único.
2. **TTL nativo do Cassandra é o mecanismo de expiração/controle de crescimento**, não um cache separado: posts de usuário duram 7 dias no feed, de estabelecimento/patrocinado 15 dias (`FEED_TTL` em `ttl_service.ts`), eventos expiram 2 dias após a data do evento (`calculateEventTTL`). Se adicionar um novo `item_type`, defina o TTL em `FeedTtlService.getTtl` em vez de espalhar um número mágico em um repository.
3. **Fan-out on write já é paginado e em lotes com concorrência limitada** (Fase 5 do plano de refatoração): `UserFollowerRepository.findFollowersByUser`/`EstablishmentFollowersRepository.findFollowersByEstablishment` recebem `limit`/`cursor` explícitos e paginam por `follower_id` (a clustering key de `followers_by_user`/`followers_by_establishment`), retornando `{ followerIds, nextCursor }` — mesmo critério de "tem mais página?" (`rows.length === limit`) já usado em `FeedRepository.findByUser`. `distributePostToFollowers`/`distributeEventToFollowers` (`src/services/feed-fanout.service.ts`) consomem isso em um loop `do...while`: buscam uma página de seguidores, distribuem só essa página via `runFanout` (que passa a limitar a exposição a um lote por vez, já que só recebe as tasks daquele lote) e seguem para a próxima página usando o cursor, até `nextCursor` vir `null`. O tamanho do lote é `FANOUT_BATCH_SIZE` (500, exportado de `feed-fanout.service.ts`) — mesmo valor de `MAX_TIED_TIMESTAMP_GROUP` em `FeedRepository`, grande o bastante para que contas com poucos seguidores (o caso comum) continuem resolvendo em 1 única leitura, pequeno o bastante para não gerar uma leva de centenas de milhares de writes simultâneos por post/evento de uma conta grande. Se for alterar esse fluxo, preserve o padrão de 1 página por iteração — nunca volte a acumular todos os seguidores em memória antes de distribuir.
4. **Toda mutação em cascata usa `runFanout`** (`src/utils/fanout.ts`), nunca `Promise.all` puro nem loop sequencial: `handleContentPostUpdated`, `handlePostStatsUpdated`, `handlePostDeleted`, `distributePostToFollowers`, `distributeEventToFollowers`, `EventAttendanceService.syncTotalConfirmed` e `FeedEntriesByPostRepository.deleteByItemId` buscam as entradas em `feed_entries_by_post` (índice reverso) e aplicam a atualização em paralelo em cada cópia do feed. `runFanout` usa `Promise.allSettled` por baixo e ainda propaga o primeiro erro (mesmo contrato de `Promise.all` para o chamador), mas **detecta e loga falha parcial** (`console.warn` + métrica `cassandra_fanout_partial_failure_total`, ver `src/metrics/registry.ts`, Fase 8 — as duas convivem, uma não substitui a outra) quando só parte das escritas falha, o pior caso silencioso de um fan-out sem BATCH/LWT entre linhas. Preserve `runFanout` em qualquer propagação nova; não volte a usar `Promise.all` cru para isso.
5. **`feed_entries_by_post` é o índice que evita `ALLOW FILTERING`** para localizar em quais feeds um post/evento está copiado (likes, edição, exclusão). Qualquer novo tipo de item que precise ser atualizável/removível após distribuído **precisa** de uma entrada equivalente nesse índice (ou um novo índice reverso do mesmo padrão) — não tente atualizar `feed_by_user` filtrando por `item_id` sem um índice, pois `item_id` não é chave de partição/clustering dessa tabela.
6. **Prepared statements sempre** (`{ prepare: true }` em `BaseRepository.execute`) — qualquer novo método de repository deve passar pelo `execute` da base em vez de chamar o client Cassandra diretamente, para manter o cache de prepared statements do driver.
7. **Client Cassandra é singleton lazy** (`getCassandraClient` em `src/config/cassandra.ts`) — nunca instancie um novo `cassandra.Client` num service/repository; o mesmo vale para o singleton do Kafka (`src/kafka/client.ts`).
8. **`findRecentPostsByUser`/`findRecentEventsByAuthor` já limitam a 15 itens** (`LIMIT 15`) ao migrar histórico recente para um novo seguidor — ao alterar a janela de "recente" (hoje 15 dias, constante `RECENT_WINDOW_DAYS` em `src/services/follow.service.ts`), lembre que aumentar o período ou o limite aumenta proporcionalmente o custo de cada novo follow.
9. Ao adicionar rota ou consumidor novo, pense no custo em alta volumetria (milhões de itens de feed, contas com muitos seguidores) desde o desenho da partição/clustering key, não como otimização posterior — em Cassandra, corrigir uma partition key errada depois exige migração de dados, não só um índice novo.

---

## Testes

- `npm test` — roda `tests/**/*.spec.ts` **exceto** `tests/integration-real/**` (excluído em `vitest.config.ts`), sempre mockando `getCassandraClient` via `vi.mock("../../src/config/cassandra", ...)` — nenhum teste dessa suíte bate em Cassandra real.
- `npm run test:integration` — roda só `tests/integration-real/**/*.spec.ts` (`vitest.integration.config.ts`) contra Cassandra real, subido via `docker-compose.test.yml` (`cassandra-test`). Sequencial (`fileParallelism: false`) porque os specs fazem `TRUNCATE` de tabelas compartilhadas no mesmo keyspace.
- `npm run test:coverage` — thresholds mínimos **70% linhas, 70% funções, 60% branches**, medidos sobre `src/services`, `src/controllers`, `src/routes.ts` (`vitest.config.ts`) — não reduza esses valores para fazer um PR passar.
- `tests/setup/vitest.setup.ts` mocka `src/config/env` globalmente (bundle/token/keyspace fake) — se adicionar uma env var nova em `env.ts`, adicione o valor fake correspondente aqui também, senão os testes que importam `env` indiretamente podem quebrar.
- `tests/integration/feed-fanout.consumer.spec.ts`/`follow.consumer.spec.ts`/`event-attendance.consumer.spec.ts` testam o consumer **chamando os métodos do service certo diretamente** (não sobe um Kafka de verdade nem usa `EachMessagePayload`) — ao adicionar um handler novo, siga esse mesmo padrão: teste o método do service com o payload já validado, não o parsing do Kafka em si.
- `npm run migrate` não é testado automaticamente — ao adicionar uma migration `.cql` nova, valide manualmente contra uma keyspace de teste/dev antes de assumir que ela roda limpa em produção via `scripts/migrate.ts`.
- Toda feature nova precisa de: teste unitário do método novo no service certo (incluindo o branch sem seguidores/entries e o branch com seguidores/entries, como já feito para `handlePostCreated`/`handlePostDeleted` em `FeedFanoutService`), e teste de integração da rota se a mudança afetar `GET /feed/:userId`.

---

## Variáveis de Ambiente

Mesmo padrão do `establishment-service`/`post-service`: `src/config/env.ts` valida com `zod` (`envSchema.safeParse(process.env)`), `process.exit(1)` se inválido. `JWT_SECRET`, `ASTRA_KEYSPACE` e `KAFKA_BROKERS` são obrigatórios e checados no boot. `ASTRA_SECURE_CONNECT_BUNDLE`/`ASTRA_TOKEN`/`ASTRA_CLIENT_ID`/`ASTRA_CLIENT_SECRET`/`CASSANDRA_CONTACT_POINTS` ficam `.optional()` no schema porque são **condicionalmente** obrigatórios (Astra cloud vs. cluster local via `CASSANDRA_CONTACT_POINTS`) — zod não expressa bem essa condicional num objeto plano, então a checagem real de qual combinação é obrigatória fica em `src/config/cassandra.ts` (lança erro explícito se faltar `secure_connect_bundle`/`astra_token` e não houver `cassandra_contact_points`). Ao adicionar uma env var nova, adicione ao `envSchema` (obrigatória por padrão, `.optional()` só se genuinamente opcional).

`astra_client_id`/`astra_client_secret` continuam carregados em `env.ts` a partir de `ASTRA_CLIENT_ID`/`ASTRA_CLIENT_SECRET`, mas **não são usados** por `src/config/cassandra.ts` (a autenticação real é só `secureConnectBundle` + `astra_token`) — são valores mortos hoje, mantidos por compatibilidade com o `.env.example` existente.

`CORS_ALLOWED_ORIGINS` (lista separada por vírgula, `.optional()`) e `RATE_LIMIT_MAX` (`z.coerce.number().default(300)`) seguem o mesmo schema zod — ambas opcionais com fallback seguro (`origin: true` e `300`, respectivamente, ver `src/plugins.ts`), então não precisam derrubar o boot como `JWT_SECRET`.

O `.env.example` já reflete as env vars reais do `env.ts` (`ASTRA_SECURE_CONNECT_BUNDLE`, `JWT_SECRET`, etc.) — ao mexer em qualquer env var, mantenha os dois em sincronia.

`RANKING_ROLLOUT_SHARE` (opcional, 0 a 1, padrão 0) é a fatia do experimento de ranking; é lida com fallback para 0 e aviso no log, nunca derruba o boot.

Propague qualquer variável nova no `k8s/deployment.yaml` (via `envFrom.secretRef: feed-service-secret`, hoje o único mecanismo usado — não há `configMapRef` neste serviço).

---

## Infra deste Serviço

- `Dockerfile`: build em um único estágio (`npm install` → `npm run build` → `npm run migrate && npm start`), sem multi-stage e sem `npm ci --omit=dev`/`npm prune` — a imagem final carrega `devDependencies` (necessário porque `migrate`/`start` usam `tsx`/`node` sobre o próprio código, e o script de migration roda via `tsx scripts/migrate.ts`). O `CMD` aplica as migrations pendentes do Cassandra (`migrations/*.cql`, via `scripts/migrate.ts`) automaticamente antes de subir o servidor, mesmo padrão de `auth-service`/`post-service` — não é mais necessário rodar `npm run migrate` manualmente após o deploy.
- `docker-compose.yml` local sobe **Kafka** (+ `kafka-init` criando os tópicos `posts`/`users`/`establishments`/`events` e `kafka-ui`) **e também o próprio `feed-service`** (`build: .`, porta `3006`, `depends_on: kafka`/`kafka-init`) — mas só define `KAFKA_BROKERS` como env var; `ASTRA_*`/`JWT_SECRET` não são setados no compose, então o container do `feed-service` só sobe de fato se essas variáveis vierem de fora (`.env`/shell). **Não há Cassandra local no compose**; rodar este serviço localmente depende de credenciais reais de uma instância Astra (ou mockar `getCassandraClient` como os testes fazem). Se for melhorar o setup local, considere isso antes de assumir que `docker-compose up` sobe o serviço fim-a-fim.
- `k8s/`: `deployment.yaml`, `service.yaml`, `hpa.yaml` e `pdb.yaml` (Fase 11 do plano de refatoração — antes só existiam os dois primeiros). `hpa.yaml` (min 1 / max 4 réplicas, CPU 70% / memória 80%, `stabilizationWindowSeconds` assimétrico: 60s scale-up / 120s scale-down) e `pdb.yaml` (`minAvailable: 1`) seguem o mesmo padrão já usado em `event-service`. `replicas: 1` continua no `deployment.yaml`, mas agora é só o valor inicial — a partir do HPA, a contagem de réplicas é decidida dinamicamente. O bloqueio técnico que impedia múltiplas réplicas com segurança já tinha sido removido na Fase 5 (fan-out de seguidores paginado em lotes de 500 com concorrência limitada, em vez de disparar uma escrita por seguidor sem limite) — o consumer Kafka já usa `groupId: "feed-service-group"` (`consumer.ts`), então múltiplas réplicas já dividem partições corretamente sem mudança de lógica de consumo. **Ressalva que continua valendo com múltiplas réplicas**: o rate limit em memória (ver Segurança #3) passa a ser efetivamente por réplica assim que o HPA escalar acima de 1 — reavalie um store compartilhado (Redis) se isso se tornar um problema real.
  `deployment.yaml` também ganhou `securityContext` (`runAsNonRoot: true`, `runAsUser: 1001`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: false`, `capabilities.drop: [ALL]`, mesmo padrão do `post-service`) e `terminationGracePeriodSeconds: 60`, dando tempo para o `SIGTERM` drenar o consumer Kafka e fechar a conexão Cassandra (shutdown gracioso, ver `server.ts`) antes do kill forçado do pod.
- O secure connect bundle da Astra é montado como `Secret` (`astra-bundle`) em `/secure-connect` (`volumeMounts`/`volumes` no `deployment.yaml`) — a env var `ASTRA_SECURE_CONNECT_BUNDLE` (do `feed-service-secret`) precisa apontar para um caminho dentro desse mount; se o nome do arquivo dentro do secret mudar, atualize os dois lados juntos.
- **`readinessProbe` aponta para `/ready`, `livenessProbe` para `/health`** (`k8s/deployment.yaml`) — separação final feita depois que Fase 8 (que criou `/ready`) e Fase 11 (que criou HPA/PDB/securityContext, mas deliberadamente não mexeu nas probes por rodar em paralelo com a Fase 8) foram mescladas. Liveness continua só confirmando que o processo Fastify está de pé (nunca reinicia o pod por causa de uma dependência externa fora do ar); readiness agora reflete o estado real do Cassandra (ver abaixo) — um pod só recebe tráfego se `/ready` responder `200`.
- **`/ready` (Fase 8) verifica Cassandra, que é a única dependência crítica deste serviço** — `SELECT now() FROM system.local` (mesmo padrão do `post-service`); falha → `503 { status: "degraded", dependencies: { cassandra: "error" } }`. **O consumer Kafka deliberadamente não é checado em `/ready`**: não existe hoje uma forma barata de verificar "o consumer está processando" sem manter estado extra (ex.: timestamp/offset da última mensagem processada), e uma checagem especulativa (ex.: ping no broker) não provaria que o loop `eachMessage` em si está vivo — inventar isso seria fingir uma cobertura que não existe. Essa lacuna é conhecida e aceita por ora; se a confiabilidade do consumer se tornar crítica o suficiente para justificar o esforço, a forma correta é instrumentar um heartbeat de "última mensagem processada com sucesso" e checar seu recency aqui, não simular uma checagem sem sinal real por trás.
- **Métricas Prometheus em `/metrics` (Fase 8)** — `src/metrics/registry.ts` (`prom-client`, mesma versão do `post-service`), inclui métricas padrão de processo (`collectDefaultMetrics`) e as específicas deste serviço: `http_request_duration_seconds`/`http_requests_total` (hook `onResponse` em `registerHttpMetrics`, `src/plugins.ts`, label `route` = padrão da rota via `request.routeOptions.url`, nunca a URL crua), `cassandra_query_duration_seconds` (tabela extraída da própria query em `BaseRepository.execute`, `src/repositories/base.repository.ts`, sem precisar anotar cada método de repository), `cassandra_fanout_partial_failure_total` (incrementada em `runFanout`, `src/utils/fanout.ts`, junto do `console.warn` já existente — os dois convivem, a métrica não substitui o log), `kafka_handler_error_total` (labels `topic`/`eventType`, incrementada no `catch` de `handleMessage`, `src/kafka/consumer.ts` — antes uma mensagem malformada ou um handler que lança só virava `console.error`, indistinguível de qualquer outro erro; `eventType` fica vazio quando a mensagem nem chega a ter o envelope `{eventId, eventType, ...}` parseado, ex.: JSON inválido) e `rate_limit_exceeded_total` (label `route`, hook `onExceeded` do `@fastify/rate-limit` em `registerCorsAndRateLimit`, `src/plugins.ts`). **Sem métricas de cache/Redis nem de publish Kafka** — este serviço não usa Redis para cache (ver "Stack e Dependências") e só consome Kafka, nunca publica, então essas categorias do `post-service` não se aplicam aqui. Toda métrica nova deste serviço deve ser registrada em `metrics/registry.ts` — não crie `new client.Counter(...)` solto em outro arquivo.
- Sem tracing distribuído (OpenTelemetry) neste serviço — fora do escopo por enquanto; log estruturado + as métricas acima cobrem a lacuna de observabilidade mais urgente hoje (exceto a lacuna documentada acima sobre o consumer Kafka em `/ready`).

---

## Ranking do feed (fases 1 e 2 do roteiro de recomendação)

> **A rota já usa o ranking, mas nasce desligada.** `GET /feed/:userId` passa por `RankedFeedService`; com `RANKING_ROLLOUT_SHARE=0` (padrão) todo mundo continua recebendo o feed cronológico. Ranking aqui ordena o following — não traz conteúdo de quem a pessoa não segue (isso é a fase 3).

O ranking mora neste serviço por decisão: a ordem nasce na leitura (read-time), e um serviço de ranking separado significaria chamada síncrona no caminho mais quente do produto. Não mova para outro serviço antes da fase 4 (value model) sem motivo novo.

### Onde está

```
src/ranking/
  types.ts             → SIGNAL_TYPES, ItemFeatures, Scorer, rankItems
  engagement.ts        → taxa suavizada, qualityMultiple, dwell suavizado, recencyDecay
  affinity.ts          → afinidade a partir de contagem, com saturação
  decay.ts             → decaimento e^(−Δt/τ) incremental e exato
  weights.ts           → pesos recarregáveis (loadWeights valida; a fonte ainda não está ligada)
  heuristic.scorer.ts  → HeuristicScorer e ChronologicalScorer (a régua do holdout)
  experiment.ts        → bucketing determinístico e holdout cronológico de 5%
src/services/ranking_features.service.ts        → agrega sinais e monta ItemFeatures
src/repositories/ranking_counters.repository.ts → os dois modelos de armazenamento (abaixo)
src/schema/events/interactions-normalized.schema.ts
migrations/V013 (ranking_counters_by_item), V014 (ranking_affinity_by_user_author)
src/services/ranked_feed.service.ts            → quem recebe ranking, primeira página, páginas da sessão
src/repositories/feed_session.repository.ts    → feed_session_items (ordem congelada por 30 min)
src/utils/feed_cursor.ts                       → os três formatos de cursor
src/utils/feed_item.ts                         → formato do item na resposta, único para os dois caminhos
migrations/V015 (feed_session_items)
```

### Leia `interactions.normalized`, nunca `interactions.raw`

`interactions.raw` só tem sinais do app: a API do interaction-service rejeita `LIKE`, `COMMENT` e `FOLLOW` lá, porque esses chegam pelos tópicos dos serviços de origem. O worker do interaction-service republica **tudo** que persiste em `interactions.normalized`. Ler `raw` deixa o ranking sem nenhuma curtida — esse bug já existiu. Ler os dois conta o app em dobro.

### Dois modelos de armazenamento, de propósito

| tabela | modelo | escrita concorrente? | TTL |
|---|---|---|---|
| `ranking_counters_by_item` | `counter` nativo, incremento atômico | sim | não aceita |
| `ranking_affinity_by_user_author` | `double` decaído + `updated_at`, ler-calcular-gravar | não | 6τ |

- Contador por item recebe escrita de muitas pessoas em paralelo, por isso é `counter`. Não é idempotente (reprocessar incrementa de novo, ±1 que não muda ordem) e não aceita TTL — não tente.
- Afinidade precisa esquecer, e esquecer é multiplicar, algo que `counter` não faz. Guarda a **contagem** por sinal já decaída, nunca score: os pesos são aplicados na leitura, então recalibrar peso não exige reprocessar histórico.
- A soma do tempo de exibição mora numa linha reservada `_dwell_ms_sum` da tabela de contadores, e só recebe o `dwellMs` das **impressões** (mesma população do denominador).
- Afinidade ignora `IMPRESSION`: é o evento mais volumoso e tem peso zero.

### Invariante que não pode quebrar

A ler-calcular-gravar da afinidade só é segura sem concorrência sobre o mesmo par leitor-autor. Três coisas garantem isso, cada uma com teste-cadeado:

1. o produtor do interaction-service publica `interactions.normalized` com **key = userId** (`interaction-service/src/kafka/__tests__/producer.test.ts`);
2. o `KafkaConsumer` deste serviço usa `eachMessage`, sem `eachBatch` nem `partitionsConsumedConcurrently` (`tests/unit/kafka.consumer.serialization.unit.spec.ts`);
3. `handleInteractions` processa os pares em laço sequencial, nunca `Promise.all` (`tests/unit/ranking_features.service.unit.spec.ts`).

Se algum desses testes falhar depois de uma mudança, a mudança está errada — não ajuste o teste.

### Pesos

Escala de teto 100 do catálogo de ações do desenho do produto, com exceções documentadas em `src/ranking/weights.ts`: `IMPRESSION = 0` (é denominador), `SKIP = -30`, `UNLIKE = -60`, e `NOT_INTERESTED = -200` rompendo o teto de propósito para preservar a assimetria de custo. Qualidade e atenção entram no score **normalizadas pela média da plataforma** (1 = item médio); sem isso uma troca de escala transforma a afinidade em ruído. Todos os números são chute até existir um mês de impressão real.

### Feed rankeado na rota (fase 2)

**Quem recebe ranking**, nesta ordem:

1. holdout cronológico permanente de 5% (`isInChronologicalHoldout`) — nunca recebe, nem com a fatia em 100%. É a régua do experimento;
2. do resto, a fatia `RANKING_ROLLOUT_SHARE` (0 a 1) do experimento `ranking-v1`. Valor ausente ou inválido vira 0. Trocar o nome do experimento reembaralha os grupos.

**Primeira página rankeada**: lê os 200 itens mais recentes da partição (`CANDIDATE_LIMIT`), monta as features (2 queries), ordena com `HeuristicScorer` e devolve os `limit` primeiros direto da memória. Se sobrar item, grava a ordem inteira em `feed_session_items` (lotes de 50 na mesma partição, TTL 30 min) e devolve um cursor de sessão. Custo fixo por primeira página: 1 leitura de 200 linhas + 2 queries de features + 4 lotes — aumentar `CANDIDATE_LIMIT` encarece toda primeira página.

**Páginas seguintes** leem `limit + 1` chaves da sessão a partir da posição e hidratam de `feed_by_user` com `(created_at, item_id) IN (...)` numa query de partição. O Cassandra devolve por `created_at`, então o serviço reordena pela sessão. Item apagado desde a primeira página é pulado.

**Cursor**: o app só repassa o texto, então o formato é livre.

| formato | exemplo | quando |
|---|---|---|
| data ISO | `2026-09-12T02:00:00.000Z` | caminho cronológico, e continuação depois do fim da sessão |
| sessão | `s1.<base64url de {s, o, t?}>` | páginas seguintes do rankeado |

- `t` (tail) só existe quando os candidatos bateram no teto: é a data do mais antigo. Quando a sessão acaba, o próximo cursor vira essa data e o feed segue cronológico dali, sem repetir nem pular.
- Sessão é servida mesmo que a fatia mude no meio: quem começou rankeado termina rankeado.
- Sessão expirada (30 min parado) **termina o feed** (`items: []`, `nextCursor: null`) em vez de abrir outra, que repetiria itens. Puxar para atualizar abre uma nova.
- `user_id` é chave de partição da sessão: cursor de outra pessoa não encontra nada.
- Mudar o conteúdo do token exige prefixo novo (`s2.`): cursores antigos continuam em apps abertos.
- **Não volte a pôr `format: "date-time"`** no `cursor` da querystring nem no `nextCursor` da resposta em `routes.ts`: o Fastify recusaria o token de sessão antes do controller. A validação é `parseFeedCursor`, e cursor inválido é 400, nunca 500.

**Limite honesto**: enquanto não houver impressões reais, a qualidade suavizada é igual para todos os itens (a taxa cai no prior), então o ranking se resume a **recência + afinidade com o autor**. Não ligue a fatia esperando efeito de engajamento antes de o app mandar impressão.

### Bug de bootstrap do runner de migration

`scripts/migrate.ts` consulta `feed_keyspace.schema_migrations` antes de rodar qualquer migration e usa o nome `feed_keyspace` fixo. Num keyspace novo a primeira consulta falha. Em ambiente novo, crie antes: `CREATE TABLE IF NOT EXISTS feed_keyspace.schema_migrations (version text PRIMARY KEY, executed_at timestamp);`
