import { FastifyReply, FastifyRequest } from "fastify";
import {
    postIdParamsSchema,
    userIdParamsSchema,
    establishmentIdParamsSchema,
    updatePostSchema,
    generateUploadUrlsSchema,
    createPostSchema,
} from "../schema/post.schema";
import { PostService } from "../services/post.service";
import { UploadService } from "../services/upload.service";
import { CreatePostInput, UpdatePostInput } from "../types/post.types";

export class PostController {

    constructor(
        private readonly postService: PostService,
        private readonly uploadService: UploadService,
    ) {}

    async create(request: FastifyRequest, reply: FastifyReply) {
        const body = createPostSchema.parse(request.body);

        const data: CreatePostInput = {
            userId: body.userId,
            userUsername: body.userUsername,
            userProfilePicture: body.userProfilePicture,
            userVerified: body.userVerified,
            media: body.media,
            caption: body.caption ?? "",
            establishmentId: body.establishmentId,
            establishmentName: body.establishmentName,
            establishmentLogo: body.establishmentLogo,
            establishmentCategory: body.establishmentCategory,
            tags: body.tags,
        };

        const post = await this.postService.create(data);

        return reply.status(201).send(post);
    }

    async findById(
        request: FastifyRequest<{
            Params: { postId: string; };
        }>,
        reply: FastifyReply
    ) {
        const { postId } = postIdParamsSchema.parse(request.params);
        const post = await this.postService.findById(postId);

        if (!post) {
            return reply.status(404).send({ message: "Post not found" });
        }

        return reply.status(200).send(post);
    }

    async findByUser(
        request: FastifyRequest<{
            Params: { userId: string; };
            Querystring: { limit?: number; cursor?: string; viewerId?: string };
        }>,
        reply: FastifyReply
    ) {
        const { userId } = userIdParamsSchema.parse(request.params);
        const limit = request.query.limit ?? 50;
        const result = await this.postService.findByUser(userId, limit, request.query.cursor, request.query.viewerId);

        if (result.nextCursor) { reply.header("X-Next-Cursor", result.nextCursor); }
        return reply.status(200).send(result.posts);
    }

    async findByEstablishment(
        request: FastifyRequest<{
            Params: { establishmentId: string; };
            Querystring: { limit?: number; cursor?: string; viewerId?: string };
        }>,
        reply: FastifyReply
    ) {
        const { establishmentId } = establishmentIdParamsSchema.parse(request.params);
        const limit = request.query.limit ?? 50;
        const result = await this.postService.findByEstablishment(establishmentId, limit, request.query.cursor, request.query.viewerId);

        if (result.nextCursor) { reply.header("X-Next-Cursor", result.nextCursor); }
        return reply.status(200).send(result.posts);
    }

    async updateCaption(
        request: FastifyRequest<{
            Params: { postId: string };
            Body: { caption: string };
        }>,
        reply: FastifyReply
    ) {
        const { postId } = postIdParamsSchema.parse(request.params);
        const { caption } = updatePostSchema.parse(request.body);

        const updateInput: UpdatePostInput = { postId, caption };

        const post = await this.postService.updateCaption(updateInput);

        return reply.status(200).send(post);
    }

    async softDelete(
        request: FastifyRequest<{
            Params: { postId: string; };
        }>,
        reply: FastifyReply
    ) {
        const { postId } = postIdParamsSchema.parse(request.params);
        await this.postService.softDelete(postId);

        return reply.status(204).send();
    }

    async generateUploadUrls(request: FastifyRequest, reply: FastifyReply) {
        const { userId, files } = generateUploadUrlsSchema.parse(request.body);
        const urls = await this.uploadService.generatePresignedUrls(userId, files);

        return reply.status(200).send(urls);
    }
}
