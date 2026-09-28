import { FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "../errors/http.error";

/**
 * O auth-service assina o token com `{ userId, accountId }` (HS256).
 *
 * ATENÇÃO: `userId` no token é o id da linha `Access` (autenticação). A
 * identidade pública, usada por post-service, user-service e feed-service, é o
 * `accountId` — e é ela que precisa ir no log de auditoria e no evento de
 * rejeição, senão o `authorId` do post nunca casa com quem foi validado.
 * Mesma armadilha documentada no interaction-service.
 */
export interface AccessTokenPayload {
    userId: string;
    accountId: string;
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: AccessTokenPayload;
        user: AccessTokenPayload;
    }
}

/**
 * preHandler de autenticação, obrigatório na rota de validação.
 *
 * O requisito de segurança pede identidade antes de validar, e há um motivo
 * concreto além do requisito: sem token, o endpoint é um oráculo anônimo da
 * blocklist — qualquer um sonda em loop até achar o texto que passa. Com token,
 * a sondagem tem dono, rate limit e rastro na auditoria.
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    try {
        await request.jwtVerify();
    } catch {
        throw new HttpError("Token ausente ou inválido", 401);
    }

    if (!request.user?.accountId) {
        throw new HttpError("Token sem accountId", 401);
    }
}

/** Identidade canônica do requisitante. Use sempre isto, nunca `request.user.userId`. */
export function getAccountId(request: FastifyRequest): string {
    return request.user.accountId;
}
