import { FeedItem, UpdatePostContentEvent } from "../types/feed.types";
import { BaseRepository } from "./base.repository";
import { toMediaRows } from "../utils/media";

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

    async findByUser(userId: string, limit: number, cursor?: Date) {
        if (cursor) {
            return this.execute(
                `
                    SELECT *
                    FROM feed_keyspace.feed_by_user
                    WHERE user_id = ?
                    AND created_at < ?
                    LIMIT ?;
                `,
                [userId, cursor, limit]
            );
        }

        return this.execute(
            `
                SELECT *
                FROM feed_keyspace.feed_by_user
                WHERE user_id = ?
                LIMIT ?;
            `,
            [userId, limit]
        );
    }

    /**
     * Linhas do feed pelas chaves exatas `(created_at, item_id)`, numa query de partição.
     *
     * Usado para hidratar as páginas de uma sessão rankeada: a sessão guarda só a ordem,
     * e o conteúdo continua vindo daqui. IN multi-coluna sobre a chave de clustering, com
     * a lista limitada a uma página (no máximo 50). O Cassandra devolve na ordem de
     * clustering, não na ordem pedida — quem chama reordena.
     */
    async findByKeys(userId: string, keys: readonly { createdAt: Date; itemId: string }[]) {
        if (keys.length === 0) { return []; }

        const placeholders = keys.map(() => "(?, ?)").join(", ");
        const params: unknown[] = [userId];

        for (const key of keys) {
            params.push(key.createdAt, key.itemId);
        }

        const result = await this.execute(
            `
                SELECT *
                FROM feed_keyspace.feed_by_user
                WHERE user_id = ?
                AND (created_at, item_id) IN (${placeholders});
            `,
            params
        );

        return result.rows;
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