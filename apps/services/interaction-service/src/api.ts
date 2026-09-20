import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env";
import { setupRoutes } from "./routes";
import { registerSwagger } from "./config/swagger";
import { registerErrorHandler } from "./errors/error.handler";
import { connectProducer, disconnectProducer } from "./kafka/producer";

/**
 * Modo `api`: endpoint fino de ingestão.
 *
 * Não abre conexão com o Cassandra de propósito — a API só valida e publica no
 * Kafka. Menos dependência no caminho quente significa menos coisa capaz de
 * derrubar a coleta.
 */
export async function startApi(): Promise<void> {
    const app = Fastify({
        logger: {
            level: "info",
            serializers: {
                req(req) { return { method: req.method, url: req.url }; },
            },
        },
        // Lote de 50 eventos fica na casa de poucas dezenas de KB; 256KB é folga
        // suficiente e impede payload abusivo.
        bodyLimit: 256 * 1024,
        requestTimeout: 15000,
    });

    await app.register(cors, { origin: true });
    await app.register(helmet, { contentSecurityPolicy: false });
    await app.register(jwt, { secret: env.jwt_secret });

    await app.register(rateLimit, {
        global: true,
        max: env.rate_limit_max,
        timeWindow: "1 minute",
        errorResponseBuilder: (_req, context) => ({
            message: `Rate limit excedido. Tente novamente em ${Math.ceil(context.ttl / 1000)}s.`,
        }),
    });

    registerErrorHandler(app);

    await connectProducer();

    await registerSwagger(app);
    await setupRoutes(app);

    await app.listen({ port: env.port, host: "0.0.0.0" });

    app.log.info({ port: env.port, mode: env.mode }, "Interaction Service (api) iniciado");

    const gracefulShutdown = async (signal: string) => {
        app.log.info({ signal }, "Iniciando shutdown gracioso");

        try {
            await app.close();
            await disconnectProducer();
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
