import { FastifyReply, FastifyRequest } from "fastify";
import { LoginInputInterface } from "../types/register.types";
import { LoginService } from "../services/login.service";
import { AppError } from "../errors/app-error";
import { logAuthFailure } from "../observability/auth-audit";

export class LoginController {
    private readonly loginService = new LoginService();

    async login(
        request: FastifyRequest<{ Body: LoginInputInterface }>,
        reply: FastifyReply
    ) {
        const { email, username } = request.body;

        if (!email && !username) {
            logAuthFailure(request, "login", "missing_identifier", email ?? username);
            return reply.status(400).send({ error: "Email ou username é obrigatório" });
        }

        try {
            const account = await this.loginService.login(request.body);
            return reply.status(200).send(account);
        } catch (error: any) {
            if (error instanceof AppError) {
                logAuthFailure(request, "login", error.reason ?? "app_error", email ?? username);
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }
}
