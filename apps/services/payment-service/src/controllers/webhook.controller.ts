import { FastifyReply, FastifyRequest } from "fastify";
import { WebhookService } from "../services/webhook.service";
import { AbacatePayWebhookPayload, WebhookQueryInterface } from "../types/webhook.types";
import { AppError } from "../errors/app-error";

export class WebhookController {
    private readonly webhookService = new WebhookService();

    async handle(
        request: FastifyRequest<{ Body: AbacatePayWebhookPayload; Querystring: WebhookQueryInterface }>,
        reply: FastifyReply
    ) {
        try {
            await this.webhookService.handle(request.body);
            return reply.status(200).send({ received: true });
        } catch (error: any) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }
}
