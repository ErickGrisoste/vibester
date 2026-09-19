# Payment Service

> Contexto específico do microserviço de pagamentos do Vibester.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto/arquitetura; este arquivo prevalece em convenções específicas deste serviço. Código-fonte é sempre a fonte de verdade final.
>
> **Atenção**: este serviço foi migrado de Go para Node.js/TypeScript. Há pontos assumidos por falta de acesso à documentação oficial da AbacatePay neste repositório (ver seção "Pontos em aberto com a AbacatePay" abaixo) — não trate esses trechos como comportamento confirmado em produção sem validar contra a API/sandbox real.

---

## Responsabilidade do Serviço

O `payment-service` é responsável exclusivamente por:

- criar um checkout na AbacatePay para um produto/quantidade e devolver a URL de pagamento (`POST /checkout`);
- registrar a cobrança localmente com status `PENDING` no momento da criação;
- receber a confirmação/falha de pagamento via webhook da AbacatePay (`POST /webhook/abacatepay`) e atualizar o status para `PAID`/`FAILED`;
- publicar eventos Kafka (`payment.checkout.created`, `payment.confirmed`, `payment.failed`) para que outros serviços reajam de forma assíncrona.

Nunca adicione regras de negócio de autenticação, perfil, evento ou estabelecimento aqui. Se uma feature parece pertencer a outro domínio, ela deve ser feita no serviço correspondente e comunicada via Kafka.

---

## Stack e Dependências deste Serviço

- Fastify 5 + `@fastify/cors`, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/swagger` (+ `swagger-ui`)
- Prisma 7 com `@prisma/adapter-pg` (driver adapter sobre `pg.Pool`), mesmo padrão do `auth-service`
- PostgreSQL
- Kafka (`kafkajs`) — produtor apenas, sem consumidores neste serviço
- `fetch`/`AbortController` nativos do Node (sem lib HTTP externa) para chamar a AbacatePay
- Vitest para testes (unit + integration com `app.inject`)

Não introduza um ORM alternativo, outro cliente Kafka, ou uma lib HTTP diferente sem necessidade real.

---

## Estrutura de Pastas

Segue o mesmo padrão do `auth-service`: `src/config`, `src/controllers`, `src/services`, `src/errors`, `src/kafka`, `src/prisma`, `src/types`, `src/routes.ts`, `src/server.ts`, mais `src/abacatepay/client.ts` (client HTTP da AbacatePay, específico deste serviço).

### Padrão de uma feature nova

Mesmo fluxo do `auth-service`: `types/<feature>.types.ts` → `services/<feature>.service.ts` (lança `AppError(message, statusCode)`) → `controllers/<feature>.controller.ts` (try/catch: `AppError` vira `{ error }` com o status certo, qualquer outro erro vira `request.log.error` + `500 { error: "Erro interno do servidor" }`) → `routes.ts` (schema Fastify completo + `config.rateLimit` quando sensível) → testes unit do service/controller + integration da rota.

---

## Pontos em aberto com a AbacatePay (confirmar antes de produção)

1. **Campo de valor na resposta do checkout**: `src/abacatepay/client.ts` (`CheckoutResponseData.amount`) assume que `POST /checkouts/create` devolve o valor total em `data.amount` (centavos). Essa suposição nunca foi confirmada contra a documentação/sandbox real da AbacatePay. Se o campo tiver outro nome (ou não existir), `checkout.service.ts` cai no fallback `amount = 0` — reproduzindo o bug que motivou a correção. Antes de considerar esse fluxo pronto para produção, validar com uma chamada real.
2. **Mecanismo de validação do webhook**: `verifyWebhookSecret` (`src/routes.ts`) valida um secret simples via querystring (`?webhookSecret=`) comparado com `ABACATEPAY_WEBHOOK_SECRET`. Isso é uma suposição de como a AbacatePay autentica webhooks — não uma assinatura HMAC confirmada. Se a AbacatePay usar outro mecanismo (header de assinatura, por exemplo), esse trecho precisa ser reescrito antes de ir para produção.
3. **Nomes de evento do webhook**: `webhook.service.ts` (`mapEventToStatus`) assume os valores `billing.paid`, `billing.failed`, `billing.expired`. Confirmar contra o payload real enviado pela AbacatePay.
4. **Lista de `methods` aceitos**: a rota documenta `PIX`/`CREDIT_CARD` (valor mais recente encontrado no `openapi-partial.json` do serviço em Go), mas o Postman collection antigo usava `PIX`/`CARD` — os dois documentos divergiam entre si mesmo antes da migração. Confirmar o valor real aceito pela AbacatePay.

---

## Segurança — obrigatório em qualquer alteração

1. `POST /checkout` exige JWT (`preHandler: [authenticate]`, mesmo secret compartilhado do `auth-service`) — é uma rota que gera cobrança real na AbacatePay; nunca remova essa checagem.
2. `POST /webhook/abacatepay` **não** usa JWT (quem chama é a AbacatePay, não um client do Vibester) — usa o secret de webhook (ver "Pontos em aberto" acima). Não abra essa rota sem alguma forma de validação.
3. O update de status pelo webhook é idempotente (`webhook.service.ts` não faz nada se o pagamento já saiu de `PENDING`) — importante porque provedores de pagamento costumam reenviar o mesmo webhook; não remova essa checagem achando que é redundante.
4. Erros internos nunca vazam para o cliente: qualquer exceção não mapeada vira `request.log.error` + `500 { error: "Erro interno do servidor" }` genérico.
5. `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET` e `JWT_SECRET` são segredos — nunca hardcode, nunca logue.

---

## Testes

- `npm test` — unit + integration (mocka Prisma/Kafka/AbacatePay client via `tests/mocks`)
- `npm run test:coverage` — cobertura focada em `src/services`, `src/controllers`, `src/routes.ts`
- Toda feature nova precisa de: teste unitário do service, teste unitário do controller (branch de erro incluso), e teste de integração da rota.

---

## Variáveis de Ambiente

Todo valor novo passa por `src/config/env.ts`. Propague no `k8s/deployment.yaml` (`env`/`configMapKeyRef`/`secretRef`) e no `.env.example`.

**Nota operacional**: o secret `payment-service-secret` referenciado em `k8s/deployment.yaml` precisa passar a incluir `JWT_SECRET`, `ABACATEPAY_WEBHOOK_SECRET` e `DATABASE_URL`/`ABACATEPAY_API_KEY` (as duas últimas já existiam antes da migração) — atualizar o secret no cluster antes do primeiro deploy desta versão.

---

## Infra deste Serviço

- `Dockerfile`: mesmo padrão do `auth-service` (`npm install --ignore-scripts` → `prisma generate` → `tsc` → `npm prune --omit=dev`; `CMD` roda `prisma migrate deploy && npm start`).
- `k8s/`: `deployment.yaml` (probes em `/health`, 2 réplicas), `hpa.yaml` (min 2/max 6), `pdb.yaml` (novos nesta migração — o serviço em Go não tinha), `service.yaml` (porta 8080, mantida para não quebrar quem já aponta para este serviço).
