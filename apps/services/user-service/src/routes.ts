import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import { profileRoutes } from "./controllers/profile.controller.js";
import { safetyRoutes } from "./controllers/safety.controller.js";
import prismaClient from "./prisma/index.js";
import { redis } from "./config/redis.js";

export async function setupRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get("/health", {
    schema: {
      tags: ["Health"],
      summary: "Liveness check",
      response: { 200: z.object({ status: z.string() }) },
    },
  }, async (_request, reply) => reply.status(200).send({ status: "ok" }));

  router.get("/ready", {
    schema: {
      tags: ["Health"],
      summary: "Readiness check",
      response: {
        200: z.object({ status: z.string(), db: z.boolean(), cache: z.boolean() }),
        503: z.object({ status: z.string(), db: z.boolean(), cache: z.boolean() }),
      },
    },
  }, async (_request, reply) => {
    let db = false;
    let cache = false;

    try {
      await prismaClient.$queryRaw`SELECT 1`;
      db = true;
    } catch {}

    try {
      await redis.ping();
      cache = true;
    } catch {}

    const ok = db && cache;
    return reply.status(ok ? 200 : 503).send({ status: ok ? "ok" : "degraded", db, cache });
  });

  app.register(profileRoutes, { prefix: "/users" });
  app.register(safetyRoutes, { prefix: "/users" });
}
