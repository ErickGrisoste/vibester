import { FastifyInstance } from "fastify";
import { env } from "./config/env";
import { authenticate } from "./plugins/auth";
import { ValidationController } from "./controllers/validation.controller";
import { ValidationService } from "./services/validation.service";
import { isProducerConnected } from "./kafka/producer";
import { isRedisReady } from "./config/redis";
import { registry } from "./metrics/registry";
import { ValidationCode } from "./types/validation.types";

const issueJsonSchema = {
    type: "object",
    properties: {
        code: {
            type: "string",
            enum: Object.values(ValidationCode),
            description:
                "Motivo da rejeição. É por este código que o cliente decide a mensagem — " +
                "nenhum código revela qual termo ou domínio casou.",
        },
        field: { type: "string", enum: ["content", "tags"] },
        message: { type: "string", description: "Mensagem pronta em pt-BR." },
    },
} as const;

export async function setupRoutes(app: FastifyInstance) {
    const validationService = new ValidationService();
    const validationController = new ValidationController(validationService);

    app.post(
        "/validations/post",
        {
            preHandler: authenticate,
            config: { rateLimit: { max: env.rate_limit_max, timeWindow: "1 minute" } },
            schema: {
                tags: ["validations"],
                summary: "Valida o conteúdo de uma postagem",
                description:
                    "Aplica as regras da comunidade (vazio, tamanho, linguagem, links, spam) e " +
                    "devolve o veredito. Responde 200 tanto para válido quanto para inválido: a " +
                    "validação em si teve sucesso nos dois casos. O userId NÃO vem no payload — " +
                    "é o accountId do token.",
                security: [{ bearerAuth: [] }],
                body: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        content: {
                            type: "string",
                            description: "Legenda da postagem. Pode ser vazia se houver mídia.",
                        },
                        tags: {
                            type: "array",
                            items: { type: "string" },
                            description: "Tags da postagem. Passam pelo mesmo filtro de linguagem.",
                        },
                        mediaCount: {
                            type: "integer",
                            minimum: 0,
                            description:
                                "Quantas mídias a postagem tem. Só distingue post só de foto de post vazio.",
                        },
                        postId: {
                            type: "string",
                            format: "uuid",
                            description: "Opcional, só para correlacionar no log. Não muda o veredito.",
                        },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            valid: { type: "boolean" },
                            issues: { type: "array", items: issueJsonSchema },
                            contentHash: {
                                type: "string",
                                description: "SHA-256 do conteúdo + configuração. Chave do cache.",
                            },
                            cached: { type: "boolean" },
                        },
                    },
                    400: {
                        type: "object",
                        properties: {
                            message: { type: "string" },
                            errors: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        field: { type: "string" },
                                        message: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    401: { type: "object", properties: { message: { type: "string" } } },
                },
            },
        },
        validationController.validatePost.bind(validationController)
    );

    /**
     * Liveness: o processo está vivo. NÃO checa dependência — reiniciar o pod
     * não conserta um Redis fora do ar. Mesma separação do interaction-service.
     */
    app.get("/health", {
        schema: {
            tags: ["health"],
            summary: "Liveness — processo vivo, sem checar dependências",
            response: {
                200: {
                    type: "object",
                    properties: { status: { type: "string" }, mode: { type: "string" } },
                },
            },
        },
    }, async () => ({ status: "ok", mode: env.mode }));

    /**
     * Readiness.
     *
     * **Nada aqui é crítico, de propósito.** As regras são puras: sem Redis o
     * serviço valida igual, só recalculando; sem Kafka a rota síncrona continua
     * respondendo (só o worker precisa do broker). Derrubar o readiness por uma
     * dependência opcional tiraria de rotação um pod que estava funcionando —
     * e seria o serviço de validação inteiro indisponível por causa do cache.
     *
     * Por isso o status vira `degraded` com 200, seguindo o que o post-service
     * faz com o Redis dele. Um alerta em cima de `redis: false` é o lugar certo
     * de reagir a isso, não o balanceador.
     */
    app.get("/ready", {
        schema: {
            tags: ["health"],
            summary: "Readiness — sempre 200; reporta dependências degradadas",
            response: {
                200: {
                    type: "object",
                    properties: {
                        status: { type: "string" },
                        redis: { type: "boolean" },
                        kafka: { type: "boolean" },
                    },
                },
            },
        },
    }, async () => {
        const redisReady = isRedisReady();
        const kafkaReady = isProducerConnected();

        return {
            status: redisReady && kafkaReady ? "ready" : "degraded",
            redis: redisReady,
            kafka: kafkaReady,
        };
    });

    app.get("/metrics", {
        schema: { tags: ["health"], summary: "Métricas Prometheus" },
    }, async (_request, reply) => {
        reply.header("Content-Type", registry.contentType);
        return registry.metrics();
    });
}
