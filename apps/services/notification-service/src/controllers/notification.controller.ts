import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import { ListNotificationsService } from "../services/listNotifications.service";
import { countUnreadGroups } from "../services/unreadCount.service";
import { markAllReadByRecipient } from "../services/markAllRead.service";

const listNotificationsService = new ListNotificationsService();

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (error) {
    request.log.error(error);
    return reply.status(401).send({ message: "Token de autenticação inválido ou ausente" });
  }
}

const listQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  before: z.string().optional(),
});

const errorSchema = z.object({ message: z.string() });

const actorSummarySchema = z.object({
  accountId: z.string(),
  name: z.string(),
  username: z.string(),
  avatarUrl: z.string(),
}).nullable();

const postSummarySchema = z.object({
  postId: z.string(),
  imageUrl: z.string(),
  caption: z.string(),
  isDeleted: z.boolean(),
}).nullable();

const notificationGroupResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  refId: z.string().optional(),
  othersCount: z.number(),
  totalCount: z.number(),
  content: z.string().optional(),
  read: z.boolean(),
  createdAt: z.coerce.date(),
  actor: actorSummarySchema,
  post: postSummarySchema,
});

const listResponseSchema = z.object({
  items: z.array(notificationGroupResponseSchema),
  nextCursor: z.string().nullable(),
});

const unreadCountResponseSchema = z.object({
  count: z.number(),
});

const markReadResponseSchema = z.object({
  updated: z.number(),
});

export async function notificationRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // List notifications for authenticated user
  router.get("/", {
    schema: {
      tags: ["Notifications"],
      summary: "Listar notificações do usuário autenticado",
      security: [{ bearerAuth: [] }],
      querystring: listQuerySchema,
      response: {
        200: listResponseSchema,
        401: errorSchema,
        500: errorSchema,
      },
    },
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const limit = request.query.limit ?? 50;
      const before = request.query.before ? new Date(request.query.before) : undefined;

      const result = await listNotificationsService.buildFeed(userId, limit, before);
      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao buscar notificações" });
    }
  });

  // Get unread notifications count for authenticated user
  router.get("/unread-count", {
    schema: {
      tags: ["Notifications"],
      summary: "Contar notificações não lidas",
      security: [{ bearerAuth: [] }],
      response: {
        200: unreadCountResponseSchema,
        401: errorSchema,
        500: errorSchema,
      },
    },
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const count = await countUnreadGroups(userId);
      return reply.status(200).send({ count });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao contar notificações não lidas" });
    }
  });

  // Mark all notifications as read for authenticated user
  router.patch("/read", {
    schema: {
      tags: ["Notifications"],
      summary: "Marcar todas notificações como lidas",
      security: [{ bearerAuth: [] }],
      response: {
        200: markReadResponseSchema,
        401: errorSchema,
        500: errorSchema,
      },
    },
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const updated = await markAllReadByRecipient(userId);
      return reply.status(200).send({ updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao marcar notificações como lidas" });
    }
  });

  // Legacy route compatibility: GET /notifications/:userId
  router.get("/:userId", {
    schema: {
      tags: ["Notifications"],
      summary: "Listar notificações de um usuário (compatibilidade)",
      params: z.object({ userId: z.string() }),
      querystring: listQuerySchema,
      response: {
        200: listResponseSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.params.userId;
      const limit = request.query.limit ?? 50;
      const before = request.query.before ? new Date(request.query.before) : undefined;

      const result = await listNotificationsService.buildFeed(userId, limit, before);
      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao buscar notificações" });
    }
  });

  // Legacy route compatibility: GET /notifications/:userId/unread-count
  router.get("/:userId/unread-count", {
    schema: {
      tags: ["Notifications"],
      summary: "Contar notificações não lidas (compatibilidade)",
      params: z.object({ userId: z.string() }),
      response: {
        200: unreadCountResponseSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.params.userId;
      const count = await countUnreadGroups(userId);
      return reply.status(200).send({ count });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao contar notificações não lidas" });
    }
  });

  // Legacy route compatibility: PATCH /notifications/:userId/read
  router.patch("/:userId/read", {
    schema: {
      tags: ["Notifications"],
      summary: "Marcar notificações como lidas (compatibilidade)",
      params: z.object({ userId: z.string() }),
      response: {
        200: markReadResponseSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.params.userId;
      const updated = await markAllReadByRecipient(userId);
      return reply.status(200).send({ updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao marcar notificações como lidas" });
    }
  });
}
