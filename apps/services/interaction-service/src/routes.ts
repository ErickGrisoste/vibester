import { FastifyInstance } from "fastify";
import { env } from "./config/env";
import { authenticate } from "./plugins/auth";
import { InteractionController } from "./controllers/interaction.controller";
import { InteractionService } from "./services/interaction.service";
import { isProducerConnected } from "./kafka/producer";
import {
    CLIENT_INTERACTION_TYPES,
    INTERACTION_SOURCES,
    ITEM_TYPES,
} from "./types/interaction.types";

const interactionEventJsonSchema = {
    type: "object",
    required: ["eventId", "type", "itemId", "itemType", "occurredAt"],
    additionalProperties: false,
    properties: {
        eventId: {
            type: "string",
            format: "uuid",
            description: "UUID gerado pelo cliente. Garante idempotência em reenvio.",
        },
        type: {
            type: "string",
            enum: [...CLIENT_INTERACTION_TYPES],
            description:
                "Apenas sinais que só o cliente conhece. LIKE/COMMENT/FOLLOW são derivados dos tópicos Kafka dos serviços de origem e são rejeitados aqui.",
        },
        itemId: { type: "string", minLength: 1, maxLength: 64 },
        itemType: { type: "string", enum: [...ITEM_TYPES] },
        occurredAt: {
            type: "string",
            description: "Data ISO 8601 do momento da captura no cliente.",
        },
        position: {
            type: "integer",
            minimum: 0,
            maximum: 10000,
            description: "Posição do item na lista quando o evento ocorreu.",
        },
        dwellMs: {
            type: "integer",
            minimum: 0,
            description: "Tempo em milissegundos que o item ficou visível.",
        },
        source: { type: "string", enum: [...INTERACTION_SOURCES] },
    },
} as const;

export async function setupRoutes(app: FastifyInstance) {
    const interactionService = new InteractionService();
    const interactionController = new InteractionController(interactionService);

    app.post(
        "/interactions",
        {
            preHandler: authenticate,
            config: { rateLimit: { max: env.rate_limit_max, timeWindow: "1 minute" } },
            schema: {
                tags: ["interactions"],
                summary: "Registra um lote de interações do usuário autenticado",
                description:
                    "Recebe os sinais implícitos que só o cliente conhece (impressão, dwell, posição, skip) e publica no Kafka. Responde 202: o evento foi aceito, a persistência é assíncrona. O userId NÃO vem no payload — é o accountId do token.",
                security: [{ bearerAuth: [] }],
                body: {
                    type: "object",
                    required: ["sessionId", "events"],
                    additionalProperties: false,
                    properties: {
                        sessionId: {
                            type: "string",
                            format: "uuid",
                            description:
                                "Sessão de navegação. Permite juntar eventos da mesma rolagem sem depender de relógio.",
                        },
                        events: {
                            type: "array",
                            minItems: 1,
                            maxItems: env.max_batch_size,
                            items: interactionEventJsonSchema,
                        },
                    },
                },
                response: {
                    202: {
                        type: "object",
                        properties: {
                            accepted: { type: "integer" },
                            duplicatesInBatch: { type: "integer" },
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
                    401: {
                        type: "object",
                        properties: { message: { type: "string" } },
                    },
                },
            },
        },
        interactionController.ingest.bind(interactionController)
    );

    /**
     * Liveness: o processo está vivo e servindo HTTP. NÃO checa dependência.
     *
     * O post-service aponta liveness e readiness para o mesmo /health, que checa
     * Cassandra — o efeito é que uma oscilação do Astra reinicia o pod mesmo com o
     * Node saudável. Aqui os dois são separados de propósito.
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
     * Readiness: pode receber tráfego?
     *
     * No modo api a única dependência é o Kafka — a ingestão não toca o Cassandra.
     */
    app.get("/ready", {
        schema: {
            tags: ["health"],
            summary: "Readiness — broker Kafka acessível",
            response: {
                200: { type: "object", properties: { status: { type: "string" }, kafka: { type: "boolean" } } },
                503: { type: "object", properties: { status: { type: "string" }, kafka: { type: "boolean" } } },
            },
        },
    }, async (_request, reply) => {
        const kafkaReady = isProducerConnected();

        return reply
            .status(kafkaReady ? 200 : 503)
            .send({ status: kafkaReady ? "ready" : "not-ready", kafka: kafkaReady });
    });
}
