import prismaClient from "../prisma/index.js";
import { redis } from "../config/redis.js";

// Kafka entrega pelo menos uma vez: a mesma mensagem pode chegar de novo após
// um rebalance. Guardar o eventId processado evita contar o mesmo post duas
// vezes. É best-effort — com Redis fora, o contador ainda anda.
const PROCESSED_TTL_SECONDS = 7 * 24 * 60 * 60;

export class PostCounterService {
    async handlePostCreated(eventId: string, authorId: string) {
        await this.applyOnce(eventId, authorId, () =>
            prismaClient.userProfile.updateMany({
                where: { userID: authorId },
                data: { totalPosts: { increment: 1 } },
            })
        );
    }

    async handlePostDeleted(eventId: string, authorId: string) {
        // updateMany com `gt: 0` para o contador nunca ficar negativo, mesmo
        // com eventos fora de ordem ou posts anteriores a este consumidor.
        await this.applyOnce(eventId, authorId, () =>
            prismaClient.userProfile.updateMany({
                where: { userID: authorId, totalPosts: { gt: 0 } },
                data: { totalPosts: { decrement: 1 } },
            })
        );
    }

    private async applyOnce(eventId: string, authorId: string, apply: () => Promise<unknown>) {
        const processedKey = `user:post-event:${eventId}`;
        const alreadyProcessed = await redis.exists(processedKey).catch(() => 0);
        if (alreadyProcessed) return;

        await apply();

        await Promise.all([
            redis.set(processedKey, "1", "EX", PROCESSED_TTL_SECONDS).catch(() => {}),
            redis.del(`user:profile:${authorId}`).catch(() => {}),
        ]);
    }
}
