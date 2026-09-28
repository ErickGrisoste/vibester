import Fastify, { FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { setupRoutes } from "../../src/routes";
import { registerErrorHandler } from "../../src/errors/error.handler";
import { FASTIFY_AJV_OPTIONS } from "../../src/config/fastify";

export const TEST_JWT_SECRET = "test-jwt-secret";

/**
 * App mínimo: registra `@fastify/jwt` (a rota depende dele) + o error handler +
 * as rotas. Sem cors/helmet/rate-limit, mesmo helper do post-service e do
 * interaction-service.
 *
 * Consequência a lembrar: o rate limit não é exercitado por estes testes, então
 * o `config.rateLimit` da rota não é validado aqui.
 */
export async function buildServer(): Promise<FastifyInstance> {
    // Mesmas opções de AJV do servidor real: sem isto, o teste validaria um
    // comportamento de payload diferente do de produção.
    const app = Fastify({ logger: false, ajv: FASTIFY_AJV_OPTIONS });

    await app.register(jwt, { secret: TEST_JWT_SECRET });

    registerErrorHandler(app);
    await setupRoutes(app);
    await app.ready();

    return app;
}

/**
 * Token no mesmo formato que o auth-service emite: `{ userId, accountId }`.
 * Os dois valores são diferentes de propósito — é o que permite provar que o
 * serviço usa o `accountId` e não o id da linha de autenticação.
 */
export function signToken(
    app: FastifyInstance,
    payload: { userId: string; accountId: string }
): string {
    return app.jwt.sign(payload);
}
