import { Kafka } from 'kafkajs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { CreateProfileService } from '../services/createProfile.service.js';
import { PostCounterService } from '../services/postCounter.service.js';

const kafka = new Kafka({ clientId: 'user-service', brokers: env.kafkaBrokers.split(',') });
const consumer = kafka.consumer({ groupId: 'user-service-group' });
const createProfileService = new CreateProfileService();
const postCounterService = new PostCounterService();

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

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            if (topic === 'posts') {
                await handlePostEvent(message.value!.toString());
                return;
            }

            const payload = JSON.parse(message.value!.toString());
            await createProfileService.createProfile({ accountId: payload.accountId });
        },
    });
}
