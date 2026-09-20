import { FastifyReply, FastifyRequest } from "fastify";
import { InteractionService } from "../services/interaction.service";
import { interactionBatchSchema } from "../schema/interaction.schema";
import { getAccountId } from "../plugins/auth";

export class InteractionController {
    constructor(private readonly interactionService: InteractionService) { }

    /**
     * POST /interactions
     *
     * Responde 202 (e não 201): o evento foi aceito e publicado no Kafka, mas
     * ainda não está persistido. Prometer 201 seria mentir sobre durabilidade.
     */
    async ingest(request: FastifyRequest, reply: FastifyReply) {
        const batch = interactionBatchSchema.parse(request.body);
        const accountId = getAccountId(request);

        const result = await this.interactionService.ingest(accountId, batch);

        return reply.status(202).send(result);
    }
}
