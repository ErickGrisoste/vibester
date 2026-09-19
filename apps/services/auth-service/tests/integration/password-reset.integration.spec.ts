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

import { buildServer } from '../helpers/fastify.test.helper';
import { redisMock } from '../mocks/redis';
import { producerMock } from '../mocks/kafka.producer';
import { FORGOT_PASSWORD_MESSAGE } from '../../src/controllers/password-reset.controller';

describe('Password reset routes', () => {
  let app: any;

  beforeAll(async () => { app = await buildServer(); });
  afterAll(async () => app.close());
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.ttl.mockResolvedValue(-2);
  });

  it('POST /password/forgot responde 202 igual para email sem conta', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(null);

    const res = await app.inject({ method: 'POST', url: '/password/forgot', payload: { email: 'ninguem@example.com' } });

    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.payload).message).toBe(FORGOT_PASSWORD_MESSAGE);
    expect(producerMock.send).not.toHaveBeenCalled();
  });

  it('POST /password/forgot envia o código quando há conta', async () => {
    mockAccess.findUnique.mockResolvedValueOnce({ accountId: 'acc', email: 'joao@example.com', username: '@joao' });

    const res = await app.inject({ method: 'POST', url: '/password/forgot', payload: { email: 'joao@example.com' } });

    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.payload).message).toBe(FORGOT_PASSWORD_MESSAGE);
    expect(producerMock.send).toHaveBeenCalledWith(expect.objectContaining({ topic: 'auth.password.reset' }));
  });

  it('POST /password/forgot 400 com email inválido', async () => {
    const res = await app.inject({ method: 'POST', url: '/password/forgot', payload: { email: 'nao-e-email' } });
    expect(res.statusCode).toBe(400);
  });

  it('POST /password/reset 400 com senha curta', async () => {
    const res = await app.inject({
      method: 'POST', url: '/password/reset',
      payload: { email: 'joao@example.com', code: '123456', password: '123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /password/reset 404 sem código pendente', async () => {
    redisMock.get.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST', url: '/password/reset',
      payload: { email: 'joao@example.com', code: '123456', password: 'novaSenha123' },
    });

    expect(res.statusCode).toBe(404);
  });
});
