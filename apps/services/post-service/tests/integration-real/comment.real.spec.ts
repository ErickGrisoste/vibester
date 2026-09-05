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
const COMMENTER_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const OTHER_USER_ID = "d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

describe("post-service — Comments Integration (Cassandra + Redis reais)", () => {
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
    return JSON.parse(res.payload) as { postId: string; totalComments: number };
  }

  describe("POST /comments", () => {
    it("cria comentário em comments_by_id/_by_post/_by_user e incrementa total_comments do post", async () => {
      const post = await createRealPost();

      const res = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { postId: post.postId, userId: COMMENTER_ID, content: "Que lugar incrível!" },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty("commentId");
      expect(body.postId).toBe(post.postId);

      const client = getCassandraClient();
      const byId = await client.execute("SELECT * FROM comments_by_id WHERE comment_id = ?", [body.commentId], { prepare: true });
      expect(byId.rowLength).toBe(1);

      const byPost = await client.execute("SELECT * FROM comments_by_post WHERE post_id = ?", [post.postId], { prepare: true });
      expect(byPost.rowLength).toBe(1);

      const byUser = await client.execute("SELECT * FROM comments_by_user WHERE user_id = ?", [COMMENTER_ID], { prepare: true });
      expect(byUser.rowLength).toBe(1);

      const updatedPost = await client.execute("SELECT total_comments FROM posts_by_id WHERE post_id = ?", [post.postId], { prepare: true });
      expect(updatedPost.rows[0]?.total_comments).toBe(1);
    });

    it("retorna 404 quando o post não existe no Cassandra", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { postId: "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5", userId: COMMENTER_ID, content: "comentário" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("retorna 400 quando content está vazio", async () => {
      const post = await createRealPost();
      const res = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { postId: post.postId, userId: COMMENTER_ID, content: "" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("retorna 400 quando content excede 500 caracteres", async () => {
      const post = await createRealPost();
      const res = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { postId: post.postId, userId: COMMENTER_ID, content: "a".repeat(501) },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /posts/:postId/comments e /users/:userId/comments", () => {
    it("lista comentários reais do post e do usuário", async () => {
      const post = await createRealPost();
      await app.inject({ method: "POST", url: "/comments", payload: { postId: post.postId, userId: COMMENTER_ID, content: "Ótimo post!" } });

      const byPostRes = await app.inject({ method: "GET", url: `/posts/${post.postId}/comments` });
      expect(byPostRes.statusCode).toBe(200);
      const byPostBody = JSON.parse(byPostRes.payload);
      expect(byPostBody).toHaveLength(1);
      expect(byPostBody[0].content).toBe("Ótimo post!");

      const byUserRes = await app.inject({ method: "GET", url: `/users/${COMMENTER_ID}/comments` });
      expect(byUserRes.statusCode).toBe(200);
      expect(JSON.parse(byUserRes.payload)).toHaveLength(1);
    });
  });

  describe("PATCH /comments/:commentId", () => {
    it("atualiza o conteúdo quando o autor é o dono do comentário", async () => {
      const post = await createRealPost();
      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { postId: post.postId, userId: COMMENTER_ID, content: "original" },
      });
      const comment = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: "PATCH",
        url: `/comments/${comment.commentId}`,
        payload: { userId: COMMENTER_ID, content: "editado" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).content).toBe("editado");

      const client = getCassandraClient();
      const byId = await client.execute("SELECT content FROM comments_by_id WHERE comment_id = ?", [comment.commentId], { prepare: true });
      expect(byId.rows[0]?.content).toBe("editado");
    });

    it("retorna 403 quando quem edita não é o dono do comentário", async () => {
      const post = await createRealPost();
      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { postId: post.postId, userId: COMMENTER_ID, content: "original" },
      });
      const comment = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: "PATCH",
        url: `/comments/${comment.commentId}`,
        payload: { userId: OTHER_USER_ID, content: "tentativa de editar" },
      });

      expect(res.statusCode).toBe(403);

      const client = getCassandraClient();
      const byId = await client.execute("SELECT content FROM comments_by_id WHERE comment_id = ?", [comment.commentId], { prepare: true });
      expect(byId.rows[0]?.content).toBe("original");
    });
  });

  describe("DELETE /comments/:commentId", () => {
    it("marca is_deleted e decrementa total_comments do post quando o autor é o dono", async () => {
      const post = await createRealPost();
      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { postId: post.postId, userId: COMMENTER_ID, content: "para remover" },
      });
      const comment = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: "DELETE",
        url: `/comments/${comment.commentId}`,
        payload: { userId: COMMENTER_ID },
      });

      expect(res.statusCode).toBe(204);

      const client = getCassandraClient();
      const byId = await client.execute("SELECT is_deleted FROM comments_by_id WHERE comment_id = ?", [comment.commentId], { prepare: true });
      expect(byId.rows[0]?.is_deleted).toBe(true);

      const updatedPost = await client.execute("SELECT total_comments FROM posts_by_id WHERE post_id = ?", [post.postId], { prepare: true });
      expect(updatedPost.rows[0]?.total_comments).toBe(0);
    });

    it("retorna 403 quando quem deleta não é o dono do comentário", async () => {
      const post = await createRealPost();
      const createRes = await app.inject({
        method: "POST",
        url: "/comments",
        payload: { postId: post.postId, userId: COMMENTER_ID, content: "não deve sumir" },
      });
      const comment = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: "DELETE",
        url: `/comments/${comment.commentId}`,
        payload: { userId: OTHER_USER_ID },
      });

      expect(res.statusCode).toBe(403);

      const client = getCassandraClient();
      const byId = await client.execute("SELECT is_deleted FROM comments_by_id WHERE comment_id = ?", [comment.commentId], { prepare: true });
      expect(byId.rows[0]?.is_deleted).toBe(false);
    });
  });
});
