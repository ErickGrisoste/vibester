import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { LoginInputInterface, RegisterInputInterface } from "./types/register.types";
import { VerifyEmailInputInterface } from "./types/email-verification.types";
import { RegisterController } from "./controllers/register.controller";
import { LoginController } from "./controllers/login.controller";
import { EmailVerificationController } from "./controllers/email-verification.controller";
import { env } from "./config/env";

const registerController = new RegisterController();
const loginController = new LoginController();
const emailVerificationController = new EmailVerificationController();

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
            description: "Autentica uma conta usando email ou username e retorna um token JWT. O username é aceito com ou sem o prefixo \"@\". Falhas consecutivas são contabilizadas e o dono da conta é notificado por email ao atingir o limite da janela.",
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
                        token: { type: "string" },
                        accountId: { type: "string", format: "uuid" },
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
}
