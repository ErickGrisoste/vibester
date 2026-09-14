# Interaction Service

> Contexto específico do microserviço de coleta de interações do Vibester.
> Complementa o `CLAUDE.md` da raiz do monorepo. Em conflito, a raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece nas convenções deste serviço. O código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este é o único serviço do monorepo que **exige JWT**. Todos os vizinhos (`post-service`, `user-service`) aceitam `userId` no body sem verificar identidade. Não copie a ausência de auth deles para cá — aqui a auth é o que protege o dado de treino do ranking.

---

## Por que este serviço existe

O Vibester registra likes mas **não registra impressões**. Sem o denominador, não há taxa de engajamento: não dá para diferenciar um post com 10 likes em 20 impressões de um com 10 likes em 5.000. Nenhuma linha de ranking faz sentido antes disso.

Este serviço é a fase 0 do roteiro de recomendação: coletar os sinais implícitos. É a peça que perde valor a cada dia — dado não coletado não volta.

**Ele não faz ranking, não calcula contador e não ordena feed.** Se uma feature parece ser "escolher o que mostrar", ela não é daqui.

---

## Responsabilidade do Serviço

- receber, validar e publicar no Kafka os sinais que **só o cliente conhece**: `IMPRESSION`, `DWELL`, `SKIP`, `TAP_DETAIL`, `PROFILE_OPEN`, `NOT_INTERESTED`, `DIRECTIONS_CLICK`, `TICKET_CLICK`;
- consumir os tópicos que outros serviços **já publicam** (`post.liked`, `post.unliked`, `post.commented`, `user.followed`) e normalizá-los no mesmo log;
- persistir o log bruto em `interactions_by_user` (Cassandra), com TTL;
- **republicar toda interação persistida em `interactions.normalized`**, o stream canônico que consumidores downstream (o ranking do `feed-service`) devem ler.

### `interactions.normalized` não é opcional

`interactions.raw` só carrega sinais do cliente — a API rejeita `LIKE`, `COMMENT` e `FOLLOW` lá, por causa da regra de origem abaixo. Esses sinais chegam pelos tópicos dos serviços de domínio e, sem a republicação, ficariam presos neste serviço: o ranking do feed rodaria sem curtida nenhuma. Isso aconteceu de fato numa versão anterior, e um teste de worker que injetava `LIKE` direto em `interactions.raw` mascarou o problema — o teste passava por um caminho que a API real bloqueia. O teste de regressão está em `src/kafka/__tests__/consumer.test.ts`.

Ordem no worker: **persistir antes de publicar**. Falha de publicação propaga, o Kafka reentrega a mensagem de origem, a regravação no log é idempotente — mas a republicação não é, então o consumidor downstream pode receber duplicata. Downstream precisa tolerar isso.

### Regra de origem — não viole

**O cliente só manda o que só ele sabe.** Like, comentário e follow já viram evento Kafka nos serviços de origem. O cliente não deve reenviá-los, e a API **rejeita** esses tipos (`DERIVED_INTERACTION_TYPES` em `src/types/interaction.types.ts`): seriam duplicata, e um cliente hostil poderia forjar um LIKE que nunca aconteceu.

Ao adicionar um sinal novo, a primeira pergunta é: *algum serviço já sabe disso?* Se sim, consuma o tópico dele. Se não, aceite do cliente.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/cors` (`origin: true`), `@fastify/helmet`, `@fastify/rate-limit` (global, em memória), `@fastify/jwt` (**obrigatório**, ver Segurança).
- **Cassandra** (`cassandra-driver`) via DataStax Astra em produção, ou `CASSANDRA_CONTACT_POINTS` em local/CI (`src/config/cassandra.ts`). Migrations `.cql` em `migrations/`, aplicadas pelo runner próprio `scripts/migrate.ts` (mesmo padrão do `post-service`, **não** Prisma).
- Kafka (`kafkajs`) — no modo api, **produtor** em `interactions.raw`; no modo worker, **consumidor** de `interactions.raw` + os quatro tópicos de domínio **e produtor** em `interactions.normalized`.
- `zod` para validação de env (`src/config/env.ts`) e de payload (`src/schema/interaction.schema.ts`).
- **Sem Redis.** A fase 0 não tem leitura cacheável. Não adicione antes de existir uma rota de leitura que justifique.
- Vitest: unit em `src/**/__tests__`, rota mockada em `tests/integration`, Cassandra real em `tests/integration-real`.

---

## Os dois modos (`SERVICE_MODE`)

Uma imagem, dois Deployments:

| Modo | O que faz | Depende de | Porta |
|---|---|---|---|
| `api` | Valida e publica no Kafka. **Nunca abre conexão com o Cassandra.** | Kafka | 3007 |
| `worker` | Consome Kafka, persiste no Cassandra e republica em `interactions.normalized`. Aplica as migrations no start. | Kafka (consumo e produção) + Cassandra | 3007 |

O entrypoint é `src/server.ts`, que despacha para `src/api.ts` ou `src/worker.ts`.

**Nunca renomeie `SERVICE_MODE` para `MODE`**: o Vitest injeta `process.env.MODE=test`, e o boot quebraria em qualquer contexto com ferramental Vite. Está comentado em `src/config/env.ts`.

Não junte os dois modos num processo só (como o `notification-service` faz): a API escala por requisições/segundo, o worker por lag de partição. Juntos, um obriga o outro a escalar sem necessidade.

---

## Modelagem no Cassandra

Uma tabela só: `interactions_by_user`.

```
PRIMARY KEY ((user_id, day_bucket), occurred_at, event_id)
```

1. **`day_bucket` na chave de partição** (`YYYY-MM-DD`, UTC): sem ele, ~120 impressões/dia viram ~44 mil linhas por ano numa única partição. O bucket é **detalhe de armazenamento, não "dia de negócio"** — num app de vida noturna a festa das 2h pertence à noite anterior, então qualquer agregação por "noite" precisa calcular isso separadamente e **não** reaproveitar este campo (`src/utils/bucket.ts`).
2. **`event_id` fecha a chave**: é o que dá idempotência. Reprocessar mensagem do Kafka reescreve a mesma linha em vez de duplicar. Eventos do cliente trazem `eventId` próprio; os derivados de tópico não têm, então o id é derivado do conteúdo (`src/utils/deterministic-uuid.ts`).
3. **TTL por linha no INSERT** (`INTERACTION_TTL_DAYS`, 90 por padrão): o log bruto é matéria-prima de treino, não arquivo histórico. Expira sozinho, sem job de limpeza.
4. **Não existe `interactions_by_item`, de propósito.** O lado do item, na fase 1, será servido por tabela de `counter` alimentada do Kafka — não por varredura do log. Criar a segunda tabela agora seria escrever ~1,2M linhas/dia para nunca ler.

Ao adicionar campo novo, lembre que ele precisa entrar no INSERT **e** no schema Zod do envelope (`normalizedInteractionSchema`), senão o worker descarta a mensagem silenciosamente.

---

## Segurança — obrigatório em qualquer alteração

1. **JWT é obrigatório na ingestão.** `src/plugins/auth.ts` verifica o token e o controller lê o `accountId` dele. `userId` **nunca** vem do body. Sem isso, qualquer chamador injetaria impressão falsa em nome de outra pessoa — e dado de treino envenenado não se limpa depois.
2. **Use `accountId`, nunca `userId` do token.** O `auth-service` assina `{ userId, accountId }`, onde `userId` é o id da linha `Access` (autenticação) e `accountId` é a identidade pública que `post-service`, `user-service` e `feed-service` usam — confirmado no app mobile, que lê `user.accountId` e envia como `userId`. Gravar o campo errado produziria um identificador que não casa com nenhum outro serviço, e o erro só apareceria meses depois. Use sempre `getAccountId(request)`.
3. **A API rejeita tipos derivados** (`LIKE`, `UNLIKE`, `COMMENT`, `FOLLOW`) — ver a regra de origem acima.
4. **`occurredAt` é limitado** a uma janela (`MAX_EVENT_AGE_HOURS`, e no máximo 5 min no futuro): relógio de cliente fora de sincronia contamina qualquer cálculo de recência. A **revalidação no worker não aplica essa janela**, de propósito: mensagem represada no tópico durante indisponibilidade precisa ser recuperada, não descartada.
5. **Rate limit é global e em memória**, sem store Redis. Funciona porque `replicas: 1`; ao ganhar autoscaling, cada pod passa a contar separado — migre para store Redis antes de aumentar réplicas.
6. **Erros**: lance `HttpError` para erro esperado; `ZodError` vira 400 com lista de campos; o resto vira 500 genérico (`src/errors/error.handler.ts`, mesmo contrato do `post-service`).
7. **Segredos** (`JWT_SECRET`, credenciais do Astra) sempre via Secret do k8s. O Deployment da **api não recebe credencial do Astra** — não adicione: ele não usa banco.

---

## Performance — obrigatório em qualquer alteração

1. **A API não escreve no banco.** Valida e publica; responde `202`, não `201`, porque a persistência é assíncrona — prometer 201 seria mentir sobre durabilidade. Não introduza escrita síncrona no caminho de ingestão.
2. **Um lote = uma mensagem Kafka.** Uma mensagem por evento seria ~1,2M/dia; em lotes de ~20, são 60 mil. Chave de partição = `userId`, o que mantém a ordem por pessoa e espalha a carga.
3. **Nunca `Promise.all` sobre lista de tamanho arbitrário.** Use `runWithConcurrency` (`src/utils/concurrency.ts`) com teto de `CASSANDRA_WRITE_CONCURRENCY`. Essa é exatamente a dívida conhecida do `feed-service` — não a reproduza aqui.
4. **Sem `BATCH` do Cassandra**: as linhas caem em partições diferentes, e BATCH entre partições piora a latência sem dar atomicidade real.
5. **Quando a fase 1 trouxer contadores, use coluna `counter` nativa.** O `post-service` faz read-modify-write manual e o CLAUDE.md dele marca isso como race condition real — não é padrão a copiar.
6. **Mensagem inválida não trava a partição**: os handlers devolvem lista vazia / `null` em vez de lançar, então o worker faz ack e segue. Só falha de **escrita** propaga, para que o Kafka reentregue — e a idempotência da chave primária é o que torna a reentrega segura. Preserve essa distinção: transformar erro de parse em exceção cria retry infinito numa mensagem envenenada.
7. **`replicas: 1` no worker é travado pelo migrate no CMD.** Para escalar, mova o migrate para um Job/initContainer único antes de subir réplicas. O consumer group já está pronto (groupId fixo).

---

## Health checks

`/health` e `/ready` são **endpoints diferentes de propósito**:

- `/health` (liveness): só diz que o processo está vivo. Não checa dependência.
- `/ready` (readiness): no modo api, checa o broker Kafka; no worker, checa consumidor + Cassandra.

O `post-service` aponta liveness e readiness para o mesmo `/health`, que checa o banco — o efeito é reiniciar o pod quando o Astra oscila, mesmo com o Node saudável. Não replique isso.

---

## Testes

- `npm test` — unit + rota mockada. **Não precisa de nenhuma infra.**
- `npm run test:unit` — só `src/**/*.test.ts`.
- `npm run test:integration` — `tests/integration-real/`, contra Cassandra **real**. Exige `docker compose -f docker-compose.test.yml up -d --wait` e `npm run migrate` antes, e as env vars `ASTRA_KEYSPACE`, `CASSANDRA_CONTACT_POINTS`, `KAFKA_BROKERS`, `JWT_SECRET`.
- `tests/setup/vitest.setup.ts` mocka `src/config/env` inteiro — e **não** é usado por `tests/integration-real`, que precisa do env real.
- Não há Kafka nos testes: o produtor é mockado (mesma decisão do `post-service`). O caminho API → Kafka → worker só é validado manualmente.

Os testes que provam o design (TTL, idempotência, bucket de partição, lote acima do limite de concorrência) estão em `tests/integration-real/interaction.repository.spec.ts`. Nenhum teste mockado cobre isso — se for mexer na modelagem, é lá que o erro aparece.

Toda feature nova precisa de: teste unitário do service/handler (incluindo os branches de payload malformado) e teste da rota.

---

## Variáveis de Ambiente

Toda variável é validada por Zod em `src/config/env.ts` (`process.exit(1)` se inválida). Não leia `process.env` direto em outro arquivo do `src/` — a exceção existente é `scripts/migrate.ts`, que roda fora do runtime do server. Propague em `.env.example` (placeholder vazio) e nos dois Deployments do `k8s/`.

---

## Infra deste Serviço

- `Dockerfile`: build em 2 estágios. `npm install --legacy-peer-deps` contorna um bug do arborist (npm 10) ao resolver os peers opcionais do vitest — não afeta dependência de runtime. O `CMD` roda o migrate **só quando `SERVICE_MODE=worker`**: rodar nos dois Deployments colocaria duas réplicas aplicando DDL ao mesmo tempo, causando desacordo de schema no Cassandra.
- `k8s/`: `deployment-api.yaml`, `deployment-worker.yaml` e `service.yaml`. O **worker não tem Service** (nada o chama por HTTP; os probes batem direto no pod). O worker usa `strategy: Recreate`, para não forçar um rebalance extra do consumer group durante deploy.
- CI (`.github/workflows/interaction-service.yml`) usa **`npm ci --legacy-peer-deps`**, não `npm install`: instala exatamente o lockfile e evita o bug de resolução de peers. No deploy, o **worker sobe antes da api**, porque é ele que aplica as migrations.
- Sem métricas Prometheus e sem tracing. Observabilidade hoje é só log estruturado do Pino. Para um serviço de ingestão, o que mais faltará primeiro é **lag do consumer group** — não assuma que existe.
- Swagger em `/docs`, sempre registrado, sem flag para desligar.

---

## O que NÃO fazer aqui

- ranking, ordenação ou seleção de conteúdo;
- contador agregado por item (fase 1, e com coluna `counter`);
- leitura pública do log de interação (`findByUserAndDay` é apoio de teste/depuração, não rota);
- aceitar `userId` no body;
- aceitar do cliente um sinal que outro serviço já publica.
