import { FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "../errors/http.error";

/**
 * O auth-service assina o token com `{ userId, accountId }` (HS256, via
 * `jsonwebtoken` em `auth-service/src/services/login.service.ts`).
 *
 * ATENÇÃO: `userId` no token é o id da linha `Access` (tabela de autenticação).
 * A identidade pública da pessoa, usada por post-service, user-service e
 * feed-service, é o `accountId` — e é o app mobile que confirma isso: ele lê
 * `user.accountId` e envia como `userId` nas chamadas de post e de feed.
 *
 * Gravar o `userId` do token no log de interação produziria um identificador que
 * não casa com nenhum outro serviço, e o erro só apareceria meses depois, quando
 * o ranking tentasse juntar interação com post.
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
 * preHandler de autenticação. Diferente dos serviços vizinhos, aqui o JWT é
 * obrigatório: o `userId` nunca vem do body. Sem isso, qualquer chamador poderia
 * injetar impressões falsas em nome de outra pessoa, e dado de treino envenenado
 * não se limpa depois.
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
