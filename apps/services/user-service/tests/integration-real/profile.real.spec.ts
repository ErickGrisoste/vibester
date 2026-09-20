import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Kafka é um efeito colateral de saída — mantemos mockado nos testes de integração
vi.mock("../../src/kafka/producer", () => ({
  producer: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn().mockResolvedValue({}),
  },
}));

import prismaClient from "../../src/prisma/index.js";
import { redis } from "../../src/config/redis.js";
import { buildServer } from "../helpers/fastify.test.helper.js";

const ACCOUNT_ID_1 = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ACCOUNT_ID_2 = "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

describe("user-service — HTTP Integration (Postgres + Redis reais)", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    await redis.connect();
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    await prismaClient.$disconnect();
    redis.disconnect();
  });

  beforeEach(async () => {
    await prismaClient.userFollow.deleteMany();
    await prismaClient.userProfile.deleteMany();
    await redis.flushall();
  });

  describe("POST /users/profile", () => {
    it("cria perfil e persiste no banco", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/users/profile",
        payload: { accountId: ACCOUNT_ID_1 },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.accountId).toBe(ACCOUNT_ID_1);
      expect(body.followers).toBe(0);
      expect(body.following).toBe(0);

      const row = await prismaClient.userProfile.findUnique({ where: { userID: ACCOUNT_ID_1 } });
      expect(row).not.toBeNull();
    });

    it("retorna 409 ao criar perfil duplicado", async () => {
      await app.inject({
        method: "POST",
        url: "/users/profile",
        payload: { accountId: ACCOUNT_ID_1 },
      });

      const res = await app.inject({
        method: "POST",
        url: "/users/profile",
        payload: { accountId: ACCOUNT_ID_1 },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe("GET /users/profile/:accountId", () => {
    it("retorna 200 com dados reais do banco", async () => {
      await app.inject({
        method: "POST",
        url: "/users/profile",
        payload: { accountId: ACCOUNT_ID_1 },
      });

      const res = await app.inject({
        method: "GET",
        url: `/users/profile/${ACCOUNT_ID_1}`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).accountId).toBe(ACCOUNT_ID_1);
    });

    it("segunda requisição usa cache (Redis) sem bater no banco", async () => {
      await app.inject({
        method: "POST",
        url: "/users/profile",
        payload: { accountId: ACCOUNT_ID_1 },
      });

      // Cache miss — lê do banco
      await app.inject({ method: "GET", url: `/users/profile/${ACCOUNT_ID_1}` });

      // Altera diretamente no banco sem invalidar cache
      await prismaClient.userProfile.update({
        where: { userID: ACCOUNT_ID_1 },
        data: { bio: "alterado-direto-no-banco" },
      });

      // Cache hit — deve retornar valor original, não o alterado
      const res = await app.inject({ method: "GET", url: `/users/profile/${ACCOUNT_ID_1}` });
      expect(JSON.parse(res.payload).bio).toBeNull();
    });

    it("retorna 404 quando perfil não existe", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/users/profile/${ACCOUNT_ID_1}`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PUT /users/profile/bio", () => {
    it("atualiza bio no banco e invalida o cache", async () => {
      await app.inject({
        method: "POST",
        url: "/users/profile",
        payload: { accountId: ACCOUNT_ID_1 },
      });

      // Prime cache
      await app.inject({ method: "GET", url: `/users/profile/${ACCOUNT_ID_1}` });

      const updateRes = await app.inject({
        method: "PUT",
        url: "/users/profile/bio",
        payload: { accountId: ACCOUNT_ID_1, bio: "nova bio real" },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.payload).bio).toBe("nova bio real");

      // Cache invalidado — próximo GET deve refletir a atualização
      const getRes = await app.inject({ method: "GET", url: `/users/profile/${ACCOUNT_ID_1}` });
      expect(JSON.parse(getRes.payload).bio).toBe("nova bio real");
    });
  });

  describe("PUT /users/profile/avatar", () => {
    it("atualiza avatarUrl no banco", async () => {
      await app.inject({
        method: "POST",
        url: "/users/profile",
        payload: { accountId: ACCOUNT_ID_1 },
      });

      const res = await app.inject({
        method: "PUT",
        url: "/users/profile/avatar",
        payload: { accountId: ACCOUNT_ID_1, avatarUrl: "https://example.com/avatar.png" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).avatarUrl).toBe("https://example.com/avatar.png");

      const row = await prismaClient.userProfile.findUnique({ where: { userID: ACCOUNT_ID_1 } });
      expect(row?.avatarUrl).toBe("https://example.com/avatar.png");
    });
  });

  describe("POST /users/profile/followers/increase + decrease", () => {
    it("incrementa contadores e grava follow na tabela", async () => {
      await app.inject({ method: "POST", url: "/users/profile", payload: { accountId: ACCOUNT_ID_1 } });
      await app.inject({ method: "POST", url: "/users/profile", payload: { accountId: ACCOUNT_ID_2 } });

      const incRes = await app.inject({
        method: "POST",
        url: "/users/profile/followers/increase",
        payload: { followerId: ACCOUNT_ID_2, followingId: ACCOUNT_ID_1 },
      });

      expect(incRes.statusCode).toBe(200);
      expect(JSON.parse(incRes.payload).followers).toBe(1);

      const follow = await prismaClient.userFollow.findFirst({
        where: { followerId: ACCOUNT_ID_2, followingId: ACCOUNT_ID_1 },
      });
      expect(follow).not.toBeNull();
    });

    it("decrementa contadores e remove follow da tabela", async () => {
      await app.inject({ method: "POST", url: "/users/profile", payload: { accountId: ACCOUNT_ID_1 } });
      await app.inject({ method: "POST", url: "/users/profile", payload: { accountId: ACCOUNT_ID_2 } });
      await app.inject({
        method: "POST",
        url: "/users/profile/followers/increase",
        payload: { followerId: ACCOUNT_ID_2, followingId: ACCOUNT_ID_1 },
      });

      const decRes = await app.inject({
        method: "POST",
        url: "/users/profile/followers/decrease",
        payload: { followerId: ACCOUNT_ID_2, followingId: ACCOUNT_ID_1 },
      });

      expect(decRes.statusCode).toBe(200);
      expect(JSON.parse(decRes.payload).followers).toBe(0);

      const follow = await prismaClient.userFollow.findFirst({
        where: { followerId: ACCOUNT_ID_2, followingId: ACCOUNT_ID_1 },
      });
      expect(follow).toBeNull();
    });
  });

  describe("GET /users/:accountId/followers e /following", () => {
    it("retorna seguidores e seguidos reais do banco", async () => {
      await app.inject({ method: "POST", url: "/users/profile", payload: { accountId: ACCOUNT_ID_1 } });
      await app.inject({ method: "POST", url: "/users/profile", payload: { accountId: ACCOUNT_ID_2 } });
      await app.inject({
        method: "POST",
        url: "/users/profile/followers/increase",
        payload: { followerId: ACCOUNT_ID_2, followingId: ACCOUNT_ID_1 },
      });

      const followersRes = await app.inject({ method: "GET", url: `/users/${ACCOUNT_ID_1}/followers` });
      expect(followersRes.statusCode).toBe(200);
      const followers = JSON.parse(followersRes.payload);
      expect(followers.data).toHaveLength(1);
      expect(followers.data[0].accountId).toBe(ACCOUNT_ID_2);
      expect(followers.data[0]).toHaveProperty("username");
      expect(followers.nextCursor).toBeNull();

      const followingRes = await app.inject({ method: "GET", url: `/users/${ACCOUNT_ID_2}/following` });
      expect(followingRes.statusCode).toBe(200);
      const following = JSON.parse(followingRes.payload);
      expect(following.data).toHaveLength(1);
      expect(following.data[0].accountId).toBe(ACCOUNT_ID_1);
    });
  });
});
