import { vi } from 'vitest';
import { LoginController } from '../../src/controllers/login.controller';
import { FastifyReply } from 'fastify';
import { LoginService } from '../../src/services/login.service';
import { AppError } from '../../src/errors/app-error';

vi.mock('../../src/services/login.service');

const mockReply = () => {
  const status = vi.fn().mockReturnThis();
  const send = vi.fn().mockReturnThis();
  return { status, send, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyReply;
};

describe('LoginController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 when email and username are both absent', async () => {
    const controller = new LoginController();
    const req: any = { body: { password: 'short' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.login(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('should call service and return 200 on success', async () => {
    vi.mocked(LoginService).prototype.login = vi.fn().mockResolvedValue({ authId: '1', token: 't', accountId: 'acc' });

    const controller = new LoginController();
    const req: any = { body: { email: 'a@b.com', password: 'password' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.login(req, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ authId: '1', token: 't', accountId: 'acc' });
  });

  it('should return 401 when service throws AppError 401', async () => {
    vi.mocked(LoginService).prototype.login = vi.fn().mockRejectedValue(new AppError('Usuário ou senha inválidos', 401));

    const controller = new LoginController();
    const req: any = { body: { email: 'a@b.com', password: 'password' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.login(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Usuário ou senha inválidos' });
  });

  it('should return 500 and not expose internals on unknown error', async () => {
    vi.mocked(LoginService).prototype.login = vi.fn().mockRejectedValue(new Error('DB timeout'));

    const controller = new LoginController();
    const req: any = { body: { email: 'a@b.com', password: 'password' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.login(req, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
  });
});
