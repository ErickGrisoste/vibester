import { FastifyReply, FastifyRequest } from "fastify";
import { EmailVerificationService } from "../services/email-verification.service";
import { VerifyEmailInputInterface } from "../types/email-verification.types";
import { AppError } from "../errors/app-error";
import { logAuthFailure } from "../observability/auth-audit";

export class EmailVerificationController {
    private readonly emailVerificationService = new EmailVerificationService();

    async verify(
        request: FastifyRequest<{ Body: VerifyEmailInputInterface }>,
        reply: FastifyReply
    ) {
        const { email, code } = request.body;

        try {
            const account = await this.emailVerificationService.verify(email, code);
            return reply.status(201).send(account);
        } catch (error: any) {
            if (error instanceof AppError) {
                logAuthFailure(request, "verify-email", error.reason ?? "app_error", email);
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }
}
