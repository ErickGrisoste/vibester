import { vi } from 'vitest';
import { createHmac } from 'node:crypto';

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
  const hash = vi.fn(async (p: string) => `hashed-${p}`);
  return { default: { hash }, hash };
});

import { PasswordResetService, PASSWORD_RESET_TOPIC } from '../../src/services/password-reset.service';
import { mockAccess } from '../mocks/prisma.client';
import { redisMock } from '../mocks/redis';
import { producerMock } from '../mocks/kafka.producer';

const hmac = (code: string) => createHmac('sha256', 'test-code-secret').update(code).digest('hex');

const ACCOUNT = { accountId: '5f0c1a1e-9d8b-4c1a-8e2f-1b2c3d4e5f60', email: 'joao@example.com', username: '@joao' };

describe('PasswordResetService.request', () => {
  let service: PasswordResetService;

  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.ttl.mockResolvedValue(-2);
    service = new PasswordResetService();
  });

  it('não faz nada quando não existe conta com o email', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(null);

    await expect(service.request('ninguem@example.com')).resolves.toBeUndefined();

    expect(redisMock.set).not.toHaveBeenCalled();
    expect(producerMock.send).not.toHaveBeenCalled();
  });

  it('guarda só o HMAC do código e publica o email com o código', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(ACCOUNT);

    await service.request('  joao@example.com ');

    expect(mockAccess.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'joao@example.com' } }));

    const [topicCall] = producerMock.send.mock.calls;
    const record = topicCall[0];
    expect(record.topic).toBe(PASSWORD_RESET_TOPIC);
    const payload = JSON.parse(record.messages[0].value);
    expect(payload).toMatchObject({ email: ACCOUNT.email, name: 'joao', expiresInMinutes: 10 });
    expect(payload.code).toMatch(/^\d{6}$/);

    expect(redisMock.set).toHaveBeenCalledWith(`pwreset:${ACCOUNT.email}`, expect.any(String), 600);
    const stored = JSON.parse(redisMock.set.mock.calls[0][1]);
    expect(stored).toEqual({ accountId: ACCOUNT.accountId, codeHash: hmac(payload.code) });
    expect(JSON.stringify(stored)).not.toContain(payload.code);
  });

  it('não reenvia dentro do cooldown de 60s', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(ACCOUNT);
    redisMock.ttl.mockResolvedValueOnce(590);

    await service.request(ACCOUNT.email);

    expect(redisMock.set).not.toHaveBeenCalled();
    expect(producerMock.send).not.toHaveBeenCalled();
  });
});

describe('PasswordResetService.reset', () => {
  let service: PasswordResetService;

  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.ttl.mockResolvedValue(300);
    service = new PasswordResetService();
  });

  it('404 quando não há código pendente', async () => {
    redisMock.get.mockResolvedValueOnce(null);

    const err: any = await service.reset(ACCOUNT.email, '123456', 'novaSenha123').catch(e => e);

    expect(err.statusCode).toBe(404);
    expect(mockAccess.update).not.toHaveBeenCalled();
  });

  it('422 e conta a tentativa quando o código está errado', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ accountId: ACCOUNT.accountId, codeHash: hmac('111111') }));

    const err: any = await service.reset(ACCOUNT.email, '222222', 'novaSenha123').catch(e => e);

    expect(err.statusCode).toBe(422);
    expect(redisMock.set).toHaveBeenCalledWith(`pwreset:${ACCOUNT.email}`, expect.stringContaining('"attempts":1'), 300);
    expect(mockAccess.update).not.toHaveBeenCalled();
  });

  it('429 e descarta a pendência no limite de tentativas', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ accountId: ACCOUNT.accountId, codeHash: hmac('111111'), attempts: 4 }));

    const err: any = await service.reset(ACCOUNT.email, '222222', 'novaSenha123').catch(e => e);

    expect(err.statusCode).toBe(429);
    expect(redisMock.del).toHaveBeenCalledWith(`pwreset:${ACCOUNT.email}`);
  });

  it('troca o hash da senha e consome o código quando ele confere', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ accountId: ACCOUNT.accountId, codeHash: hmac('654321') }));
    mockAccess.update.mockResolvedValueOnce({});

    await service.reset(ACCOUNT.email, '654321', 'novaSenha123');

    expect(mockAccess.update).toHaveBeenCalledWith({
      where: { accountId: ACCOUNT.accountId },
      data: { passwordHash: 'hashed-novaSenha123' },
    });
    expect(redisMock.del).toHaveBeenCalledWith(`pwreset:${ACCOUNT.email}`);
    expect(redisMock.del).toHaveBeenCalledWith(`auth:fail:login:${ACCOUNT.email}`);
  });

  it('404 quando a conta foi excluída depois do pedido', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ accountId: ACCOUNT.accountId, codeHash: hmac('654321') }));
    mockAccess.update.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'P2025' }));

    const err: any = await service.reset(ACCOUNT.email, '654321', 'novaSenha123').catch(e => e);

    expect(err.statusCode).toBe(404);
    expect(redisMock.del).toHaveBeenCalledWith(`pwreset:${ACCOUNT.email}`);
  });
});
