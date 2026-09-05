import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Kafka é um efeito colateral de saída — mantemos mockado nos testes de integração real,
// assim como no user-service (ver tests/integration-real/profile.real.spec.ts).
vi.mock("../../src/kafka/producer", () => ({
  producer: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn().mockResolvedValue({}),
  },
}));

// R2/S3 é infra externa (Cloudflare) sem credenciais reais disponíveis em CI — mockado
// igual aos testes já existentes em tests/integration/post.integration.spec.ts.
const { mockGetSignedUrl } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn().mockResolvedValue("https://signed.r2.dev/presigned?X-Amz-Signature=test"),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mockGetSignedUrl }));
vi.mock("../../src/config/r2", () => ({ r2Client: {} }));

import { buildServer } from "../helpers/fastify.test.helper";
import { getCassandraClient } from "../../src/config/cassandra";
import { redis } from "../../src/config/redis";
import { truncateAllTables } from "./helpers/cassandra.cleanup";

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ESTAB_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

// Payload completo (com todos os campos opcionais de snapshot denormalizado
// preenchidos) — o repository grava userUsername/userProfilePicture/userVerified
// direto como parâmetro (sem `?? null`), e o cassandra-driver rejeita `undefined`
// como bind parameter. Testes com payload real evitam esse ponto cego, que os
// testes mockados (tests/integration/post.integration.spec.ts) nunca exercitam.
function fullCreatePayload(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    userUsername: "test-user",
    userProfilePicture: "https://example.com/avatar.jpg",
    userVerified: false,
    imageUrls: ["https://example.com/img.jpg"],
    caption: "Test post",
    establishmentId: ESTAB_ID,
    establishmentName: "Test Bar",
    establishmentLogo: "https://example.com/logo.jpg",
    establishmentCategory: "bar",
    tags: ["party"],
    ...overrides,
  };
}

describe("post-service — HTTP Integration (Cassandra + Redis reais)", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    await redis.connect();
    await getCassandraClient().connect();
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    await getCassandraClient().shutdown();
    redis.disconnect();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue("https://signed.r2.dev/presigned?X-Amz-Signature=test");
    await truncateAllTables();
    await redis.flushall();
  });

  describe("GET /health", () => {
    it("retorna 200 com Redis e Cassandra reais saudáveis", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("ok");
      expect(body.dependencies).toEqual({ redis: "ok", cassandra: "ok" });
    });
  });

  describe("POST /posts", () => {
    it("cria post e persiste em posts_by_id, posts_by_user e posts_by_establishment", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/posts",
        payload: fullCreatePayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty("postId");
      expect(body.userId).toBe(USER_ID);
      expect(body.caption).toBe("Test post");

      const client = getCassandraClient();
      const byId = await client.execute("SELECT * FROM posts_by_id WHERE post_id = ?", [body.postId], { prepare: true });
      expect(byId.rowLength).toBe(1);

      const byUser = await client.execute("SELECT * FROM posts_by_user WHERE user_id = ?", [USER_ID], { prepare: true });
      expect(byUser.rowLength).toBe(1);

      const byEstablishment = await client.execute(
        "SELECT * FROM posts_by_establishment WHERE establishment_id = ?",
        [ESTAB_ID],
        { prepare: true }
      );
      expect(byEstablishment.rowLength).toBe(1);
    });

    it("cria post sem estabelecimento e não grava em posts_by_establishment", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/posts",
        payload: fullCreatePayload({ establishmentId: undefined, establishmentName: undefined, establishmentLogo: undefined, establishmentCategory: undefined }),
      });

      expect(res.statusCode).toBe(201);

      const client = getCassandraClient();
      const byEstablishment = await client.execute(
        "SELECT * FROM posts_by_establishment WHERE establishment_id = ?",
        [ESTAB_ID],
        { prepare: true }
      );
      expect(byEstablishment.rowLength).toBe(0);
    });

    it("rejeita caption com mais de 2000 caracteres antes de tocar no banco", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/posts",
        payload: fullCreatePayload({ caption: "a".repeat(2001) }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /posts/:postId — cache-aside real (Redis + Cassandra)", () => {
    it("cache miss: busca no Cassandra real e grava no Redis real", async () => {
      const createRes = await app.inject({ method: "POST", url: "/posts", payload: fullCreatePayload() });
      const created = JSON.parse(createRes.payload);

      const cachedBefore = await redis.get(`post:id:${created.postId}`);
      expect(cachedBefore).toBeNull();

      const res = await app.inject({ method: "GET", url: `/posts/${created.postId}` });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).postId).toBe(created.postId);

      const cachedAfter = await redis.get(`post:id:${created.postId}`);
      expect(cachedAfter).not.toBeNull();
    });

    it("cache hit: retorna o valor cacheado mesmo após alteração direta no Cassandra", async () => {
      const createRes = await app.inject({ method: "POST", url: "/posts", payload: fullCreatePayload() });
      const created = JSON.parse(createRes.payload);

      // Popula o cache
      await app.inject({ method: "GET", url: `/posts/${created.postId}` });

      // Altera diretamente no Cassandra sem invalidar o cache
      await getCassandraClient().execute(
        "UPDATE posts_by_id SET caption = ? WHERE post_id = ?",
        ["alterado-direto-no-cassandra", created.postId],
        { prepare: true }
      );

      const res = await app.inject({ method: "GET", url: `/posts/${created.postId}` });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).caption).toBe("Test post");
    });

    it("retorna 404 quando post não existe no Cassandra", async () => {
      const res = await app.inject({ method: "GET", url: "/posts/b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5" });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /users/:userId/posts", () => {
    it("retorna posts do usuário ordenados por created_at desc (paginação keyset real)", async () => {
      const first = await app.inject({ method: "POST", url: "/posts", payload: fullCreatePayload({ caption: "first" }) });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await app.inject({ method: "POST", url: "/posts", payload: fullCreatePayload({ caption: "second" }) });

      const res = await app.inject({ method: "GET", url: `/users/${USER_ID}/posts` });

      expect(res.statusCode).toBe(200);
      const posts = JSON.parse(res.payload);
      expect(posts).toHaveLength(2);
      expect(posts[0].postId).toBe(JSON.parse(second.payload).postId);
      expect(posts[1].postId).toBe(JSON.parse(first.payload).postId);
    });
  });

  describe("PATCH /posts/:postId", () => {
    it("atualiza legenda em todas as tabelas denormalizadas e invalida o cache", async () => {
      const createRes = await app.inject({ method: "POST", url: "/posts", payload: fullCreatePayload() });
      const created = JSON.parse(createRes.payload);

      // Popula o cache antes de atualizar
      await app.inject({ method: "GET", url: `/posts/${created.postId}` });

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/posts/${created.postId}`,
        payload: { caption: "legenda atualizada" },
      });
      expect(patchRes.statusCode).toBe(200);

      const res = await app.inject({ method: "GET", url: `/posts/${created.postId}` });
      expect(JSON.parse(res.payload).caption).toBe("legenda atualizada");

      const client = getCassandraClient();
      const byUser = await client.execute("SELECT caption FROM posts_by_user WHERE user_id = ?", [USER_ID], { prepare: true });
      expect(byUser.rows[0]?.caption).toBe("legenda atualizada");
    });
  });

  describe("DELETE /posts/:postId (soft delete)", () => {
    it("marca is_deleted em posts_by_id e posts_by_user e some das listagens paginadas", async () => {
      const createRes = await app.inject({ method: "POST", url: "/posts", payload: fullCreatePayload() });
      const created = JSON.parse(createRes.payload);

      const res = await app.inject({ method: "DELETE", url: `/posts/${created.postId}` });
      expect(res.statusCode).toBe(204);

      const client = getCassandraClient();
      const byId = await client.execute("SELECT is_deleted FROM posts_by_id WHERE post_id = ?", [created.postId], { prepare: true });
      expect(byId.rows[0]?.is_deleted).toBe(true);

      // findByUser filtra isDeleted (post.repository.ts) — não deve aparecer na listagem
      const listRes = await app.inject({ method: "GET", url: `/users/${USER_ID}/posts` });
      expect(JSON.parse(listRes.payload)).toHaveLength(0);
    });

    it("retorna 404 ao deletar post inexistente", async () => {
      const res = await app.inject({ method: "DELETE", url: "/posts/b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5" });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /posts/upload-url", () => {
    it("retorna URLs pré-assinadas sem tocar no Cassandra", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/posts/upload-url",
        payload: { userId: USER_ID, count: 2 },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(2);
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });
  });
});
