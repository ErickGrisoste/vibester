import prismaClient from "../prisma/index.js";
import { cacheAside } from "../config/redis.js";
import type { FollowProfilesPage, FollowRef } from "../types/profile.types.js";

/** Tamanho de página padrão — o único que entra no cache (ver `paginate`). */
export const FOLLOW_PAGE_SIZE = 30;

/**
 * Listagem de seguidores e de quem o perfil segue, já com nome, @ e avatar.
 *
 * O relacionamento (`UserFollow`) e o perfil (`UserProfile`) são tabelas
 * separadas e sem relação declarada no Prisma, então a hidratação é feita em
 * **duas** consultas por página — a do relacionamento e um `findMany` com
 * `userID: { in: [...] }` — nunca uma consulta de perfil por linha (N+1).
 *
 * A paginação é por cursor em `createdAt` (e não por `skip`), porque a lista
 * cresce indefinidamente e `OFFSET` fica mais caro a cada página.
 */
export class GetFollowersService {
    /** Quem segue `accountId`, mais recentes primeiro. */
    async listFollowers(accountId: string, limit = FOLLOW_PAGE_SIZE, cursor?: Date): Promise<FollowProfilesPage> {
        return this.paginate(`user:followers:${accountId}`, limit, cursor, async () => {
            const rows = await prismaClient.userFollow.findMany({
                where: { followingId: accountId, ...(cursor ? { createdAt: { lt: cursor } } : {}) },
                orderBy: { createdAt: "desc" },
                take: limit,
                select: { followerId: true, createdAt: true },
            });
            return rows.map((row) => ({ accountId: row.followerId, createdAt: row.createdAt }));
        });
    }

    /** Quem `accountId` segue, mais recentes primeiro. */
    async listFollowing(accountId: string, limit = FOLLOW_PAGE_SIZE, cursor?: Date): Promise<FollowProfilesPage> {
        return this.paginate(`user:following:${accountId}`, limit, cursor, async () => {
            const rows = await prismaClient.userFollow.findMany({
                where: { followerId: accountId, ...(cursor ? { createdAt: { lt: cursor } } : {}) },
                orderBy: { createdAt: "desc" },
                take: limit,
                select: { followingId: true, createdAt: true },
            });
            return rows.map((row) => ({ accountId: row.followingId, createdAt: row.createdAt }));
        });
    }

    /**
     * Só a primeira página no tamanho padrão entra no cache: é a que
     * praticamente todo acesso abre, e é a única cuja chave
     * (`user:followers:<id>` / `user:following:<id>`) o seguir/deixar de seguir
     * já invalida em `EditProfileService`. Página com cursor ou limite fora do
     * padrão vai direto ao banco, para não deixar chave órfã no Redis.
     */
    private async paginate(
        cacheKey: string,
        limit: number,
        cursor: Date | undefined,
        fetchRefs: () => Promise<FollowRef[]>,
    ): Promise<FollowProfilesPage> {
        const load = async () => this.hydrate(await fetchRefs(), limit);
        if (cursor || limit !== FOLLOW_PAGE_SIZE) return load();
        return cacheAside(cacheKey, 60, load);
    }

    /** Traz os perfis dos ids da página numa consulta só, preservando a ordem. */
    private async hydrate(refs: FollowRef[], limit: number): Promise<FollowProfilesPage> {
        if (refs.length === 0) return { data: [], nextCursor: null };

        const profiles = await prismaClient.userProfile.findMany({
            where: { userID: { in: refs.map((ref) => ref.accountId) } },
            select: { userID: true, name: true, username: true, avatarUrl: true, followers: true },
        });
        const byAccountId = new Map(profiles.map((profile) => [profile.userID, profile]));

        return {
            // Um follow sem perfil correspondente (perfil ainda não criado, ou
            // conta em exclusão) continua na lista com os campos nulos, em vez
            // de sumir — senão a página viria menor que o `limit` e a
            // paginação pularia registros.
            data: refs.map((ref) => {
                const profile = byAccountId.get(ref.accountId);
                return {
                    accountId: ref.accountId,
                    name: profile?.name ?? null,
                    username: profile?.username ?? null,
                    avatarUrl: profile?.avatarUrl ?? null,
                    followers: profile?.followers ?? 0,
                    followedAt: ref.createdAt,
                };
            }),
            nextCursor: refs.length === limit ? refs[refs.length - 1].createdAt.toISOString() : null,
        };
    }
}
