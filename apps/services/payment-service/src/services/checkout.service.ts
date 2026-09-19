import { randomUUID } from "node:crypto";
import prismaClient from "../prisma/index";
import { abacatePayClient } from "../abacatepay/client";
import { producer } from "../kafka/producer";
import { AppError } from "../errors/app-error";
import { CheckoutInputInterface, CheckoutOutputInterface } from "../types/checkout.types";

export class CheckoutService {
    async createCheckout(input: CheckoutInputInterface): Promise<CheckoutOutputInterface> {
        let checkout;
        try {
            checkout = await abacatePayClient.createCheckout(input.productId, input.quantity, input.methods);
        } catch (error) {
            throw new AppError((error as Error).message, 502);
        }

        const billId = randomUUID();
        // checkout.data.amount ainda não foi confirmado contra a resposta real da AbacatePay
        // (ver src/abacatepay/client.ts). Sem esse campo, cai em 0 até a confirmação.
        const amount = checkout.data.amount ?? 0;

        try {
            await prismaClient.payment.create({
                data: {
                    billId,
                    externalId: checkout.data.id,
                    amount,
                    status: "PENDING",
                },
            });
        } catch {
            throw new AppError("Falha ao salvar pagamento", 500);
        }

        await producer.send({
            topic: "payment.checkout.created",
            messages: [
                {
                    key: billId,
                    value: JSON.stringify({
                        billId,
                        externalId: checkout.data.id,
                        amount,
                        status: "PENDING",
                    }),
                },
            ],
        });

        return { url: checkout.data.url };
    }
}
