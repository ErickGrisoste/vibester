import { Comment, PaginatedComments } from "../types/comment.type";
import { BaseRepository } from "./base.repository";
import { CommentCursor, encodeCommentCursor } from "../utils/cursor";

export class CommentRepository extends BaseRepository {

    async createCommentByPost(comment: Comment) {
        return this.execute(
            `
                INSERT INTO comments_by_post (
                    post_id,
                    created_at,
                    comment_id,
                    user_id,
                    content,
                    is_deleted,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?);
            `,
            [
                comment.postId,
                comment.createdAt,
                comment.commentId,
                comment.userId,
                comment.content,
                comment.isDeleted,
                comment.updatedAt ?? null
            ]
        );
    }

    async createCommentByUser(comment: Comment) {
        return this.execute(
            `
                INSERT INTO comments_by_user (
                    user_id,
                    created_at,
                    comment_id,
                    post_id,
                    content,
                    is_deleted,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?);
            `,
            [
                comment.userId,
                comment.createdAt,
                comment.commentId,
                comment.postId,
                comment.content,
                comment.isDeleted,
                comment.updatedAt ?? null
            ]
        );
    }

    async findByPost(postId: string, limit = 50, cursor?: CommentCursor): Promise<PaginatedComments> {
        const params: unknown[] = [postId];
        let cursorClause = "";

        if (cursor) {
            cursorClause = "AND (created_at, comment_id) < (?, ?)";
            params.push(cursor.createdAt, cursor.commentId);
        }

        params.push(limit);

        const result = await this.execute(
            `
                SELECT *
                FROM comments_by_post
                WHERE post_id = ?
                ${cursorClause}
                LIMIT ?;
            `,
            params
        );

        const rows = result.rows;
        const comments = rows.map((row) => ({
            commentId: row.comment_id,
            postId: row.post_id,
            userId: row.user_id,
            content: row.content,
            isDeleted: row.is_deleted,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
        const lastRow = rows[rows.length - 1];
        const nextCursor = rows.length === limit && lastRow
            ? encodeCommentCursor({ createdAt: lastRow.created_at, commentId: lastRow.comment_id })
            : null;

        return { comments, nextCursor };
    }

    async findByUser(userId: string, limit = 50, cursor?: CommentCursor): Promise<PaginatedComments> {
        const params: unknown[] = [userId];
        let cursorClause = "";

        if (cursor) {
            cursorClause = "AND (created_at, comment_id) < (?, ?)";
            params.push(cursor.createdAt, cursor.commentId);
        }

        params.push(limit);

        const result = await this.execute(
            `
                SELECT *
                FROM comments_by_user
                WHERE user_id = ?
                ${cursorClause}
                LIMIT ?;
            `,
            params
        );

        const rows = result.rows;
        const comments = rows.map((row) => ({
            commentId: row.comment_id,
            postId: row.post_id,
            userId: row.user_id,
            content: row.content,
            isDeleted: row.is_deleted,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
        const lastRow = rows[rows.length - 1];
        const nextCursor = rows.length === limit && lastRow
            ? encodeCommentCursor({ createdAt: lastRow.created_at, commentId: lastRow.comment_id })
            : null;

        return { comments, nextCursor };
    }

    async updateCommentByPost(
        postId: string,
        createdAt: Date,
        commentId: string,
        content: string,
        updatedAt: Date
    ) {
        return this.execute(
            `
                UPDATE comments_by_post
                SET content = ?,
                    updated_at = ?
                WHERE post_id = ?
                AND created_at = ?
                AND comment_id = ?;
            `,
            [content, updatedAt, postId, createdAt, commentId]
        );
    }

    async updateCommentByUser(
        userId: string,
        createdAt: Date,
        commentId: string,
        content: string,
        updatedAt: Date
    ) {
        return this.execute(
            `
                UPDATE comments_by_user
                SET content = ?,
                    updated_at = ?
                WHERE user_id = ?
                AND created_at = ?
                AND comment_id = ?;
            `,
            [content, updatedAt, userId, createdAt, commentId]
        );
    }

    async softDeleteCommentByPost(
        postId: string,
        createdAt: Date,
        commentId: string
    ) {
        return this.execute(
            `
                UPDATE comments_by_post
                SET is_deleted = true
                WHERE post_id = ?
                AND created_at = ?
                AND comment_id = ?;
            `,
            [postId, createdAt, commentId]
        );
    }

    async softDeleteCommentByUser(
        userId: string,
        createdAt: Date,
        commentId: string
    ) {
        return this.execute(
            `
                UPDATE comments_by_user
                SET is_deleted = true
                WHERE user_id = ?
                AND created_at = ?
                AND comment_id = ?;
            `,
            [userId, createdAt, commentId]
        );
    }

    async createCommentById(comment: Comment) {
        return this.execute(
            `
                INSERT INTO comments_by_id (
                    comment_id,
                    post_id,
                    user_id,
                    content,
                    is_deleted,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?);
            `,
            [
                comment.commentId,
                comment.postId,
                comment.userId,
                comment.content,
                comment.isDeleted,
                comment.createdAt,
                comment.updatedAt ?? null
            ]
        );
    }

    async findById(commentId: string): Promise<Comment | null> {
        const result = await this.execute(
            `
                SELECT *
                FROM comments_by_id
                WHERE comment_id = ?;
            `,
            [commentId]
        );

        const row = result.rows[0];

        if (!row) { return null; }

        return {
            commentId: row.comment_id,
            postId: row.post_id,
            userId: row.user_id,
            content: row.content,
            isDeleted: row.is_deleted,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    async updateCommentById(
        commentId: string,
        content: string,
        updatedAt: Date
    ) {
        return this.execute(
            `
                UPDATE comments_by_id
                SET content = ?,
                    updated_at = ?
                WHERE comment_id = ?;
            `,
            [content, updatedAt, commentId]
        );
    }

    // IF is_deleted = false fecha a corrida de dois softDelete concorrentes do
    // mesmo comentário: sem isso, ambos passavam pela checagem prévia em
    // CommentService (nenhum write tinha rodado ainda) e ambos decrementavam o
    // counter atômico de total_comments, deixando-o negativo.
    async softDeleteCommentById(commentId: string): Promise<boolean> {
        const result = await this.execute(
            `
                UPDATE comments_by_id
                SET is_deleted = true
                WHERE comment_id = ?
                IF is_deleted = false;
            `,
            [commentId]
        );
        return this.isApplied(result);
    }
}
