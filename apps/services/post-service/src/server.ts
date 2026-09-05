import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { getCassandraClient } from "./config/cassandra";
import { redis } from "./config/redis";
import { routes } from "./routes";
import { registerSwagger } from "./config/swagger";
import { producer } from "./kafka/producer";
import { env } from "./config/env";
import { registerErrorHandler } from "./errors/error.handler";

const app = Fastify({
    logger: {
        level: "info",
        serializers: {
            req(req) { return { method: req.method, url: req.url }; },
        },
    },
    bodyLimit: 1 * 1024 * 1024,
    requestTimeout: 30000,
});

app.register(cors, { origin: true });

app.register(helmet, {
    contentSecurityPolicy: false,
});

app.register(compress, { global: true });

app.register(rateLimit, {
    global: true,
    max: env.rate_limit_max,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, context) => ({
        message: `Rate limit excedido. Tente novamente em ${Math.ceil(context.ttl / 1000)}s.`,
    }),
});

app.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 20,
    },
});

registerErrorHandler(app);

async function start() {
    try {
        await redis.connect();
        await producer.connect();
        await getCassandraClient().connect();

        await registerSwagger(app);
        await app.register(routes);

        await app.listen({
            port: Number(env.port) || 3000,
            host: "0.0.0.0",
        });

        async function gracefulShutdown(signal: string) {
            app.log.info({ signal }, "Iniciando shutdown gracioso");
            try {
                await app.close();
                await producer.disconnect();
                await getCassandraClient().shutdown();
                await redis.quit();
                app.log.info("Shutdown concluído");
                process.exit(0);
            } catch (err) {
                app.log.error({ err }, "Erro durante shutdown");
                process.exit(1);
            }
        }

        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    } catch (error) {
        app.log.error({ err: error }, "Falha ao iniciar o servidor");
        process.exit(1);
    }
}

start();
