import { timingSafeEqual } from "node:crypto";
import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { CheckoutInputInterface } from "./types/checkout.types";
import { AbacatePayWebhookPayload, WebhookQueryInterface } from "./types/webhook.types";
import { CheckoutController } from "./controllers/checkout.controller";
import { WebhookController } from "./controllers/webhook.controller";
import { env } from "./config/env";

const checkoutController = new CheckoutController();
const webhookController = new WebhookController();

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
        await request.jwtVerify();
    } catch (error) {
        request.log.error(error);
        return reply.status(401).send({ error: "Token de autenticação inválido ou ausente" });
    }
}

// Mecanismo de validação assumido (secret compartilhado via querystring) até confirmação
// contra a documentação real de assinatura de webhooks da AbacatePay.
async function verifyWebhookSecret(
    request: FastifyRequest<{ Querystring: WebhookQueryInterface }>,
    reply: FastifyReply
) {
    const provided = request.query.webhookSecret ?? "";
    const expected = env.abacatePayWebhookSecret ?? "";

    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);

    const isValid =
        expected.length > 0 &&
        providedBuf.length === expectedBuf.length &&
        timingSafeEqual(providedBuf, expectedBuf);

    if (!isValid) {
        return reply.status(401).send({ error: "Secret de webhook inválido" });
    }
}

export async function paymentRoutes(instance: FastifyInstance, options: FastifyPluginOptions) {

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
    }, async (_request, reply) => {
        return reply.status(200).send({ status: "ok" });
    });

    instance.post<{ Body: CheckoutInputInterface }>("/checkout", {
        schema: {
            tags: ["Payment"],
            summary: "Criar checkout",
            description: "Cria um checkout no AbacatePay e registra o pagamento com status PENDING. Retorna a URL de pagamento para redirecionar o usuário.",
            security: [{ bearerAuth: [] }],
            body: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                    productId: { type: "string", description: "ID do produto cadastrado no AbacatePay", example: "prod_abc123" },
                    quantity: { type: "integer", minimum: 1, description: "Quantidade do produto", example: 1 },
                    methods: {
                        type: "array",
                        items: { type: "string", enum: ["PIX", "CREDIT_CARD"] },
                        description: "Métodos de pagamento aceitos (opcional; padrão: todos disponíveis)",
                    },
                },
            },
            response: {
                200: {
                    description: "Checkout criado com sucesso",
                    type: "object",
                    properties: { url: { type: "string", format: "uri" } },
                },
                400: {
                    description: "Requisição inválida",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                401: {
                    description: "Token de autenticação inválido ou ausente",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                500: {
                    description: "Erro interno ou falha ao salvar o pagamento",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                502: {
                    description: "Falha ao comunicar com o AbacatePay",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
            },
        },
        config: {
            rateLimit: { max: env.rateLimitCheckoutMax, timeWindow: '1 minute' },
        },
        preHandler: [authenticate],
    }, async (request, reply) => {
        return checkoutController.checkout(request, reply);
    });

    instance.post<{ Body: AbacatePayWebhookPayload; Querystring: WebhookQueryInterface }>("/webhook/abacatepay", {
        schema: {
            tags: ["Payment"],
            summary: "Webhook de confirmação de pagamento",
            description: "Recebido da AbacatePay quando um pagamento é confirmado ou falha. Atualiza o status do pagamento de PENDING para PAID/FAILED.",
            querystring: {
                type: "object",
                properties: { webhookSecret: { type: "string" } },
            },
            body: {
                type: "object",
                required: ["event", "data"],
                properties: {
                    event: { type: "string", example: "billing.paid" },
                    data: {
                        type: "object",
                        required: ["id"],
                        properties: { id: { type: "string", example: "bill_abc123" } },
                    },
                },
            },
            response: {
                200: {
                    description: "Webhook processado",
                    type: "object",
                    properties: { received: { type: "boolean" } },
                },
                400: {
                    description: "Evento não reconhecido ou payload inválido",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                401: {
                    description: "Secret de webhook inválido",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
                404: {
                    description: "Pagamento não encontrado para o externalId informado",
                    type: "object",
                    properties: { error: { type: "string" } },
                },
            },
        },
        preHandler: [verifyWebhookSecret],
    }, async (request, reply) => {
        return webhookController.handle(request, reply);
    });
}
