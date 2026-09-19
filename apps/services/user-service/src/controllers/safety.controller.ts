import { FastifyInstance, FastifyRequest } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import { BlockService } from "../services/block.service.js";
import { ReportService } from "../services/report.service.js";
import { SafetyError } from "../services/safetyError.js";
import { authenticatedAccountId } from "./auth.js";
import { env } from "../config/env.js";

const blockService = new BlockService();
const reportService = new ReportService();

const errorSchema = z.object({ message: z.string() });

const UNAUTHORIZED = { message: "Token de autenticação inválido ou ausente" };

const listBlocksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().datetime().optional(),
});

const blockedProfileSchema = z.object({
  accountId: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  blockedAt: z.coerce.date(),
});

const blockBodySchema = z.object({ blockedId: z.string().uuid() });

const blockedIdParamsSchema = z.object({ blockedId: z.string().uuid() });

const accountIdParamsSchema = z.object({ accountId: z.string().uuid() });

const reportBodySchema = z.object({
  targetType: z.enum(["USER", "POST"]),
  targetId: z.string().uuid(),
  targetOwnerId: z.string().uuid().optional(),
  reason: z.enum(["SPAM", "NUDITY", "VIOLENCE", "HARASSMENT", "HATE", "ILLEGAL", "IMPERSONATION", "UNDERAGE", "OTHER"]),
  details: z.string().max(1000).optional(),
}).refine((body) => body.targetType === "USER" || body.targetOwnerId !== undefined, {
  message: "targetOwnerId é obrigatório para denúncia de publicação",
  path: ["targetOwnerId"],
});

const ipRateLimit = (max: number, prefix: string) => ({
  rateLimit: {
    max,
    timeWindow: 60000,
    keyGenerator: (request: FastifyRequest) => `rate:${prefix}:${request.ip}`,
  },
});

export async function safetyRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get("/blocks", {
    schema: {
      tags: ["Safety"],
      summary: "Listar perfis bloqueados",
      description: "Perfis que o usuário do token bloqueou, mais recentes primeiro. `nextCursor` vai em `cursor` para a próxima página.",
      security: [{ bearerAuth: [] }],
      querystring: listBlocksQuerySchema,
      response: {
        200: z.object({ data: z.array(blockedProfileSchema), nextCursor: z.string().nullable() }),
        401: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    const accountId = await authenticatedAccountId(request);
    if (!accountId) return reply.status(401).send(UNAUTHORIZED);

    try {
      const { limit, cursor } = request.query;
      const page = await blockService.listBlocked(accountId, limit, cursor ? new Date(cursor) : undefined);
      return reply.status(200).send(page);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error listing blocks" });
    }
  });

  router.post("/blocks", {
    config: ipRateLimit(env.rateLimitBlockMax, "block"),
    schema: {
      tags: ["Safety"],
      summary: "Bloquear perfil",
      description: "O usuário do token bloqueia `blockedId`. Desfaz o follow nas duas direções (evento user.unfollowed) e impede seguir de novo. Idempotente.",
      security: [{ bearerAuth: [] }],
      body: blockBodySchema,
      response: {
        201: z.object({ blockedId: z.string(), blocked: z.boolean() }),
        400: errorSchema,
        401: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    const accountId = await authenticatedAccountId(request);
    if (!accountId) return reply.status(401).send(UNAUTHORIZED);

    try {
      await blockService.block(accountId, request.body.blockedId);
      return reply.status(201).send({ blockedId: request.body.blockedId, blocked: true });
    } catch (error) {
      if (error instanceof SafetyError) return reply.status(400).send({ message: error.message });
      request.log.error(error);
      return reply.status(500).send({ message: "Error blocking profile" });
    }
  });

  router.delete("/blocks/:blockedId", {
    config: ipRateLimit(env.rateLimitBlockMax, "block"),
    schema: {
      tags: ["Safety"],
      summary: "Desbloquear perfil",
      security: [{ bearerAuth: [] }],
      params: blockedIdParamsSchema,
      response: {
        200: z.object({ blockedId: z.string(), blocked: z.boolean() }),
        401: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    const accountId = await authenticatedAccountId(request);
    if (!accountId) return reply.status(401).send(UNAUTHORIZED);

    try {
      await blockService.unblock(accountId, request.params.blockedId);
      return reply.status(200).send({ blockedId: request.params.blockedId, blocked: false });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error unblocking profile" });
    }
  });

  router.get("/blocks/:accountId/status", {
    schema: {
      tags: ["Safety"],
      summary: "Situação de bloqueio com um perfil",
      description: "`blocking`: o usuário do token bloqueou o perfil. `blockedBy`: o perfil bloqueou o usuário do token.",
      security: [{ bearerAuth: [] }],
      params: accountIdParamsSchema,
      response: {
        200: z.object({ blocking: z.boolean(), blockedBy: z.boolean() }),
        401: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    const accountId = await authenticatedAccountId(request);
    if (!accountId) return reply.status(401).send(UNAUTHORIZED);

    try {
      const status = await blockService.status(accountId, request.params.accountId);
      return reply.status(200).send(status);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error checking block status" });
    }
  });

  router.post("/reports", {
    config: ipRateLimit(env.rateLimitReportMax, "report"),
    schema: {
      tags: ["Safety"],
      summary: "Denunciar perfil ou publicação",
      description: "Registra a denúncia do usuário do token e publica content.reported para a moderação. Denunciar o mesmo alvo de novo não duplica (created=false).",
      security: [{ bearerAuth: [] }],
      body: reportBodySchema,
      response: {
        201: z.object({ id: z.string(), created: z.boolean() }),
        400: errorSchema,
        401: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    const accountId = await authenticatedAccountId(request);
    if (!accountId) return reply.status(401).send(UNAUTHORIZED);

    try {
      const result = await reportService.create(accountId, request.body);
      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof SafetyError) return reply.status(400).send({ message: error.message });
      request.log.error(error);
      return reply.status(500).send({ message: "Error creating report" });
    }
  });
}
