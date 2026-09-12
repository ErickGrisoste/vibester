import { vi } from 'vitest';
import prismaMock, { mockPayment } from '../mocks/prisma.client';

vi.mock('../../src/prisma/index', () => ({ default: prismaMock }));

vi.mock('../../src/kafka/producer', async () => ({
  producer: (await import('../mocks/kafka.producer')).producerMock,
}));

vi.mock('../../src/abacatepay/client', async () => ({
  abacatePayClient: (await import('../mocks/abacatepay.client')).abacatePayClientMock,
}));

import { CheckoutService } from '../../src/services/checkout.service';
import { producerMock } from '../mocks/kafka.producer';
import { abacatePayClientMock } from '../mocks/abacatepay.client';

describe('CheckoutService', () => {
  let service: CheckoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CheckoutService();
  });

  it('creates checkout, persists PENDING payment with amount from AbacatePay response and publishes event', async () => {
    abacatePayClientMock.createCheckout.mockResolvedValue({
      data: { id: 'ext-123', url: 'https://pay.abacatepay.com/checkout/xxx', amount: 1000 },
      success: true,
    });
    mockPayment.create.mockResolvedValue({});

    const result = await service.createCheckout({ productId: 'prod_1', quantity: 2 });

    expect(result).toEqual({ url: 'https://pay.abacatepay.com/checkout/xxx' });
    expect(mockPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ externalId: 'ext-123', amount: 1000, status: 'PENDING' }),
      }),
    );
    expect(producerMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'payment.checkout.created' }),
    );
  });

  it('falls back to amount 0 when AbacatePay response has no amount field', async () => {
    abacatePayClientMock.createCheckout.mockResolvedValue({
      data: { id: 'ext-123', url: 'https://pay.abacatepay.com/checkout/xxx' },
      success: true,
    });
    mockPayment.create.mockResolvedValue({});

    await service.createCheckout({ productId: 'prod_1', quantity: 1 });

    expect(mockPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 0 }) }),
    );
  });

  it('throws AppError 502 when AbacatePay call fails', async () => {
    abacatePayClientMock.createCheckout.mockRejectedValue(new Error('AbacatePay retornou status 500'));

    const err: any = await service.createCheckout({ productId: 'prod_1', quantity: 1 }).catch(e => e);

    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(502);
    expect(mockPayment.create).not.toHaveBeenCalled();
  });

  it('throws AppError 500 when persisting payment fails, without publishing event', async () => {
    abacatePayClientMock.createCheckout.mockResolvedValue({
      data: { id: 'ext-123', url: 'https://pay.abacatepay.com/checkout/xxx', amount: 500 },
      success: true,
    });
    mockPayment.create.mockRejectedValue(new Error('DB down'));

    const err: any = await service.createCheckout({ productId: 'prod_1', quantity: 1 }).catch(e => e);

    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(500);
    expect(producerMock.send).not.toHaveBeenCalled();
  });
});
