import { vi } from 'vitest';
import prismaMock, { mockAccess, mockSession } from '../mocks/prisma.client';

vi.mock('../../src/prisma', () => ({ default: prismaMock }));
vi.mock('../../src/prisma/index', () => ({ default: prismaMock }));

vi.mock('../../src/config/redis', async () => ({
  redis: (await import('../mocks/redis')).redisMock,
}));

vi.mock('../../src/kafka/producer', async () => ({
  producer: (await import('../mocks/kafka.producer')).producerMock,
}));

vi.mock('bcryptjs', () => {
  const compare = vi.fn();
  return { default: { compare }, compare };
});

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(() => 'signed-token') },
}));

import bcrypt from 'bcryptjs';
import { buildServer } from '../helpers/fastify.test.helper';
import { makeUser } from '../factories/user.factory';
import { hashRefreshToken } from '../../src/services/session.service';

describe('Session integration', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.updateMany.mockResolvedValue({ count: 1 });
  });

  it('POST /login abre uma sessão e devolve access + refresh token', async () => {
    const user = makeUser();
    mockAccess.findFirst.mockResolvedValueOnce(user);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const res = await app.inject({
      method: 'POST',
      url: '/login',
      headers: { 'user-agent': 'VibesterApp/1.0' },
      payload: { email: user.email, password: 'secretpw' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toMatchObject({ accessToken: 'signed-token', expiresIn: 900 });
    expect(typeof body.refreshToken).toBe('string');
    expect(mockSession.create.mock.calls[0][0].data.tokenHash).toBe(hashRefreshToken(body.refreshToken));
  });

  it('POST /refresh devolve um par novo', async () => {
    mockSession.findFirst.mockResolvedValueOnce({
      id: 'session-id',
      tokenHash: hashRefreshToken('current'),
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      access: { id: 'auth-id', accountId: 'acc-id', suspendedAt: null },
    });

    const res = await app.inject({ method: 'POST', url: '/refresh', payload: { refreshToken: 'current' } });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.accessToken).toBe('signed-token');
    expect(body.refreshToken).not.toBe('current');
    expect(body.expiresIn).toBe(900);
  });

  it('POST /refresh com token desconhecido responde 401', async () => {
    mockSession.findFirst.mockResolvedValueOnce(null);

    const res = await app.inject({ method: 'POST', url: '/refresh', payload: { refreshToken: 'nope' } });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload)).toEqual({ error: 'Sessão inválida ou expirada' });
  });

  it('POST /refresh sem refreshToken responde 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/refresh', payload: {} });

    expect(res.statusCode).toBe(400);
  });

  it('POST /logout responde 204 e apaga a sessão', async () => {
    const res = await app.inject({ method: 'POST', url: '/logout', payload: { refreshToken: 'current' } });

    expect(res.statusCode).toBe(204);
    expect(mockSession.deleteMany).toHaveBeenCalled();
  });
});
