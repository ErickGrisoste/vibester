import { FastifyInstance } from "fastify";

import { PostRepository } from "./repository/post.repository";
import { PostService } from "./services/post.service";
import { PostController } from "./controller/post.controller";
import { UploadService } from "./services/upload.service";
import { LikeRepository } from "./repository/like.repository";
import { LikeController } from "./controller/like.controller";
import { LikeService } from "./services/like.service";
import { CommentRepository } from "./repository/comment.repository";
import { CommentService } from "./services/comment.service";
import { CommentController } from "./controller/comment.controller";
import { getCassandraClient } from "./config/cassandra";
import { redis } from "./config/redis";
import { env } from "./config/env";

const postSchema = {
    type: "object",
    properties: {
        postId: { type: "string", format: "uuid" },
        userId: { type: "string", format: "uuid" },
        userUsername: { type: "string" },
        userProfilePicture: { type: "string" },
        userVerified: { type: "boolean" },
        establishmentId: { type: "string", format: "uuid", nullable: true },
        establishmentName: { type: "string", nullable: true },
        establishmentLogo: { type: "string", nullable: true },
        establishmentCategory: { type: "string", nullable: true },
        imageUrls: { type: "array", items: { type: "string", format: "uri" } },
        media: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    url: { type: "string", format: "uri" },
                    type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                    thumbnailUrl: { type: "string", format: "uri", nullable: true },
                },
            },
        },
        caption: { type: "string" },
        tags: { type: "array", items: { type: "string" }, nullable: true },
        totalLikes: { type: "integer" },
        totalComments: { type: "integer" },
        isLiked: { type: "boolean" },
        isDeleted: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time", nullable: true },
    },
};

const commentSchema = {
    type: "object",
    properties: {
        commentId: { type: "string", format: "uuid" },
        postId: { type: "string", format: "uuid" },
        userId: { type: "string", format: "uuid" },
        content: { type: "string" },
        isDeleted: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time", nullable: true },
    },
};

const likeSchema = {
    type: "object",
    properties: {
        postId: { type: "string", format: "uuid" },
        userId: { type: "string", format: "uuid" },
        likedAt: { type: "string", format: "date-time" },
    },
};

const errorSchema = {
    type: "object",
    properties: { message: { type: "string" } },
};

const postIdParam = {
    type: "object",
    required: ["postId"],
    properties: { postId: { type: "string", format: "uuid" } },
};

const userIdParam = {
    type: "object",
    required: ["userId"],
    properties: { userId: { type: "string", format: "uuid" } },
};

const paginationQuerystring = {
    type: "object",
    properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50, description: "Máximo de resultados" },
        cursor: { type: "string", description: "Cursor opaco retornado no header X-Next-Cursor da página anterior" },
    },
};

const postsQuerystring = {
    type: "object",
    properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50, description: "Máximo de resultados" },
        cursor: { type: "string", description: "Cursor opaco retornado no header X-Next-Cursor da página anterior" },
        viewerId: { type: "string", format: "uuid", description: "Id do usuário autenticado, usado para calcular isLiked" },
    },
};

export async function routes(app: FastifyInstance) {
    app.get("/health", {
        schema: {
            tags: ["Health"],
            summary: "Health check com verificação de dependências",
            response: {
                200: {
                    type: "object",
                    properties: {
                        status: { type: "string", example: "ok" },
                        dependencies: {
                            type: "object",
                            properties: {
                                redis: { type: "string" },
                                cassandra: { type: "string" },
                            },
                        },
                    },
                },
                503: {
                    type: "object",
                    properties: {
                        status: { type: "string", example: "degraded" },
                        dependencies: {
                            type: "object",
                            properties: {
                                redis: { type: "string" },
                                cassandra: { type: "string" },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request, reply) => {
        const [redisOk, cassandraOk] = await Promise.all([
            redis.ping().then(() => true).catch(() => false),
            getCassandraClient()
                .execute("SELECT now() FROM system.local")
                .then(() => true)
                .catch(() => false),
        ]);

        const dependencies = {
            redis: redisOk ? "ok" : "error",
            cassandra: cassandraOk ? "ok" : "error",
        };

        if (redisOk && cassandraOk) {
            return reply.status(200).send({ status: "ok", dependencies });
        }
        return reply.status(503).send({ status: "degraded", dependencies });
    });

    const uploadService = new UploadService();
    const postRepository = new PostRepository();
    const likeRepository = new LikeRepository();
    const postService = new PostService(postRepository, likeRepository);
    const postController = new PostController(postService, uploadService);

    const likeService = new LikeService(likeRepository, postRepository);
    const likeController = new LikeController(likeService);

    const commentRepository = new CommentRepository();
    const commentService = new CommentService(commentRepository, postRepository);
    const commentController = new CommentController(commentService);

    app.post("/posts/upload-url", {
        config: { rateLimit: { max: env.rate_limit_write_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Upload"],
            summary: "Gerar URLs pré-assinadas para upload direto ao bucket",
            description: "Retorna URLs temporárias (5 min) para o cliente fazer PUT direto no Cloudflare R2, sem passar pela VPS. Após o upload, use as publicUrls no corpo de POST /posts.",
            body: {
                type: "object",
                required: ["userId"],
                properties: {
                    userId: { type: "string", format: "uuid", description: "ID do usuário que fará o upload" },
                    files: {
                        type: "array",
                        minItems: 1,
                        maxItems: 10,
                        description: "Um item por arquivo, com o tipo e o content-type reais. A URL é assinada com esse content-type.",
                        items: {
                            type: "object",
                            required: ["type", "contentType"],
                            properties: {
                                type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                                contentType: { type: "string", description: "Ex.: image/jpeg, video/mp4" },
                            },
                        },
                    },
                    count: { type: "integer", minimum: 1, maximum: 10, description: "Legado: N imagens JPEG. Use `files`." },
                },
            },
            response: {
                200: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            uploadUrl: { type: "string", description: "URL pré-assinada para PUT (expira em 5 min)" },
                            key: { type: "string", description: "Chave do objeto no bucket" },
                            publicUrl: { type: "string", description: "URL pública final após upload" },
                            type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                            contentType: { type: "string", description: "Content-type com que a URL foi assinada" },
                        },
                    },
                },
                400: errorSchema,
                429: errorSchema,
            },
        },
    }, postController.generateUploadUrls.bind(postController));

    app.post("/posts", {
        config: { rateLimit: { max: env.rate_limit_write_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Posts"],
            summary: "Criar post",
            body: {
                type: "object",
                required: ["userId"],
                properties: {
                    userId: { type: "string", format: "uuid" },
                    userUsername: { type: "string", maxLength: 50 },
                    userProfilePicture: { type: "string", format: "uri" },
                    userVerified: { type: "boolean" },
                    establishmentId: { type: "string", format: "uuid" },
                    establishmentName: { type: "string", maxLength: 100 },
                    establishmentLogo: { type: "string", format: "uri" },
                    establishmentCategory: { type: "string", maxLength: 50 },
                    media: {
                    type: "array",
                    maxItems: 10,
                    items: {
                        type: "object",
                        required: ["url", "type"],
                        properties: {
                            url: { type: "string", format: "uri" },
                            type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                            thumbnailUrl: { type: "string", format: "uri", nullable: true },
                        },
                    },
                    },
                    imageUrls: { type: "array", items: { type: "string", format: "uri" }, minItems: 1, maxItems: 10, description: "Legado: só imagens. Use `media`." },
                    caption: { type: "string", maxLength: 2000 },
                    tags: { type: "array", items: { type: "string" }, maxItems: 20 },
                },
            },
            response: { 201: postSchema, 400: errorSchema, 429: errorSchema },
        },
    }, postController.create.bind(postController));

    app.get("/posts/:postId", {
        schema: {
            tags: ["Posts"],
            summary: "Buscar post por ID",
            params: postIdParam,
            response: { 200: postSchema, 404: errorSchema },
        },
    }, postController.findById.bind(postController));

    app.get("/users/:userId/posts", {
        schema: {
            tags: ["Posts"],
            summary: "Listar posts de um usuário",
            params: userIdParam,
            querystring: postsQuerystring,
            response: { 200: { type: "array", items: postSchema } },
        },
    }, postController.findByUser.bind(postController));

    app.get("/establishments/:establishmentId/posts", {
        schema: {
            tags: ["Posts"],
            summary: "Listar posts de um estabelecimento",
            params: {
                type: "object",
                required: ["establishmentId"],
                properties: { establishmentId: { type: "string", format: "uuid" } },
            },
            querystring: postsQuerystring,
            response: { 200: { type: "array", items: postSchema } },
        },
    }, postController.findByEstablishment.bind(postController));

    app.patch("/posts/:postId", {
        config: { rateLimit: { max: env.rate_limit_write_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Posts"],
            summary: "Atualizar legenda",
            params: postIdParam,
            body: {
                type: "object",
                required: ["caption"],
                properties: { caption: { type: "string", maxLength: 2000 } },
            },
            response: { 200: postSchema, 400: errorSchema, 404: errorSchema },
        },
    }, postController.updateCaption.bind(postController));

    app.delete("/posts/:postId", {
        config: { rateLimit: { max: env.rate_limit_write_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Posts"],
            summary: "Remover post (soft delete)",
            params: postIdParam,
            response: { 204: { type: "null", description: "Removido com sucesso" }, 404: errorSchema },
        },
    }, postController.softDelete.bind(postController));

    app.post("/posts/:postId/likes", {
        config: { rateLimit: { max: env.rate_limit_like_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Likes"],
            summary: "Curtir post",
            params: postIdParam,
            body: {
                type: "object",
                required: ["userId"],
                properties: { userId: { type: "string", format: "uuid" } },
            },
            response: { 201: likeSchema, 404: errorSchema, 409: errorSchema, 429: errorSchema },
        },
    }, likeController.likePost.bind(likeController));

    app.delete("/posts/:postId/likes", {
        config: { rateLimit: { max: env.rate_limit_like_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Likes"],
            summary: "Descurtir post",
            params: postIdParam,
            body: {
                type: "object",
                required: ["userId"],
                properties: { userId: { type: "string", format: "uuid" } },
            },
            response: { 204: { type: "null", description: "Descurtido com sucesso" }, 404: errorSchema },
        },
    }, likeController.unlikePost.bind(likeController));

    app.get("/users/:userId/likes", {
        schema: {
            tags: ["Likes"],
            summary: "Listar curtidas de um usuário",
            params: userIdParam,
            querystring: paginationQuerystring,
            response: { 200: { type: "array", items: likeSchema } },
        },
    }, likeController.findLikesByUser.bind(likeController));

    app.get("/posts/:postId/likes", {
        schema: {
            tags: ["Likes"],
            summary: "Listar curtidas de um post",
            params: postIdParam,
            querystring: paginationQuerystring,
            response: { 200: { type: "array", items: likeSchema } },
        },
    }, likeController.findLikesByPost.bind(likeController));

    app.post("/comments", {
        config: { rateLimit: { max: env.rate_limit_write_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Comments"],
            summary: "Criar comentário",
            body: {
                type: "object",
                required: ["postId", "userId", "content"],
                properties: {
                    postId: { type: "string", format: "uuid" },
                    userId: { type: "string", format: "uuid" },
                    content: { type: "string", minLength: 1, maxLength: 500 },
                },
            },
            response: { 201: commentSchema, 400: errorSchema, 404: errorSchema, 429: errorSchema },
        },
    }, commentController.create.bind(commentController));

    app.get("/posts/:postId/comments", {
        schema: {
            tags: ["Comments"],
            summary: "Listar comentários de um post",
            params: postIdParam,
            querystring: paginationQuerystring,
            response: { 200: { type: "array", items: commentSchema } },
        },
    }, commentController.findByPost.bind(commentController));

    app.get("/users/:userId/comments", {
        schema: {
            tags: ["Comments"],
            summary: "Listar comentários de um usuário",
            params: userIdParam,
            querystring: paginationQuerystring,
            response: { 200: { type: "array", items: commentSchema } },
        },
    }, commentController.findByUser.bind(commentController));

    app.patch("/comments/:commentId", {
        config: { rateLimit: { max: env.rate_limit_write_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Comments"],
            summary: "Atualizar comentário",
            params: {
                type: "object",
                required: ["commentId"],
                properties: { commentId: { type: "string", format: "uuid" } },
            },
            body: {
                type: "object",
                required: ["userId", "content"],
                properties: {
                    userId: { type: "string", format: "uuid" },
                    content: { type: "string", minLength: 1, maxLength: 500 },
                },
            },
            response: { 200: commentSchema, 400: errorSchema, 403: errorSchema, 404: errorSchema },
        },
    }, commentController.update.bind(commentController));

    app.delete("/comments/:commentId", {
        config: { rateLimit: { max: env.rate_limit_write_max, timeWindow: "1 minute" } },
        schema: {
            tags: ["Comments"],
            summary: "Remover comentário (soft delete)",
            params: {
                type: "object",
                required: ["commentId"],
                properties: { commentId: { type: "string", format: "uuid" } },
            },
            body: {
                type: "object",
                required: ["userId"],
                properties: { userId: { type: "string", format: "uuid" } },
            },
            response: { 204: { type: "null", description: "Removido com sucesso" }, 403: errorSchema, 404: errorSchema },
        },
    }, commentController.softDelete.bind(commentController));
}
