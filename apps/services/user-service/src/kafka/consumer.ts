import { Kafka } from 'kafkajs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { CreateProfileService } from '../services/createProfile.service.js';
import { PostCounterService } from '../services/postCounter.service.js';
import { UserDeletionService } from '../services/userDeletion.service.js';

const kafka = new Kafka({ clientId: 'user-service', brokers: env.kafkaBrokers.split(',') });
const consumer = kafka.consumer({ groupId: 'user-service-group' });
const createProfileService = new CreateProfileService();
const postCounterService = new PostCounterService();
const userDeletionService = new UserDeletionService();

// Payload plano publicado pelo auth-service (DELETE /auth/account).
const userDeletedSchema = z.object({
    userId: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
}).refine((event) => event.accountId || event.userId, { message: 'accountId ou userId obrigatório' });

export async function handleUserDeletedEvent(rawValue: string, service = userDeletionService) {
    let event: z.infer<typeof userDeletedSchema>;
    try {
        event = userDeletedSchema.parse(JSON.parse(rawValue));
    } catch (error) {
        console.error('[Kafka] invalid user.deleted event, skipping:', error);
        return;
    }

    // Erro de banco sobe: o Kafka reentrega e a exclusão é idempotente.
    await service.handleUserDeleted((event.accountId ?? event.userId)!);
}

// Envelope publicado pelo post-service (`publishEvent` em post-service/src/kafka/events.ts).
const postEventSchema = z.object({
    eventId: z.string(),
    eventType: z.string(),
    data: z.object({ authorId: z.string() }).passthrough(),
});

export async function handlePostEvent(rawValue: string, service = postCounterService) {
    let event: z.infer<typeof postEventSchema>;
    try {
        event = postEventSchema.parse(JSON.parse(rawValue));
    } catch (error) {
        // Mensagem malformada é descartada: reprocessar nunca vai dar certo e
        // travaria a partição. Erro de banco, abaixo, sobe para o Kafka tentar de novo.
        console.error('[Kafka] invalid posts event, skipping:', error);
        return;
    }

    switch (event.eventType) {
        case 'post.created':
            return service.handlePostCreated(event.eventId, event.data.authorId);
        case 'post.deleted':
            return service.handlePostDeleted(event.eventId, event.data.authorId);
        default:
            // post.content.updated / post.stats.updated não mexem no perfil.
            return;
    }
}

export async function startConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'user.registered', fromBeginning: false });
    await consumer.subscribe({ topic: 'posts', fromBeginning: false });
    await consumer.subscribe({ topic: 'user.deleted', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            if (topic === 'posts') {
                await handlePostEvent(message.value!.toString());
                return;
            }

            if (topic === 'user.deleted') {
                await handleUserDeletedEvent(message.value!.toString());
                return;
            }

            const payload = JSON.parse(message.value!.toString());
            await createProfileService.createProfile({ accountId: payload.accountId });
        },
    });
}
