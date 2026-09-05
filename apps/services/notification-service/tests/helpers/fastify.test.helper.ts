import Fastify, { FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import { setupRoutes } from "../../src/routes";

export async function buildServer() {
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(jwt, { secret: "test-secret" });
    await setupRoutes(app);
    return app;
}

export function generateToken(app: FastifyInstance, userId = "test-user-id"): string {
    return app.jwt.sign({ userId });
}
