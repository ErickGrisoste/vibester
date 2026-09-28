import Fastify from "fastify";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import { env } from "./config/env";
import { FASTIFY_AJV_OPTIONS } from "./config/fastify";
import { setupRoutes } from "./routes";
import { registerSwagger } from "./config/swagger";
import { registerCorsAndRateLimit, registerHttpMetrics } from "./plugins";
import { registerErrorHandler } from "./errors/error.handler";
import { connectProducer, disconnectProducer } from "./kafka/producer";
import { connectRedis, disconnectRedis } from "./config/redis";

/**
 * Modo `api`: o veredito síncrono, no caminho quente da criação de post.
 *
 * O orçamento é 200ms, e o desenho todo sai disso: as regras são CPU pura, o
 * cache é opcional e o produtor Kafka nem é usado nesta rota — está conectado só
 * para o `/ready` reportar o broker e para o serviço poder publicar no futuro
 * sem religar infra.
 */
export async function startApi(): Promise<void> {
    const app = Fastify({
        logger: {
            level: "info",
            serializers: {
                req(req) { return { method: req.method, url: req.url }; },
            },
        },
        // Guarda de CPU do serviço: é o que garante que nenhuma regra veja texto
        // ilimitado. Todas são lineares, então limitar a entrada limita o custo.
        bodyLimit: env.max_body_bytes,
        requestTimeout: 10000,
        // Payload desconhecido ou de tipo errado vira 400 em vez de ser corrigido
        // em silêncio — ver config/fastify.ts.
        ajv: FASTIFY_AJV_OPTIONS,
    });

    await app.register(helmet, { contentSecurityPolicy: false });
    await app.register(jwt, { secret: env.jwt_secret });

    await connectRedis();
    await registerCorsAndRateLimit(app);

    registerErrorHandler(app);
    registerHttpMetrics(app);

    // Sem `await`, de propósito — e não é descuido de async.
    //
    // A rota síncrona não publica nada: o produtor existe aqui só para alimentar
    // o `/ready` e para o serviço poder publicar no futuro sem religar infra.
    // Esperar por ele acopla o boot da validação a um broker que ela não usa, e
    // não de leve: com o broker fora do ar, o kafkajs tenta 10 vezes com backoff
    // exponencial antes de desistir, o que segura o `listen` por mais de meio
    // minuto. O efeito seria readiness falhando e rollout travado por uma
    // dependência opcional — exatamente o que o `/ready` deste modo promete não
    // fazer ao nunca devolver 503.
    //
    // No worker é o oposto: lá o Kafka é crítico, o connect é aguardado e a
    // falha sobe.
    void connectProducer().catch((err) => {
        app.log.warn({ err }, "Kafka indisponível no boot; a api segue sem o produtor");
    });

    await registerSwagger(app);
    await setupRoutes(app);

    await app.listen({ port: env.port, host: "0.0.0.0" });

    app.log.info({ port: env.port, mode: env.mode }, "Post Validation Service (api) iniciado");

    const gracefulShutdown = async (signal: string) => {
        app.log.info({ signal }, "Iniciando shutdown gracioso");

        try {
            await app.close();
            await disconnectProducer();
            await disconnectRedis();
            app.log.info("Shutdown concluído");
            process.exit(0);
        } catch (err) {
            app.log.error({ err }, "Erro durante shutdown");
            process.exit(1);
        }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
