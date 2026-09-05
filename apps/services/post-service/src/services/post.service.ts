import { randomUUID } from "crypto";
import { PostRepository } from "../repository/post.repository";
import { LikeRepository } from "../repository/like.repository";
import {
    CreatePostInput,
    Post,
    UpdatePostInput
} from "../types/post.types";
import { redis, cacheAside } from "../config/redis";
import { HttpError } from "../errors/http.error";
import { producer } from "../kafka/producer";
import { decodeCursor } from "../utils/cursor";
import { toLegacyImageUrls } from "../utils/media";

const POSTS_TOPIC = "posts";

function kafkaEnvelope(eventType: string, data: unknown) {
    return JSON.stringify({
        eventId: randomUUID(),
        eventType,
        occurredAt: new Date().toISOString(),
        data,
    });
}

export class PostService {

    constructor(
        private readonly postRepository: PostRepository,
        private readonly likeRepository: LikeRepository,
    ) {}

    async create(input: CreatePostInput): Promise<Post> {
        const postId = randomUUID();

        const post: Post = {
            postId,
            userId: input.userId,
            userUsername: input.userUsername,
            userProfilePicture: input.userProfilePicture,
            userVerified: input.userVerified,
            establishmentId: input.establishmentId,
            establishmentName: input.establishmentName,
            establishmentLogo: input.establishmentLogo,
            establishmentCategory: input.establishmentCategory,
            media: input.media,
            imageUrls: toLegacyImageUrls(input.media),
            caption: input.caption,
            tags: input.tags,
            totalLikes: 0,
            totalComments: 0,
            isDeleted: false,
            createdAt: new Date(),
        };

        await Promise.all([
            this.postRepository.createPostById(post),
            this.postRepository.createPostByUser(post),
        ]);

        if (post.establishmentId) {
            await this.postRepository.createPostByEstablishment(post);
        }

        await this.invalidatePostCaches(post.userId, post.establishmentId, post.postId);

        await producer.send({
            topic: POSTS_TOPIC,
            messages: [{
                key: post.postId,
                value: kafkaEnvelope("post.created", {
                    itemId: post.postId,
                    itemType: post.establishmentId ? "ESTABLISHMENT_POST" : "USER_POST",
                    authorId: post.userId,
                    authorUsername: post.userUsername,
                    authorProfilePicture: post.userProfilePicture,
                    authorVerified: post.userVerified ?? false,
                    establishmentId: post.establishmentId,
                    establishmentName: post.establishmentName,
                    establishmentLogo: post.establishmentLogo,
                    establishmentCategory: post.establishmentCategory,
                    content: post.caption,
                    media: post.media,
                    imageUrls: post.imageUrls,
                    tags: post.tags,
                    totalLikes: 0,
                    totalComments: 0,
                    isLiked: false,
                    isSponsored: false,
                    isDeleted: false,
                    createdAt: post.createdAt.toISOString(),
                }),
            }],
        });

        return post;
    }

    async findById(postId: string) {
        return cacheAside(`post:id:${postId}`, 300, () =>
            this.postRepository.findById(postId)
        );
    }

    async findByUser(userId: string, limit = 50, rawCursor?: string, viewerId?: string) {
        const cursor = decodeCursor(rawCursor);
        const cacheKey = `post:user:${userId}:${limit}` + (rawCursor ? `:${rawCursor}` : "");
        const result = await cacheAside(cacheKey, 120, () =>
            this.postRepository.findByUser(userId, limit, cursor)
        );

        return { ...result, posts: await this.attachIsLiked(result.posts, viewerId) };
    }

    async findByEstablishment(establishmentId: string, limit = 50, rawCursor?: string, viewerId?: string) {
        const cursor = decodeCursor(rawCursor);
        const cacheKey = `post:establishment:${establishmentId}:${limit}` + (rawCursor ? `:${rawCursor}` : "");
        const result = await cacheAside(cacheKey, 120, () =>
            this.postRepository.findByEstablishment(establishmentId, limit, cursor)
        );

        return { ...result, posts: await this.attachIsLiked(result.posts, viewerId) };
    }

    // Feito fora do cacheAside de propósito: o cache de posts é por autor
    // (compartilhado entre todos os viewers), então isLiked precisa ser
    // calculado a cada request pro viewerId específico, nunca cacheado junto.
    private async attachIsLiked(posts: Post[], viewerId?: string): Promise<Post[]> {
        if (!viewerId || posts.length === 0) {
            return posts.map((post) => ({ ...post, isLiked: false }));
        }

        const likedPostIds = await this.likeRepository.findLikedPostIds(
            posts.map((post) => post.postId),
            viewerId
        );

        return posts.map((post) => ({ ...post, isLiked: likedPostIds.has(post.postId) }));
    }

    async updateCaption(input: UpdatePostInput): Promise<Post> {
        const post = await this.postRepository.findById(input.postId);

        if (!post) { throw new HttpError("Post not found", 404); }

        if (post.isDeleted) { throw new HttpError("Post is deleted", 404); }

        const updatedAt = new Date();

        await Promise.all([
            this.postRepository.updateCaptionById(input.postId, input.caption, updatedAt),
            this.postRepository.updateCaptionByUser(post.userId, post.createdAt, input.postId, input.caption, updatedAt),
        ]);

        if (post.establishmentId) {
            await this.postRepository.updateCaptionByEstablishment(post.establishmentId, post.createdAt, input.postId, input.caption, updatedAt);
        }

        await this.invalidatePostCaches(post.userId, post.establishmentId, input.postId);

        await producer.send({
            topic: POSTS_TOPIC,
            messages: [{
                key: input.postId,
                value: kafkaEnvelope("post.content.updated", {
                    authorId: post.userId,
                    postId: input.postId,
                    createdAt: post.createdAt.toISOString(),
                    caption: input.caption,
                }),
            }],
        });

        return {
            ...post,
            caption: input.caption,
            updatedAt,
        };
    }

    async softDelete(postId: string) {
        const post = await this.postRepository.findById(postId);

        if (!post) { throw new HttpError("Post not found", 404); }

        await Promise.all([
            this.postRepository.softDeleteById(postId),
            this.postRepository.softDeleteByUser(post.userId, post.createdAt, postId),
        ]);

        if (post.establishmentId) {
            await this.postRepository.softDeleteByEstablishment(post.establishmentId, post.createdAt, post.postId);
        }

        await this.invalidatePostCaches(post.userId, post.establishmentId, postId);

        await producer.send({
            topic: POSTS_TOPIC,
            messages: [{
                key: postId,
                value: kafkaEnvelope("post.deleted", {
                    authorId: post.userId,
                    postId,
                    createdAt: post.createdAt.toISOString(),
                }),
            }],
        });
    }

    private async invalidatePostCaches(userId: string, establishmentId: string | undefined, postId: string) {
        const keys = [
            `post:id:${postId}`,
            `post:user:${userId}:50`,
            `post:user:${userId}:100`,
        ];
        if (establishmentId) {
            keys.push(`post:establishment:${establishmentId}:50`);
            keys.push(`post:establishment:${establishmentId}:100`);
        }
        try {
            await redis.del(...keys);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(JSON.stringify({ level: "warn", service: "post-service", op: "cache-invalidate", msg }));
        }
    }
}
