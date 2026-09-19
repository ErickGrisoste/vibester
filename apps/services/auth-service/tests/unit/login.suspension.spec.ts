import { vi } from 'vitest';

vi.mock('../../src/prisma/index', async () => ({
  default: (await import('../mocks/prisma.client')).default,
}));

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
  default: { sign: vi.fn(() => 'token') },
}));

import bcrypt from 'bcryptjs';
import { LoginService } from '../../src/services/login.service';
import { mockAccess } from '../mocks/prisma.client';
import { makeUser } from '../factories/user.factory';

describe('LoginService — conta suspensa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recusa com 403 quando a senha confere mas a conta está suspensa', async () => {
    mockAccess.findFirst.mockResolvedValueOnce({ ...makeUser(), suspendedAt: new Date() });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const err: any = await new LoginService().login({ email: 'john@example.com', password: 'certa' }).catch(e => e);

    expect(err.statusCode).toBe(403);
    expect(err.reason).toBe('account_suspended');
  });

  it('continua respondendo 401 genérico com senha errada, sem revelar a suspensão', async () => {
    mockAccess.findFirst.mockResolvedValueOnce({ ...makeUser(), suspendedAt: new Date() });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    const err: any = await new LoginService().login({ email: 'john@example.com', password: 'errada' }).catch(e => e);

    expect(err.statusCode).toBe(401);
  });
});
