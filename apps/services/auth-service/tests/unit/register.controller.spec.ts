import { vi } from 'vitest';
import { RegisterController } from '../../src/controllers/register.controller';
import { RegisterService } from '../../src/services/register.service';

vi.mock('../../src/services/register.service');

const mockReply = () => {
  const status = vi.fn().mockReturnThis();
  const send = vi.fn().mockReturnThis();
  return { status, send } as any;
};

describe('RegisterController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call register service and return 202', async () => {
    vi.mocked(RegisterService).prototype.register = vi.fn().mockResolvedValue(undefined);

    const controller = new RegisterController();
    const req: any = { body: { username: 'u', email: 'e@e.com', password: 'p123', name: 'n', bornAt: '1990-01-01' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.register(req, reply);

    expect(reply.status).toHaveBeenCalledWith(202);
    expect(reply.send).toHaveBeenCalledWith({ message: 'Código de verificação enviado para seu email' });
  });

  it('should return 409 when register service throws AppError', async () => {
    const { AppError } = await import('../../src/errors/app-error');
    vi.mocked(RegisterService).prototype.register = vi.fn().mockRejectedValue(new AppError('Email ou username já está em uso', 409));

    const controller = new RegisterController();
    const req: any = { body: { username: 'u', email: 'e@e.com', password: 'p123', name: 'n', bornAt: '1990-01-01' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.register(req, reply);

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Email ou username já está em uso' });
  });

  it('should return 500 on unexpected error', async () => {
    vi.mocked(RegisterService).prototype.register = vi.fn().mockRejectedValue(new Error('DB down'));

    const controller = new RegisterController();
    const req: any = { body: { username: 'u', email: 'e@e.com', password: 'p123', name: 'n', bornAt: '1990-01-01' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.register(req, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});
