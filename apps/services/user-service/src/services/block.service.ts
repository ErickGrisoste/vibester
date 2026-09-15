import prismaClient from "../prisma/index.js";
import { EditProfileService } from "./editProfile.service.js";
import { SafetyError, isPrismaError } from "./safetyError.js";
import type { BlockedProfilesPage, BlockStatus } from "../types/safety.types.js";

const eitherWay = (a: string, b: string) => ({
    OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
    ],
});

export class BlockService {
    constructor(private readonly editProfileService = new EditProfileService()) {}

    /**
     * Bloqueia e desfaz o follow nas duas direções. Idempotente: bloquear de
     * novo não é erro.
     *
     * O unfollow reaproveita `decreaseFollower`, então contadores, cache e o
     * evento `user.unfollowed` (que tira os posts do feed no feed-service)
     * seguem o mesmo caminho de um deixar de seguir comum.
     */
    async block(blockerId: string, blockedId: string): Promise<void> {
        if (blockerId === blockedId) {
            throw new SafetyError("Você não pode bloquear a si mesmo", 400);
        }

        try {
            await prismaClient.userBlock.create({ data: { blockerId, blockedId } });
        } catch (error) {
            if (!isPrismaError(error, "P2002")) throw error;
        }

        const follows = await prismaClient.userFollow.findMany({
            where: {
                OR: [
                    { followerId: blockerId, followingId: blockedId },
                    { followerId: blockedId, followingId: blockerId },
                ],
            },
            select: { followerId: true, followingId: true },
        });

        for (const follow of follows) {
            try {
                await this.editProfileService.decreaseFollower(follow.followerId, follow.followingId);
            } catch (error) {
                // Já desfeito por uma chamada concorrente.
                if (!isPrismaError(error, "P2025")) throw error;
            }
        }
    }

    async unblock(blockerId: string, blockedId: string): Promise<void> {
        await prismaClient.userBlock.deleteMany({ where: { blockerId, blockedId } });
    }

    async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
        const count = await prismaClient.userBlock.count({ where: eitherWay(a, b) });
        return count > 0;
    }

    async status(viewerId: string, otherId: string): Promise<BlockStatus> {
        const rows = await prismaClient.userBlock.findMany({
            where: eitherWay(viewerId, otherId),
            select: { blockerId: true },
        });

        return {
            blocking: rows.some((row) => row.blockerId === viewerId),
            blockedBy: rows.some((row) => row.blockerId === otherId),
        };
    }

    /** Perfis bloqueados, mais recentes primeiro, paginados por `createdAt`. */
    async listBlocked(blockerId: string, limit = 50, cursor?: Date): Promise<BlockedProfilesPage> {
        const blocks = await prismaClient.userBlock.findMany({
            where: { blockerId, ...(cursor ? { createdAt: { lt: cursor } } : {}) },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { blockedId: true, createdAt: true },
        });

        if (blocks.length === 0) return { data: [], nextCursor: null };

        const profiles = await prismaClient.userProfile.findMany({
            where: { userID: { in: blocks.map((block) => block.blockedId) } },
            select: { userID: true, name: true, username: true, avatarUrl: true },
        });
        const byAccountId = new Map(profiles.map((profile) => [profile.userID, profile]));

        return {
            data: blocks.map((block) => {
                const profile = byAccountId.get(block.blockedId);
                return {
                    accountId: block.blockedId,
                    name: profile?.name ?? null,
                    username: profile?.username ?? null,
                    avatarUrl: profile?.avatarUrl ?? null,
                    blockedAt: block.createdAt,
                };
            }),
            nextCursor: blocks.length === limit ? blocks[blocks.length - 1].createdAt.toISOString() : null,
        };
    }
}
