import { FastifyInstance, FastifyRequest } from "fastify";
import "@fastify/jwt";
import { FeedController } from "./controllers/feed.controller";

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: { userId: string; accountId: string };
        user: { userId: string; accountId: string };
    }
}

const feedController = new FeedController();

const feedItemSchema = {
  type: "object",
  properties: {
    user_id: { type: "string", format: "uuid" },
    created_at: { type: "string", format: "date-time" },
    item_id: { type: "string", format: "uuid" },
    item_type: {
      type: "string",
      enum: ["USER_POST", "ESTABLISHMENT_POST", "SPONSORED_POST", "EVENT", "EVENT_USER", "EVENT_ESTABLISHMENT"],
    },
    author_id: { type: "string", format: "uuid", nullable: true },
    author_username: { type: "string", nullable: true },
    author_profile_picture: { type: "string", nullable: true },
    author_verified: { type: "boolean", nullable: true },
    establishment_id: { type: "string", format: "uuid", nullable: true },
    establishment_name: { type: "string", nullable: true },
    establishment_logo: { type: "string", nullable: true },
    establishment_category: { type: "string", nullable: true },
    event_id: { type: "string", format: "uuid", nullable: true },
    event_title: { type: "string", nullable: true },
    event_banner: { type: "string", nullable: true },
    event_lineup: { type: "array", items: { type: "string" }, nullable: true },
    event_date: { type: "string", format: "date-time", nullable: true },
    event_location: { type: "string", nullable: true },
    event_organizer_name: { type: "string", nullable: true },
    event_organizer_logo: { type: "string", nullable: true },
    total_confirmed: { type: "integer", nullable: true },
    title: { type: "string", nullable: true },
    content: { type: "string", nullable: true },
    image_urls: { type: "array", items: { type: "string" }, nullable: true },
    media: {
      type: "array",
      nullable: true,
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          type: { type: "string", enum: ["IMAGE", "VIDEO"] },
          thumbnailUrl: { type: "string", nullable: true },
        },
      },
    },
    tags: { type: "array", items: { type: "string" }, nullable: true },
    total_likes: { type: "integer", nullable: true },
    total_comments: { type: "integer", nullable: true },
    is_liked: { type: "boolean" },
    is_sponsored: { type: "boolean" },
    is_deleted: { type: "boolean" },
    updated_at: { type: "string", format: "date-time", nullable: true },
  },
};

const feedResponseSchema = {
  type: "object",
  properties: {
    items: { type: "array", items: feedItemSchema },
    // String sem `format`: o cursor passou a ser um token opaco na paginação rankeada.
    // Com `format: "date-time"` o serializador do Fastify recusaria o token. O app já
    // trata o valor como texto e só o devolve na próxima chamada.
    nextCursor: {
      type: "string",
      nullable: true,
      description: "Token opaco da próxima página. Repasse exatamente como recebido; null no fim do feed.",
    },
  },
};

const errorSchema = {
  type: "object",
  properties: { message: { type: "string" } },
};

export async function feedRoutes(app: FastifyInstance) {
  app.get("/health", {
    schema: {
      tags: ["Health"],
      summary: "Health check",
      response: {
        200: {
          type: "object",
          properties: { status: { type: "string", example: "ok" } },
        },
      },
    },
  }, async () => ({ status: "ok" }));

  app.get("/feed/:userId", {
    onRequest: [async (request: FastifyRequest<{ Params: { userId: string } }>, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ message: "Unauthorized" });
      }
      if (request.user.accountId !== request.params.userId) {
        return reply.status(403).send({ message: "Forbidden" });
      }
    }],
    schema: {
      tags: ["Feed"],
      summary: "Buscar feed do usuário",
      description:
        "Retorna a timeline de um usuário com posts, eventos e conteúdo patrocinado de quem ele segue. Para parte do público a ordem é rankeada (experimento ranking-v1, com holdout cronológico permanente de 5%); para o resto é cronológica. A paginação usa um cursor opaco em ambos os casos.",
      params: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: { type: "string", format: "uuid", description: "ID do usuário dono do feed" },
        },
      },
      querystring: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 50,
            default: 20,
            description: "Quantidade máxima de itens por página (1-50, padrão: 20)",
          },
          // Sem `format: "date-time"`: um cursor de sessão rankeada não é data, e o Fastify
          // o recusaria antes do controller. A validação real acontece em parseFeedCursor.
          cursor: {
            type: "string",
            minLength: 1,
            maxLength: 512,
            description:
              "Cursor opaco: repasse exatamente o nextCursor da página anterior. Datas ISO 8601 (formato antigo) continuam aceitas e retornam ordem cronológica.",
          },
        },
      },
      response: {
        200: feedResponseSchema,
        400: errorSchema,
        401: errorSchema,
        403: errorSchema,
        500: errorSchema,
      },
    },
  }, feedController.getFeedByUser.bind(feedController));
}
