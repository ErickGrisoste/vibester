import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env";
import { routes } from "./routes";
import { registerSwagger } from "./config/swagger";
import { startMovementJob } from "./jobs/movement.job";
import { prisma } from "./prisma/index";
import { kafkaProducer } from "./kafka/producer";
import { register, httpRequestsTotal, httpRequestDurationSeconds } from "./config/metrics";
import type { AppLogger } from "./utils/logger";

const app = Fastify({
  logger: true,
  ajv: { customOptions: { keywords: ["example"] } },
});

const start = async () => {
  await app.register(cors, { origin: env.corsOrigin });

  await app.register(jwt, { secret: env.jwtSecret });

  await app.register(rateLimit, {
    max: env.rateLimitMax,
    timeWindow: env.rateLimitTimeWindow,
  });

  await registerSwagger(app);
  await app.register(routes);

  app.addHook("onRequest", (request, _reply, done) => {
    (request as FastifyRequest & { _startTime: number })._startTime = Date.now();
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const duration =
      (Date.now() - (request as FastifyRequest & { _startTime: number })._startTime) / 1000;
    const route = request.routeOptions?.url ?? request.url;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, duration);
    done();
  });

  app.get(
    "/metrics",
    { schema: { tags: ["Metrics"], summary: "Métricas Prometheus" } },
    async (_request, reply) => {
      reply.header("Content-Type", register.contentType);
      return reply.send(await register.metrics());
    }
  );

  const appLogger: AppLogger = {
    info: (msg) => app.log.info(msg),
    warn: (msg) => app.log.warn(msg),
    error: (msg, cause) => app.log.error({ err: cause }, msg),
  };

  await kafkaProducer.connect();

  const stopJob = startMovementJob(appLogger);

  const shutdown = async () => {
    app.log.info("Recebendo sinal de encerramento, aguardando tarefas...");
    stopJob();
    await kafkaProducer.disconnect();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await app.listen({ port: Number(env.port) || 3000, host: "0.0.0.0" });
};

start();
