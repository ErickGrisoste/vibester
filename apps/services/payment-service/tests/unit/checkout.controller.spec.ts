import { vi } from 'vitest';
import { CheckoutController } from '../../src/controllers/checkout.controller';
import { CheckoutService } from '../../src/services/checkout.service';

vi.mock('../../src/services/checkout.service');

const mockReply = () => {
  const status = vi.fn().mockReturnThis();
  const send = vi.fn().mockReturnThis();
  return { status, send } as any;
};

describe('CheckoutController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with checkout url on success', async () => {
    vi.mocked(CheckoutService).prototype.createCheckout = vi.fn().mockResolvedValue({
      url: 'https://pay.abacatepay.com/checkout/xxx',
    });

    const controller = new CheckoutController();
    const req: any = { body: { productId: 'prod_1', quantity: 1 }, log: { error: vi.fn() } };
    const reply = mockReply();

    await controller.checkout(req, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ url: 'https://pay.abacatepay.com/checkout/xxx' });
  });

  it('returns mapped status when service throws AppError', async () => {
    const { AppError } = await import('../../src/errors/app-error');
    vi.mocked(CheckoutService).prototype.createCheckout = vi.fn().mockRejectedValue(
      new AppError('Falha ao comunicar com o AbacatePay', 502),
    );

    const controller = new CheckoutController();
    const req: any = { body: { productId: 'prod_1', quantity: 1 }, log: { error: vi.fn() } };
    const reply = mockReply();

    await controller.checkout(req, reply);

    expect(reply.status).toHaveBeenCalledWith(502);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Falha ao comunicar com o AbacatePay' });
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(CheckoutService).prototype.createCheckout = vi.fn().mockRejectedValue(new Error('boom'));

    const controller = new CheckoutController();
    const req: any = { body: { productId: 'prod_1', quantity: 1 }, log: { error: vi.fn() } };
    const reply = mockReply();

    await controller.checkout(req, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
  });
});
