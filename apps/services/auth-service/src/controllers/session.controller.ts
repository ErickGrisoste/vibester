import { FastifyReply, FastifyRequest } from "fastify";
import { SessionService } from "../services/session.service";
import { RefreshTokenInputInterface } from "../types/session.types";
import { AppError } from "../errors/app-error";
import { logAuthFailure } from "../observability/auth-audit";

export class SessionController {
    private readonly sessionService = new SessionService();

    async refresh(
        request: FastifyRequest<{ Body: RefreshTokenInputInterface }>,
        reply: FastifyReply
    ) {
        try {
            const tokens = await this.sessionService.refresh(
                request.body.refreshToken,
                request.headers["user-agent"],
            );
            return reply.status(200).send(tokens);
        } catch (error: any) {
            if (error instanceof AppError) {
                // Sem subject: o refresh token é credencial e nunca vai para log.
                logAuthFailure(request, "refresh", error.reason ?? "app_error");
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }

    async logout(
        request: FastifyRequest<{ Body: RefreshTokenInputInterface }>,
        reply: FastifyReply
    ) {
        try {
            await this.sessionService.revoke(request.body.refreshToken);
            return reply.status(204).send();
        } catch (error: any) {
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }
}
