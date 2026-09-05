import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

vi.mock("../../src/kafka/producer", () => ({
  producer: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
vi.mock("../../src/config/r2", () => ({ r2Client: {} }));

import { buildServer } from "../helpers/fastify.test.helper";
import { getCassandraClient } from "../../src/config/cassandra";
import { redis } from "../../src/config/redis";
import { truncateAllTables } from "./helpers/cassandra.cleanup";

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const LIKER_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const OTHER_LIKER_ID = "d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

describe("post-service — Likes Integration (Cassandra + Redis reais)", () => {
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
    await truncateAllTables();
    await redis.flushall();
  });

  async function createRealPost(overrides: Record<string, unknown> = {}) {
    const res = await app.inject({
      method: "POST",
      url: "/posts",
      payload: {
        userId: USER_ID,
        userUsername: "post-author",
        userProfilePicture: "https://example.com/avatar.jpg",
        userVerified: false,
        imageUrls: ["https://example.com/img.jpg"],
        caption: "Test post",
        ...overrides,
      },
    });
    return JSON.parse(res.payload) as { postId: string; totalLikes: number };
  }

  describe("POST /posts/:postId/likes", () => {
    it("cria like em likes_by_post e likes_by_user e incrementa total_likes no post", async () => {
      const post = await createRealPost();

      const res = await app.inject({
        method: "POST",
        url: `/posts/${post.postId}/likes`,
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.postId).toBe(post.postId);
      expect(body.userId).toBe(LIKER_ID);

      const client = getCassandraClient();
      const byPost = await client.execute("SELECT * FROM likes_by_post WHERE post_id = ? AND user_id = ?", [post.postId, LIKER_ID], { prepare: true });
      expect(byPost.rowLength).toBe(1);

      const byUser = await client.execute("SELECT * FROM likes_by_user WHERE user_id = ?", [LIKER_ID], { prepare: true });
      expect(byUser.rowLength).toBe(1);

      const updatedPost = await client.execute("SELECT total_likes FROM posts_by_id WHERE post_id = ?", [post.postId], { prepare: true });
      expect(updatedPost.rows[0]?.total_likes).toBe(1);
    });

    it("retorna 404 quando o post não existe no Cassandra", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/posts/b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5/likes",
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(404);
    });

    it("retorna 409 ao curtir o mesmo post duas vezes com o mesmo usuário", async () => {
      const post = await createRealPost();

      await app.inject({ method: "POST", url: `/posts/${post.postId}/likes`, payload: { userId: LIKER_ID } });
      const res = await app.inject({ method: "POST", url: `/posts/${post.postId}/likes`, payload: { userId: LIKER_ID } });

      expect(res.statusCode).toBe(409);

      const client = getCassandraClient();
      const updatedPost = await client.execute("SELECT total_likes FROM posts_by_id WHERE post_id = ?", [post.postId], { prepare: true });
      expect(updatedPost.rows[0]?.total_likes).toBe(1);
    });

    it("permite curtidas concorrentes de usuários diferentes no mesmo post", async () => {
      const post = await createRealPost();

      await Promise.all([
        app.inject({ method: "POST", url: `/posts/${post.postId}/likes`, payload: { userId: LIKER_ID } }),
        app.inject({ method: "POST", url: `/posts/${post.postId}/likes`, payload: { userId: OTHER_LIKER_ID } }),
      ]);

      const client = getCassandraClient();
      const byPost = await client.execute("SELECT * FROM likes_by_post WHERE post_id = ?", [post.postId], { prepare: true });
      expect(byPost.rowLength).toBe(2);
    });
  });

  describe("DELETE /posts/:postId/likes", () => {
    it("remove o like e decrementa total_likes", async () => {
      const post = await createRealPost();
      await app.inject({ method: "POST", url: `/posts/${post.postId}/likes`, payload: { userId: LIKER_ID } });

      const res = await app.inject({
        method: "DELETE",
        url: `/posts/${post.postId}/likes`,
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(204);

      const client = getCassandraClient();
      const byPost = await client.execute("SELECT * FROM likes_by_post WHERE post_id = ? AND user_id = ?", [post.postId, LIKER_ID], { prepare: true });
      expect(byPost.rowLength).toBe(0);

      const updatedPost = await client.execute("SELECT total_likes FROM posts_by_id WHERE post_id = ?", [post.postId], { prepare: true });
      expect(updatedPost.rows[0]?.total_likes).toBe(0);
    });

    it("retorna 404 quando o post não existe", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/posts/b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5/likes",
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /posts/:postId/likes e /users/:userId/likes", () => {
    it("lista curtidas reais do post e do usuário", async () => {
      const post = await createRealPost();
      await app.inject({ method: "POST", url: `/posts/${post.postId}/likes`, payload: { userId: LIKER_ID } });

      const byPostRes = await app.inject({ method: "GET", url: `/posts/${post.postId}/likes` });
      expect(byPostRes.statusCode).toBe(200);
      const byPostBody = JSON.parse(byPostRes.payload);
      expect(byPostBody).toHaveLength(1);
      expect(byPostBody[0].userId).toBe(LIKER_ID);

      const byUserRes = await app.inject({ method: "GET", url: `/users/${LIKER_ID}/likes` });
      expect(byUserRes.statusCode).toBe(200);
      const byUserBody = JSON.parse(byUserRes.payload);
      expect(byUserBody).toHaveLength(1);
      expect(byUserBody[0].postId).toBe(post.postId);
    });
  });
});
