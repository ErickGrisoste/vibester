import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";

import { env } from "./config/env";
import { setupRoutes } from "./routes";
import { registerSwagger } from "./config/swagger";
import { startKafkaConsumers, stopKafkaConsumer } from "./kafka/consumer";
import prismaClient from "./prisma";
import { redis } from "./config/redis";

const app = Fastify({
  logger: true,
  bodyLimit: 1_048_576,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

const start = async () => {
  try {
    await app.register(cors, {
      origin: env.allowedOrigins,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      credentials: true,
    });

    await app.register(jwt, { secret: env.jwtSecret });

    await registerSwagger(app);
    await setupRoutes(app);

    await startKafkaConsumers();

    await app.listen({ port: env.port, host: "0.0.0.0" });
    app.log.info(
      { port: env.port, env: process.env.NODE_ENV ?? "development" },
      "Notification Service started",
    );

    const gracefulShutdown = async (signal: string) => {
      app.log.info({ signal }, "Starting graceful shutdown...");
      try {
        await app.close();
        await stopKafkaConsumer();
        await prismaClient.$disconnect();
        await redis.quit();
        app.log.info("Graceful shutdown completed");
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, "Error during shutdown");
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
