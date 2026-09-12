import { BaseRepository } from "./base.repository";
import { PaginatedLikes, PostLike } from "../types/like.types";
import {
    LikeByPostCursor,
    LikeCursor,
    encodeLikeByPostCursor,
    encodeLikeCursor,
} from "../utils/cursor";

export class LikeRepository extends BaseRepository {

    // IF NOT EXISTS fecha a corrida de dois likePost concorrentes pro mesmo
    // (post, user): sem isso, ambos passavam pela checagem prévia em
    // LikeService e ambos incrementavam o counter atômico, inflando
    // total_likes mesmo só existindo uma linha aqui no fim.
    async createLikeByPost(like: PostLike): Promise<boolean> {
        const result = await this.execute(
            `
            INSERT INTO likes_by_post (
                post_id,
                user_id,
                liked_at
            )
            VALUES (?, ?, ?)
            IF NOT EXISTS;
            `,
            [like.postId, like.userId, like.likedAt]
        );
        return this.isApplied(result);
    }

    async createLikeByUser(like: PostLike) {
        return this.execute(
            `
                INSERT INTO likes_by_user (
                    user_id,
                    liked_at,
                    post_id
                )
                VALUES (?, ?, ?);
            `,
            [like.userId, like.likedAt, like.postId]
        );
    }

    async findLikeByPostAndUser(postId: string, userId: string): Promise<PostLike | null> {
        const result = await this.execute(
            `
                SELECT *
                FROM likes_by_post
                WHERE post_id = ?
                AND user_id = ?;
            `,
            [postId, userId]
        );

        const row = result.rows[0];

        if (!row) { return null; }

        return {
            postId: row.post_id,
            userId: row.user_id,
            likedAt: row.liked_at
        };
    }

    // Usado pra marcar isLiked em uma lista de posts sem N+1: uma query só,
    // usando IN na partition key (post_id) do lado do usuário que está vendo.
    async findLikedPostIds(postIds: string[], userId: string): Promise<Set<string>> {
        if (postIds.length === 0) { return new Set(); }

        const result = await this.execute(
            `
                SELECT post_id
                FROM likes_by_post
                WHERE post_id IN ?
                AND user_id = ?;
            `,
            [postIds, userId]
        );

        return new Set(result.rows.map((row) => row.post_id));
    }

    // likes_by_post é clusterizada por user_id, não por liked_at (ver
    // migrations/V005 e o comentário em utils/cursor.ts) — a paginação aqui é
    // por ordem estável de user_id, não por recência.
    async findLikesByPost(postId: string, limit = 50, cursor?: LikeByPostCursor): Promise<PaginatedLikes> {
        const params: unknown[] = [postId];
        let cursorClause = "";

        if (cursor) {
            cursorClause = "AND user_id > ?";
            params.push(cursor.userId);
        }

        params.push(limit);

        const result = await this.execute(
            `
                SELECT *
                FROM likes_by_post
                WHERE post_id = ?
                ${cursorClause}
                LIMIT ?;
            `,
            params
        );

        const rows = result.rows;
        const likes = rows.map((row) => ({
            postId: row.post_id,
            userId: row.user_id,
            likedAt: row.liked_at,
        }));
        const lastRow = rows[rows.length - 1];
        const nextCursor = rows.length === limit && lastRow
            ? encodeLikeByPostCursor({ userId: lastRow.user_id })
            : null;

        return { likes, nextCursor };
    }

    async findLikesByUser(userId: string, limit = 50, cursor?: LikeCursor): Promise<PaginatedLikes> {
        const params: unknown[] = [userId];
        let cursorClause = "";

        if (cursor) {
            cursorClause = "AND (liked_at, post_id) < (?, ?)";
            params.push(cursor.likedAt, cursor.postId);
        }

        params.push(limit);

        const result = await this.execute(
            `
                SELECT *
                FROM likes_by_user
                WHERE user_id = ?
                ${cursorClause}
                LIMIT ?;
            `,
            params
        );

        const rows = result.rows;
        const likes = rows.map((row) => ({
            postId: row.post_id,
            userId: row.user_id,
            likedAt: row.liked_at,
        }));
        const lastRow = rows[rows.length - 1];
        const nextCursor = rows.length === limit && lastRow
            ? encodeLikeCursor({ likedAt: lastRow.liked_at, postId: lastRow.post_id })
            : null;

        return { likes, nextCursor };
    }

    // IF EXISTS fecha a corrida de dois unlikePost concorrentes pro mesmo
    // (post, user): sem isso, ambos passavam pela checagem prévia em
    // LikeService e ambos decrementavam o counter atômico, deixando
    // total_likes negativo mesmo já não existindo like nenhum pra remover.
    async deleteLikeByPost(postId: string, userId: string): Promise<boolean> {
        const result = await this.execute(
            `
                DELETE FROM likes_by_post
                WHERE post_id = ?
                AND user_id = ?
                IF EXISTS;
            `,
            [postId, userId]
        );
        return this.isApplied(result);
    }

    async deleteLikeByUser(userId: string, likedAt: Date, postId: string) {
        return this.execute(
            `
            DELETE FROM likes_by_user
            WHERE user_id = ?
            AND liked_at = ?
            AND post_id = ?;
            `,
            [userId, likedAt, postId]
        );
    }
}
