import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../src/config/cassandra', () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { buildServer, makeAuthHeader } from '../helpers/fastify.test.helper';
import { encodeSessionCursor } from '../../src/utils/feed_cursor';

const USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const ITEM_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

const createdAt = new Date('2024-01-15T12:00:00.000Z');

function makeFeedRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: USER_ID,
    created_at: createdAt,
    item_id: ITEM_ID,
    item_type: 'USER_POST',
    author_id: 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
    author_username: 'testuser',
    author_profile_picture: null,
    author_verified: false,
    establishment_id: null,
    establishment_name: null,
    establishment_logo: null,
    establishment_category: null,
    event_id: null,
    event_title: null,
    event_banner: null,
    event_lineup: null,
    event_date: null,
    event_location: null,
    event_organizer_name: null,
    event_organizer_logo: null,
    total_confirmed: null,
    title: null,
    content: 'Ótimo lugar!',
    image_urls: ['https://example.com/img.jpg'],
    tags: [],
    total_likes: 5,
    total_comments: 2,
    is_sponsored: false,
    is_deleted: false,
    updated_at: null,
    ...overrides,
  };
}

describe('feed-service — HTTP Integration', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let authHeader: string;

  beforeAll(async () => {
    app = await buildServer();
    authHeader = makeAuthHeader(app, USER_ID);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    vi.resetAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
  });

  describe('GET /feed/:userId', () => {
    it('retorna feed com items quando há conteúdo', async () => {
      const rows = [makeFeedRow()];
      mockExecute.mockResolvedValueOnce({ rows });

      const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeader } });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('items');
      expect(body.items).toHaveLength(1);
      expect(body).toHaveProperty('nextCursor');
    });

    it('retorna feed vazio quando não há conteúdo', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeader } });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it('suporta paginação com limit', async () => {
      const rows = [makeFeedRow()];
      mockExecute.mockResolvedValueOnce({ rows });

      const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}?limit=5`, headers: { authorization: authHeader } });

      expect(res.statusCode).toBe(200);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([USER_ID, 5]),
        expect.anything()
      );
    });

    it('retorna 400 para limit inválido', async () => {
      const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}?limit=0`, headers: { authorization: authHeader } });
      expect(res.statusCode).toBe(400);
    });

    it('retorna 400 para limit acima do máximo', async () => {
      const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}?limit=100`, headers: { authorization: authHeader } });
      expect(res.statusCode).toBe(400);
    });

    it('suporta cursor para paginação por data', async () => {
      const cursorDate = '2024-01-15T12:00:00.000Z';
      const rows = [makeFeedRow({ created_at: new Date('2024-01-14T00:00:00.000Z') })];
      mockExecute.mockResolvedValueOnce({ rows });

      const res = await app.inject({
        method: 'GET',
        url: `/feed/${USER_ID}?cursor=${encodeURIComponent(cursorDate)}`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(200);
    });

    it('retorna 400 para cursor com data inválida', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/feed/${USER_ID}?cursor=not-a-date`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(400);
    });

    it('retorna nextCursor com o created_at do último item', async () => {
      const lastDate = new Date('2024-01-10T08:00:00.000Z');
      const rows = [
        makeFeedRow({ created_at: new Date('2024-01-15T12:00:00.000Z') }),
        makeFeedRow({ created_at: lastDate }),
      ];
      mockExecute.mockResolvedValueOnce({ rows });

      const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeader } });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.nextCursor).not.toBeNull();
    });

    it('devolve o nextCursor como data ISO em texto no caminho cronológico', async () => {
      const lastDate = new Date('2024-01-10T08:00:00.000Z');
      mockExecute.mockResolvedValueOnce({ rows: [makeFeedRow({ created_at: lastDate })] });

      const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeader } });

      expect(JSON.parse(res.payload).nextCursor).toBe('2024-01-10T08:00:00.000Z');
    });

    it('aceita cursor opaco de sessão: o schema da rota não pode exigir formato de data', async () => {
      const token = encodeSessionCursor('7e1f0c8a-1111-4111-8111-aaaaaaaaaaaa', 20);

      const res = await app.inject({
        method: 'GET',
        url: `/feed/${USER_ID}?cursor=${encodeURIComponent(token)}`,
        headers: { authorization: authHeader },
      });

      // Sessão sem linhas (expirada) termina o feed; o que importa é não virar 400.
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ items: [], nextCursor: null });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('feed_session_items'),
        [USER_ID, '7e1f0c8a-1111-4111-8111-aaaaaaaaaaaa', 20, 21],
        expect.anything()
      );
    });

    it('retorna 400 para cursor de sessão corrompido, sem tocar no banco', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/feed/${USER_ID}?cursor=${encodeURIComponent('s1.nao-e-um-token')}`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('retorna 500 quando o banco falha', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValueOnce(new Error('cassandra down'));

      const res = await app.inject({
        method: 'GET',
        url: `/feed/${USER_ID}`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(500);
      consoleError.mockRestore();
    });
  });

  describe('GET /health', () => {
    it('retorna status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ status: 'ok' });
    });
  });
});
