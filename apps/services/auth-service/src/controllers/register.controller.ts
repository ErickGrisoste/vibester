import { FastifyReply, FastifyRequest } from "fastify";
import { RegisterService } from "../services/register.service";
import { RegisterInputInterface } from "../types/register.types";
import { AppError } from "../errors/app-error";
import { logAuthFailure } from "../observability/auth-audit";

export class RegisterController {
    private readonly registerService = new RegisterService();

    async register(
        request: FastifyRequest<{ Body: RegisterInputInterface }>,
        reply: FastifyReply
    ) {
        const { name, username, email, password, bornAt } = request.body;

        try {
            await this.registerService.register({
                name,
                username,
                email,
                password,
                bornAt: new Date(bornAt),
            });
            return reply.status(202).send({ message: "Código de verificação enviado para seu email" });
        } catch (error: any) {
            if (error instanceof AppError) {
                logAuthFailure(request, "register", error.reason ?? "app_error", email);
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }
}
