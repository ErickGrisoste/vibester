import { vi } from 'vitest';
import prismaMock, { mockPayment } from '../mocks/prisma.client';

vi.mock('../../src/prisma/index', () => ({ default: prismaMock }));

vi.mock('../../src/kafka/producer', async () => ({
  producer: (await import('../mocks/kafka.producer')).producerMock,
}));

import { buildServer } from '../helpers/fastify.test.helper';

describe('Webhook integration', () => {
  let app: any;

  beforeAll(async () => { app = await buildServer(); });
  afterAll(async () => app.close());
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without webhookSecret', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/abacatepay',
      payload: { event: 'billing.paid', data: { id: 'ext-123' } },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with wrong webhookSecret', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/abacatepay?webhookSecret=wrong-secret',
      payload: { event: 'billing.paid', data: { id: 'ext-123' } },
    });
    expect(res.statusCode).toBe(401);
  });

  it('updates payment and returns 200 with valid secret', async () => {
    mockPayment.findFirst.mockResolvedValue({
      id: 'a3f5c8e2-6b1d-4f9a-9c3e-1d2b3a4c5d6e', billId: 'bill-1', externalId: 'ext-123', amount: 1000, status: 'PENDING',
    });
    mockPayment.update.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/webhook/abacatepay?webhookSecret=test-webhook-secret',
      payload: { event: 'billing.paid', data: { id: 'ext-123' } },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ received: true });
    expect(mockPayment.update).toHaveBeenCalledWith({ where: { id: 'a3f5c8e2-6b1d-4f9a-9c3e-1d2b3a4c5d6e' }, data: { status: 'PAID' } });
  });

  it('returns 404 when payment not found', async () => {
    mockPayment.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/webhook/abacatepay?webhookSecret=test-webhook-secret',
      payload: { event: 'billing.paid', data: { id: 'unknown' } },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for malformed body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/abacatepay?webhookSecret=test-webhook-secret',
      payload: { event: 'billing.paid' },
    });

    expect(res.statusCode).toBe(400);
  });
});
