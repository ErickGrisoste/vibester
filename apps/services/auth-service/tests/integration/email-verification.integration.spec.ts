import { vi } from 'vitest';
import prismaMock, { mockAccess } from '../mocks/prisma.client';

vi.mock('../../src/prisma', () => ({ default: prismaMock }));

vi.mock('../../src/config/redis', async () => ({
  redis: (await import('../mocks/redis')).redisMock,
}));

vi.mock('../../src/kafka/producer', async () => ({
  producer: (await import('../mocks/kafka.producer')).producerMock,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { buildServer } from '../helpers/fastify.test.helper';
import { redisMock } from '../mocks/redis';

const pendingData = {
  username: 'u',
  name: 'n',
  email: 'u@example.com',
  passwordHash: 'hashed-secret',
  bornAt: new Date('1990-01-01').toISOString(),
  code: '482931',
};

const baseAccount = {
  id: 'auth-1',
  accountId: 'acc-1',
  username: 'u',
  email: 'u@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Email verification integration', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ accountId: 'acc-1' }),
    });
  });

  it('POST /verify-email returns 201 with account data on valid code', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
    mockAccess.create.mockResolvedValueOnce(baseAccount);

    const res = await app.inject({
      method: 'POST',
      url: '/verify-email',
      payload: { email: 'u@example.com', code: '482931' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('authId', 'auth-1');
    expect(body).toHaveProperty('accountId', 'acc-1');
    expect(body).toHaveProperty('username', 'u');
  });

  it('POST /verify-email returns 404 when no pending registration exists', async () => {
    redisMock.get.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/verify-email',
      payload: { email: 'u@example.com', code: '482931' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /verify-email returns 422 when code is wrong', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));

    const res = await app.inject({
      method: 'POST',
      url: '/verify-email',
      payload: { email: 'u@example.com', code: '000000' },
    });

    expect(res.statusCode).toBe(422);
  });

  it('POST /verify-email returns 502 and rolls back account when user-service fails', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
    mockAccess.create.mockResolvedValueOnce(baseAccount);
    mockAccess.delete.mockResolvedValueOnce(undefined);
    mockFetch.mockResolvedValueOnce({ ok: false });

    const res = await app.inject({
      method: 'POST',
      url: '/verify-email',
      payload: { email: 'u@example.com', code: '482931' },
    });

    expect(res.statusCode).toBe(502);
    expect(mockAccess.delete).toHaveBeenCalledWith({ where: { id: 'auth-1' } });
  });

  it('POST /verify-email returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/verify-email',
      payload: { email: 'u@example.com' },
    });

    expect(res.statusCode).toBe(400);
  });
  it('POST /verify-email returns 429 and discards the pending registration after too many wrong codes', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ ...pendingData, attempts: 4 }));

    const res = await app.inject({
      method: 'POST',
      url: '/verify-email',
      payload: { email: 'u@example.com', code: '000000' },
    });

    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.payload).error).toBe('Muitas tentativas inválidas. Solicite um novo código.');
    expect(redisMock.del).toHaveBeenCalledWith('pending:reg:u@example.com');
  });

  it('POST /verify-email keeps the pending registration alive below the attempt limit', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
    redisMock.ttl.mockResolvedValueOnce(300);

    const res = await app.inject({
      method: 'POST',
      url: '/verify-email',
      payload: { email: 'u@example.com', code: '000000' },
    });

    expect(res.statusCode).toBe(422);
    expect(redisMock.del).not.toHaveBeenCalled();
  });
});
