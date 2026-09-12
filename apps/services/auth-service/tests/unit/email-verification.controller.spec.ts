import { vi } from 'vitest';
import { EmailVerificationController } from '../../src/controllers/email-verification.controller';
import { EmailVerificationService } from '../../src/services/email-verification.service';

vi.mock('../../src/services/email-verification.service');

const mockReply = () => {
  const status = vi.fn().mockReturnThis();
  const send = vi.fn().mockReturnThis();
  return { status, send } as any;
};

const accountOutput = {
  authId: 'auth-1',
  accountId: 'acc-1',
  username: 'u',
  name: 'n',
  email: 'e@e.com',
  bornAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('EmailVerificationController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call verify service and return 201 on success', async () => {
    vi.mocked(EmailVerificationService).prototype.verify = vi.fn().mockResolvedValue(accountOutput);

    const controller = new EmailVerificationController();
    const req: any = { body: { email: 'e@e.com', code: '482931' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.verify(req, reply);

    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith(accountOutput);
  });

  it('should return 404 when AppError 404 is thrown', async () => {
    const { AppError } = await import('../../src/errors/app-error');
    vi.mocked(EmailVerificationService).prototype.verify = vi.fn().mockRejectedValue(
      new AppError('Nenhuma verificação pendente', 404),
    );

    const controller = new EmailVerificationController();
    const req: any = { body: { email: 'e@e.com', code: '000000' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.verify(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it('should return 422 when AppError 422 is thrown', async () => {
    const { AppError } = await import('../../src/errors/app-error');
    vi.mocked(EmailVerificationService).prototype.verify = vi.fn().mockRejectedValue(
      new AppError('Código de verificação inválido', 422),
    );

    const controller = new EmailVerificationController();
    const req: any = { body: { email: 'e@e.com', code: '000000' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.verify(req, reply);

    expect(reply.status).toHaveBeenCalledWith(422);
  });

  it('should return 500 on unexpected error', async () => {
    vi.mocked(EmailVerificationService).prototype.verify = vi.fn().mockRejectedValue(new Error('Unexpected'));

    const controller = new EmailVerificationController();
    const req: any = { body: { email: 'e@e.com', code: '482931' }, log: { error: vi.fn(), warn: vi.fn() } };
    const reply = mockReply();

    await controller.verify(req, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});
