import { FeedItem, UpdatePostContentEvent } from "../types/feed.types";
import { BaseRepository } from "./base.repository";
import { toMediaRows } from "../utils/media";

// Teto de segurança para o grupo de itens com `created_at` idêntico buscado em
// extendPageAcrossTiedTimestamps — protege contra um grupo patologicamente
// grande (todos com o mesmo timestamp) virar uma leitura sem limite.
const MAX_TIED_TIMESTAMP_GROUP = 500;

export class FeedRepository extends BaseRepository {

    async create(feedItem: FeedItem, ttl: number) {
        return this.execute(
            `
                INSERT INTO feed_keyspace.feed_by_user (
                    user_id,
                    created_at,

                    item_id,
                    item_type,

                    author_id,
                    author_username,
                    author_profile_picture,
                    author_verified,

                    establishment_id,
                    establishment_name,
                    establishment_logo,
                    establishment_category,

                    event_id,
                    event_title,
                    event_banner,
                    event_lineup,
                    event_date,
                    event_location,
                    event_organizer_name,
                    event_organizer_logo,
                    total_confirmed,

                    title,
                    content,
                    image_urls,
                    media,
                    tags,

                    total_likes,
                    total_comments,

                    is_liked,
                    is_sponsored,
                    is_deleted,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                USING TTL ?;
            `,
            [
                feedItem.userId,
                feedItem.createdAt,

                feedItem.itemId,
                feedItem.itemType,

                feedItem.authorId,
                feedItem.authorUsername,
                feedItem.authorProfilePicture,
                feedItem.authorVerified,

                feedItem.establishmentId,
                feedItem.establishmentName,
                feedItem.establishmentLogo,
                feedItem.establishmentCategory,

                feedItem.eventId,
                feedItem.eventTitle,
                feedItem.eventBanner,
                feedItem.eventLineup,
                feedItem.eventDate,
                feedItem.eventLocation,
                feedItem.eventOrganizerName,
                feedItem.eventOrganizerLogo,
                feedItem.totalConfirmed,

                feedItem.title,
                feedItem.content,
                feedItem.imageUrls,
                toMediaRows(feedItem.media),
                feedItem.tags,

                feedItem.totalLikes,
                feedItem.totalComments,

                feedItem.isLiked ?? false,
                feedItem.isSponsored,
                feedItem.isDeleted,
                feedItem.updatedAt,

                ttl
            ]
        );
    }

    async updatePostContent(userId: string, createdAt: Date, contentUpdated: UpdatePostContentEvent) {
        return this.execute(
            `
                UPDATE feed_keyspace.feed_by_user
                SET
                    content = ?,
                    image_urls = ?,
                    media = ?
                WHERE user_id = ?
                    AND created_at = ?
                    AND item_id = ?;
            `,
            [contentUpdated.caption, contentUpdated.imageUrls, toMediaRows(contentUpdated.media), userId, createdAt, contentUpdated.postId]
        );
    }

    async updatePostStats(userId: string, createdAt: Date, postId: string, totalLikes: number, totalComments: number) {
        return this.execute(
            `
                UPDATE feed_keyspace.feed_by_user
                SET
                    total_likes = ?,
                    total_comments = ?
                WHERE user_id = ?
                    AND created_at = ?
                    AND item_id = ?;
            `,
            [totalLikes, totalComments, userId, createdAt, postId]
        );
    }

    async markAsLiked(userId: string, createdAt: Date, itemId: string) {
        return this.execute(
            `
                UPDATE feed_keyspace.feed_by_user
                SET is_liked = true
                WHERE user_id = ?
                    AND created_at = ?
                    AND item_id = ?;
            `,
            [userId, createdAt, itemId]
        );
    }

    async markAsUnliked(userId: string, createdAt: Date, itemId: string) {
        return this.execute(
            `
            UPDATE feed_keyspace.feed_by_user
            SET is_liked = false
            WHERE user_id = ?
                AND created_at = ?
                AND item_id = ?;
        `,
            [userId, createdAt, itemId]
        );
    }

    /**
     * `feed_by_user` particiona por `user_id` e ordena por `(created_at DESC,
     * item_id)`, mas a paginação só usa `created_at < ?` — sem `item_id` como
     * desempate. Se o `LIMIT` corta no meio de um grupo de itens com o mesmo
     * `created_at`, o restante do grupo nunca mais aparece: a próxima página
     * usa `created_at < cursor`, que exclui igualmente TODOS os itens desse
     * timestamp, inclusive os que ficaram de fora desta página — o feed perdia
     * itens em silêncio, sem erro nem log.
     *
     * Em vez de mudar o formato do cursor da API (hoje só `created_at`, usado
     * como está por clientes que não podemos confirmar agora), buscamos
     * `limit + 1` linhas para "espiar" se o item logo após o corte tem o mesmo
     * `created_at` do último item da página — só isso, sem round-trip extra no
     * caso comum. Se houver empate na fronteira, aí sim buscamos o grupo
     * completo desse timestamp (`extendPageAcrossTiedTimestamps`) e o incluímos
     * inteiro nesta página, para que `created_at < cursor` na próxima chamada
     * nunca corte um grupo pela metade de novo.
     */
    async findByUser(userId: string, limit: number, cursor?: Date) {
        const fetchLimit = limit + 1;

        const result = cursor
            ? await this.execute(
                `
                    SELECT *
                    FROM feed_keyspace.feed_by_user
                    WHERE user_id = ?
                    AND created_at < ?
                    LIMIT ?;
                `,
                [userId, cursor, fetchLimit]
            )
            : await this.execute(
                `
                    SELECT *
                    FROM feed_keyspace.feed_by_user
                    WHERE user_id = ?
                    LIMIT ?;
                `,
                [userId, fetchLimit]
            );

        if (result.rows.length === 0) {
            return result;
        }

        if (result.rows.length > limit) {
            const boundary = result.rows[limit - 1].created_at;
            const peekIsTied = result.rows[limit].created_at.getTime() === boundary.getTime();

            result.rows = result.rows.slice(0, limit);

            if (peekIsTied) {
                await this.extendPageAcrossTiedTimestamps(userId, result);
            }
        }

        return result;
    }

    /** Busca o grupo inteiro de itens com o `created_at` do último item da página (ver findByUser) e o mescla nela. */
    private async extendPageAcrossTiedTimestamps(userId: string, result: { rows: any[] }) {
        const rows = result.rows;
        const boundary = rows[rows.length - 1].created_at;
        const rowsAtBoundaryInPage = rows.filter(
            (row) => row.created_at.getTime() === boundary.getTime()
        ).length;

        const fullGroup = await this.execute(
            `
                SELECT *
                FROM feed_keyspace.feed_by_user
                WHERE user_id = ?
                    AND created_at = ?
                LIMIT ?;
            `,
            [userId, boundary, MAX_TIED_TIMESTAMP_GROUP]
        );

        if (fullGroup.rows.length <= rowsAtBoundaryInPage) {
            // Nenhum item do grupo de fronteira ficou de fora do LIMIT original.
            return;
        }

        const seenItemIds = new Set(rows.map((row) => row.item_id.toString()));
        const missing = fullGroup.rows.filter((row) => !seenItemIds.has(row.item_id.toString()));

        result.rows = [...rows, ...missing];
    }

    async delete(userId: string, createdAt: Date, itemId: string) {
        return this.execute(
            `
                DELETE FROM feed_keyspace.feed_by_user
                WHERE user_id = ?
                    AND created_at = ?
                    AND item_id = ?;
            `,
            [userId, createdAt, itemId]
        );
    }
}