import { Post, PaginatedPosts, PostCounters } from "../types/post.types";
import { BaseRepository } from "./base.repository";
import { PostCursor, encodeCursor } from "../utils/cursor";
import { toLegacyImageUrls, toMediaItems, toMediaRows } from "../utils/media";
import { runFanout } from "../utils/fanout";

// Colunas `counter` do Cassandra vêm como Long (biblioteca `long`), não como
// number nativo — só relevante para total_likes/total_comments de
// post_counters, as colunas `int` das tabelas denormalizadas já são number.
function toCount(value: unknown): number {
    if (value === null || value === undefined) { return 0; }
    if (typeof value === "number") { return value; }
    if (typeof (value as { toNumber?: unknown }).toNumber === "function") {
        return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value);
}

export class PostRepository extends BaseRepository {

    private mapRow(row: any): Post {
        const media = toMediaItems(row.media, row.image_urls);

        return {
            postId: row.post_id,
            userId: row.user_id,
            userUsername: row.user_username,
            userProfilePicture: row.user_profile_picture,
            userVerified: row.user_verified,
            establishmentId: row.establishment_id,
            establishmentName: row.establishment_name,
            establishmentLogo: row.establishment_logo,
            establishmentCategory: row.establishment_category,
            media,
            imageUrls: toLegacyImageUrls(media),
            caption: row.caption,
            tags: row.tags,
            totalLikes: row.total_likes,
            totalComments: row.total_comments,
            isDeleted: row.is_deleted,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    async createPostById(post: Post) {
        return this.execute(
            `
                INSERT INTO posts_by_id (
                    post_id,
                    user_id,
                    user_username,
                    user_profile_picture,
                    user_verified,
                    establishment_id,
                    establishment_name,
                    establishment_logo,
                    establishment_category,
                    image_urls,
                    media,
                    caption,
                    tags,
                    total_likes,
                    total_comments,
                    is_deleted,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `,
            [
                post.postId,
                post.userId,
                post.userUsername,
                post.userProfilePicture,
                post.userVerified,
                post.establishmentId ?? null,
                post.establishmentName ?? null,
                post.establishmentLogo ?? null,
                post.establishmentCategory ?? null,
                post.imageUrls,
                toMediaRows(post.media),
                post.caption,
                post.tags ?? null,
                post.totalLikes,
                post.totalComments,
                post.isDeleted,
                post.createdAt
            ]
        );
    }

    async createPostByUser(post: Post) {
        return this.execute(
            `
                INSERT INTO posts_by_user (
                    user_id,
                    created_at,
                    post_id,
                    user_username,
                    user_profile_picture,
                    user_verified,
                    establishment_id,
                    establishment_name,
                    establishment_logo,
                    establishment_category,
                    image_urls,
                    media,
                    caption,
                    tags,
                    total_likes,
                    total_comments,
                    is_deleted
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `,
            [
                post.userId,
                post.createdAt,
                post.postId,
                post.userUsername,
                post.userProfilePicture,
                post.userVerified,
                post.establishmentId ?? null,
                post.establishmentName ?? null,
                post.establishmentLogo ?? null,
                post.establishmentCategory ?? null,
                post.imageUrls,
                toMediaRows(post.media),
                post.caption,
                post.tags ?? null,
                post.totalLikes,
                post.totalComments,
                post.isDeleted
            ]
        );
    }

    async createPostByEstablishment(post: Post) {
        if (!post.establishmentId) { return; }

        return this.execute(
            `
                INSERT INTO posts_by_establishment (
                    establishment_id,
                    created_at,
                    post_id,
                    user_id,
                    user_username,
                    user_profile_picture,
                    user_verified,
                    establishment_name,
                    establishment_logo,
                    establishment_category,
                    image_urls,
                    media,
                    caption,
                    tags,
                    total_likes,
                    total_comments,
                    is_deleted
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `,
            [
                post.establishmentId,
                post.createdAt,
                post.postId,
                post.userId,
                post.userUsername,
                post.userProfilePicture,
                post.userVerified,
                post.establishmentName ?? null,
                post.establishmentLogo ?? null,
                post.establishmentCategory ?? null,
                post.imageUrls,
                toMediaRows(post.media),
                post.caption,
                post.tags ?? null,
                post.totalLikes,
                post.totalComments,
                post.isDeleted
            ]
        );
    }

    /**
     * Grava o post em todas as tabelas denormalizadas relevantes. Sem BATCH/LWT
     * entre elas (Cassandra não oferece transação cross-partition barata) — uma
     * falha parcial pode deixar as views divergentes; ver CLAUDE.md do serviço.
     */
    async createInAllViews(post: Post) {
        await runFanout("createInAllViews", [
            () => this.createPostById(post),
            () => this.createPostByUser(post),
            ...(post.establishmentId ? [() => this.createPostByEstablishment(post)] : []),
        ]);
    }

    async updateCaptionInAllViews(post: Post, caption: string, updatedAt: Date) {
        await runFanout("updateCaptionInAllViews", [
            () => this.updateCaptionById(post.postId, caption, updatedAt),
            () => this.updateCaptionByUser(post.userId, post.createdAt, post.postId, caption, updatedAt),
            ...(post.establishmentId
                ? [() => this.updateCaptionByEstablishment(post.establishmentId!, post.createdAt, post.postId, caption, updatedAt)]
                : []),
        ]);
    }

    async softDeleteInAllViews(post: Post) {
        await runFanout("softDeleteInAllViews", [
            () => this.softDeleteById(post.postId),
            () => this.softDeleteByUser(post.userId, post.createdAt, post.postId),
            ...(post.establishmentId
                ? [() => this.softDeleteByEstablishment(post.establishmentId!, post.createdAt, post.postId)]
                : []),
        ]);
    }

    async updateTotalLikesInAllViews(post: Post, totalLikes: number) {
        await runFanout("updateTotalLikesInAllViews", [
            () => this.updateTotalLikesById(totalLikes, post.postId),
            () => this.updateTotalLikesByUser(post.userId, post.createdAt, totalLikes, post.postId),
            ...(post.establishmentId
                ? [() => this.updateTotalLikesByEstablishment(post.establishmentId!, post.createdAt, totalLikes, post.postId)]
                : []),
        ]);
    }

    async updateTotalCommentsInAllViews(post: Post, totalComments: number) {
        await runFanout("updateTotalCommentsInAllViews", [
            () => this.updateTotalCommentsById(totalComments, post.postId),
            () => this.updateTotalCommentsByUser(post.userId, post.createdAt, totalComments, post.postId),
            ...(post.establishmentId
                ? [() => this.updateTotalCommentsByEstablishment(post.establishmentId!, post.createdAt, totalComments, post.postId)]
                : []),
        ]);
    }

    /**
     * Incremento/decremento atômico em `post_counters` — substitui o padrão
     * antigo de ler `totalLikes`/`totalComments` e recalcular em memória, que
     * perdia incrementos sob curtidas/comentários concorrentes no mesmo post
     * (ver CLAUDE.md do serviço, seção Performance). O valor absoluto atual
     * ainda precisa ser lido via `getCounters` depois — Cassandra não tem
     * `UPDATE ... RETURNING` para counter.
     */
    async incrementLikes(postId: string): Promise<void> {
        await this.execute(
            `UPDATE post_counters SET total_likes = total_likes + 1 WHERE post_id = ?;`,
            [postId]
        );
    }

    async decrementLikes(postId: string): Promise<void> {
        await this.execute(
            `UPDATE post_counters SET total_likes = total_likes - 1 WHERE post_id = ?;`,
            [postId]
        );
    }

    async incrementComments(postId: string): Promise<void> {
        await this.execute(
            `UPDATE post_counters SET total_comments = total_comments + 1 WHERE post_id = ?;`,
            [postId]
        );
    }

    async decrementComments(postId: string): Promise<void> {
        await this.execute(
            `UPDATE post_counters SET total_comments = total_comments - 1 WHERE post_id = ?;`,
            [postId]
        );
    }

    // Sem linha em post_counters == nunca incrementado == 0 (convenção do
    // Cassandra para counter: a partição só existe após o primeiro incremento).
    async getCounters(postId: string): Promise<PostCounters> {
        const result = await this.execute(
            `SELECT total_likes, total_comments FROM post_counters WHERE post_id = ?;`,
            [postId]
        );

        const row = result.rows[0];
        return {
            totalLikes: toCount(row?.total_likes),
            totalComments: toCount(row?.total_comments),
        };
    }

    async findById(postId: string): Promise<Post | null> {
        const result = await this.execute(
            `
                SELECT *
                FROM posts_by_id
                WHERE post_id = ?;
            `,
            [postId]
        );

        const row = result.rows[0];

        if (!row) { return null; }

        return this.mapRow(row);
    }

    async findByUser(userId: string, limit = 50, cursor?: PostCursor): Promise<PaginatedPosts> {
        const params: unknown[] = [userId];
        let cursorClause = "";

        if (cursor) {
            cursorClause = "AND (created_at, post_id) < (?, ?)";
            params.push(cursor.createdAt, cursor.postId);
        }

        params.push(limit);

        const result = await this.execute(
            `
                SELECT *
                FROM posts_by_user
                WHERE user_id = ?
                ${cursorClause}
                LIMIT ?;
            `,
            params
        );

        const rows = result.rows;
        const posts = rows.map((row) => this.mapRow(row)).filter((post) => !post.isDeleted);
        const lastRow = rows[rows.length - 1];
        const nextCursor = rows.length === limit && lastRow
            ? encodeCursor({ createdAt: lastRow.created_at, postId: lastRow.post_id })
            : null;

        return { posts, nextCursor };
    }

    async findByEstablishment(establishmentId: string, limit = 50, cursor?: PostCursor): Promise<PaginatedPosts> {
        const params: unknown[] = [establishmentId];
        let cursorClause = "";

        if (cursor) {
            cursorClause = "AND (created_at, post_id) < (?, ?)";
            params.push(cursor.createdAt, cursor.postId);
        }

        params.push(limit);

        const result = await this.execute(
            `
                SELECT *
                FROM posts_by_establishment
                WHERE establishment_id = ?
                ${cursorClause}
                LIMIT ?;
            `,
            params
        );

        const rows = result.rows;
        const posts = rows.map((row) => this.mapRow(row)).filter((post) => !post.isDeleted);
        const lastRow = rows[rows.length - 1];
        const nextCursor = rows.length === limit && lastRow
            ? encodeCursor({ createdAt: lastRow.created_at, postId: lastRow.post_id })
            : null;

        return { posts, nextCursor };
    }

    async updateCaptionById(postId: string, caption: string, updatedAt: Date) {
        return this.execute(
            `
                UPDATE posts_by_id
                SET caption = ?,
                    updated_at = ?
                WHERE post_id = ?;
            `,
            [caption, updatedAt, postId]
        );
    }

    async updateCaptionByUser(userId: string, createdAt: Date, postId: string, caption: string, updatedAt: Date) {
        return this.execute(
            `
                UPDATE posts_by_user
                SET caption = ?,
                    updated_at = ?
                WHERE user_id = ?
                AND created_at = ?
                AND post_id = ?;
            `,
            [caption, updatedAt, userId, createdAt, postId]
        );
    }

    async updateCaptionByEstablishment(establishmentId: string, createdAt: Date, postId: string, caption: string, updatedAt: Date) {
        return this.execute(
            `
                UPDATE posts_by_establishment
                SET caption = ?,
                    updated_at = ?
                WHERE establishment_id = ?
                AND created_at = ?
                AND post_id = ?;
            `,
            [caption, updatedAt, establishmentId, createdAt, postId]
        );
    }

    async softDeleteById(postId: string) {
        return this.execute(
            `
                UPDATE posts_by_id
                SET is_deleted = true
                WHERE post_id = ?;
            `,
            [postId]
        );
    }

    async softDeleteByUser(userId: string, createdAt: Date, postId: string) {
        return this.execute(
            `
                UPDATE posts_by_user
                SET is_deleted = true
                WHERE user_id = ?
                AND created_at = ?
                AND post_id = ?;
            `,
            [userId, createdAt, postId]
        );
    }

    async softDeleteByEstablishment(establishmentId: string, createdAt: Date, postId: string) {
        return this.execute(
            `
                UPDATE posts_by_establishment
                SET is_deleted = true
                WHERE establishment_id = ?
                AND created_at = ?
                AND post_id = ?;
            `,
            [establishmentId, createdAt, postId]
        );
    }

    async updateTotalLikesById(totalLikes: number, postId: string) {
        return this.execute(
            `
                UPDATE posts_by_id
                SET total_likes = ?
                WHERE post_id = ?;
            `,
            [totalLikes, postId]
        );
    }

    async updateTotalLikesByUser(userId: string, createdAt: Date, totalLikes: number, postId: string) {
        return this.execute(
            `
                UPDATE posts_by_user
                SET total_likes = ?
                WHERE user_id = ?
                AND created_at = ?
                AND post_id = ?;
            `,
            [totalLikes, userId, createdAt, postId]
        );
    }

    async updateTotalLikesByEstablishment(establishmentId: string, createdAt: Date, totalLikes: number, postId: string) {
        return this.execute(
            `
                UPDATE posts_by_establishment
                SET total_likes = ?
                WHERE establishment_id = ?
                AND created_at = ?
                AND post_id = ?;
            `,
            [totalLikes, establishmentId, createdAt, postId]
        );
    }

    async updateTotalCommentsById(totalComments: number, postId: string) {
        return this.execute(
            `
                UPDATE posts_by_id
                SET total_comments = ?
                WHERE post_id = ?;
            `,
            [totalComments, postId]
        );
    }

    async updateTotalCommentsByUser(userId: string, createdAt: Date, totalComments: number, postId: string) {
        return this.execute(
            `
                UPDATE posts_by_user
                SET total_comments = ?
                WHERE user_id = ?
                AND created_at = ?
                AND post_id = ?;
            `,
            [totalComments, userId, createdAt, postId]
        );
    }

    async updateTotalCommentsByEstablishment(establishmentId: string, createdAt: Date, totalComments: number, postId: string) {
        return this.execute(
            `
                UPDATE posts_by_establishment
                SET total_comments = ?
                WHERE establishment_id = ?
                AND created_at = ?
                AND post_id = ?;
            `,
            [totalComments, establishmentId, createdAt, postId]
        );
    }
}
