import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { LoginInputInterface, RegisterInputInterface } from "./types/register.types";
import { VerifyEmailInputInterface } from "./types/email-verification.types";
import { RegisterController } from "./controllers/register.controller";
import { LoginController } from "./controllers/login.controller";
import { EmailVerificationController } from "./controllers/email-verification.controller";
import { PasswordResetController } from "./controllers/password-reset.controller";
import { AccountController } from "./controllers/account.controller";
import { SessionController } from "./controllers/session.controller";
import { RefreshTokenInputInterface } from "./types/session.types";
import { ForgotPasswordInputInterface, ResetPasswordInputInterface } from "./types/password-reset.types";
import { AccountIdParamsInterface, DeleteAccountInputInterface } from "./types/account.types";
import { env } from "./config/env";

const registerController = new RegisterController();
const loginController = new LoginController();
const emailVerificationController = new EmailVerificationController();
const passwordResetController = new PasswordResetController();
const accountController = new AccountController();
const sessionController = new SessionController();

const errorResponse = {
    type: "object",
    properties: { error: { type: "string" } },
};

const tokenPairProperties = {
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
    expiresIn: { type: "integer", description: "Validade do access token, em segundos" },
};

const refreshTokenBody = {
    type: "object",
    required: ["refreshToken"],
    properties: {
        refreshToken: { type: "string", minLength: 1, maxLength: 128 },
    },
};

const accountIdParams = {
    type: "object",
    required: ["accountId"],
    properties: { accountId: { type: "string", format: "uuid" } },
};

export async function authRoutes(instance: FastifyInstance, options: FastifyPluginOptions) {

    instance.get("/health", {
        schema: {
            tags: ["Health"],
            summary: "Health check",
            description: "Verifica se o serviço está disponível.",
            response: {
                200: {
                    type: "object",
                    properties: { status: { type: "string", example: "ok" } },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send({ status: "ok" });
    });

    instance.post("/register", {
        schema: {
            tags: ["Auth"],
            summary: "Iniciar registro de conta",
            description: "Inicia o cadastro enviando um código de verificação para o email informado.",
            body: {
                type: "object",
                required: ["username", "name", "email", "password", "bornAt"],
                properties: {
                    username: { type: "string", example: "joaosilva" },
                    name: { type: "string", example: "João Silva" },
                    email: { type: "string", format: "email", example: "joao@email.com" },
                    password: { type: "string", minLength: 6, example: "senha123" },
                    bornAt: { type: "string", format: "date", example: "1998-05-20" },
                },
            },
            response: {
                202: {
                    description: "Código de verificação enviado",
                    type: "object",
                    properties: {
                        message: { type: "string" },
                    },
                },
                400: {
                    description: "Dados inválidos",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                409: {
                    description: "Email ou username já está em uso",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitRegisterMax, timeWindow: '1 minute' },
        },
    }, async (
        request: FastifyRequest<{ Body: RegisterInputInterface }>,
        reply: FastifyReply) => {
            return registerController.register(request, reply);
        }
    );

    instance.post("/verify-email", {
        schema: {
            tags: ["Auth"],
            summary: "Verificar email e concluir cadastro",
            description: "Valida o código enviado por email e conclui a criação da conta. Após MAX_CODE_ATTEMPTS códigos incorretos a verificação pendente é descartada (429) e o cadastro precisa ser reiniciado.",
            body: {
                type: "object",
                required: ["email", "code"],
                properties: {
                    email: { type: "string", format: "email", example: "joao@email.com" },
                    code: { type: "string", minLength: 6, maxLength: 6, example: "482931" },
                },
            },
            response: {
                201: {
                    description: "Conta criada com sucesso",
                    type: "object",
                    properties: {
                        authId: { type: "string", format: "uuid" },
                        accountId: { type: "string", format: "uuid" },
                        username: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string", format: "email" },
                        bornAt: { type: "string", format: "date-time" },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                },
                400: {
                    description: "Dados inválidos",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                404: {
                    description: "Nenhuma verificação pendente ou código expirado",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                409: {
                    description: "Email ou username já está em uso",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                422: {
                    description: "Código inválido",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                429: {
                    description: "Tentativas inválidas em excesso — a verificação pendente foi descartada e um novo código deve ser solicitado",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                502: {
                    description: "Serviço de perfil indisponível",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitVerifyEmailMax, timeWindow: '1 minute' },
        },
    }, async (
        request: FastifyRequest<{ Body: VerifyEmailInputInterface }>,
        reply: FastifyReply) => {
            return emailVerificationController.verify(request, reply);
        }
    );

    instance.post("/login", {
        schema: {
            tags: ["Auth"],
            summary: "Login",
            description: "Autentica uma conta usando email ou username e abre uma sessão: devolve um access token (JWT de ACCESS_TOKEN_TTL_SECONDS) e um refresh token (REFRESH_TOKEN_TTL_SECONDS, renovado a cada POST /refresh). O username é aceito com ou sem o prefixo \"@\". Falhas consecutivas são contabilizadas e o dono da conta é notificado por email ao atingir o limite da janela.",
            body: {
                type: "object",
                required: ["password"],
                anyOf: [
                    { required: ["email"] },
                    { required: ["username"] },
                ],
                properties: {
                    email: { type: "string", format: "email", example: "joao@email.com" },
                    username: { type: "string", example: "joaosilva" },
                    password: { type: "string", minLength: 6, example: "senha123" },
                },
            },
            response: {
                200: {
                    description: "Autenticado com sucesso",
                    type: "object",
                    properties: {
                        authId: { type: "string", format: "uuid" },
                        accountId: { type: "string", format: "uuid" },
                        ...tokenPairProperties,
                    },
                },
                400: {
                    description: "Dados inválidos",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                401: {
                    description: "Credenciais inválidas",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                403: {
                    description: "Conta suspensa pela moderação",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitLoginMax, timeWindow: '1 minute' },
        },
    }, async (
        request: FastifyRequest<{ Body: LoginInputInterface }>,
        reply: FastifyReply) => {
            return loginController.login(request, reply);
        }
    );

    instance.post("/refresh", {
        schema: {
            tags: ["Auth"],
            summary: "Renovar a sessão",
            description: "Troca o refresh token por um par novo (access + refresh). O refresh token enviado deixa de valer: reenviá-lo dentro de REFRESH_TOKEN_REUSE_GRACE_SECONDS devolve outro par; depois disso é tratado como roubo e encerra a sessão. Conta suspensa responde 403 e perde a sessão.",
            body: refreshTokenBody,
            response: {
                200: {
                    description: "Sessão renovada",
                    type: "object",
                    properties: tokenPairProperties,
                },
                400: { description: "Dados inválidos", ...errorResponse },
                401: { description: "Refresh token inválido, expirado ou reutilizado", ...errorResponse },
                403: { description: "Conta suspensa pela moderação", ...errorResponse },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitRefreshMax, timeWindow: '1 minute' },
        },
    }, async (
        request: FastifyRequest<{ Body: RefreshTokenInputInterface }>,
        reply: FastifyReply) => {
            return sessionController.refresh(request, reply);
        }
    );

    instance.post("/logout", {
        schema: {
            tags: ["Auth"],
            summary: "Encerrar a sessão do aparelho",
            description: "Invalida o refresh token enviado. Idempotente: responde 204 mesmo se o token não existir mais. O access token já emitido vence sozinho em ACCESS_TOKEN_TTL_SECONDS.",
            body: refreshTokenBody,
            response: {
                204: { description: "Sessão encerrada", type: "null" },
                400: { description: "Dados inválidos", ...errorResponse },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitRefreshMax, timeWindow: '1 minute' },
        },
    }, async (
        request: FastifyRequest<{ Body: RefreshTokenInputInterface }>,
        reply: FastifyReply) => {
            return sessionController.logout(request, reply);
        }
    );

    instance.post("/password/forgot", {
        schema: {
            tags: ["Auth"],
            summary: "Pedir código de redefinição de senha",
            description: "Envia um código de 6 dígitos para o email, se houver conta com ele. A resposta é sempre 202 com a mesma mensagem, exista ou não a conta, para não permitir enumeração.",
            body: {
                type: "object",
                required: ["email"],
                properties: {
                    email: { type: "string", format: "email", example: "joao@email.com" },
                },
            },
            response: {
                202: {
                    description: "Pedido aceito",
                    type: "object",
                    properties: { message: { type: "string" } },
                },
                400: { description: "Dados inválidos", ...errorResponse },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitPasswordResetMax, timeWindow: '1 minute' },
        },
    }, async (
        request: FastifyRequest<{ Body: ForgotPasswordInputInterface }>,
        reply: FastifyReply) => {
            return passwordResetController.forgot(request, reply);
        }
    );

    instance.post("/password/reset", {
        schema: {
            tags: ["Auth"],
            summary: "Redefinir senha com o código",
            description: "Valida o código enviado por /password/forgot e troca a senha. O código é de uso único; após MAX_CODE_ATTEMPTS erros a pendência é descartada (429).",
            body: {
                type: "object",
                required: ["email", "code", "password"],
                properties: {
                    email: { type: "string", format: "email", example: "joao@email.com" },
                    code: { type: "string", minLength: 6, maxLength: 6, example: "482931" },
                    password: { type: "string", minLength: 8, maxLength: 128, example: "novaSenha123" },
                },
            },
            response: {
                200: {
                    description: "Senha redefinida",
                    type: "object",
                    properties: { message: { type: "string" } },
                },
                400: { description: "Dados inválidos", ...errorResponse },
                404: { description: "Nenhum código pendente ou código expirado", ...errorResponse },
                422: { description: "Código inválido", ...errorResponse },
                429: { description: "Tentativas inválidas em excesso", ...errorResponse },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitPasswordResetMax, timeWindow: '1 minute' },
        },
    }, async (
        request: FastifyRequest<{ Body: ResetPasswordInputInterface }>,
        reply: FastifyReply) => {
            return passwordResetController.reset(request, reply);
        }
    );

    instance.delete("/account", {
        schema: {
            tags: ["Auth"],
            summary: "Excluir a própria conta",
            description: "Exclui permanentemente a conta do token (Authorization: Bearer). Pede a senha de novo. Publica `user.deleted`, que remove perfil, seguidores, bloqueios, denúncias feitas, posts, curtidas, comentários e notificações nos outros serviços.",
            security: [{ bearerAuth: [] }],
            body: {
                type: "object",
                required: ["password"],
                properties: {
                    password: { type: "string", minLength: 1, maxLength: 128 },
                },
            },
            response: {
                204: { description: "Conta excluída", type: "null" },
                400: { description: "Dados inválidos", ...errorResponse },
                401: { description: "Token ausente/inválido ou senha incorreta", ...errorResponse },
                404: { description: "Conta não encontrada", ...errorResponse },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitAccountDeleteMax, timeWindow: '1 minute' },
        },
    }, async (
        request: FastifyRequest<{ Body: DeleteAccountInputInterface }>,
        reply: FastifyReply) => {
            return accountController.delete(request, reply);
        }
    );

    instance.post("/admin/accounts/:accountId/suspend", {
        schema: {
            tags: ["Admin"],
            summary: "Suspender conta (moderação)",
            description: "Impede o login da conta. Exige o header x-admin-key (ADMIN_API_KEY); sem a variável configurada a rota responde 404.",
            params: accountIdParams,
            response: {
                204: { description: "Conta suspensa", type: "null" },
                401: { description: "Chave de administração inválida", ...errorResponse },
                404: { description: "Conta não encontrada", ...errorResponse },
            },
        },
    }, async (
        request: FastifyRequest<{ Params: AccountIdParamsInterface }>,
        reply: FastifyReply) => {
            return accountController.suspend(request, reply);
        }
    );

    instance.post("/admin/accounts/:accountId/unsuspend", {
        schema: {
            tags: ["Admin"],
            summary: "Reativar conta suspensa (moderação)",
            description: "Desfaz a suspensão. Exige o header x-admin-key (ADMIN_API_KEY).",
            params: accountIdParams,
            response: {
                204: { description: "Conta reativada", type: "null" },
                401: { description: "Chave de administração inválida", ...errorResponse },
                404: { description: "Conta não encontrada", ...errorResponse },
            },
        },
    }, async (
        request: FastifyRequest<{ Params: AccountIdParamsInterface }>,
        reply: FastifyReply) => {
            return accountController.unsuspend(request, reply);
        }
    );
}
