import { vi } from 'vitest';
import prismaMock, { mockAccess } from '../mocks/prisma.client';

vi.mock('../../src/prisma', () => ({ default: prismaMock }));

vi.mock('bcryptjs', () => {
  const compare = vi.fn();
  return { default: { compare }, compare };
});

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(() => 'signed-token') },
}));

import { buildServer } from '../helpers/fastify.test.helper';
import bcrypt from 'bcryptjs';
import { makeUser } from '../factories/user.factory';

describe('Login integration', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => app.close());

  beforeEach(() => vi.clearAllMocks());

  it('POST /login success returns 200 and token', async () => {
    const user = makeUser({ passwordHash: 'hashed' });
    mockAccess.findFirst.mockResolvedValueOnce(user);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const res = await app.inject({ method: 'POST', url: '/login', payload: { email: user.email, password: 'secretpw' } });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).not.toHaveProperty('token');
    expect(body.authId).toBe(user.id);
  });

  it('POST /login invalid password returns 401', async () => {
    const user = makeUser({ passwordHash: 'hashed' });
    mockAccess.findFirst.mockResolvedValueOnce(user);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    const res = await app.inject({ method: 'POST', url: '/login', payload: { email: user.email, password: 'wrongpw' } });

    expect(res.statusCode).toBe(401);
  });

  it('POST /login missing email and username returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/login', payload: { password: 'password123' } });

    expect(res.statusCode).toBe(400);
  });
});
