import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { feedRoutes } from "./routes";
import { registerSwagger } from "./config/swagger";
import { registerCorsAndRateLimit, registerHttpMetrics } from "./plugins";
import { KafkaConsumer } from "./kafka/consumer";
import { FeedFanoutService } from "./services/feed-fanout.service";
import { FollowService } from "./services/follow.service";
import { EventAttendanceService } from "./services/event-attendance.service";
import { env } from "./config/env";
import { getCassandraClient } from "./config/cassandra";
import { registerErrorHandler } from "./errors/error.handler";

const app = Fastify({
    logger: { level: "info" },
});

registerErrorHandler(app);

let kafkaConsumer: KafkaConsumer | undefined;

async function start() {
    await registerCorsAndRateLimit(app, {
        corsAllowedOrigins: env.cors_allowed_origins,
        rateLimitMax: env.rate_limit_max,
    });
    registerHttpMetrics(app);

    await app.register(jwt, { secret: env.jwt_secret });

    await registerSwagger(app);
    await app.register(feedRoutes);

    kafkaConsumer = new KafkaConsumer(
        new FeedFanoutService(),
        new FollowService(),
        new EventAttendanceService(),
    );

    await kafkaConsumer.start();

    await app.listen({
        port: 3006,
        host: "0.0.0.0",
    });

    app.log.info("Feed service running on port 3006");

    async function gracefulShutdown(signal: string) {
        app.log.info({ signal }, "Iniciando shutdown gracioso");
        try {
            await app.close();
            await kafkaConsumer?.stop();
            await getCassandraClient().shutdown();
            app.log.info("Shutdown concluído");
            process.exit(0);
        } catch (err) {
            app.log.error({ err }, "Erro durante shutdown");
            process.exit(1);
        }
    }

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

start().catch((error) => {
    app.log.error({ err: error }, "Falha ao iniciar o servidor");
    process.exit(1);
});
