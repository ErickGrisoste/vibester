import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../src/config/cassandra', () => ({
  getCassandraClient: vi.fn(() => ({ execute: mockExecute, shutdown: vi.fn() })),
}));

vi.mock('../../src/kafka/producer', () => ({
  producer: { connect: vi.fn(), disconnect: vi.fn(), send: vi.fn() },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));
vi.mock('../../src/config/r2', () => ({ r2Client: {} }));

import { buildServer } from '../helpers/fastify.test.helper';
import { redis } from '../../src/config/redis';

const USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const POST_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const LIKER_ID = 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

function makeCassandraRow(overrides: Record<string, unknown> = {}) {
  return {
    post_id: POST_ID,
    user_id: USER_ID,
    establishment_id: null,
    image_urls: ['https://example.com/img.jpg'],
    caption: 'Test post',
    total_likes: 0,
    total_comments: 0,
    is_deleted: false,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: null,
    ...overrides,
  };
}

describe('post-service — Likes Integration', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    await redis.connect();
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
    await redis.flushall();
  });

  describe('POST /posts/:postId/likes', () => {
    it('cria like, atualiza contadores e retorna 201', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [makeCassandraRow()] })
        .mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'POST',
        url: `/posts/${POST_ID}/likes`,
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('postId', POST_ID);
      expect(body).toHaveProperty('userId', LIKER_ID);
      expect(body).toHaveProperty('likedAt');
    });

    it('retorna 404 quando post não existe', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'POST',
        url: `/posts/${POST_ID}/likes`,
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(404);
    });

    it('retorna 409 quando post já foi curtido', async () => {
      const likeRow = { post_id: POST_ID, user_id: LIKER_ID, liked_at: new Date() };
      mockExecute
        .mockResolvedValueOnce({ rows: [makeCassandraRow()] }) // findById
        .mockResolvedValueOnce({ rows: [likeRow] });            // findLikeByPostAndUser (já existe)

      const res = await app.inject({
        method: 'POST',
        url: `/posts/${POST_ID}/likes`,
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('DELETE /posts/:postId/likes', () => {
    it('remove like e retorna 204', async () => {
      const likeRow = { post_id: POST_ID, user_id: LIKER_ID, liked_at: new Date() };
      mockExecute
        .mockResolvedValueOnce({ rows: [makeCassandraRow({ total_likes: 1 })] })
        .mockResolvedValueOnce({ rows: [likeRow] })
        .mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'DELETE',
        url: `/posts/${POST_ID}/likes`,
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(204);
    });

    it('retorna 404 quando post não existe', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'DELETE',
        url: `/posts/${POST_ID}/likes`,
        payload: { userId: LIKER_ID },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /posts/:postId/likes', () => {
    it('retorna lista de likes do post', async () => {
      const likeRows = [
        { post_id: POST_ID, user_id: LIKER_ID, liked_at: new Date() },
      ];
      mockExecute.mockResolvedValueOnce({ rows: likeRows });

      const res = await app.inject({ method: 'GET', url: `/posts/${POST_ID}/likes` });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveLength(1);
      expect(body[0]).toHaveProperty('userId', LIKER_ID);
    });

    it('retorna o header X-Next-Cursor quando a página está cheia', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ post_id: POST_ID, user_id: LIKER_ID, liked_at: new Date() }],
      });

      const res = await app.inject({ method: 'GET', url: `/posts/${POST_ID}/likes?limit=1` });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-next-cursor']).toBeDefined();
    });
  });

  describe('GET /users/:userId/likes', () => {
    it('retorna lista de likes do usuário', async () => {
      const likeRows = [
        { post_id: POST_ID, user_id: USER_ID, liked_at: new Date() },
      ];
      mockExecute.mockResolvedValueOnce({ rows: likeRows });

      const res = await app.inject({ method: 'GET', url: `/users/${USER_ID}/likes` });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveLength(1);
    });

    it('retorna o header X-Next-Cursor quando a página está cheia', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ post_id: POST_ID, user_id: USER_ID, liked_at: new Date() }],
      });

      const res = await app.inject({ method: 'GET', url: `/users/${USER_ID}/likes?limit=1` });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-next-cursor']).toBeDefined();
    });
  });
});
