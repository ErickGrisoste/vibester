import { UpdatePostContentEvent } from "../schema/events/post-content-updated.schema";
import { Post } from "../types/post.types";
import { BaseRepository } from "./base.repository";
import { toMediaRows } from "../utils/media";

export class PostsByUserRepository extends BaseRepository {

    async create(post: Post, ttl: number) {
        return this.execute(
            `
                INSERT INTO feed_keyspace.posts_by_user (
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
                    is_deleted,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                USING TTL ?;
            `,
            [
                post.userId,
                post.createdAt,
                post.postId,

                post.username,
                post.userProfilePicture,
                post.userVerified,

                post.establishmentId,
                post.establishmentName,
                post.establishmentLogo,
                post.establishmentCategory,

                post.imageUrls,
                toMediaRows(post.media),
                post.caption,
                post.tags,

                post.totalLikes,
                post.totalComments,
                post.isDeleted,
                post.updatedAt,

                ttl
            ]
        );
    }

    async findRecentPostsByUser(userId: string, since: Date) {
        return this.execute(
            `
                SELECT *
                FROM feed_keyspace.posts_by_user
                WHERE user_id = ?
                    AND created_at >= ?
                LIMIT 15;
            `,
            [userId, since]
        );
    }

    async updateContent(userId: string, createdAt: Date, contentUpdated: UpdatePostContentEvent) {
        return this.execute(
            `
                UPDATE feed_keyspace.posts_by_user
                SET
                    caption = ?,
                    image_urls = ?,
                    media = ?,
                    tags = ?
                WHERE user_id = ?
                    AND created_at = ?
                    AND post_id = ?;
            `,
            [contentUpdated.caption, contentUpdated.imageUrls, toMediaRows(contentUpdated.media), contentUpdated.tags, userId, createdAt, contentUpdated.postId]
        );
    }

    async updateStats(userId: string, createdAt: Date, postId: string, totalLikes: number, totalComments: number) {
        return this.execute(
            `
                UPDATE feed_keyspace.posts_by_user
                SET
                    total_likes = ?,
                    total_comments = ?
                WHERE user_id = ?
                    AND created_at = ?
                    AND post_id = ?;
            `,
            [totalLikes, totalComments, userId, createdAt, postId]
        );
    }

    async softDelete(userId: string, createdAt: Date, postId: string) {
        return this.execute(
            `
                UPDATE feed_keyspace.posts_by_user
                SET
                    is_deleted = true
                WHERE user_id = ?
                    AND created_at = ?
                    AND post_id = ?;
            `,
            [userId, createdAt, postId]
        );
    }

    async delete(userId: string, createdAt: Date, postId: string) {
        return this.execute(
            `
                DELETE
                FROM feed_keyspace.posts_by_user
                WHERE user_id = ?
                    AND created_at = ?
                    AND post_id = ?;
            `,
            [userId, createdAt, postId]
        );
    }
}