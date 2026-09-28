import { vi } from 'vitest';

vi.mock('../../src/prisma/index', async () => ({
  default: (await import('../mocks/prisma.client')).default,
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(() => 'access-token') },
}));

import jwt from 'jsonwebtoken';
import { SessionService, hashRefreshToken } from '../../src/services/session.service';
import { mockSession } from '../mocks/prisma.client';

const access = { id: 'auth-id', accountId: 'acc-id', suspendedAt: null };

function sessionRow(overrides: Partial<any> = {}) {
  return {
    id: 'session-id',
    tokenHash: hashRefreshToken('current'),
    rotatedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    access,
    ...overrides,
  };
}

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.updateMany.mockResolvedValue({ count: 1 });
    service = new SessionService();
  });

  describe('start', () => {
    it('grava só o hash do refresh token e devolve o par', async () => {
      const pair = await service.start(access, 'VibesterApp/1.0');

      const data = mockSession.create.mock.calls[0][0].data;
      expect(data.tokenHash).toBe(hashRefreshToken(pair.refreshToken));
      expect(data.tokenHash).not.toBe(pair.refreshToken);
      expect(data.accountId).toBe('acc-id');
      expect(data.userAgent).toBe('VibesterApp/1.0');
      expect(pair).toEqual({ accessToken: 'access-token', refreshToken: expect.any(String), expiresIn: 900 });
    });

    it('gera refresh tokens aleatórios de 256 bits', async () => {
      const a = await service.start(access);
      const b = await service.start(access);

      expect(a.refreshToken).not.toBe(b.refreshToken);
      expect(Buffer.from(a.refreshToken, 'base64url')).toHaveLength(32);
    });

    it('assina o access token com o payload de sempre e a validade curta', async () => {
      await service.start(access);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'auth-id', accountId: 'acc-id' },
        'test-secret',
        { expiresIn: 900 },
      );
    });
  });

  describe('refresh', () => {
    it('troca o token atual e guarda o anterior', async () => {
      mockSession.findFirst.mockResolvedValueOnce(sessionRow());

      const pair = await service.refresh('current');

      const call = mockSession.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'session-id', tokenHash: hashRefreshToken('current') });
      expect(call.data.tokenHash).toBe(hashRefreshToken(pair.refreshToken));
      expect(call.data.previousTokenHash).toBe(hashRefreshToken('current'));
      expect(call.data.rotatedAt).toBeInstanceOf(Date);
      expect(pair.refreshToken).not.toBe('current');
    });

    it('renova a validade da sessão a cada troca', async () => {
      mockSession.findFirst.mockResolvedValueOnce(sessionRow());

      await service.refresh('current');

      const expiresAt: Date = mockSession.updateMany.mock.calls[0][0].data.expiresAt;
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
    });

    it('401 para token desconhecido', async () => {
      mockSession.findFirst.mockResolvedValueOnce(null);

      const err: any = await service.refresh('nope').catch(e => e);

      expect(err.statusCode).toBe(401);
      expect(err.reason).toBe('refresh_token_not_found');
    });

    it('401 e apaga a sessão quando vencida', async () => {
      mockSession.findFirst.mockResolvedValueOnce(sessionRow({ expiresAt: new Date(Date.now() - 1) }));

      const err: any = await service.refresh('current').catch(e => e);

      expect(err.statusCode).toBe(401);
      expect(err.reason).toBe('refresh_token_expired');
      expect(mockSession.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-id' } });
    });

    it('403 e apaga a sessão quando a conta está suspensa', async () => {
      mockSession.findFirst.mockResolvedValueOnce(sessionRow({ access: { ...access, suspendedAt: new Date() } }));

      const err: any = await service.refresh('current').catch(e => e);

      expect(err.statusCode).toBe(403);
      expect(err.reason).toBe('account_suspended');
      expect(mockSession.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-id' } });
      expect(mockSession.updateMany).not.toHaveBeenCalled();
    });

    it('aceita o token anterior dentro da tolerância e emite outro par', async () => {
      mockSession.findFirst.mockResolvedValueOnce(sessionRow({ rotatedAt: new Date(Date.now() - 5_000) }));

      const pair = await service.refresh('previous');

      const call = mockSession.updateMany.mock.calls[0][0];
      expect(call.where.previousTokenHash).toBe(hashRefreshToken('previous'));
      expect(call.data.tokenHash).toBe(hashRefreshToken(pair.refreshToken));
      // Não estica a janela de tolerância nem troca o anterior.
      expect(call.data).not.toHaveProperty('rotatedAt');
      expect(call.data).not.toHaveProperty('previousTokenHash');
    });

    it('encerra a sessão quando o token anterior volta fora da tolerância (roubo)', async () => {
      mockSession.findFirst.mockResolvedValueOnce(sessionRow({ rotatedAt: new Date(Date.now() - 60_000) }));

      const err: any = await service.refresh('previous').catch(e => e);

      expect(err.statusCode).toBe(401);
      expect(err.reason).toBe('refresh_token_reused');
      expect(mockSession.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-id' } });
      expect(mockSession.updateMany).not.toHaveBeenCalled();
    });

    it('perdendo a corrida para outra troca do mesmo token, cai na tolerância', async () => {
      mockSession.findFirst.mockResolvedValueOnce(sessionRow());
      mockSession.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      const pair = await service.refresh('current');

      expect(mockSession.updateMany).toHaveBeenCalledTimes(2);
      expect(mockSession.updateMany.mock.calls[1][0].where.previousTokenHash).toBe(hashRefreshToken('current'));
      expect(pair.accessToken).toBe('access-token');
    });

    it('401 quando nem a tolerância consegue reemitir', async () => {
      mockSession.findFirst.mockResolvedValueOnce(sessionRow());
      mockSession.updateMany.mockResolvedValue({ count: 0 });

      const err: any = await service.refresh('current').catch(e => e);

      expect(err.statusCode).toBe(401);
      expect(err.reason).toBe('refresh_token_race_lost');
    });
  });

  describe('revoke', () => {
    it('apaga a sessão pelo token atual ou anterior', async () => {
      await service.revoke('tok');

      const hash = hashRefreshToken('tok');
      expect(mockSession.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }] },
      });
    });

    it('revokeAll apaga todas as sessões da conta', async () => {
      await service.revokeAll('acc-id');

      expect(mockSession.deleteMany).toHaveBeenCalledWith({ where: { accountId: 'acc-id' } });
    });
  });
});
