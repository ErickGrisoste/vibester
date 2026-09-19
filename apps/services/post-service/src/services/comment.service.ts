import { randomUUID } from "crypto";

import { CommentRepository } from "../repository/comment.repository";
import { PostRepository } from "../repository/post.repository";
import { Comment, CreateCommentInput, PaginatedComments, UpdateCommentInput } from "../types/comment.type";
import { publishEvent } from "../kafka/events";
import { HttpError } from "../errors/http.error";
import { decodeCommentCursor } from "../utils/cursor";
import { commentsTotal } from "../metrics/registry";

export class CommentService {
    constructor(private readonly commentRepository: CommentRepository,
         private readonly postRepository: PostRepository) {}

    async create(input: CreateCommentInput): Promise<Comment> {
        const post = await this.postRepository.findById(input.postId);

        if (!post) { throw new HttpError("Post not found", 404); }

        if (post.isDeleted) { throw new HttpError("Post is deleted", 404); }

        const comment: Comment = {
            commentId: randomUUID(),
            postId: input.postId,
            userId: input.userId,
            content: input.content,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: null
        };

        await Promise.all([
            this.commentRepository.createCommentById(comment),
            this.commentRepository.createCommentByPost(comment),
            this.commentRepository.createCommentByUser(comment),
            this.postRepository.incrementComments(post.postId),
        ]);

        const { totalComments } = await this.postRepository.getCounters(post.postId);
        await this.postRepository.updateTotalCommentsInAllViews(post, totalComments);
        commentsTotal.inc({ action: "created" });

        await publishEvent('post.commented', comment.postId, 'post.commented', {
            postId: comment.postId,
            postOwnerId: post.userId,
            commentedByUserId: comment.userId,
            content: comment.content,
        });

        return comment;
    }

    async findByPost(postId: string, limit = 50, rawCursor?: string): Promise<PaginatedComments> {
        return this.commentRepository.findByPost(postId, limit, decodeCommentCursor(rawCursor));
    }

    async findByUser(userId: string, limit = 50, rawCursor?: string): Promise<PaginatedComments> {
        return this.commentRepository.findByUser(userId, limit, decodeCommentCursor(rawCursor));
    }

    async findById(commentId: string): Promise<Comment | null> {
        return this.commentRepository.findById(commentId);
    }

    async update(input: UpdateCommentInput, currentUserId: string): Promise<Comment> {
        const comment = await this.commentRepository.findById(input.commentId);

        if (!comment) { throw new HttpError("Comment not found", 404); }

        if (comment.userId != currentUserId) { throw new HttpError("You cannot update this comment.", 403); }

        if (comment.isDeleted) { throw new HttpError("Comment is deleted", 404); }

        const updatedAt = new Date();

        await Promise.all([
            this.commentRepository.updateCommentById(comment.commentId, input.content, updatedAt),

            this.commentRepository.updateCommentByPost(comment.postId, comment.createdAt, comment.commentId,
                input.content, updatedAt),

            this.commentRepository.updateCommentByUser(comment.userId, comment.createdAt, comment.commentId,
                input.content, updatedAt)
        ]);

        return {
            ...comment,
            content: input.content,
            updatedAt
        };
    }

    async softDelete(
        commentId: string,
        currentUserId: string
    ): Promise<void> {
        const comment = await this.commentRepository.findById(commentId);

        if (!comment) { throw new HttpError("Comment not found", 404); }

        if (comment.userId != currentUserId) { throw new HttpError("You cannot delete this comment.", 403); }

        if (comment.isDeleted) { throw new HttpError("Comment already deleted", 409); }

        const post = await this.postRepository.findById(comment.postId);

        if (post?.isDeleted) { throw new HttpError("Post deleted", 404); }

        // A checagem de comment.isDeleted acima é só o caminho feliz — sob
        // concorrência, dois DELETE do mesmo comentário podem passar por ela
        // antes de qualquer escrita acontecer. softDeleteCommentById usa
        // IF is_deleted = false e é quem realmente decide: só uma das duas
        // chamadas concorrentes recebe `true`, evitando decrementar
        // total_comments duas vezes para o mesmo comentário.
        const deleted = await this.commentRepository.softDeleteCommentById(comment.commentId);
        if (!deleted) { throw new HttpError("Comment already deleted", 409); }

        await Promise.all([
            this.commentRepository.softDeleteCommentByPost(comment.postId, comment.createdAt, comment.commentId),
            this.commentRepository.softDeleteCommentByUser(comment.userId, comment.createdAt, comment.commentId),
            this.postRepository.decrementComments(comment.postId),
        ]);

        if (post) {
            const { totalComments } = await this.postRepository.getCounters(post.postId);
            await this.postRepository.updateTotalCommentsInAllViews(post, totalComments);
        }

        commentsTotal.inc({ action: "deleted" });
    }
}
