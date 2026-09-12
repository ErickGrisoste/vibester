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
const COMMENTER_ID = 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

function makeCassandraPostRow(overrides: Record<string, unknown> = {}) {
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

describe('post-service — Comments Integration', () => {
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

  describe('POST /comments', () => {
    it('cria comentário e retorna 201', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [makeCassandraPostRow()] })
        .mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'POST',
        url: '/comments',
        payload: {
          postId: POST_ID,
          userId: COMMENTER_ID,
          content: 'Que lugar incrível!',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('postId', POST_ID);
      expect(body).toHaveProperty('userId', COMMENTER_ID);
      expect(body).toHaveProperty('content', 'Que lugar incrível!');
      expect(body).toHaveProperty('commentId');
    });

    it('retorna 404 quando post não existe', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'POST',
        url: '/comments',
        payload: { postId: POST_ID, userId: COMMENTER_ID, content: 'comentário' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('retorna 400 quando content está vazio', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/comments',
        payload: { postId: POST_ID, userId: COMMENTER_ID, content: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('retorna 400 quando content excede 500 caracteres', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/comments',
        payload: { postId: POST_ID, userId: COMMENTER_ID, content: 'a'.repeat(501) },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /comments/:commentId', () => {
    const COMMENT_ID = 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

    function makeCommentRow(overrides: Record<string, unknown> = {}) {
      return {
        comment_id: COMMENT_ID,
        post_id: POST_ID,
        user_id: COMMENTER_ID,
        content: 'comentário original',
        is_deleted: false,
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: null,
        ...overrides,
      };
    }

    it('atualiza o conteúdo quando o userId é o autor do comentário', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [makeCommentRow()] }) // findById
        .mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'PATCH',
        url: `/comments/${COMMENT_ID}`,
        payload: { userId: COMMENTER_ID, content: 'editado' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).content).toBe('editado');
    });

    it('retorna 403 quando o userId não é o autor do comentário', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [makeCommentRow()] });

      const res = await app.inject({
        method: 'PATCH',
        url: `/comments/${COMMENT_ID}`,
        payload: { userId: 'f1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', content: 'não deveria passar' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('retorna 404 quando o comentário não existe', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'PATCH',
        url: `/comments/${COMMENT_ID}`,
        payload: { userId: COMMENTER_ID, content: 'x' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /comments/:commentId', () => {
    const COMMENT_ID = 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

    function makeCommentRow(overrides: Record<string, unknown> = {}) {
      return {
        comment_id: COMMENT_ID,
        post_id: POST_ID,
        user_id: COMMENTER_ID,
        content: 'comentário original',
        is_deleted: false,
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        updated_at: null,
        ...overrides,
      };
    }

    it('remove o comentário quando o userId é o autor e retorna 204', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [makeCommentRow()] })       // findById (comment)
        .mockResolvedValueOnce({ rows: [makeCassandraPostRow()] }) // findById (post)
        .mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'DELETE',
        url: `/comments/${COMMENT_ID}`,
        payload: { userId: COMMENTER_ID },
      });

      expect(res.statusCode).toBe(204);
    });

    it('retorna 403 quando o userId não é o autor do comentário', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [makeCommentRow()] });

      const res = await app.inject({
        method: 'DELETE',
        url: `/comments/${COMMENT_ID}`,
        payload: { userId: 'f1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('retorna 404 quando o comentário não existe', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'DELETE',
        url: `/comments/${COMMENT_ID}`,
        payload: { userId: COMMENTER_ID },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /posts/:postId/comments', () => {
    it('retorna comentários do post', async () => {
      const commentRows = [
        {
          comment_id: 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
          post_id: POST_ID,
          user_id: COMMENTER_ID,
          content: 'Ótimo post!',
          is_deleted: false,
          created_at: new Date(),
          updated_at: null,
        },
      ];
      mockExecute.mockResolvedValueOnce({ rows: commentRows });

      const res = await app.inject({ method: 'GET', url: `/posts/${POST_ID}/comments` });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveLength(1);
      expect(body[0]).toHaveProperty('content', 'Ótimo post!');
    });

    it('retorna o header X-Next-Cursor quando a página está cheia', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{
          comment_id: 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
          post_id: POST_ID,
          user_id: COMMENTER_ID,
          content: 'Ótimo post!',
          is_deleted: false,
          created_at: new Date(),
          updated_at: null,
        }],
      });

      const res = await app.inject({ method: 'GET', url: `/posts/${POST_ID}/comments?limit=1` });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-next-cursor']).toBeDefined();
    });
  });

  describe('GET /users/:userId/comments', () => {
    it('retorna comentários do usuário', async () => {
      const commentRows = [
        {
          comment_id: 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
          post_id: POST_ID,
          user_id: COMMENTER_ID,
          content: 'Meu comentário',
          is_deleted: false,
          created_at: new Date(),
          updated_at: null,
        },
      ];
      mockExecute.mockResolvedValueOnce({ rows: commentRows });

      const res = await app.inject({ method: 'GET', url: `/users/${COMMENTER_ID}/comments` });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveLength(1);
    });
  });
});
