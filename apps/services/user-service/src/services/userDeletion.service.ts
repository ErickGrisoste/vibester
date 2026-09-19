import prismaClient from "../prisma/index.js";
import { producer } from "../kafka/producer.js";
import { redis } from "../config/redis.js";

/** Follows removidos por rodada: limita o tamanho de cada transação e evento. */
export const FOLLOW_PAGE_SIZE = 500;

/**
 * Apaga os dados deste serviço de uma conta excluída (evento `user.deleted`
 * publicado pelo auth-service).
 *
 * Idempotente: o Kafka pode entregar o evento de novo, e uma segunda rodada
 * simplesmente não encontra mais nada.
 */
export class UserDeletionService {
    async handleUserDeleted(accountId: string): Promise<void> {
        await this.removeFollows(accountId);

        await prismaClient.$transaction([
            prismaClient.userBlock.deleteMany({
                where: { OR: [{ blockerId: accountId }, { blockedId: accountId }] },
            }),
            // Denúncias feitas pela conta, e denúncias contra o perfil (que não
            // existe mais). Denúncias de posts dela somem junto com os posts.
            prismaClient.contentReport.deleteMany({
                where: {
                    OR: [
                        { reporterId: accountId },
                        { targetType: "USER", targetId: accountId },
                    ],
                },
            }),
            prismaClient.userProfile.deleteMany({ where: { userID: accountId } }),
        ]);

        await redis.del(
            `user:profile:${accountId}`,
            `user:followers:${accountId}`,
            `user:following:${accountId}`,
        ).catch(() => {});
    }

    /**
     * Desfaz, em páginas, todo follow de e para a conta.
     *
     * Os contadores dos outros perfis andam num `updateMany` por página (cada
     * perfil aparece no máximo uma vez por direção, pela unique do follow), e
     * `user.unfollowed` sai para o feed-service limpar as relações locais — o
     * mesmo evento de um deixar de seguir comum.
     */
    private async removeFollows(accountId: string): Promise<void> {
        for (;;) {
            const page = await prismaClient.userFollow.findMany({
                where: { OR: [{ followerId: accountId }, { followingId: accountId }] },
                select: { id: true, followerId: true, followingId: true },
                take: FOLLOW_PAGE_SIZE,
            });

            if (page.length === 0) return;

            const followedByDeleted = page
                .filter((follow) => follow.followerId === accountId)
                .map((follow) => follow.followingId);
            const followersOfDeleted = page
                .filter((follow) => follow.followingId === accountId)
                .map((follow) => follow.followerId);

            // Evento antes do delete: se a transação falhar, o Kafka reentrega e
            // o evento sai de novo (o feed-service trata unfollow repetido).
            await producer.send({
                topic: "user.unfollowed",
                messages: page.map((follow) => ({
                    value: JSON.stringify({ followerId: follow.followerId, followedId: follow.followingId }),
                })),
            });

            await prismaClient.$transaction([
                prismaClient.userFollow.deleteMany({ where: { id: { in: page.map((follow) => follow.id) } } }),
                prismaClient.userProfile.updateMany({
                    where: { userID: { in: followedByDeleted }, followers: { gt: 0 } },
                    data: { followers: { decrement: 1 } },
                }),
                prismaClient.userProfile.updateMany({
                    where: { userID: { in: followersOfDeleted }, following: { gt: 0 } },
                    data: { following: { decrement: 1 } },
                }),
            ]);

            await redis.del(
                ...followedByDeleted.flatMap((id) => [`user:profile:${id}`, `user:followers:${id}`]),
                ...followersOfDeleted.flatMap((id) => [`user:profile:${id}`, `user:following:${id}`]),
            ).catch(() => {});
        }
    }
}
