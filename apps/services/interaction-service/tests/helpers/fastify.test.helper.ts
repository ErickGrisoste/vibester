import Fastify, { FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { setupRoutes } from "../../src/routes";
import { registerErrorHandler } from "../../src/errors/error.handler";

export const TEST_JWT_SECRET = "test-jwt-secret";

/**
 * App mínimo: registra @fastify/jwt (a rota de ingestão depende dele) + o error
 * handler + as rotas. Sem cors/helmet/rate-limit, igual ao helper do post-service.
 *
 * Consequência a lembrar: o rate limit não é exercitado por estes testes, então
 * `config.rateLimit` da rota não é validado aqui.
 */
export async function buildServer(): Promise<FastifyInstance> {
    const app = Fastify({ logger: false });

    await app.register(jwt, { secret: TEST_JWT_SECRET });

    registerErrorHandler(app);
    await setupRoutes(app);
    await app.ready();

    return app;
}

/**
 * Token no mesmo formato que o auth-service emite: `{ userId, accountId }`.
 * `userId` diferente de `accountId` de propósito — é o que permite provar que o
 * serviço grava o `accountId`, e não o id da linha de autenticação.
 */
export function signToken(
    app: FastifyInstance,
    payload: { userId: string; accountId: string }
): string {
    return app.jwt.sign(payload);
}
