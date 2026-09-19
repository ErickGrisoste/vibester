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
  const hash = vi.fn((_p: string) => Promise.resolve('hashed-password'));
  return { default: { hash }, hash };
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { EmailVerificationService } from '../../src/services/email-verification.service';
import { mockAccess } from '../mocks/prisma.client';
import { redisMock } from '../mocks/redis';
import { producerMock } from '../mocks/kafka.producer';

const baseInput = {
  username: 'newuser',
  email: 'new@example.com',
  password: 'secret123',
  name: 'New User',
  bornAt: new Date('1990-01-01'),
};

const pendingData = {
  username: 'newuser',
  name: 'New User',
  email: 'new@example.com',
  passwordHash: 'hashed-password',
  bornAt: new Date('1990-01-01').toISOString(),
  code: '482931',
};

const CODE = '482931';
const hashOf = (code: string) =>
  createHmac('sha256', 'test-code-secret').update(code).digest('hex');

// Formato atual: só o HMAC é persistido.
const pendingHashed = {
  username: 'newuser',
  name: 'New User',
  email: 'new@example.com',
  passwordHash: 'hashed-password',
  bornAt: new Date('1990-01-01').toISOString(),
  codeHash: hashOf(CODE),
};

const baseAccount = {
  id: 'auth-1',
  accountId: 'acc-1',
  username: 'newuser',
  email: 'new@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmailVerificationService();
  });

  describe('initiate', () => {
    it('should store pending registration in Redis and publish Kafka event', async () => {
      await service.initiate(baseInput as any);

      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringContaining('pending:reg:new@example.com'),
        expect.stringContaining('"email":"new@example.com"'),
        600,
      );

      expect(producerMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'auth.email.verification',
          messages: expect.arrayContaining([
            expect.objectContaining({ value: expect.stringContaining('"email":"new@example.com"') }),
          ]),
        }),
      );
    });
  });

  describe('verify', () => {
    it('should throw 404 when no pending registration exists', async () => {
      redisMock.get.mockResolvedValueOnce(null);

      const err: any = await service.verify('new@example.com', '482931').catch(e => e);

      expect(err.name).toBe('AppError');
      expect(err.statusCode).toBe(404);
    });

    it('should throw 422 when code does not match', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));

      const err: any = await service.verify('new@example.com', '000000').catch(e => e);

      expect(err.name).toBe('AppError');
      expect(err.statusCode).toBe(422);
      expect(err.message).toBe('Código de verificação inválido');
    });

    it('should create account, call user-service, and return output on valid code', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
      mockAccess.create.mockResolvedValueOnce(baseAccount);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ accountId: 'acc-1' }),
      });

      const result = await service.verify('new@example.com', '482931');

      expect(redisMock.del).toHaveBeenCalledWith('pending:reg:new@example.com');
      expect(mockAccess.create).toHaveBeenCalled();
      expect(result).toHaveProperty('authId', 'auth-1');
      expect(result).toHaveProperty('accountId', 'acc-1');
      expect(result.username).toBe('newuser');
    });

    it('should rollback account and throw AppError 502 when user-service fails', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
      mockAccess.create.mockResolvedValueOnce(baseAccount);
      mockAccess.delete.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({ ok: false });

      const err: any = await service.verify('new@example.com', '482931').catch(e => e);

      expect(mockAccess.delete).toHaveBeenCalledWith({ where: { id: 'auth-1' } });
      expect(err.name).toBe('AppError');
      expect(err.statusCode).toBe(502);
    });

    // Regressao: o codigo era apagado do Redis ANTES de criar a conta. Se o
    // user-service falhasse, o usuario ficava sem conta E sem poder reusar o
    // codigo que recebeu por email — toda tentativa seguinte dava 404.
    it('should keep the pending code in Redis when user-service fails', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
      mockAccess.create.mockResolvedValueOnce(baseAccount);
      mockAccess.delete.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({ ok: false });

      await service.verify('new@example.com', '482931').catch(() => {});

      expect(redisMock.del).not.toHaveBeenCalled();
    });

    it('should keep the pending code in Redis when the profile call times out', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
      mockAccess.create.mockResolvedValueOnce(baseAccount);
      mockAccess.delete.mockResolvedValueOnce(undefined);
      mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));

      await service.verify('new@example.com', '482931').catch(() => {});

      expect(redisMock.del).not.toHaveBeenCalled();
      expect(mockAccess.delete).toHaveBeenCalledWith({ where: { id: 'auth-1' } });
    });

    // Sem contador, o codigo de 6 digitos teria os 10 minutos inteiros de TTL
    // como janela de brute force — o rate limit por IP nao fecha isso porque e
    // por instancia e o servico roda com varias replicas.
    it('should count a wrong code and keep the pending registration alive', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
      redisMock.ttl.mockResolvedValueOnce(420);

      await service.verify('new@example.com', '000000').catch(() => {});

      expect(redisMock.del).not.toHaveBeenCalled();
      const [, valor, ttl] = redisMock.set.mock.calls[0];
      expect(JSON.parse(valor).attempts).toBe(1);
      // TTL restante reaplicado: errar o codigo nao pode esticar a validade dele
      expect(ttl).toBe(420);
    });

    it('should discard the pending registration and throw 429 at the attempt limit', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify({ ...pendingData, attempts: 4 }));

      const err: any = await service.verify('new@example.com', '000000').catch(e => e);

      expect(redisMock.del).toHaveBeenCalledWith('pending:reg:new@example.com');
      expect(err.name).toBe('AppError');
      expect(err.statusCode).toBe(429);
      expect(err.reason).toBe('too_many_code_attempts');
    });

    it('should fall back to the full TTL when Redis reports no expiry', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
      redisMock.ttl.mockResolvedValueOnce(-1);

      await service.verify('new@example.com', '000000').catch(() => {});

      const [, , ttl] = redisMock.set.mock.calls[0];
      expect(ttl).toBe(600);
    });

    it('should store only the HMAC of the code, never the code itself', async () => {
      await service.initiate(baseInput as any);

      const [, gravado] = redisMock.set.mock.calls[0];
      const pending = JSON.parse(gravado);

      expect(pending.code).toBeUndefined();
      expect(pending.codeHash).toMatch(/^[0-9a-f]{64}$/);

      // O código vai em texto puro só no evento Kafka, porque precisa chegar
      // ao usuário por email — mas não fica em repouso no Redis.
      const evento = JSON.parse(producerMock.send.mock.calls[0][0].messages[0].value);
      expect(pending.codeHash).toBe(hashOf(evento.code));
    });

    it('should accept the correct code against the stored hash', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingHashed));
      mockAccess.create.mockResolvedValueOnce(baseAccount);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ accountId: 'acc-1' }),
      });

      const result = await service.verify('new@example.com', CODE);

      expect(result).toHaveProperty('accountId', 'acc-1');
    });

    it('should reject a wrong code against the stored hash', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingHashed));

      const err: any = await service.verify('new@example.com', '000000').catch(e => e);

      expect(err.statusCode).toBe(422);
      expect(mockAccess.create).not.toHaveBeenCalled();
    });

    // Pendências gravadas antes do deploy do HMAC ainda estão no Redis com o
    // código em texto puro; elas precisam continuar funcionando até expirarem.
    it('should still accept legacy plaintext pending registrations', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
      mockAccess.create.mockResolvedValueOnce(baseAccount);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ accountId: 'acc-1' }),
      });

      const result = await service.verify('new@example.com', CODE);

      expect(result).toHaveProperty('accountId', 'acc-1');
    });

    it('should throw AppError 409 when account creation hits unique constraint', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(pendingData));
      const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      mockAccess.create.mockRejectedValueOnce(p2002);

      const err: any = await service.verify('new@example.com', '482931').catch(e => e);

      expect(err.name).toBe('AppError');
      expect(err.statusCode).toBe(409);
    });
  });
});
