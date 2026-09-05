import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../src/config/cassandra', () => ({
  getCassandraClient: vi.fn(() => ({ execute: mockExecute, shutdown: vi.fn() })),
}));

vi.mock('../../src/kafka/producer', () => ({
  producer: { connect: vi.fn(), disconnect: vi.fn(), send: vi.fn() },
}));

const { mockGetSignedUrl } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn().mockResolvedValue('https://signed.r2.dev/presigned?X-Amz-Signature=test'),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mockGetSignedUrl }));
vi.mock('../../src/config/r2', () => ({ r2Client: {} }));

import { buildServer } from '../helpers/fastify.test.helper';
import { redis } from '../../src/config/redis';

const USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const POST_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const ESTAB_ID = 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

function makeCassandraRow(overrides: Record<string, unknown> = {}) {
  return {
    post_id: POST_ID,
    user_id: USER_ID,
    establishment_id: ESTAB_ID,
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

describe('post-service — HTTP Integration', () => {
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
    mockGetSignedUrl.mockResolvedValue('https://signed.r2.dev/presigned?X-Amz-Signature=test');
    await redis.flushall();
  });

  describe('GET /health', () => {
    it('retorna 200 ou 503 com status de dependências', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect([200, 503]).toContain(res.statusCode);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('dependencies');
    });
  });

  describe('POST /posts', () => {
    it('cria post e retorna 201', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: {
          userId: USER_ID,
          imageUrls: ['https://test.r2.dev/posts/img.jpg'],
          caption: 'Test post',
          establishmentId: ESTAB_ID,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('userId', USER_ID);
      expect(body).toHaveProperty('caption', 'Test post');
      expect(body).toHaveProperty('postId');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('aceita caption com até 2000 caracteres', async () => {
      const longCaption = 'a'.repeat(2000);
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: {
          userId: USER_ID,
          imageUrls: ['https://test.r2.dev/posts/img.jpg'],
          caption: longCaption,
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it('rejeita caption com mais de 2000 caracteres', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: {
          userId: USER_ID,
          imageUrls: ['https://test.r2.dev/posts/img.jpg'],
          caption: 'a'.repeat(2001),
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('aceita post misto de imagem e vídeo preservando a ordem', async () => {
      const media = [
        { url: 'https://test.r2.dev/posts/a.jpg', type: 'IMAGE' },
        { url: 'https://test.r2.dev/posts/b.mp4', type: 'VIDEO', thumbnailUrl: 'https://test.r2.dev/posts/b.jpg' },
        { url: 'https://test.r2.dev/posts/c.jpg', type: 'IMAGE' },
      ];

      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: { userId: USER_ID, media, caption: 'noite boa' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.media).toEqual(media);
      // image_urls continua sendo gravada para apps que ainda não leem media.
      expect(body.imageUrls).toEqual([
        'https://test.r2.dev/posts/a.jpg',
        'https://test.r2.dev/posts/c.jpg',
      ]);
    });

    it('aceita post só de vídeo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: {
          userId: USER_ID,
          media: [{ url: 'https://test.r2.dev/posts/b.mp4', type: 'VIDEO' }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).imageUrls).toEqual([]);
    });

    it('converte imageUrls legado em media do tipo IMAGE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: { userId: USER_ID, imageUrls: ['https://test.r2.dev/posts/a.jpg'] },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).media).toEqual([
        { url: 'https://test.r2.dev/posts/a.jpg', type: 'IMAGE' },
      ]);
    });

    it('rejeita mídia hospedada fora do bucket', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: {
          userId: USER_ID,
          media: [{ url: 'https://evil.example.com/a.jpg', type: 'IMAGE' }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejeita tipo de mídia desconhecido', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: {
          userId: USER_ID,
          media: [{ url: 'https://test.r2.dev/posts/a.gif', type: 'GIF' }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejeita post sem nenhuma mídia', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: { userId: USER_ID, caption: 'só texto' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejeita mais de 10 mídias', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: {
          userId: USER_ID,
          media: Array.from({ length: 11 }, (_, i) => ({
            url: `https://test.r2.dev/posts/${i}.jpg`,
            type: 'IMAGE',
          })),
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /posts/:postId — Redis cache real', () => {
    it('cache miss: busca no Cassandra e armazena no cache Redis real', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [makeCassandraRow()] });

      const res = await app.inject({ method: 'GET', url: `/posts/${POST_ID}` });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('postId', POST_ID);

      const cached = await redis.get(`post:id:${POST_ID}`);
      expect(cached).not.toBeNull();
    });

    it('cache hit: segunda requisição não chama Cassandra', async () => {
      const post = makeCassandraRow();
      const mappedPost = {
        postId: post.post_id,
        userId: post.user_id,
        establishmentId: post.establishment_id,
        imageUrls: post.image_urls,
        caption: post.caption,
        totalLikes: post.total_likes,
        totalComments: post.total_comments,
        isDeleted: post.is_deleted,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
      };
      await redis.set(`post:id:${POST_ID}`, JSON.stringify(mappedPost), 'EX', 300);

      const callsBefore = mockExecute.mock.calls.length;
      const res = await app.inject({ method: 'GET', url: `/posts/${POST_ID}` });
      expect(res.statusCode).toBe(200);
      expect(mockExecute.mock.calls.length).toBe(callsBefore);
    });

    it('retorna 404 quando post não existe', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.inject({ method: 'GET', url: `/posts/${POST_ID}` });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /users/:userId/posts', () => {
    it('retorna posts do usuário e usa cache Redis real', async () => {
      const row = makeCassandraRow();
      const mappedPost = {
        postId: row.post_id,
        userId: row.user_id,
        establishmentId: row.establishment_id,
        imageUrls: row.image_urls,
        caption: row.caption,
        totalLikes: row.total_likes,
        totalComments: row.total_comments,
        isDeleted: row.is_deleted,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      await redis.set(`post:user:${USER_ID}:50`, JSON.stringify({ posts: [mappedPost], nextCursor: null }), 'EX', 120);

      const callsBefore = mockExecute.mock.calls.length;
      const res = await app.inject({ method: 'GET', url: `/users/${USER_ID}/posts` });
      expect(res.statusCode).toBe(200);
      expect(mockExecute.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('DELETE /posts/:postId (soft delete)', () => {
    it('marca post como deletado e retorna 204', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [makeCassandraRow()] })
        .mockResolvedValue({ rows: [] });

      const res = await app.inject({ method: 'DELETE', url: `/posts/${POST_ID}` });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('POST /posts/upload-url', () => {
    it('retorna 200 com array de URLs pré-assinadas', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts/upload-url',
        payload: { userId: USER_ID, count: 2 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload) as unknown[];
      expect(body).toHaveLength(2);
    });

    it('cada item retorna uploadUrl, key e publicUrl', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts/upload-url',
        payload: { userId: USER_ID, count: 1 },
      });

      expect(res.statusCode).toBe(200);
      const [item] = JSON.parse(res.payload) as { uploadUrl: string; key: string; publicUrl: string }[];
      expect(item).toHaveProperty('uploadUrl');
      expect(item).toHaveProperty('key');
      expect(item).toHaveProperty('publicUrl');
      expect(item.key).toMatch(new RegExp(`^posts/${USER_ID}/`));
    });

    it('retorna 400 quando userId não é UUID válido', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts/upload-url',
        payload: { userId: 'invalid-id', count: 1 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('retorna 400 quando count é zero', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts/upload-url',
        payload: { userId: USER_ID, count: 0 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('retorna 400 quando count excede 20', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts/upload-url',
        payload: { userId: USER_ID, count: 21 },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
