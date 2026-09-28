import { FastifyInstance, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env";
import { redis } from "./config/redis";
import { httpRequestDuration, httpRequestsTotal, rateLimitExceededTotal } from "./metrics/registry";

/**
 * Chave do rate limit: a **conta** do token, não o IP.
 *
 * Por IP (o padrão do plugin) o limite quebra no uso real. O chamador principal
 * deste serviço é o post-service, que consulta a validação em nome de cada
 * autor — então toda requisição chega do IP do pod dele. Com chave por IP, a
 * plataforma inteira dividiria um único balde de `RATE_LIMIT_MAX` por minuto; o
 * 121º post do minuto receberia 429, o post-service trataria o 429 como
 * indisponibilidade e publicaria sem validar. Em outras palavras: sob carga, a
 * validação se desligaria sozinha, sem erro visível em lugar nenhum.
 *
 * Por conta, o limite volta a significar o que foi pensado para significar —
 * encarecer a sondagem da blocklist por uma pessoa — e cada autor tem o próprio
 * balde, venha a requisição de onde vier.
 *
 * O token é **verificado**, não só decodificado. Decodificar sem verificar
 * deixaria qualquer um fabricar um `accountId` novo a cada requisição e ganhar
 * um balde vazio de graça. Token ausente ou inválido cai na chave por IP: essas
 * requisições vão receber 401 de qualquer jeito, e o IP é o que limita uma
 * enxurrada delas.
 */
export async function rateLimitKey(request: FastifyRequest): Promise<string> {
    try {
        const payload = await request.jwtVerify<{ accountId?: string }>();
        if (payload?.accountId) {
            return `acct:${payload.accountId}`;
        }
    } catch {
        // Sem token válido: cai no IP abaixo.
    }

    return `ip:${request.ip}`;
}

export async function registerCorsAndRateLimit(app: FastifyInstance) {
    await app.register(cors, { origin: true });

    await app.register(rateLimit, {
        global: true,
        max: env.rate_limit_max,
        timeWindow: "1 minute",
        keyGenerator: rateLimitKey,
        // Store no Redis, como no post-service: o contador é compartilhado entre
        // réplicas. Num serviço que é oráculo de blocklist, rate limit por
        // processo seria multiplicado pelo número de pods — e é justamente o
        // limite que encarece a sondagem da lista.
        redis,
        nameSpace: "post-validation-rate-limit-",
        // Redis fora do ar desliga o rate limit até voltar, nunca derruba a
        // requisição. Mesmo princípio do cache: disponibilidade acima de limite.
        skipOnError: true,
        errorResponseBuilder: (_req, context) => ({
            message: `Rate limit excedido. Tente novamente em ${Math.ceil(context.ttl / 1000)}s.`,
        }),
        // `onExceeded`, não `onExceeding`: o segundo roda em toda requisição
        // que AINDA está dentro do limite, e a métrica passaria a contar tráfego
        // normal como bloqueio. Mesmo callback do post-service e do feed-service.
        onExceeded: (request) => {
            rateLimitExceededTotal.inc({ route: request.routeOptions?.url ?? "unknown" });
        },
    });
}

export function registerHttpMetrics(app: FastifyInstance) {
    app.addHook("onResponse", async (request, reply) => {
        // `routeOptions.url` (o padrão da rota), nunca `request.url`: a URL crua
        // traria UUID e explodiria a cardinalidade da métrica.
        const labels = {
            method: request.method,
            route: request.routeOptions?.url ?? "unknown",
            status_code: String(reply.statusCode),
        };

        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
    });
}
