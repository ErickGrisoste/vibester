import prismaClient from "../prisma/index";
import { producer } from "../kafka/producer";
import { AppError } from "../errors/app-error";
import { AbacatePayWebhookPayload } from "../types/webhook.types";

// Nomes de evento assumidos ("billing.paid"/"billing.failed"/"billing.expired") até confirmação
// contra a documentação real de webhooks da AbacatePay.
function mapEventToStatus(event: string): "PAID" | "FAILED" | null {
    if (event === "billing.paid") return "PAID";
    if (event === "billing.failed" || event === "billing.expired") return "FAILED";
    return null;
}

export class WebhookService {
    async handle(payload: AbacatePayWebhookPayload): Promise<void> {
        const status = mapEventToStatus(payload.event);
        if (!status) {
            throw new AppError("Evento de webhook não reconhecido", 400);
        }

        const payment = await prismaClient.payment.findFirst({
            where: { externalId: payload.data.id },
        });

        if (!payment) {
            throw new AppError("Pagamento não encontrado para o externalId informado", 404);
        }

        if (payment.status !== "PENDING") {
            return;
        }

        await prismaClient.payment.update({
            where: { id: payment.id },
            data: { status },
        });

        await producer.send({
            topic: status === "PAID" ? "payment.confirmed" : "payment.failed",
            messages: [
                {
                    key: payment.billId,
                    value: JSON.stringify({
                        billId: payment.billId,
                        externalId: payment.externalId,
                        amount: payment.amount,
                        status,
                    }),
                },
            ],
        });
    }
}
