import { timingSafeEqual } from "node:crypto";
import { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";

/**
 * `accountId` do JWT emitido pelo próprio auth-service no login.
 *
 * Rotas que agem sobre a conta (excluir) nunca aceitam o id no corpo: ele vem
 * só do token assinado.
 */
export function accountIdFromRequest(request: FastifyRequest): string {
    const header = request.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        throw new AppError("Token de autenticação ausente", 401, "missing_token");
    }

    try {
        const payload = jwt.verify(header.slice("Bearer ".length), env.jwtSecret, { algorithms: ["HS256"] });
        if (typeof payload === "object" && typeof payload.accountId === "string") {
            return payload.accountId;
        }
    } catch {
        /* cai no 401 abaixo */
    }

    throw new AppError("Sessão inválida ou expirada", 401, "invalid_token");
}

/**
 * Valida o header `x-admin-key` das rotas de moderação.
 *
 * Sem `ADMIN_API_KEY` configurada as rotas respondem 404, como se não
 * existissem — nunca ficam abertas por falta de configuração.
 */
export function assertAdminKey(request: FastifyRequest): void {
    const expected = env.adminApiKey;

    if (!expected) {
        throw new AppError("Not found", 404, "admin_disabled");
    }

    const provided = request.headers["x-admin-key"];
    const providedBuf = Buffer.from(typeof provided === "string" ? provided : "");
    const expectedBuf = Buffer.from(expected);

    const valid = providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);

    if (!valid) {
        throw new AppError("Chave de administração inválida", 401, "invalid_admin_key");
    }
}
