import { vi } from 'vitest';
import { WebhookController } from '../../src/controllers/webhook.controller';
import { WebhookService } from '../../src/services/webhook.service';

vi.mock('../../src/services/webhook.service');

const mockReply = () => {
  const status = vi.fn().mockReturnThis();
  const send = vi.fn().mockReturnThis();
  return { status, send } as any;
};

describe('WebhookController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 { received: true } on success', async () => {
    vi.mocked(WebhookService).prototype.handle = vi.fn().mockResolvedValue(undefined);

    const controller = new WebhookController();
    const req: any = { body: { event: 'billing.paid', data: { id: 'ext-123' } }, log: { error: vi.fn() } };
    const reply = mockReply();

    await controller.handle(req, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ received: true });
  });

  it('returns mapped status when service throws AppError', async () => {
    const { AppError } = await import('../../src/errors/app-error');
    vi.mocked(WebhookService).prototype.handle = vi.fn().mockRejectedValue(
      new AppError('Pagamento não encontrado para o externalId informado', 404),
    );

    const controller = new WebhookController();
    const req: any = { body: { event: 'billing.paid', data: { id: 'ext-123' } }, log: { error: vi.fn() } };
    const reply = mockReply();

    await controller.handle(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(WebhookService).prototype.handle = vi.fn().mockRejectedValue(new Error('boom'));

    const controller = new WebhookController();
    const req: any = { body: { event: 'billing.paid', data: { id: 'ext-123' } }, log: { error: vi.fn() } };
    const reply = mockReply();

    await controller.handle(req, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});
