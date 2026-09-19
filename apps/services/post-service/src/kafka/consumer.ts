import { Kafka, Consumer } from "kafkajs";
import { z } from "zod";
import { env } from "../config/env";
import type { AccountContentDeletionService } from "../services/account-content-deletion.service";

export const USER_DELETED_TOPIC = "user.deleted";

// Payload plano publicado pelo auth-service (DELETE /auth/account). O id vira
// prefixo de chave no R2, então só UUID passa.
const userDeletedSchema = z.object({
    userId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional(),
}).refine((event) => event.accountId || event.userId, { message: "accountId ou userId obrigatório" });

type DeletionService = Pick<AccountContentDeletionService, "deleteAllContent">;

export async function handleUserDeletedMessage(rawValue: string, service: DeletionService): Promise<void> {
    let event: z.infer<typeof userDeletedSchema>;
    try {
        event = userDeletedSchema.parse(JSON.parse(rawValue));
    } catch (error) {
        // Malformada nunca vai dar certo: descarta para não travar a partição.
        const msg = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({ level: "error", service: "post-service", op: "user.deleted", msg: "invalid event, skipping", detail: msg }));
        return;
    }

    const userId = (event.accountId ?? event.userId)!;
    await service.deleteAllContent(userId);
    console.log(JSON.stringify({ level: "info", service: "post-service", op: "user.deleted", msg: "account content deleted", userId }));
}

let _consumer: Consumer | null = null;

export async function startConsumer(service: DeletionService): Promise<void> {
    const kafka = new Kafka({ clientId: "post-service", brokers: env.kafka_brokers.split(",") });
    _consumer = kafka.consumer({ groupId: "post-service-group" });

    await _consumer.connect();
    await _consumer.subscribe({ topic: USER_DELETED_TOPIC, fromBeginning: false });

    await _consumer.run({
        eachMessage: async ({ message }) => {
            // Erro de Cassandra/R2 sobe: o kafkajs tenta de novo com backoff.
            await handleUserDeletedMessage(message.value?.toString() ?? "{}", service);
        },
    });
}

export async function stopConsumer(): Promise<void> {
    await _consumer?.disconnect();
    _consumer = null;
}
