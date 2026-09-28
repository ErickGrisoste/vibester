import { vi } from 'vitest';
import { FastifyReply } from 'fastify';
import { SessionController } from '../../src/controllers/session.controller';
import { SessionService } from '../../src/services/session.service';
import { AppError } from '../../src/errors/app-error';

vi.mock('../../src/services/session.service');

const mockReply = () => {
  const status = vi.fn().mockReturnThis();
  const send = vi.fn().mockReturnThis();
  return { status, send } as unknown as FastifyReply;
};

const makeRequest = (): any => ({
  body: { refreshToken: 'refresh-secret' },
  headers: { 'user-agent': 'VibesterApp/1.0' },
  ip: '127.0.0.1',
  log: { error: vi.fn(), warn: vi.fn() },
});

describe('SessionController', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('refresh', () => {
    it('responde 200 com o par novo', async () => {
      const pair = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };
      vi.mocked(SessionService).prototype.refresh = vi.fn().mockResolvedValue(pair);
      const reply = mockReply();

      await new SessionController().refresh(makeRequest(), reply);

      expect(SessionService.prototype.refresh).toHaveBeenCalledWith('refresh-secret', 'VibesterApp/1.0');
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(pair);
    });

    it('repassa AppError e nunca loga o refresh token', async () => {
      vi.mocked(SessionService).prototype.refresh = vi.fn()
        .mockRejectedValue(new AppError('Sessão inválida ou expirada', 401, 'refresh_token_reused'));
      const request = makeRequest();
      const reply = mockReply();

      await new SessionController().refresh(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Sessão inválida ou expirada' });
      const logged = JSON.stringify(request.log.warn.mock.calls);
      expect(logged).toContain('refresh_token_reused');
      expect(logged).not.toContain('refresh-secret');
    });

    it('500 genérico em erro inesperado', async () => {
      vi.mocked(SessionService).prototype.refresh = vi.fn().mockRejectedValue(new Error('DB down'));
      const reply = mockReply();

      await new SessionController().refresh(makeRequest(), reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
    });
  });

  describe('logout', () => {
    it('responde 204', async () => {
      vi.mocked(SessionService).prototype.revoke = vi.fn().mockResolvedValue(undefined);
      const reply = mockReply();

      await new SessionController().logout(makeRequest(), reply);

      expect(SessionService.prototype.revoke).toHaveBeenCalledWith('refresh-secret');
      expect(reply.status).toHaveBeenCalledWith(204);
    });

    it('500 genérico em erro inesperado', async () => {
      vi.mocked(SessionService).prototype.revoke = vi.fn().mockRejectedValue(new Error('DB down'));
      const reply = mockReply();

      await new SessionController().logout(makeRequest(), reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });
});
