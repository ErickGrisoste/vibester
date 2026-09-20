import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import {
  listEstablishmentsController,
  updateEstablishmentRatingController,
  getEstablishmentProfileController,
  listOpenEstablishmentsController,
  uploadProfilePictureController,
  updateMovementLevelController,
} from "./controllers/establishment.controller";
import { listNearbyEstablishmentsController } from "./controllers/establishment.controller";

const movementLevelSchema = {
  type: "object",
  nullable: true,
  properties: {
    level: { type: "string" },
    source: { type: "string" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const establishmentSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    googlePlaceId: { type: "string", nullable: true },
    name: { type: "string" },
    bio: { type: "string", nullable: true },
    endereco: { type: "string", nullable: true },
    photoUrl: { type: "string", nullable: true },
    bannerUrl: { type: "string", nullable: true },
    category: { type: "string" },
    priceIndicator: { type: "string", nullable: true },
    averageRating: { type: "number" },
    qtdAvaliacoes: { type: "number" },
    distribuicao: { type: "array", items: { type: "number" } },
    nivelMovimento: { type: "number" },
    latitude: { type: "number" },
    longitude: { type: "number" },
    distanceTo: { type: "number", nullable: true },
    openingHours: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          dayOfWeek: { type: "number" },
          openTime: { type: "string" },
          closeTime: { type: "string" },
        },
      },
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const paginationSchema = {
  type: "object",
  properties: {
    total: { type: "number", description: "Total de registros" },
    page: { type: "number", description: "Página atual" },
    limit: { type: "number", description: "Itens por página" },
    totalPages: { type: "number", description: "Total de páginas" },
  },
};

const paginatedEstablishmentsSchema = {
  type: "object",
  properties: {
    data: { type: "array", items: establishmentSchema },
    pagination: paginationSchema,
  },
};

const establishmentProfileSchema = {
  type: "object",
  properties: {
    ...establishmentSchema.properties,
    openingHours: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          dayOfWeek: { type: "number" },
          openTime: { type: "string" },
          closeTime: { type: "string" },
        },
      },
    },
    images: {
      type: "array",
      description: "Galeria de imagens do estabelecimento (ex.: fotos de ambiente via SerpAPI)",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string" },
          source: { type: "string", enum: ["SERPAPI", "MANUAL"] },
          position: { type: "number" },
        },
      },
    },
  },
};

const nearbyEstablishmentSchema = {
  type: "object",
  properties: {
    ...establishmentSchema.properties,
    distanceTo: { type: "number" },
  },
};

const errorSchema = {
  type: "object",
  properties: { message: { type: "string" } },
};

export async function establishmentRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Liveness check",
        response: {
          200: {
            type: "object",
            properties: { status: { type: "string", example: "ok" } },
          },
        },
      },
    },
    async (_request, reply) => reply.status(200).send({ status: "ok" })
  );

  fastify.get(
    "/health/ready",
    {
      schema: {
        tags: ["Health"],
        summary: "Readiness check — verifica DB e Redis",
        response: {
          200: {
            type: "object",
            properties: { status: { type: "string" } },
          },
          503: errorSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        const { default: prismaClient } = await import("./prisma/index");
        await prismaClient.$queryRaw`SELECT 1`;
      } catch (error: unknown) {
        console.error("Readiness check failed (DB):", error);
        return reply.status(503).send({ message: "Service unavailable" });
      }

      try {
        const { redis } = await import("./config/redis");
        await redis.ping();
      } catch {
        console.warn("Readiness check: Redis not yet available");
      }

      return reply.status(200).send({ status: "ok" });
    }
  );

  fastify.get(
    "/establishments",
    {
      schema: {
        tags: ["Establishments"],
        summary: "Listar estabelecimentos (paginado)",
        description:
          "Lista estabelecimentos com filtros opcionais por localização, categoria, avaliação e busca textual. Suporta paginação.",
        querystring: {
          type: "object",
          properties: {
            latitude: {
              type: "string",
              description: "Latitude do usuário (deve ser informada junto com longitude)",
            },
            longitude: {
              type: "string",
              description: "Longitude do usuário (deve ser informada junto com latitude)",
            },
            category: { type: "string", description: "Filtra por categoria" },
            minRating: { type: "string", description: "Avaliação mínima (0 a 5)" },
            search: { type: "string", description: "Busca textual por nome" },
            sortBy: {
              type: "string",
              enum: ["name", "rating", "distance"],
              description: "Critério de ordenação",
            },
            page: { type: "string", description: "Número da página (default: 1)" },
            limit: {
              type: "string",
              description: "Itens por página, entre 1 e 100 (default: 20)",
            },
          },
        },
        response: {
          200: paginatedEstablishmentsSchema,
          400: errorSchema,
          500: errorSchema,
        },
      },
    },
    listEstablishmentsController
  );

  fastify.get(
    "/establishments/open",
    {
      schema: {
        tags: ["Establishments"],
        summary: "Listar estabelecimentos abertos",
        description:
          "Lista os estabelecimentos atualmente abertos com base no horário de funcionamento. Resultado cacheado por 60 segundos.",
        response: {
          200: { type: "array", items: establishmentSchema },
          500: errorSchema,
        },
      },
    },
    listOpenEstablishmentsController
  );

  fastify.get(
    "/establishments/nearby",
    {
      schema: {
        tags: ["Establishments"],
        summary: "Listar estabelecimentos próximos",
        querystring: {
          type: "object",
          properties: {
            latitude: { type: "string" },
            longitude: { type: "string" },
            radiusKm: { type: "string" },
          },
          required: ["latitude", "longitude"],
        },
        response: {
          200: { type: "array", items: nearbyEstablishmentSchema },
          400: errorSchema,
          500: errorSchema,
        },
      },
    },
    listNearbyEstablishmentsController
  );

  fastify.get(
    "/establishments/:id",
    {
      schema: {
        tags: ["Establishments"],
        summary: "Obter perfil de estabelecimento",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: establishmentProfileSchema,
          400: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    getEstablishmentProfileController
  );

  fastify.patch(
    "/establishments/:id/rating",
    {
      onRequest: [(fastify as unknown as FastifyInstance & { authenticate: (req: FastifyRequest, rep: FastifyReply) => Promise<void> }).authenticate],
      schema: {
        tags: ["Establishments"],
        summary: "Atualizar avaliação",
        description:
          "Atualiza a avaliação média de um estabelecimento (valor entre 0 e 5). Requer autenticação JWT.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["rating"],
          properties: {
            rating: { type: "number", minimum: 0, maximum: 5, example: 4.5 },
          },
        },
        response: {
          200: establishmentSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    updateEstablishmentRatingController
  );

  fastify.patch(
    "/establishments/:id/movement",
    {
      schema: {
        tags: ["Establishments"],
        summary: "Atualizar nível de movimento",
        description:
          "Atualiza o nível de movimento de um estabelecimento. Endpoint mantido para uso manual/administrativo — o scrapping-service hoje publica essa atualização via Kafka (evento establishment.movement.updated), não chama esta rota.",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["level"],
          properties: {
            level: {
              type: "string",
              enum: ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH", "UNAVAILABLE"],
            },
            source: {
              type: "string",
              enum: ["SERPAPI", "GOOGLE_MAPS", "MANUAL", "ESTIMATED"],
            },
          },
        },
        response: {
          204: { type: "null" },
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    updateMovementLevelController
  );

  fastify.post(
    "/establishments/:id/photo",
    {
      schema: {
        tags: ["Establishments"],
        summary: "Upload de foto de perfil",
        description:
          "Recebe uma imagem (multipart/form-data), faz upload para o R2 e salva a URL no banco. Máximo 5MB. Formatos aceitos: JPEG, PNG, WebP.",
        consumes: ["multipart/form-data"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "object",
            properties: { photoUrl: { type: "string" } },
          },
          400: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    uploadProfilePictureController
  );

  void movementLevelSchema;
}
