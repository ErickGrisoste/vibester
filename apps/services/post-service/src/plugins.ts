import { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type Redis from "ioredis";
import { httpRequestDuration, httpRequestsTotal, rateLimitExceededTotal } from "./metrics/registry";

export interface CorsAndRateLimitOptions {
    // undefined ou lista vazia = fallback para `origin: true` (aceita qualquer
    // origem). Ver aviso de log em registerCorsAndRateLimit.
    corsAllowedOrigins?: string[];
    rateLimitMax: number;
    redis: Redis;
}

/**
 * Registra CORS e rate limit compartilhando o mesmo client Redis do
 * cache-aside (`config/redis.ts`) como store do rate limit — antes o rate
 * limit vivia em memória do processo, então cada réplica contava separado e o
 * limite deixava de ser efetivo ao escalar horizontalmente (ver CLAUDE.md,
 * seção Segurança/Performance). `skipOnError: true` segue o mesmo princípio
 * já usado em `cacheAside`: uma falha do Redis nunca deve derrubar a
 * requisição principal, só desativa o rate limit até o Redis voltar.
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
        redis: options.redis,
        nameSpace: "post-service-rate-limit-",
        skipOnError: true,
        // `errorResponseBuilder` é usado via `throw builder(...)` pelo plugin
        // (ver node_modules/@fastify/rate-limit/index.js) — ele NÃO aplica
        // `context.statusCode` (429, ou 403 se banido) no valor devolvido
        // automaticamente. Um objeto plano sem `statusCode` cai no 500
        // genérico do error handler global (bug pré-existente: a versão
        // anterior desse builder, sem `redis`/`skipOnError`, tinha o mesmo
        // problema — testado e confirmado antes desta mudança).
        errorResponseBuilder: (_req, context) => {
            const error = new Error(
                `Rate limit excedido. Tente novamente em ${Math.ceil(context.ttl / 1000)}s.`
            ) as Error & { statusCode: number };
            error.statusCode = context.statusCode;
            return error;
        },
        onExceeded: (req) => {
            rateLimitExceededTotal.inc({ route: req.routeOptions.url ?? req.url });
        },
    });
}

/**
 * Hook `onResponse` global — grava latência e contagem por rota usando o
 * padrão da rota (`request.routeOptions.url`, ex.: `/posts/:postId`), nunca a
 * URL crua, para não explodir cardinalidade com UUIDs reais.
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
