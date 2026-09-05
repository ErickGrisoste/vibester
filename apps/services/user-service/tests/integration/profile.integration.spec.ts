import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('../../src/config/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redisMock = new RedisMock();

  const isoDateRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  const dateReviver = (_k: string, v: unknown) =>
    typeof v === 'string' && isoDateRe.test(v) ? new Date(v) : v;

  return {
    redis: redisMock,
    cacheAside: async <T>(key: string, ttl: number, fetchFn: () => Promise<T>): Promise<T> => {
      try {
        const cached = await redisMock.get(key);
        if (cached !== null) return JSON.parse(cached, dateReviver) as T;
      } catch {}
      const data = await fetchFn();
      try {
        await redisMock.set(key, JSON.stringify(data), 'EX', ttl);
      } catch {}
      return data;
    },
  };
});

const { mockUserProfile, mockUserFollow, mockTransaction, mockQueryRaw } = vi.hoisted(() => {
  const mockUserProfile = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  };
  const mockUserFollow = {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  };
  const mockTransaction = vi.fn().mockImplementation((arg: ((...args: unknown[]) => unknown) | Promise<unknown>[]) => {
    if (typeof arg === 'function') {
      return arg({ userProfile: mockUserProfile, userFollow: mockUserFollow });
    }
    return Promise.all(arg);
  });
  const mockQueryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
  return { mockUserProfile, mockUserFollow, mockTransaction, mockQueryRaw };
});

vi.mock('../../src/prisma/index', () => ({
  default: {
    userProfile: mockUserProfile,
    userFollow: mockUserFollow,
    $transaction: mockTransaction,
    $queryRaw: mockQueryRaw,
  },
}));

const { mockProducerSend } = vi.hoisted(() => ({ mockProducerSend: vi.fn() }));
vi.mock('../../src/kafka/producer', () => ({
  producer: { connect: vi.fn(), disconnect: vi.fn(), send: mockProducerSend },
}));

import { buildServer } from '../helpers/fastify.test.helper';
import { redis } from '../../src/config/redis';

const USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const PROFILE_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const FOLLOWER_ID = 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const NOT_FOUND_ID = 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    userID: USER_ID,
    name: null,
    username: null,
    avatarUrl: null,
    bio: null,
    followers: 0,
    following: 0,
    totalPosts: 0,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('user-service — HTTP Integration', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => { app = await buildServer(); });
  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation((arg: ((...args: unknown[]) => unknown) | Promise<unknown>[]) => {
      if (typeof arg === 'function') {
        return arg({ userProfile: mockUserProfile, userFollow: mockUserFollow });
      }
      return Promise.all(arg);
    });
    await redis.flushall();
  });

  describe('GET /health', () => {
    it('retorna 200 com status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ status: 'ok' });
    });
  });

  describe('GET /ready', () => {
    it('retorna 200 quando db e cache estão saudáveis', async () => {
      const res = await app.inject({ method: 'GET', url: '/ready' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ status: 'ok', db: true, cache: true });
    });

    it('retorna 503 quando o banco está indisponível', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));

      const res = await app.inject({ method: 'GET', url: '/ready' });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ status: 'degraded', db: false, cache: true });
    });

    it('retorna 503 quando o cache está indisponível', async () => {
      const pingSpy = vi.spyOn(redis, 'ping').mockRejectedValueOnce(new Error('connection refused'));

      const res = await app.inject({ method: 'GET', url: '/ready' });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ status: 'degraded', db: true, cache: false });

      pingSpy.mockRestore();
    });

    it('retorna 503 quando db e cache estão indisponíveis', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));
      const pingSpy = vi.spyOn(redis, 'ping').mockRejectedValueOnce(new Error('connection refused'));

      const res = await app.inject({ method: 'GET', url: '/ready' });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ status: 'degraded', db: false, cache: false });

      pingSpy.mockRestore();
    });
  });

  describe('POST /users/profile', () => {
    it('cria perfil e retorna 201 com accountId', async () => {
      mockUserProfile.create.mockResolvedValue(makeProfile());

      const res = await app.inject({
        method: 'POST',
        url: '/users/profile',
        payload: { accountId: USER_ID },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('accountId', USER_ID);
      expect(mockUserProfile.create).toHaveBeenCalledWith({ data: { userID: USER_ID } });
    });
  });

  describe('GET /users/profile/:accountId — Redis cache-aside', () => {
    it('retorna 200 no cache miss e consulta o banco', async () => {
      mockUserProfile.findUnique.mockResolvedValue(makeProfile());

      const res = await app.inject({ method: 'GET', url: `/users/profile/${USER_ID}` });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveProperty('accountId', USER_ID);
      expect(mockUserProfile.findUnique).toHaveBeenCalledTimes(1);
    });

    it('retorna 200 no cache hit sem consultar o banco', async () => {
      mockUserProfile.findUnique.mockResolvedValue(makeProfile());

      await app.inject({ method: 'GET', url: `/users/profile/${USER_ID}` });
      const res = await app.inject({ method: 'GET', url: `/users/profile/${USER_ID}` });

      expect(res.statusCode).toBe(200);
      expect(mockUserProfile.findUnique).toHaveBeenCalledTimes(1);
    });

    it('retorna 404 quando perfil não existe', async () => {
      mockUserProfile.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/users/profile/${NOT_FOUND_ID}`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /users/share', () => {
    it('retorna 201 com token, shareUrl e expiresAt, e incrementa shareCount', async () => {
      mockUserProfile.update.mockResolvedValue(makeProfile({ shareCount: 1 }));

      const res = await app.inject({
        method: 'POST',
        url: '/users/share',
        payload: { accountId: USER_ID },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('shareUrl');
      expect(body.shareUrl).toContain(body.token);
      expect(mockUserProfile.update).toHaveBeenCalledWith({
        where: { userID: USER_ID },
        data: { shareCount: { increment: 1 } },
      });

      const stored = await redis.get(`share:token:${body.token}`);
      expect(stored).toBe(USER_ID);
    });

    it('retorna 500 quando o perfil não existe', async () => {
      mockUserProfile.update.mockRejectedValue(new Error('Record to update not found.'));

      const res = await app.inject({
        method: 'POST',
        url: '/users/share',
        payload: { accountId: NOT_FOUND_ID },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe('GET /users/share/:token', () => {
    const SHARE_TOKEN = 'e1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

    it('retorna 200 com o perfil quando o token é válido', async () => {
      await redis.set(`share:token:${SHARE_TOKEN}`, USER_ID, 'EX', 86400);
      mockUserProfile.findUnique.mockResolvedValue(makeProfile());

      const res = await app.inject({ method: 'GET', url: `/users/share/${SHARE_TOKEN}` });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveProperty('accountId', USER_ID);
    });

    it('retorna 404 quando o token não existe/expirou', async () => {
      const res = await app.inject({ method: 'GET', url: `/users/share/${SHARE_TOKEN}` });
      expect(res.statusCode).toBe(404);
    });

    it('não conflita com a rota /users/profile/:accountId', async () => {
      mockUserProfile.findUnique.mockResolvedValue(makeProfile());
      const res = await app.inject({ method: 'GET', url: `/users/profile/${USER_ID}` });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PUT /users/profile/info', () => {
    it('atualiza nome e username e retorna 200', async () => {
      mockUserProfile.update.mockResolvedValue(
        makeProfile({ name: 'Novo Nome', username: 'novo_username' })
      );

      const res = await app.inject({
        method: 'PUT',
        url: '/users/profile/info',
        payload: { accountId: USER_ID, name: 'Novo Nome', username: 'novo_username' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('Novo Nome');
      expect(body.username).toBe('novo_username');
      expect(mockUserProfile.update).toHaveBeenCalledWith({
        where: { userID: USER_ID },
        data: { name: 'Novo Nome', username: 'novo_username' },
      });
    });

    it('retorna 500 quando a atualização falha', async () => {
      mockUserProfile.update.mockRejectedValue(new Error('db error'));

      const res = await app.inject({
        method: 'PUT',
        url: '/users/profile/info',
        payload: { accountId: USER_ID, name: 'Novo Nome', username: 'novo_username' },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe('PUT /users/profile/bio — cache invalidation', () => {
    it('atualiza bio, invalida cache e retorna 200', async () => {
      const original = makeProfile();
      const updated = makeProfile({ bio: 'Nova bio' });

      mockUserProfile.findUnique.mockResolvedValue(original);
      await app.inject({ method: 'GET', url: `/users/profile/${USER_ID}` });
      expect(mockUserProfile.findUnique).toHaveBeenCalledTimes(1);

      mockUserProfile.update.mockResolvedValue(updated);
      const res = await app.inject({
        method: 'PUT',
        url: '/users/profile/bio',
        payload: { accountId: USER_ID, bio: 'Nova bio' },
      });
      expect(res.statusCode).toBe(200);

      mockUserProfile.findUnique.mockResolvedValue(updated);
      await app.inject({ method: 'GET', url: `/users/profile/${USER_ID}` });
      expect(mockUserProfile.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('PUT /users/profile/avatar', () => {
    it('atualiza avatar e retorna 200', async () => {
      const avatarUrl = 'https://example.com/avatar.jpg';
      mockUserProfile.update.mockResolvedValue(makeProfile({ avatarUrl }));

      const res = await app.inject({
        method: 'PUT',
        url: '/users/profile/avatar',
        payload: { accountId: USER_ID, avatarUrl },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).avatarUrl).toBe(avatarUrl);
    });

    it('retorna 500 quando a atualização falha', async () => {
      mockUserProfile.update.mockRejectedValue(new Error('db error'));

      const res = await app.inject({
        method: 'PUT',
        url: '/users/profile/avatar',
        payload: { accountId: USER_ID, avatarUrl: 'https://example.com/avatar.jpg' },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe('POST /users/profile/followers/increase — transação atômica + Kafka', () => {
    it('registra follow em transação, atualiza contadores e emite user.followed', async () => {
      const updatedFollowingProfile = makeProfile({ followers: 1 });
      mockUserFollow.create.mockResolvedValue({});
      mockUserProfile.update
        .mockResolvedValueOnce(updatedFollowingProfile)
        .mockResolvedValueOnce(makeProfile({ userID: FOLLOWER_ID, following: 1 }));

      const res = await app.inject({
        method: 'POST',
        url: '/users/profile/followers/increase',
        payload: { followerId: FOLLOWER_ID, followingId: USER_ID },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).followers).toBe(1);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockProducerSend).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'user.followed',
          messages: expect.arrayContaining([
            expect.objectContaining({
              value: JSON.stringify({ followerId: FOLLOWER_ID, followingId: USER_ID }),
            }),
          ]),
        })
      );
    });

    it('retorna 500 quando a transação falha', async () => {
      mockTransaction.mockRejectedValue(new Error('transaction error'));

      const res = await app.inject({
        method: 'POST',
        url: '/users/profile/followers/increase',
        payload: { followerId: FOLLOWER_ID, followingId: USER_ID },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe('POST /users/profile/followers/decrease — transação atômica', () => {
    it('remove follow em transação, atualiza contadores e retorna 200', async () => {
      const updatedFollowingProfile = makeProfile({ followers: 0 });
      mockUserFollow.delete.mockResolvedValue({});
      mockUserProfile.update
        .mockResolvedValueOnce(updatedFollowingProfile)
        .mockResolvedValueOnce(makeProfile({ userID: FOLLOWER_ID, following: 0 }));

      const res = await app.inject({
        method: 'POST',
        url: '/users/profile/followers/decrease',
        payload: { followerId: FOLLOWER_ID, followingId: USER_ID },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).followers).toBe(0);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('retorna 500 quando a transação falha', async () => {
      mockTransaction.mockRejectedValue(new Error('transaction error'));

      const res = await app.inject({
        method: 'POST',
        url: '/users/profile/followers/decrease',
        payload: { followerId: FOLLOWER_ID, followingId: USER_ID },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe('GET /users/:userID/followers — Redis cache', () => {
    it('retorna seguidores: cache miss chama banco, cache hit não', async () => {
      const followers = [{ followerId: FOLLOWER_ID, createdAt: new Date('2024-01-01T00:00:00.000Z') }];
      mockUserFollow.findMany.mockResolvedValue(followers);

      const res1 = await app.inject({ method: 'GET', url: `/users/${USER_ID}/followers` });
      expect(res1.statusCode).toBe(200);
      expect(JSON.parse(res1.payload)).toHaveLength(1);

      const res2 = await app.inject({ method: 'GET', url: `/users/${USER_ID}/followers` });
      expect(res2.statusCode).toBe(200);
      expect(mockUserFollow.findMany).toHaveBeenCalledTimes(1);
    });

    it('retorna 500 quando a consulta falha', async () => {
      mockUserFollow.findMany.mockRejectedValue(new Error('db error'));

      const res = await app.inject({ method: 'GET', url: `/users/${USER_ID}/followers` });
      expect(res.statusCode).toBe(500);
    });
  });

  describe('GET /users/:userID/following — Redis cache', () => {
    it('retorna seguidos: cache miss chama banco, cache hit não', async () => {
      const following = [{ followingId: USER_ID, createdAt: new Date('2024-01-01T00:00:00.000Z') }];
      mockUserFollow.findMany.mockResolvedValue(following);

      const res = await app.inject({ method: 'GET', url: `/users/${FOLLOWER_ID}/following` });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(1);

      await app.inject({ method: 'GET', url: `/users/${FOLLOWER_ID}/following` });
      expect(mockUserFollow.findMany).toHaveBeenCalledTimes(1);
    });

    it('retorna 500 quando a consulta falha', async () => {
      mockUserFollow.findMany.mockRejectedValue(new Error('db error'));

      const res = await app.inject({ method: 'GET', url: `/users/${FOLLOWER_ID}/following` });
      expect(res.statusCode).toBe(500);
    });
  });

  describe('GET /users/:followerId/follows/:followingId — verificar se segue', () => {
    it('retorna isFollowing: true quando o relacionamento existe', async () => {
      mockUserFollow.count.mockResolvedValue(1);

      const res = await app.inject({
        method: 'GET',
        url: `/users/${FOLLOWER_ID}/follows/${USER_ID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ isFollowing: true });
      expect(mockUserFollow.count).toHaveBeenCalledWith({
        where: { followerId: FOLLOWER_ID, followingId: USER_ID },
      });
    });

    it('retorna isFollowing: false quando o relacionamento não existe', async () => {
      mockUserFollow.count.mockResolvedValue(0);

      const res = await app.inject({
        method: 'GET',
        url: `/users/${FOLLOWER_ID}/follows/${USER_ID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ isFollowing: false });
    });

    it('retorna 500 quando a consulta falha', async () => {
      mockUserFollow.count.mockRejectedValue(new Error('db error'));

      const res = await app.inject({
        method: 'GET',
        url: `/users/${FOLLOWER_ID}/follows/${USER_ID}`,
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe('GET /users/search — pesquisa de perfis em tempo real', () => {
    function makeSearchProfile(overrides: Record<string, unknown> = {}) {
      return {
        userID: USER_ID,
        name: 'John Doe',
        username: 'johndoe',
        avatarUrl: null,
        followers: 42,
        ...overrides,
      };
    }

    it('retorna 200 com lista de perfis e metadados de paginação', async () => {
      mockUserProfile.findMany.mockResolvedValue([makeSearchProfile()]);
      mockUserProfile.count.mockResolvedValue(1);

      const res = await app.inject({ method: 'GET', url: '/users/search?q=john' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toMatchObject({
        data: [{ accountId: USER_ID, name: 'John Doe', username: 'johndoe', avatarUrl: null, followers: 42 }],
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('retorna lista vazia quando nenhum perfil corresponde ao termo', async () => {
      mockUserProfile.findMany.mockResolvedValue([]);
      mockUserProfile.count.mockResolvedValue(0);

      const res = await app.inject({ method: 'GET', url: '/users/search?q=zzznobody' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('respeita os parâmetros limit e page', async () => {
      const profiles = [
        makeSearchProfile({ userID: USER_ID, username: 'alice' }),
        makeSearchProfile({ userID: FOLLOWER_ID, username: 'alice2' }),
      ];
      mockUserProfile.findMany.mockResolvedValue(profiles);
      mockUserProfile.count.mockResolvedValue(10);

      const res = await app.inject({ method: 'GET', url: '/users/search?q=alice&limit=2&page=2' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.limit).toBe(2);
      expect(body.page).toBe(2);
      expect(body.total).toBe(10);
      expect(body.data).toHaveLength(2);
    });

    it('retorna 400 quando o parâmetro q está ausente', async () => {
      const res = await app.inject({ method: 'GET', url: '/users/search' });
      expect(res.statusCode).toBe(400);
    });

    it('retorna 400 quando q é uma string vazia', async () => {
      const res = await app.inject({ method: 'GET', url: '/users/search?q=' });
      expect(res.statusCode).toBe(400);
    });

    it('retorna 400 quando limit excede 50', async () => {
      const res = await app.inject({ method: 'GET', url: '/users/search?q=test&limit=51' });
      expect(res.statusCode).toBe(400);
    });

    it('retorna 500 quando o banco falha', async () => {
      mockTransaction.mockRejectedValueOnce(new Error('DB failure'));

      const res = await app.inject({ method: 'GET', url: '/users/search?q=error' });

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.payload)).toEqual({ message: 'Error searching profiles' });
    });
  });
});
