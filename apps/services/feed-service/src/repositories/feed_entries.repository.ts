import { BaseRepository } from "./base.repository";
import { runFanout } from "../utils/fanout";

export class FeedEntriesByPostRepository extends BaseRepository {

    async create(postId: string, userId: string, createdAt: Date, ttl: number) {
        return this.execute(
            `
                INSERT INTO feed_keyspace.feed_entries_by_post (
                    post_id,
                    user_id,
                    created_at
                )
                VALUES (?, ?, ?)
                USING TTL ?;
            `,
            [postId, userId, createdAt, ttl]
        );
    }

    async findByItemId(postId: string) {
        return this.execute(
            `
                SELECT *
                FROM feed_keyspace.feed_entries_by_post
                WHERE post_id = ?;
            `,
            [postId]
        );
    }

    async findByItemIdAndUser(itemId: string, userId: string) {
        const result = await this.execute(
            `
                SELECT *
                FROM feed_keyspace.feed_entries_by_post
                WHERE post_id = ?
                    AND user_id = ?;
            `,
            [itemId, userId]
        );

        return result.rows[0] ?? null;
    }

    async delete(itemId: string, userId: string, createdAt: Date) {
        return this.execute(
            `
                DELETE FROM feed_keyspace.feed_entries_by_post
                WHERE post_id = ?
                    AND user_id = ?
                    AND created_at = ?;
            `,
            [itemId, userId, createdAt]
        );
    }

    async deleteByItemId(itemId: string) {
        const entries = await this.findByItemId(itemId);

        await runFanout(
            "feedEntries.deleteByItemId",
            entries.rows.map((entry) => () =>
                this.delete(entry.post_id, entry.user_id, entry.created_at)
            )
        );
    }
}