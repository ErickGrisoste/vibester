import { FastifyInstance, FastifyRequest } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import { CreateProfileService } from "../services/createProfile.service.js";
import { EditProfileService } from "../services/editProfile.service.js";
import { GetProfileService } from "../services/getProfile.service.js";
import { GetFollowersService } from "../services/getFollowers.service.js";
import { SearchProfilesService } from "../services/searchProfiles.service.js";
import type { UserProfile as UserProfileModel } from "@prisma/client";
import { CheckFollowService } from "../services/checkFollow.service.js";
import { GenerateShareLinkService } from "../services/generateShareLink.service.js";
import { ResolveShareLinkService } from "../services/resolveShareLink.service.js";
import { env } from "../config/env.js";

const profileService = new CreateProfileService();
const editProfileService = new EditProfileService();
const getProfileService = new GetProfileService();
const getFollowersService = new GetFollowersService();
const checkFollowService = new CheckFollowService();
const searchProfilesService = new SearchProfilesService();
const generateShareLinkService = new GenerateShareLinkService();
const resolveShareLinkService = new ResolveShareLinkService();

const errorSchema = z.object({ message: z.string() });

const userProfileSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  followers: z.number().int(),
  following: z.number().int(),
  totalPosts: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

function toProfileResponse(profile: UserProfileModel) {
  const { id: _id, userID: accountId, ...rest } = profile;
  return { accountId, ...rest };
}

const createProfileSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().optional(),
  username: z.string().optional(),
});

const updateProfileInfoSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string(),
  username: z.string(),
});

const updateBioSchema = z.object({
  accountId: z.string().uuid(),
  bio: z.string(),
});

const updateAvatarSchema = z.object({
  accountId: z.string().uuid(),
  avatarUrl: z.string().url(),
});

const followerActionSchema = z.object({
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
}).refine(data => data.followerId !== data.followingId, {
  message: "Cannot follow yourself",
  path: ["followerId"],
});

const accountIdParamsSchema = z.object({
  accountId: z.string().uuid(),
});

const generateShareLinkSchema = z.object({
  accountId: z.string().uuid(),
});

const shareLinkResponseSchema = z.object({
  token: z.string().uuid(),
  shareUrl: z.string().url(),
  expiresAt: z.coerce.date(),
});

const shareTokenParamsSchema = z.object({
  token: z.string().uuid(),
});

const followerEntrySchema = z.object({
  followerId: z.string().uuid(),
  createdAt: z.date(),
});

const followingEntrySchema = z.object({
  followingId: z.string().uuid(),
  createdAt: z.date(),
});

const isFollowingSchema = z.object({
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  page: z.coerce.number().int().min(1).default(1),
});

const searchResultItemSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  followers: z.number().int(),
});

const searchProfilesResponseSchema = z.object({
  data: z.array(searchResultItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

export async function profileRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.post("/profile", {
    schema: {
      tags: ["Profile"],
      summary: "Criar perfil",
      description: "Cria o perfil de um usuário a partir do seu accountId.",
      body: createProfileSchema,
      response: { 201: userProfileSchema, 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const profile = await profileService.createProfile(request.body);
      return reply.status(201).send(toProfileResponse(profile));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error creating profile" });
    }
  });

  router.get("/profile/:accountId", {
    schema: {
      tags: ["Profile"],
      summary: "Buscar perfil por accountId",
      description: "Retorna o perfil de um usuário pelo accountId (UUID da conta).",
      params: accountIdParamsSchema,
      response: {
        200: userProfileSchema,
        404: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const profile = await getProfileService.getProfileByAccountId(request.params.accountId);
      if (!profile) return reply.status(404).send({ message: "Profile not found" });
      return reply.status(200).send(toProfileResponse(profile));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error fetching profile" });
    }
  });

  router.post("/share", {
    config: {
      rateLimit: {
        max: env.rateLimitShareMax,
        timeWindow: 60000,
        keyGenerator: (request: FastifyRequest) => {
          const body = request.body as { accountId?: string };
          return `rate:share:${body?.accountId ?? request.ip}`;
        },
      },
    },
    schema: {
      tags: ["Profile"],
      summary: "Gerar link de compartilhamento",
      description:
        "Gera um token opaco de compartilhamento para o perfil informado, válido por " +
        `${env.shareLinkTtlSeconds / 3600}h. Incrementa o contador de compartilhamentos do perfil.`,
      body: generateShareLinkSchema,
      response: { 201: shareLinkResponseSchema, 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const result = await generateShareLinkService.generate(request.body);
      return reply.status(201).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error generating share link" });
    }
  });

  router.get("/share/:token", {
    schema: {
      tags: ["Profile"],
      summary: "Resolver link de compartilhamento",
      description: "Resolve um token de compartilhamento para o perfil correspondente, se ainda válido.",
      params: shareTokenParamsSchema,
      response: {
        200: userProfileSchema,
        404: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const profile = await resolveShareLinkService.resolve(request.params.token);
      if (!profile) return reply.status(404).send({ message: "Link de compartilhamento inválido ou expirado" });
      return reply.status(200).send(toProfileResponse(profile));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error resolving share link" });
    }
  });

  router.put("/profile/info", {
    schema: {
      tags: ["Profile"],
      summary: "Atualizar nome e username",
      description: "Atualiza o nome e o username do usuário.",
      body: updateProfileInfoSchema,
      response: { 200: userProfileSchema, 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const profile = await editProfileService.updateProfileInfo(request.body);
      return reply.status(200).send(toProfileResponse(profile));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error updating profile info" });
    }
  });

  router.put("/profile/bio", {
    schema: {
      tags: ["Profile"],
      summary: "Atualizar bio",
      description: "Atualiza a bio do usuário.",
      body: updateBioSchema,
      response: { 200: userProfileSchema, 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const profile = await editProfileService.updateBio(request.body);
      return reply.status(200).send(toProfileResponse(profile));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error updating bio" });
    }
  });

  router.put("/profile/avatar", {
    schema: {
      tags: ["Profile"],
      summary: "Atualizar avatar",
      description: "Atualiza a URL do avatar do usuário.",
      body: updateAvatarSchema,
      response: { 200: userProfileSchema, 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const profile = await editProfileService.updateAvatar(request.body);
      return reply.status(200).send(toProfileResponse(profile));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error updating avatar" });
    }
  });

  router.post("/profile/followers/increase", {
    config: {
      rateLimit: {
        max: env.rateLimitFollowMax,
        timeWindow: 60000,
        keyGenerator: (request: FastifyRequest) => {
          const body = request.body as { followerId?: string };
          return `rate:follow:${body?.followerId ?? request.ip}`;
        },
      },
    },
    schema: {
      tags: ["Profile"],
      summary: "Seguir usuário",
      description: "Registra que followerId passou a seguir followingId. Atualiza contadores em ambos os perfis e dispara evento Kafka user.followed.",
      body: followerActionSchema,
      response: { 200: userProfileSchema, 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const { followerId, followingId } = request.body;
      const profile = await editProfileService.increaseFollower(followerId, followingId);
      return reply.status(200).send(toProfileResponse(profile));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error increasing followers" });
    }
  });

  router.post("/profile/followers/decrease", {
    config: {
      rateLimit: {
        max: env.rateLimitFollowMax,
        timeWindow: 60000,
        keyGenerator: (request: FastifyRequest) => {
          const body = request.body as { followerId?: string };
          return `rate:follow:${body?.followerId ?? request.ip}`;
        },
      },
    },
    schema: {
      tags: ["Profile"],
      summary: "Deixar de seguir usuário",
      description: "Remove o relacionamento de follow entre followerId e followingId. Atualiza contadores em ambos os perfis.",
      body: followerActionSchema,
      response: { 200: userProfileSchema, 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const { followerId, followingId } = request.body;
      const profile = await editProfileService.decreaseFollower(followerId, followingId);
      return reply.status(200).send(toProfileResponse(profile));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error decreasing followers" });
    }
  });

  router.get("/:accountId/followers", {
    schema: {
      tags: ["Profile"],
      summary: "Listar seguidores",
      description: "Retorna a lista de usuários que seguem o usuário informado.",
      params: accountIdParamsSchema,
      response: { 200: z.array(followerEntrySchema), 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const followers = await getFollowersService.listFollowers(request.params.accountId);
      return reply.status(200).send(followers);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error listing followers" });
    }
  });

  router.get("/:accountId/following", {
    schema: {
      tags: ["Profile"],
      summary: "Listar quem o usuário segue",
      description: "Retorna a lista de usuários que o usuário informado está seguindo.",
      params: accountIdParamsSchema,
      response: { 200: z.array(followingEntrySchema), 500: errorSchema },
    },
  }, async (request, reply) => {
    try {
      const following = await getFollowersService.listFollowing(request.params.accountId);
      return reply.status(200).send(following);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error listing following" });
    }
  });

  router.get("/:followerId/follows/:followingId", {
    schema: {
      tags: ["Profile"],
      summary: "Verificar se segue",
      description: "Retorna se followerId segue followingId.",
      params: isFollowingSchema,
      response: {
        200: z.object({ isFollowing: z.boolean() }),
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const { followerId, followingId } = request.params;
      const isFollowing = await checkFollowService.isFollowing(followerId, followingId);
      return reply.status(200).send({ isFollowing });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error checking follow status" });
    }
  });

  router.get("/search", {
    schema: {
      tags: ["Profile"],
      summary: "Pesquisar perfis",
      description:
        "Busca perfis de usuários em tempo real pelo nome ou username. " +
        "Ideal para barras de pesquisa com debounce no cliente (recomendado ≥300ms). " +
        "Os resultados são ordenados por número de seguidores (decrescente).",
      querystring: searchQuerySchema,
      response: {
        200: searchProfilesResponseSchema,
        400: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const { q, limit, page } = request.query;
      const result = await searchProfilesService.search({ q, limit, page });
      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Error searching profiles" });
    }
  });
}
