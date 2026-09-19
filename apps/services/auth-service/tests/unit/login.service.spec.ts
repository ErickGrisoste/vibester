import { vi } from 'vitest';

vi.mock('../../src/prisma/index', async () => ({
  default: (await import('../mocks/prisma.client')).default,
}));

vi.mock('bcryptjs', () => {
  const compare = vi.fn();
  return { default: { compare }, compare };
});

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(() => 'token') },
}));

import { LoginService } from '../../src/services/login.service';
import { mockAccess } from '../mocks/prisma.client';
import bcrypt from 'bcryptjs';
import { makeUser } from '../factories/user.factory';

describe('LoginService', () => {
  let service: LoginService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoginService();
  });

  it('should login successfully with email', async () => {
    const user = makeUser({ passwordHash: 'hashed' });
    mockAccess.findFirst.mockResolvedValueOnce(user);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const result = await service.login({ email: user.email, password: 'plain' });

    expect(mockAccess.findFirst).toHaveBeenCalled();
    expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'hashed');
    expect(result).toHaveProperty('token');
    expect(result.authId).toBe(user.id);
  });

  it('should pass only defined fields to OR query', async () => {
    mockAccess.findFirst.mockResolvedValueOnce(null);

    await service.login({ email: 'a@b.com', password: 'x' }).catch(() => {});

    const call = mockAccess.findFirst.mock.calls[0][0];
    expect(call.where.OR).toHaveLength(1);
    expect(call.where.OR[0]).toEqual({ email: 'a@b.com' });
  });

  it('should throw AppError 401 when user not found', async () => {
    mockAccess.findFirst.mockResolvedValueOnce(null);

    const err: any = await service.login({ email: 'no@user.com', password: 'x' }).catch(e => e);

    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Usuário ou senha inválidos');
  });

  it('should throw AppError 401 when password invalid', async () => {
    const user = makeUser({ passwordHash: 'hashed' });
    mockAccess.findFirst.mockResolvedValueOnce(user);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    const err: any = await service.login({ email: user.email, password: 'wrong' }).catch(e => e);

    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(401);
  });
  // Regressao: o cadastro grava o username prefixado com "@" (ex.: "@joaosilva"),
  // mas o usuario digita a forma sem "@" na tela de login. Consultar so o texto
  // cru fazia todo login por username falhar com credenciais corretas.
  it('should match username stored with "@" when the user types it without', async () => {
    mockAccess.findFirst.mockResolvedValueOnce(null);

    await service.login({ username: 'joaosilva', password: 'x' }).catch(() => {});

    const call = mockAccess.findFirst.mock.calls[0][0];
    expect(call.where.OR).toHaveLength(1);
    expect(call.where.OR[0].username.in).toEqual(
      expect.arrayContaining(['joaosilva', '@joaosilva']),
    );
  });

  it('should match username stored without "@" when the user types it with', async () => {
    mockAccess.findFirst.mockResolvedValueOnce(null);

    await service.login({ username: '@joaosilva', password: 'x' }).catch(() => {});

    const call = mockAccess.findFirst.mock.calls[0][0];
    expect(call.where.OR[0].username.in).toEqual(
      expect.arrayContaining(['joaosilva', '@joaosilva']),
    );
  });

  it('should not build a username clause when only "@" was typed', async () => {
    mockAccess.findFirst.mockResolvedValueOnce(null);

    await service.login({ username: '@', password: 'x' }).catch(() => {});

    const call = mockAccess.findFirst.mock.calls[0][0];
    expect(call.where.OR).toHaveLength(0);
  });
});
