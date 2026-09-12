import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { establishmentRoutes } from "../../src/routes";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function buildServer() {
  const app = Fastify({
    logger: false,
    ajv: { customOptions: { strict: false } },
  });

  const secret = process.env.JWT_SECRET ?? "unit-test-secret-key-min-length";
  await app.register(jwt, { secret });

  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  });

  app.decorate("authenticate", async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  await app.register(establishmentRoutes);
  await app.ready();

  return app;
}
