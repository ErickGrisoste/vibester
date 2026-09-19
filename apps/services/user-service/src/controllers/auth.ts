import type { FastifyRequest } from "fastify";

/**
 * `accountId` do JWT emitido pelo auth-service, ou `null` sem token válido.
 *
 * As rotas de bloqueio e denúncia agem em nome de quem está logado, então o
 * id nunca vem do corpo — só do token assinado (mesmo JWT_SECRET do
 * auth-service).
 */
export async function authenticatedAccountId(request: FastifyRequest): Promise<string | null> {
    try {
        const payload = await request.jwtVerify<{ accountId?: unknown }>();
        return typeof payload.accountId === "string" ? payload.accountId : null;
    } catch {
        return null;
    }
}
