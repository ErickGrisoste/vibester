import { FastifyReply, FastifyRequest } from "fastify";
import { PasswordResetService } from "../services/password-reset.service";
import { ForgotPasswordInputInterface, ResetPasswordInputInterface } from "../types/password-reset.types";
import { AppError } from "../errors/app-error";
import { logAuthFailure } from "../observability/auth-audit";

export const FORGOT_PASSWORD_MESSAGE = "Se existir uma conta com esse email, enviamos um código para redefinir a senha";

export class PasswordResetController {
    private readonly passwordResetService = new PasswordResetService();

    async forgot(
        request: FastifyRequest<{ Body: ForgotPasswordInputInterface }>,
        reply: FastifyReply
    ) {
        try {
            await this.passwordResetService.request(request.body.email);
            return reply.status(202).send({ message: FORGOT_PASSWORD_MESSAGE });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }

    async reset(
        request: FastifyRequest<{ Body: ResetPasswordInputInterface }>,
        reply: FastifyReply
    ) {
        const { email, code, password } = request.body;

        try {
            await this.passwordResetService.reset(email, code, password);
            return reply.status(200).send({ message: "Senha redefinida com sucesso" });
        } catch (error: any) {
            if (error instanceof AppError) {
                logAuthFailure(request, "password-reset", error.reason ?? "app_error", email);
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }
}
