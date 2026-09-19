import { LikeRepository } from "../repository/like.repository";
import { PostRepository } from "../repository/post.repository";
import { PaginatedLikes, PostLike } from "../types/like.types";
import { publishEvent, POSTS_TOPIC } from "../kafka/events";
import { HttpError } from "../errors/http.error";
import { decodeLikeByPostCursor, decodeLikeCursor } from "../utils/cursor";
import { likesTotal } from "../metrics/registry";

export class LikeService {
    constructor(private readonly likeRepository: LikeRepository, private readonly postRepository: PostRepository) {}

    async likePost(postId: string, userId: string): Promise<PostLike> {
        const post = await this.postRepository.findById(postId);

        if (!post) { throw new HttpError("Post not found", 404); }

        if (post.isDeleted) { throw new HttpError("Post is deleted", 404); }

        const existingLike = await this.likeRepository.findLikeByPostAndUser(postId, userId);

        if (existingLike) { throw new HttpError("Post already liked", 409); }

        const like: PostLike = {
            postId,
            userId,
            likedAt: new Date()
        };

        // A checagem acima (findLikeByPostAndUser) é só o caminho feliz — sob
        // concorrência, duas chamadas podem passar por ela antes de qualquer
        // escrita acontecer. createLikeByPost usa IF NOT EXISTS e é quem
        // realmente decide: só uma das duas chamadas concorrentes recebe
        // `true` aqui, evitando incrementar o counter duas vezes para o mesmo
        // like.
        const created = await this.likeRepository.createLikeByPost(like);
        if (!created) { throw new HttpError("Post already liked", 409); }

        await Promise.all([
            this.likeRepository.createLikeByUser(like),
            this.postRepository.incrementLikes(postId),
        ]);

        const { totalLikes, totalComments } = await this.postRepository.getCounters(postId);
        await this.postRepository.updateTotalLikesInAllViews(post, totalLikes);
        likesTotal.inc({ action: "liked" });

        await Promise.all([
            publishEvent('post.liked', postId, 'post.liked', {
                postId,
                postOwnerId: post.userId,
                likedByUserId: userId,
                createdAt: like.likedAt.toISOString(),
            }),
            publishEvent(POSTS_TOPIC, postId, 'post.stats.updated', {
                authorId: post.userId,
                postId,
                createdAt: post.createdAt.toISOString(),
                totalLikes,
                totalComments,
            }),
        ]);

        return like;
    }

    async unlikePost(postId: string, userId: string): Promise<void> {
        const post = await this.postRepository.findById(postId);

        if (!post) { throw new HttpError("Post not found", 404); }

        const existingLike = await this.likeRepository.findLikeByPostAndUser(postId, userId);

        if (!existingLike) { throw new HttpError("Like not found", 404); }

        // Mesma corrida do likePost, na direção oposta: deleteLikeByPost usa
        // IF EXISTS e é quem decide de fato — só uma das duas chamadas
        // concorrentes de unlike recebe `true`, evitando decrementar o
        // counter duas vezes (e deixá-lo negativo) para o mesmo unlike.
        const deleted = await this.likeRepository.deleteLikeByPost(postId, userId);
        if (!deleted) { throw new HttpError("Like not found", 404); }

        await Promise.all([
            this.likeRepository.deleteLikeByUser(userId, existingLike.likedAt, postId),
            this.postRepository.decrementLikes(postId),
        ]);

        const { totalLikes, totalComments } = await this.postRepository.getCounters(postId);
        await this.postRepository.updateTotalLikesInAllViews(post, totalLikes);
        likesTotal.inc({ action: "unliked" });

        await Promise.all([
            publishEvent('post.unliked', postId, 'post.unliked', {
                postId,
                userId,
                createdAt: existingLike.likedAt.toISOString(),
            }),
            publishEvent(POSTS_TOPIC, postId, 'post.stats.updated', {
                authorId: post.userId,
                postId,
                createdAt: post.createdAt.toISOString(),
                totalLikes,
                totalComments,
            }),
        ]);
    }

    async findLikesByUser(userId: string, limit = 50, rawCursor?: string): Promise<PaginatedLikes> {
        return this.likeRepository.findLikesByUser(userId, limit, decodeLikeCursor(rawCursor));
    }

    async findLikesByPost(postId: string, limit = 50, rawCursor?: string): Promise<PaginatedLikes> {
        return this.likeRepository.findLikesByPost(postId, limit, decodeLikeByPostCursor(rawCursor));
    }
}
