import { vi } from 'vitest';
import prismaMock, { mockAccess } from '../mocks/prisma.client';

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
  const hash = vi.fn(async (p: string) => `hashed-${p}`);
  return { default: { compare, hash }, compare, hash };
});

import jwt from 'jsonwebtoken';
import { compare } from 'bcryptjs';
import { buildServer } from '../helpers/fastify.test.helper';
import { producerMock } from '../mocks/kafka.producer';
import { makeUser } from '../factories/user.factory';

const ACCOUNT_ID = '5f0c1a1e-9d8b-4c1a-8e2f-1b2c3d4e5f60';
const tokenFor = (accountId: string, secret = 'test-secret') =>
  jwt.sign({ userId: 'auth-id', accountId }, secret, { expiresIn: '1h' });

describe('DELETE /account', () => {
  let app: any;

  beforeAll(async () => { app = await buildServer(); });
  afterAll(async () => app.close());
  beforeEach(() => vi.clearAllMocks());

  it('401 sem token', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/account', payload: { password: 'x' } });
    expect(res.statusCode).toBe(401);
    expect(mockAccess.findUnique).not.toHaveBeenCalled();
  });

  it('401 com token assinado por outra chave', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/account', payload: { password: 'x' },
      headers: { authorization: `Bearer ${tokenFor(ACCOUNT_ID, 'outra-chave')}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('400 sem senha no corpo', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/account', payload: {},
      headers: { authorization: `Bearer ${tokenFor(ACCOUNT_ID)}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 com senha errada', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(makeUser({ accountId: ACCOUNT_ID }));
    vi.mocked(compare).mockResolvedValueOnce(false as never);

    const res = await app.inject({
      method: 'DELETE', url: '/account', payload: { password: 'errada' },
      headers: { authorization: `Bearer ${tokenFor(ACCOUNT_ID)}` },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe('Senha incorreta');
  });

  it('204 usa o accountId do token e publica user.deleted', async () => {
    const user = makeUser({ accountId: ACCOUNT_ID });
    mockAccess.findUnique.mockResolvedValueOnce(user);
    mockAccess.delete.mockResolvedValueOnce(user);
    vi.mocked(compare).mockResolvedValueOnce(true as never);

    const res = await app.inject({
      method: 'DELETE', url: '/account', payload: { password: 'certa' },
      headers: { authorization: `Bearer ${tokenFor(ACCOUNT_ID)}` },
    });

    expect(res.statusCode).toBe(204);
    expect(mockAccess.findUnique).toHaveBeenCalledWith({ where: { accountId: ACCOUNT_ID } });
    expect(producerMock.send).toHaveBeenCalledWith(expect.objectContaining({ topic: 'user.deleted' }));
  });
});

describe('POST /admin/accounts/:accountId/(un)suspend', () => {
  let app: any;

  beforeAll(async () => { app = await buildServer(); });
  afterAll(async () => app.close());
  beforeEach(() => vi.clearAllMocks());

  it('401 sem a chave de administração', async () => {
    const res = await app.inject({ method: 'POST', url: `/admin/accounts/${ACCOUNT_ID}/suspend` });
    expect(res.statusCode).toBe(401);
    expect(mockAccess.update).not.toHaveBeenCalled();
  });

  it('401 com chave errada', async () => {
    const res = await app.inject({
      method: 'POST', url: `/admin/accounts/${ACCOUNT_ID}/suspend`,
      headers: { 'x-admin-key': 'errada' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('204 suspende com a chave certa', async () => {
    mockAccess.update.mockResolvedValueOnce({});

    const res = await app.inject({
      method: 'POST', url: `/admin/accounts/${ACCOUNT_ID}/suspend`,
      headers: { 'x-admin-key': 'test-admin-key' },
    });

    expect(res.statusCode).toBe(204);
    expect(mockAccess.update).toHaveBeenCalledWith({
      where: { accountId: ACCOUNT_ID },
      data: { suspendedAt: expect.any(Date) },
    });
  });

  it('204 reativa limpando suspendedAt', async () => {
    mockAccess.update.mockResolvedValueOnce({});

    const res = await app.inject({
      method: 'POST', url: `/admin/accounts/${ACCOUNT_ID}/unsuspend`,
      headers: { 'x-admin-key': 'test-admin-key' },
    });

    expect(res.statusCode).toBe(204);
    expect(mockAccess.update).toHaveBeenCalledWith({ where: { accountId: ACCOUNT_ID }, data: { suspendedAt: null } });
  });

  it('404 quando a conta não existe', async () => {
    mockAccess.update.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'P2025' }));

    const res = await app.inject({
      method: 'POST', url: `/admin/accounts/${ACCOUNT_ID}/suspend`,
      headers: { 'x-admin-key': 'test-admin-key' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('400 com accountId que não é uuid', async () => {
    const res = await app.inject({
      method: 'POST', url: '/admin/accounts/nao-e-uuid/suspend',
      headers: { 'x-admin-key': 'test-admin-key' },
    });
    expect(res.statusCode).toBe(400);
  });
});
