import { FastifyReply, FastifyRequest } from "fastify";
import { LikeService } from "../services/like.service";

export class LikeController {
    constructor(private readonly likeService: LikeService) {}

    async likePost(
        request: FastifyRequest<{
            Params: { postId: string };
            Body: { userId: string };
        }>,
        reply: FastifyReply
    ) {
        const like = await this.likeService.likePost(
            request.params.postId,
            request.body.userId
        );

        return reply.status(201).send(like);
    }

    async unlikePost(
        request: FastifyRequest<{
            Params: { postId: string };
            Body: { userId: string };
        }>,
        reply: FastifyReply
    ) {
        await this.likeService.unlikePost(
            request.params.postId,
            request.body.userId
        );

        return reply.status(204).send();
    }

    async findLikesByUser(
        request: FastifyRequest<{
            Params: { userId: string };
            Querystring: { limit?: number; cursor?: string };
        }>,
        reply: FastifyReply
    ) {
        const limit = request.query.limit ?? 50;
        const result = await this.likeService.findLikesByUser(
            request.params.userId, limit, request.query.cursor
        );

        if (result.nextCursor) { reply.header("X-Next-Cursor", result.nextCursor); }
        return reply.status(200).send(result.likes);
    }

    async findLikesByPost(
        request: FastifyRequest<{
            Params: { postId: string };
            Querystring: { limit?: number; cursor?: string };
        }>,
        reply: FastifyReply
    ) {
        const limit = request.query.limit ?? 50;
        const result = await this.likeService.findLikesByPost(
            request.params.postId, limit, request.query.cursor
        );

        if (result.nextCursor) { reply.header("X-Next-Cursor", result.nextCursor); }
        return reply.status(200).send(result.likes);
    }
}