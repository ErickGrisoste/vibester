import { FastifyReply, FastifyRequest } from "fastify";
import { CheckoutService } from "../services/checkout.service";
import { CheckoutInputInterface } from "../types/checkout.types";
import { AppError } from "../errors/app-error";

export class CheckoutController {
    private readonly checkoutService = new CheckoutService();

    async checkout(
        request: FastifyRequest<{ Body: CheckoutInputInterface }>,
        reply: FastifyReply
    ) {
        const { productId, quantity, methods } = request.body;

        try {
            const result = await this.checkoutService.createCheckout({ productId, quantity, methods });
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }
}
