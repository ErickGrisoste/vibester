# Feed Service

> Contexto específico do microserviço de feed (timeline agregada) do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este é o único serviço do monorepo que não usa PostgreSQL/Prisma — a persistência é **Cassandra via DataStax Astra** (Cassandra gerenciado na nuvem), modelada em tabelas wide-partition com TTL nativo em vez de Postgres + cache Redis. `ioredis`/`ioredis-mock` estão no `package.json` mas **não são usados em lugar nenhum do `src`** — não assuma que há cache Redis aqui. Validação de payload é feita com **Zod nos eventos Kafka** (`src/schema/events/*`), mas com **JSON Schema puro do Fastify nas rotas HTTP** (`routes.ts`) — os dois padrões coexistem por domínio (evento vs. rota), não por preferência livre.

---

## Responsabilidade do Serviço

O `feed-service` é responsável exclusivamente por:

- montar e servir a **timeline personalizada** de um usuário (`GET /feed/:userId`), paginada por cursor de `created_at`;
- **fan-out on write**: ao consumir eventos de outros domínios (post criado, evento criado, follow/unfollow), duplicar (desnormalizar) o item na partição de feed de cada seguidor, já com todos os dados de exibição embutidos (autor, estabelecimento, evento) para que a leitura seja uma única query por partição, sem joins;
- manter cópias auxiliares desnormalizadas por domínio (`posts_by_user`, `events_by_id`, `events_by_user`) e índices reversos (`feed_entries_by_post`) que permitem propagar updates/likes/deleções de um item para todas as cópias já distribuídas nos feeds dos seguidores;
- manter as relações de follow **localmente** (`followers_by_user`, `followers_by_establishment`), como cache de leitura rápida para o fan-out — a fonte de verdade do relacionamento social continua sendo `user-service`/`establishment-service`; este serviço só espelha o necessário para decidir "para quem distribuir".

Este serviço **não** possui lógica de criação de posts, eventos, perfis ou estabelecimentos — ele só reage a eventos Kafka publicados por esses domínios (ver `src/kafka/consumer.ts`) e serve a leitura agregada. Nunca adicione regra de negócio de autenticação, criação de conteúdo ou pagamento aqui.

**Gap de negócio real a considerar antes de mexer em confirmação de presença**: `handleEventConfirmed`/`handleEventUnconfirmed` (`src/services/feed.service.ts`) atualizam `attendees_by_event`, mas **nunca chamam** `EventsByIdRepository.updateTotalConfirmed` (que existe no repositório mas não é usado por nenhum service). Ou seja, `total_confirmed` exibido no feed é o valor no momento da criação/distribuição do evento e **não é atualizado** quando alguém confirma ou cancela presença. Da mesma forma, `softDelete` existe em `posts_by_user`, `events_by_id` e `events_by_user`, mas nenhum service chama esses métodos — toda remoção hoje é `DELETE` físico. Se for tocar nesse fluxo, decida explicitamente se vai usar/remover esse código morto em vez de assumir que ele já está ligado a algo.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/jwt`, `@fastify/cors`, `@fastify/swagger` (+ `swagger-ui`) — **sem `@fastify/rate-limit`**, diferente dos outros três serviços já documentados; a única rota HTTP hoje não tem limite de requisições próprio.
- **`cassandra-driver`** contra **DataStax Astra** (Cassandra gerenciado, cloud) — client singleton lazy em `src/config/cassandra.ts` (`getCassandraClient`), autenticado por `secureConnectBundle` + token (`credentials: { username: "token", password: env.astra_token }`). Todo repositório roda queries via `BaseRepository.execute` (`src/repositories/base.repository.ts`), que sempre usa `{ prepare: true }` (prepared statements) — não chame `getCassandraClient().execute` direto fora de um repositório que estenda `BaseRepository`.
- Kafka (`kafkajs`) — **consumidor** neste serviço (`KafkaConsumer` em `src/kafka/consumer.ts`, singleton `kafka` em `src/kafka/client.ts`). Existe um `src/kafka/producer.ts`, mas ele **não é importado/usado em nenhum lugar do `src`** — é código morto (possivelmente resquício de um fluxo de eventos de feed que nunca foi implementado). Não assuma que este serviço publica eventos.
- `zod` — usado **só** para validar o `data` dos eventos Kafka (`src/schema/events/*.schema.ts`) antes de chamar o `FeedService`. As rotas HTTP (`routes.ts`) usam JSON Schema puro do Fastify, como no `auth-service`/`establishment-service` — não migre a rota de feed para Zod isoladamente.
- `uuid`, `@faker-js/faker` — usados por scripts de desenvolvimento/seed, não em código de produção do `src` (ver `scripts/seed-feed.sh`, que popula o feed via `kubectl exec` publicando eventos Kafka reais em vez de chamar a API).
- `ioredis`/`ioredis-mock` estão nas dependências mas **não há nenhum uso de Redis no `src`** — nem cache, nem rate limit. O papel que Redis cumpre em `user-service`/`establishment-service` (cache-aside) é substituído aqui pelo próprio modelo de dados do Cassandra: partições por usuário + **TTL nativo** (`USING TTL` em praticamente todo `INSERT`) fazem o papel de "cache com expiração automática" (ver `src/services/ttl_service.ts`).
- Vitest para testes (unit + integration), mockando sempre `getCassandraClient` (nunca infra real) — **não existe pasta `tests/integration-real`** neste serviço, diferente dos outros três.

Não introduza Prisma/Postgres, um segundo client Cassandra, ou volte a usar Redis sem antes confirmar que o modelo de TTL do Cassandra não resolve o caso de uso.

---

## Estrutura de Pastas

```
src/
  config/        env.ts (lê process.env direto, sem schema), cassandra.ts (client Astra singleton), swagger.ts
  controllers/   feed.controller.ts                    → única rota (getFeedByUser), try/catch, valida limit/cursor manualmente
  services/      feed.service.ts                         → orquestrador único: fan-out, updates propagados, follow/unfollow, eventos
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
                   base.repository.ts                      → execute(query, params) com prepare:true sobre o client singleton
  kafka/         client.ts (singleton), consumer.ts (assinatura de tópicos + dispatch), producer.ts (não usado)
  schema/events/ um schema Zod por payload de evento Kafka (post-created, post-deleted, post-liked/unliked, post-content/stats-updated,
                 follow, event-confirmance, event-unconfirmance, kafka-event → envelope genérico {eventId, eventType, occurredAt, data})
  types/         feed.types.ts (FeedItem, FeedItemType), post.types.ts (Post), event.type.ts (Event)
  routes.ts      /health + GET /feed/:userId (schema JSON Schema, onRequest com jwtVerify + checagem de dono)
  server.ts      bootstrap Fastify, CORS aberto, JWT, swagger, inicia o KafkaConsumer antes do listen
  generate-spec.ts  script standalone (não referenciado em package.json scripts) que gera o JSON do OpenAPI para um arquivo
migrations/      *.cql versionadas (V000..V009), aplicadas por scripts/migrate.ts (runner próprio, sem Flyway/Liquibase)
scripts/         migrate.ts (roda .cql pendentes e registra em feed_keyspace.schema_migrations), seed-feed.sh (seed manual via Kafka real)
tests/
  unit/          feed.service.unit.spec.ts, feed.ttl.unit.spec.ts — mocka getCassandraClient
  integration/    feed.integration.spec.ts (app.inject na rota) e feed.consumer.spec.ts (chama métodos do FeedService diretamente,
                   simulando o consumer) — ambos mockam getCassandraClient, nenhum roda contra Cassandra real
  helpers/, setup/  fastify.test.helper.ts (buildServer + makeAuthHeader), vitest.setup.ts (mocka src/config/env globalmente)
```

### Padrão de uma feature nova

1. **Nova tabela/consulta Cassandra**: modele a partition key em torno do padrão de leitura (ex.: `feed_by_user` particiona por `user_id` porque a leitura é sempre "feed de um usuário"), adicione uma migration `.cql` nova em `migrations/` com o próximo número de versão (`VNNN__descricao.cql`) e rode `npm run migrate` — não edite uma migration já aplicada em produção.
2. Crie um `*.repository.ts` novo estendendo `BaseRepository`, um método por operação, sempre com `?` parametrizado (nunca concatenar valor na query CQL) e `USING TTL ?` explícito em todo `INSERT` que representa um item de feed/conteúdo com expiração esperada.
3. Se o dado vem de um evento Kafka novo: crie um schema Zod em `src/schema/events/<evento>.schema.ts`, registre o handler em `src/kafka/consumer.ts` — decida explicitamente se ele entra no `topics`/`handlers` (convenção de envelope genérico `{eventId, eventType, occurredAt, data}` sobre um tópico de domínio, ex. `posts`, `users`) ou em `directTopicHandlers` (convenção de tópico próprio por evento com o payload cru, ex. `post.liked`). **Hoje as duas convenções coexistem e até se sobrepõem** (`user.followed`/`user.unfollowed` são tratados tanto como `eventType` dentro do tópico `users` quanto como tópicos próprios em `directTopicHandlers`) — ao adicionar um evento novo, confirme com o serviço produtor qual convenção ele realmente usa antes de escolher uma das duas.
4. Lógica de negócio nova entra em `FeedService` (`src/services/feed.service.ts`) — é uma classe única com todos os handlers; TTL de qualquer item novo deve passar por `FeedTtlService.getTtl`/`calculateEventTTL` (`src/services/ttl_service.ts`), nunca hardcode um TTL novo solto num repository.
5. Se a mudança afeta o formato do item de feed, atualize `feedItemSchema` em `routes.ts` (resposta HTTP) e o schema Zod correspondente em `src/schema/events/post-created.schema.ts` — os dois precisam ficar coerentes com `FeedItem` (`src/types/feed.types.ts`).
6. Toda feature nova precisa de: teste unitário do service em `tests/unit` (mockando `getCassandraClient`) e, se mexer na rota, teste de integração em `tests/integration/feed.integration.spec.ts`.

---

## Segurança — obrigatório em qualquer alteração

1. **`GET /feed/:userId` já valida que o usuário autenticado só pode ler o próprio feed**: o `onRequest` em `routes.ts` faz `request.jwtVerify()` e depois compara `request.user.accountId !== request.params.userId` (403 se divergir). Preserve essa checagem em qualquer rota nova de leitura de feed — nunca confie apenas no `userId` da URL sem comparar com o token.
2. **CORS está totalmente aberto** (`origin: true` em `server.ts`) — mais permissivo que os outros três serviços já documentados (que usam env var, `false` ou lista explícita). Se este serviço passar a expor rotas mais sensíveis, revisite esse `origin` antes de assumir que está protegido só pelo JWT.
3. **Não há `@fastify/rate-limit` neste serviço** — `GET /feed/:userId` é a única rota pública e não tem limite de requisições. Se for adicionar uma rota nova exposta a clientes finais (app mobile/web), avalie se ela precisa de rate limit antes de publicá-la, seguindo o padrão de `config.rateLimit` já usado no `auth-service`/`establishment-service` (isso exigiria adicionar a dependência).
4. **Payload de todo evento Kafka é validado por Zod antes de qualquer efeito colateral** (`schema.parse(data)` dentro dos handlers de `consumer.ts`) — mantenha isso para qualquer evento novo; nunca passe `data` bruto do Kafka direto para um método do `FeedService` sem passar por um schema Zod dedicado.
5. **Erros de mensagem Kafka nunca derrubam o consumer**: `handleMessage` envolve o parse + dispatch em `try/catch` e só faz `console.error` — preserve esse isolamento por mensagem (uma mensagem malformada ou um handler que lança exceção não deve parar o consumo das próximas). Como consequência, **hoje não há dead-letter queue nem retry** — uma mensagem que falha é efetivamente descartada após o commit automático do `kafkajs`; se a confiabilidade de algum evento novo for crítica, isso precisa ser resolvido explicitamente (DLQ, retry manual), não assumido como já coberto.
6. **Nunca vazar credenciais Astra** (`astra_token`, conteúdo do `secure connect bundle`) em log, resposta HTTP ou mensagem de erro — hoje `console.error(error)` no controller e no consumer já é o padrão de log de erro; ao adicionar logging novo, não inclua o objeto `env` inteiro.
7. **Erros internos nunca vazam para o cliente**: qualquer exceção não mapeada em `feed.controller.ts` vira `500 { message: "Internal server error" }` genérico; detalhes vão só para `console.error`.
8. **Segredos**: `JWT_SECRET`, `ASTRA_TOKEN`, o secure connect bundle (montado via `k8s/deployment.yaml` como `Secret` em `/secure-connect`) sempre via env/secret do k8s — nunca hardcode. O `.env.example` atual está **desatualizado**: usa `ASTRA_SECURE_BUNDLE_PATH`, enquanto o código (`src/config/env.ts`) lê `process.env.ASTRA_SECURE_CONNECT_BUNDLE`, e `JWT_SECRET` (obrigatório, valida no boot) nem aparece no arquivo. Se for adicionar uma env var nova, corrija esse arquivo em vez de perpetuar a divergência.

---

## Performance — obrigatório em qualquer alteração

Este serviço existe para servir timeline em alta concorrência com baixa latência de leitura. Ao alterar código:

1. **Leitura do feed é sempre uma única query de partição** (`SELECT * FROM feed_by_user WHERE user_id = ? [AND created_at < ?] LIMIT ?`, `FeedRepository.findByUser`) — a paginação por cursor (`created_at`) evita `OFFSET`/`SKIP`, que não existe em Cassandra. Qualquer leitura nova de listagem deve seguir esse padrão (partition key + clustering column como cursor), nunca `ALLOW FILTERING` ou scan completo.
2. **TTL nativo do Cassandra é o mecanismo de expiração/controle de crescimento**, não um cache separado: posts de usuário duram 7 dias no feed, de estabelecimento/patrocinado 15 dias (`FEED_TTL` em `ttl_service.ts`), eventos expiram 2 dias após a data do evento (`calculateEventTTL`). Se adicionar um novo `item_type`, defina o TTL em `FeedTtlService.getTtl` em vez de espalhar um número mágico em um repository.
3. **Fan-out on write sem paginação nem limite de concorrência é o maior risco de escala atual**: `UserFollowerRepository.findFollowersByUser`/`EstablishmentFollowersRepository.findFollowersByEstablishment` fazem `SELECT follower_id FROM ... WHERE user_id/establishment_id = ?` **sem `LIMIT`**, e `distributePostToFollowers`/`distributeEventToFollowers` (`feed.service.ts`) disparam um `Promise.all` com uma escrita Cassandra por seguidor. Para uma conta/estabelecimento com centenas de milhares de seguidores, isso vira uma única leva de centenas de milhares de writes simultâneos por post — não escala para o volume que o `CLAUDE.md` raiz assume como premissa. Se for expandir esse fluxo (mais volume, contas grandes/verificadas), considere paginar a leitura de seguidores e distribuir em lotes (batches) com concorrência limitada, em vez de aumentar o alcance do `Promise.all` atual.
4. **Toda mutação em cascata usa `Promise.all`, nunca loop sequencial**: `handleContentPostUpdated`, `handlePostStatsUpdated`, `handlePostDeleted` buscam as entradas em `feed_entries_by_post` (índice reverso) e aplicam a atualização em paralelo em cada cópia do feed — preserve esse padrão em qualquer propagação nova; não troque por `for...of` sequencial.
5. **`feed_entries_by_post` é o índice que evita `ALLOW FILTERING`** para localizar em quais feeds um post/evento está copiado (likes, edição, exclusão). Qualquer novo tipo de item que precise ser atualizável/removível após distribuído **precisa** de uma entrada equivalente nesse índice (ou um novo índice reverso do mesmo padrão) — não tente atualizar `feed_by_user` filtrando por `item_id` sem um índice, pois `item_id` não é chave de partição/clustering dessa tabela.
6. **Prepared statements sempre** (`{ prepare: true }` em `BaseRepository.execute`) — qualquer novo método de repository deve passar pelo `execute` da base em vez de chamar o client Cassandra diretamente, para manter o cache de prepared statements do driver.
7. **Client Cassandra é singleton lazy** (`getCassandraClient` em `src/config/cassandra.ts`) — nunca instancie um novo `cassandra.Client` num service/repository; o mesmo vale para o singleton do Kafka (`src/kafka/client.ts`).
8. **`findRecentPostsByUser`/`findRecentEventsByAuthor` já limitam a 15 itens** (`LIMIT 15`) ao migrar histórico recente para um novo seguidor — ao alterar a janela de "recente" (hoje 15 dias, hardcoded em `addRecentPostsToFollowerFeed`/`addRecentEventsToFollowerFeed`), lembre que aumentar o período ou o limite aumenta proporcionalmente o custo de cada novo follow.
9. Ao adicionar rota ou consumidor novo, pense no custo em alta volumetria (milhões de itens de feed, contas com muitos seguidores) desde o desenho da partição/clustering key, não como otimização posterior — em Cassandra, corrigir uma partition key errada depois exige migração de dados, não só um índice novo.

---

## Testes

- `npm test` — roda tudo em `tests/**/*.spec.ts` (unit + integration), sempre mockando `getCassandraClient` via `vi.mock("../../src/config/cassandra", ...)` — nenhum teste bate em Cassandra real; **não existe** uma suíte `integration-real` neste serviço.
- `npm run test:coverage` — thresholds mínimos **70% linhas, 70% funções, 60% branches**, medidos sobre `src/services`, `src/controllers`, `src/routes.ts` (`vitest.config.ts`) — não reduza esses valores para fazer um PR passar.
- `tests/setup/vitest.setup.ts` mocka `src/config/env` globalmente (bundle/token/keyspace fake) — se adicionar uma env var nova em `env.ts`, adicione o valor fake correspondente aqui também, senão os testes que importam `env` indiretamente podem quebrar.
- `tests/integration/feed.consumer.spec.ts` testa o consumer **chamando os métodos do `FeedService` diretamente** (não sobe um Kafka de verdade nem usa `EachMessagePayload`) — ao adicionar um handler novo, siga esse mesmo padrão: teste o método do service com o payload já validado, não o parsing do Kafka em si.
- `npm run migrate` não é testado automaticamente — ao adicionar uma migration `.cql` nova, valide manualmente contra uma keyspace de teste/dev antes de assumir que ela roda limpa em produção via `scripts/migrate.ts`.
- Toda feature nova precisa de: teste unitário do método novo em `FeedService` (incluindo o branch sem seguidores/entries e o branch com seguidores/entries, como já feito para `handlePostCreated`/`handlePostDeleted`), e teste de integração da rota se a mudança afetar `GET /feed/:userId`.

---

## Variáveis de Ambiente

Diferente do `establishment-service` (Zod `safeParse`) e do `auth-service` (todas centralizadas com default), aqui `src/config/env.ts` **lê `process.env` direto com non-null assertion (`!`)**, sem schema de validação — só `JWT_SECRET` é checado explicitamente no boot (`process.exit(1)` se ausente); as demais (`ASTRA_*`, `KAFKA_BROKERS`) falham silenciosamente em runtime (erro de conexão) se estiverem ausentes, não no startup. Ao adicionar uma env var nova, prefira segui o padrão existente (adicionar em `env.ts`) mas considere validar explicitamente no boot como já é feito para `JWT_SECRET`, em vez de deixar mais uma variável sem checagem.

O **`.env.example` está desatualizado em relação ao código** — ao mexer em qualquer env var, corrija também este arquivo:
- usa `ASTRA_SECURE_BUNDLE_PATH`, mas o código lê `ASTRA_SECURE_CONNECT_BUNDLE`;
- não lista `JWT_SECRET`, que é obrigatório e validado no boot;
- lista `KAFKA_CLIENT_ID`, que **não é lido em lugar nenhum** (`src/kafka/client.ts` hardcoda `clientId: "feed-service"`);
- `astra_client_id`/`astra_client_secret` são carregados em `env.ts` a partir de `ASTRA_CLIENT_ID`/`ASTRA_CLIENT_SECRET`, mas **não são usados** por `src/config/cassandra.ts` (a autenticação real é só `secureConnectBundle` + `astra_token`) — são valores mortos hoje.

Propague qualquer variável nova no `k8s/deployment.yaml` (via `envFrom.secretRef: feed-service-secret`, hoje o único mecanismo usado — não há `configMapRef` neste serviço).

---

## Infra deste Serviço

- `Dockerfile`: build em um único estágio (`npm install` → `npm run build` → `npm start`), sem multi-stage e sem `npm ci --omit=dev`/`npm prune` — a imagem final carrega `devDependencies`. Diferente de `auth-service`/`establishment-service`, **o `CMD` não roda nenhuma migration** — o schema do Cassandra (`migrations/*.cql`) precisa ser aplicado à parte via `npm run migrate` (`scripts/migrate.ts`), antes ou depois do deploy; não assuma que uma migration nova será aplicada automaticamente ao subir um pod novo.
- `docker-compose.yml` local sobe **Kafka** (+ `kafka-init` criando os tópicos `posts`/`users`/`establishments`/`events` e `kafka-ui`) **e também o próprio `feed-service`** (`build: .`, porta `3006`, `depends_on: kafka`/`kafka-init`) — mas só define `KAFKA_BROKERS` como env var; `ASTRA_*`/`JWT_SECRET` não são setados no compose, então o container do `feed-service` só sobe de fato se essas variáveis vierem de fora (`.env`/shell). **Não há Cassandra local no compose**; rodar este serviço localmente depende de credenciais reais de uma instância Astra (ou mockar `getCassandraClient` como os testes fazem). Se for melhorar o setup local, considere isso antes de assumir que `docker-compose up` sobe o serviço fim-a-fim.
- `k8s/`: só existem `deployment.yaml` e `service.yaml` — **não há `hpa.yaml` nem `pdb.yaml`** neste serviço (diferente dos outros três, que ao menos têm autoscaling configurado, mesmo que fixo). `replicas: 1` é hardcoded no `deployment.yaml`; hoje o serviço **não escala horizontalmente**. Ao tornar este serviço apto a múltiplas réplicas, lembre que o consumer Kafka já usa `groupId: "feed-service-group"` (`consumer.ts`), então múltiplas réplicas já dividiriam partições corretamente — falta apenas o HPA/PDB, não uma mudança de lógica de consumo.
- O secure connect bundle da Astra é montado como `Secret` (`astra-bundle`) em `/secure-connect` (`volumeMounts`/`volumes` no `deployment.yaml`) — a env var `ASTRA_SECURE_CONNECT_BUNDLE` (do `feed-service-secret`) precisa apontar para um caminho dentro desse mount; se o nome do arquivo dentro do secret mudar, atualize os dois lados juntos.
- `readinessProbe`/`livenessProbe` apontam para `/health`, que hoje só retorna `{ status: "ok" }` estático (`routes.ts`) — **não verifica conectividade real com Cassandra ou Kafka**. Diferente do `/ready` do `user-service`/`establishment-service`, um pod pode passar no readiness mesmo com a conexão Astra ou o consumer Kafka quebrados. Se for melhorar observabilidade, esse é o primeiro lugar a mexer.
- Sem métricas Prometheus e sem tracing (OpenTelemetry) neste serviço — nenhum dos dois está presente nas dependências.
