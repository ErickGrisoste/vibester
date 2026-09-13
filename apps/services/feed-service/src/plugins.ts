import { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { httpRequestDuration, httpRequestsTotal, rateLimitExceededTotal } from "./metrics/registry";

export interface CorsAndRateLimitOptions {
    // undefined ou lista vazia = fallback para `origin: true` (aceita qualquer
    // origem). Ver aviso de log em registerCorsAndRateLimit. Mesmo padrão do
    // post-service (src/plugins.ts), adaptado para este serviço.
    corsAllowedOrigins?: string[];
    rateLimitMax: number;
}

/**
 * Registra CORS (allowlist via env, com fallback documentado para
 * `origin: true`) e rate limit global na única rota pública deste serviço
 * (`GET /feed/:userId`).
 *
 * Diferente do post-service, este serviço **deliberadamente não usa Redis**
 * (ver CLAUDE.md deste serviço — o TTL nativo do Cassandra cumpre aqui o
 * papel que o cache-aside com Redis cumpre lá). Por isso o rate limit usa o
 * store padrão do `@fastify/rate-limit`, que é **em memória do processo**
 * (sem passar a opção `redis`).
 *
 * Limitação aceita e documentada (não bloqueante hoje, mas não escondida):
 * com múltiplas réplicas do pod, o contador de rate limit é **por réplica**,
 * não compartilhado entre elas — um cliente malicioso distribuído entre
 * réplicas efetivamente consegue até `rateLimitMax * N réplicas` requisições
 * por minuto antes de ser bloqueado em qualquer uma delas. O
 * `k8s/deployment.yaml` deste serviço roda hoje com `replicas: 1` (rate
 * limit efetivamente global, sem essa lacuna), mas o plano de refatoração do
 * feed-service prevê aumentar isso numa fase futura — quando isso acontecer,
 * reavalie se um store compartilhado (Redis, só para o rate limit) se torna
 * necessário, seguindo o padrão já usado em post-service/src/plugins.ts. Não
 * introduza Redis aqui só por causa disso enquanto `replicas: 1` for verdade.
 */
export async function registerCorsAndRateLimit(app: FastifyInstance, options: CorsAndRateLimitOptions) {
    if (options.corsAllowedOrigins && options.corsAllowedOrigins.length > 0) {
        await app.register(cors, { origin: options.corsAllowedOrigins });
    } else {
        app.log.warn(
            "CORS_ALLOWED_ORIGINS não definida — aceitando qualquer origem (origin: true). " +
            "Configure antes de expor este serviço publicamente."
        );
        await app.register(cors, { origin: true });
    }

    await app.register(rateLimit, {
        global: true,
        max: options.rateLimitMax,
        timeWindow: "1 minute",
        nameSpace: "feed-service-rate-limit-",
        onExceeded: (req) => {
            rateLimitExceededTotal.inc({ route: req.routeOptions.url ?? req.url });
        },
    });
}

/**
 * Hook `onResponse` global — grava latência e contagem por rota usando o
 * padrão da rota (`request.routeOptions.url`, ex.: `/feed/:userId`), nunca a
 * URL crua, para não explodir cardinalidade com UUIDs reais. Mesmo padrão do
 * post-service (src/plugins.ts).
 */
export function registerHttpMetrics(app: FastifyInstance) {
    app.addHook("onResponse", async (request, reply) => {
        const route = request.routeOptions.url ?? "unknown";
        const labels = {
            method: request.method,
            route,
            status_code: String(reply.statusCode),
        };
        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
    });
}
