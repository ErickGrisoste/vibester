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
  const hash = vi.fn((p: string) => `hashed-${p}`);
  return { default: { hash }, hash };
});

import { RegisterService, hasMinimumAge } from '../../src/services/register.service';
import { mockAccess } from '../mocks/prisma.client';

const baseInput = { username: 'newuser', email: 'new@example.com', password: 'secret', name: 'New', bornAt: new Date('1990-01-01') };

describe('hasMinimumAge', () => {
  const now = new Date('2026-09-14T12:00:00.000Z');

  it('aceita quem faz 18 anos exatamente hoje', () => {
    expect(hasMinimumAge(new Date('2008-09-14'), 18, now)).toBe(true);
  });

  it('recusa quem faz 18 anos amanhã', () => {
    expect(hasMinimumAge(new Date('2008-09-15'), 18, now)).toBe(false);
  });

  it('recusa data futura ou inválida', () => {
    expect(hasMinimumAge(new Date('2030-01-01'), 18, now)).toBe(false);
    expect(hasMinimumAge(new Date('not-a-date'), 18, now)).toBe(false);
  });
});

describe('RegisterService — idade mínima', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recusa menor de 18 anos com 400 sem consultar o banco', async () => {
    const service = new RegisterService();
    const bornAt = new Date();
    bornAt.setUTCFullYear(bornAt.getUTCFullYear() - 17);

    const err: any = await service.register({ ...baseInput, bornAt } as any).catch(e => e);

    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(400);
    expect(err.reason).toBe('underage');
    expect(mockAccess.findFirst).not.toHaveBeenCalled();
  });
});

describe('RegisterService', () => {
  let service: RegisterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RegisterService();
  });

  it('should initiate verification and return void when input is unique', async () => {
    mockAccess.findFirst.mockResolvedValueOnce(null);

    await expect(service.register(baseInput as any)).resolves.toBeUndefined();

    expect(mockAccess.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );
  });

  it('should throw AppError 409 when email or username already exists', async () => {
    mockAccess.findFirst.mockResolvedValueOnce({ id: 'existing-id' });

    const err: any = await service.register(baseInput as any).catch(e => e);

    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('Email ou username já está em uso');
  });
});
