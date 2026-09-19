import { vi } from 'vitest';
import prismaMock, { mockPayment } from '../mocks/prisma.client';

vi.mock('../../src/prisma/index', () => ({ default: prismaMock }));

vi.mock('../../src/kafka/producer', async () => ({
  producer: (await import('../mocks/kafka.producer')).producerMock,
}));

import { WebhookService } from '../../src/services/webhook.service';
import { producerMock } from '../mocks/kafka.producer';

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookService();
  });

  it('updates payment to PAID and publishes payment.confirmed on billing.paid', async () => {
    mockPayment.findFirst.mockResolvedValue({
      id: 'a3f5c8e2-6b1d-4f9a-9c3e-1d2b3a4c5d6e', billId: 'bill-1', externalId: 'ext-123', amount: 1000, status: 'PENDING',
    });
    mockPayment.update.mockResolvedValue({});

    await service.handle({ event: 'billing.paid', data: { id: 'ext-123' } });

    expect(mockPayment.update).toHaveBeenCalledWith({ where: { id: 'a3f5c8e2-6b1d-4f9a-9c3e-1d2b3a4c5d6e' }, data: { status: 'PAID' } });
    expect(producerMock.send).toHaveBeenCalledWith(expect.objectContaining({ topic: 'payment.confirmed' }));
  });

  it('updates payment to FAILED and publishes payment.failed on billing.failed', async () => {
    mockPayment.findFirst.mockResolvedValue({
      id: 'a3f5c8e2-6b1d-4f9a-9c3e-1d2b3a4c5d6e', billId: 'bill-1', externalId: 'ext-123', amount: 1000, status: 'PENDING',
    });
    mockPayment.update.mockResolvedValue({});

    await service.handle({ event: 'billing.failed', data: { id: 'ext-123' } });

    expect(mockPayment.update).toHaveBeenCalledWith({ where: { id: 'a3f5c8e2-6b1d-4f9a-9c3e-1d2b3a4c5d6e' }, data: { status: 'FAILED' } });
    expect(producerMock.send).toHaveBeenCalledWith(expect.objectContaining({ topic: 'payment.failed' }));
  });

  it('throws AppError 400 for unrecognized event', async () => {
    const err: any = await service.handle({ event: 'billing.unknown', data: { id: 'ext-123' } }).catch(e => e);

    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(400);
    expect(mockPayment.findFirst).not.toHaveBeenCalled();
  });

  it('throws AppError 404 when payment not found for externalId', async () => {
    mockPayment.findFirst.mockResolvedValue(null);

    const err: any = await service.handle({ event: 'billing.paid', data: { id: 'unknown-ext' } }).catch(e => e);

    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(404);
  });

  it('is idempotent: does nothing when payment already left PENDING', async () => {
    mockPayment.findFirst.mockResolvedValue({
      id: 'a3f5c8e2-6b1d-4f9a-9c3e-1d2b3a4c5d6e', billId: 'bill-1', externalId: 'ext-123', amount: 1000, status: 'PAID',
    });

    await service.handle({ event: 'billing.paid', data: { id: 'ext-123' } });

    expect(mockPayment.update).not.toHaveBeenCalled();
    expect(producerMock.send).not.toHaveBeenCalled();
  });
});
