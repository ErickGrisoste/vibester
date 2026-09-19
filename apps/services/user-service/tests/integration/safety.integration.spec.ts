import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('../../src/config/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redisMock = new RedisMock();
  return {
    redis: redisMock,
    cacheAside: async <T>(_key: string, _ttl: number, fetchFn: () => Promise<T>): Promise<T> => fetchFn(),
  };
});

const { mockUserBlock, mockContentReport, mockUserFollow, mockUserProfile, mockTransaction, mockSend } = vi.hoisted(() => {
  const mockUserBlock = {
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const mockContentReport = { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() };
  const mockUserFollow = { create: vi.fn(), delete: vi.fn(), findMany: vi.fn(), count: vi.fn() };
  const mockUserProfile = { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() };
  const mockTransaction = vi.fn();
  const mockSend = vi.fn();
  return { mockUserBlock, mockContentReport, mockUserFollow, mockUserProfile, mockTransaction, mockSend };
});

vi.mock('../../src/prisma/index', () => ({
  default: {
    userBlock: mockUserBlock,
    contentReport: mockContentReport,
    userFollow: mockUserFollow,
    userProfile: mockUserProfile,
    $transaction: mockTransaction,
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../src/kafka/producer', () => ({
  producer: { connect: vi.fn(), disconnect: vi.fn(), send: mockSend },
}));

import { buildServer } from '../helpers/fastify.test.helper';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const POST = '33333333-3333-4333-8333-333333333333';

describe('Safety routes (bloqueio e denúncia)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let auth: { authorization: string };

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    auth = { authorization: `Bearer ${app.jwt.sign({ userId: 'auth-id', accountId: ME })}` };
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserBlock.create.mockResolvedValue({});
    mockUserBlock.deleteMany.mockResolvedValue({ count: 1 });
    mockUserFollow.findMany.mockResolvedValue([]);
    mockSend.mockResolvedValue([]);
  });

  it('401 sem token', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/blocks' });
    expect(res.statusCode).toBe(401);
  });

  it('401 com token de outra chave', async () => {
    const res = await app.inject({
      method: 'POST', url: '/users/blocks', payload: { blockedId: OTHER },
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50SWQiOiJ4In0.assinatura-invalida' },
    });
    expect(res.statusCode).toBe(401);
    expect(mockUserBlock.create).not.toHaveBeenCalled();
  });

  it('POST /users/blocks bloqueia em nome do dono do token', async () => {
    const res = await app.inject({ method: 'POST', url: '/users/blocks', payload: { blockedId: OTHER }, headers: auth });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ blockedId: OTHER, blocked: true });
    expect(mockUserBlock.create).toHaveBeenCalledWith({ data: { blockerId: ME, blockedId: OTHER } });
  });

  it('POST /users/blocks 400 ao bloquear a si mesmo', async () => {
    const res = await app.inject({ method: 'POST', url: '/users/blocks', payload: { blockedId: ME }, headers: auth });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /users/blocks/:blockedId desbloqueia', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/users/blocks/${OTHER}`, headers: auth });

    expect(res.statusCode).toBe(200);
    expect(mockUserBlock.deleteMany).toHaveBeenCalledWith({ where: { blockerId: ME, blockedId: OTHER } });
  });

  it('GET /users/blocks/:accountId/status', async () => {
    mockUserBlock.findMany.mockResolvedValue([{ blockerId: ME }]);

    const res = await app.inject({ method: 'GET', url: `/users/blocks/${OTHER}/status`, headers: auth });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ blocking: true, blockedBy: false });
  });

  it('GET /users/blocks lista os bloqueados', async () => {
    const blockedAt = new Date('2026-09-10T10:00:00.000Z');
    mockUserBlock.findMany.mockResolvedValue([{ blockedId: OTHER, createdAt: blockedAt }]);
    mockUserProfile.findMany.mockResolvedValue([{ userID: OTHER, name: 'Outra', username: '@outra', avatarUrl: null }]);

    const res = await app.inject({ method: 'GET', url: '/users/blocks?limit=10', headers: auth });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      data: [{ accountId: OTHER, name: 'Outra', username: '@outra', avatarUrl: null, blockedAt: blockedAt.toISOString() }],
      nextCursor: null,
    });
  });

  it('POST /users/reports 400 em publicação sem targetOwnerId', async () => {
    const res = await app.inject({
      method: 'POST', url: '/users/reports', headers: auth,
      payload: { targetType: 'POST', targetId: POST, reason: 'SPAM' },
    });
    expect(res.statusCode).toBe(400);
    expect(mockContentReport.create).not.toHaveBeenCalled();
  });

  it('POST /users/reports 400 com motivo desconhecido', async () => {
    const res = await app.inject({
      method: 'POST', url: '/users/reports', headers: auth,
      payload: { targetType: 'USER', targetId: OTHER, reason: 'NAO_EXISTE' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /users/reports registra a denúncia e publica content.reported', async () => {
    mockContentReport.create.mockResolvedValue({ id: 'rep-1', createdAt: new Date('2026-09-14T12:00:00.000Z') });

    const res = await app.inject({
      method: 'POST', url: '/users/reports', headers: auth,
      payload: { targetType: 'POST', targetId: POST, targetOwnerId: OTHER, reason: 'HATE', details: 'ofensivo' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: 'rep-1', created: true });
    expect(mockContentReport.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reporterId: ME, targetOwnerId: OTHER }),
    }));
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ topic: 'content.reported' }));
  });

  it('POST /users/profile/followers/increase 403 quando há bloqueio', async () => {
    mockUserBlock.count.mockResolvedValue(1);

    const res = await app.inject({
      method: 'POST', url: '/users/profile/followers/increase',
      payload: { followerId: ME, followingId: OTHER },
    });

    expect(res.statusCode).toBe(403);
    expect(mockUserFollow.create).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
