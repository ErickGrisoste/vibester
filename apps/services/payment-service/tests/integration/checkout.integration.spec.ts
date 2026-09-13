import { vi } from 'vitest';
import prismaMock, { mockPayment } from '../mocks/prisma.client';

vi.mock('../../src/prisma/index', () => ({ default: prismaMock }));

vi.mock('../../src/kafka/producer', async () => ({
  producer: (await import('../mocks/kafka.producer')).producerMock,
}));

vi.mock('../../src/abacatepay/client', async () => ({
  abacatePayClient: (await import('../mocks/abacatepay.client')).abacatePayClientMock,
}));

import { buildServer, generateToken } from '../helpers/fastify.test.helper';
import { abacatePayClientMock } from '../mocks/abacatepay.client';

describe('Checkout integration', () => {
  let app: any;
  let token: string;

  beforeAll(async () => {
    app = await buildServer();
    token = generateToken(app);
  });

  afterAll(async () => app.close());

  beforeEach(() => vi.clearAllMocks());

  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('POST /checkout returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/checkout',
      payload: { productId: 'prod_1', quantity: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /checkout returns 400 for invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/checkout',
      payload: { productId: 'prod_1', quantity: 0 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /checkout returns 200 with valid token', async () => {
    abacatePayClientMock.createCheckout.mockResolvedValue({
      data: { id: 'ext-123', url: 'https://pay.abacatepay.com/checkout/xxx', amount: 1000 },
      success: true,
    });
    mockPayment.create.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/checkout',
      payload: { productId: 'prod_1', quantity: 1 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ url: 'https://pay.abacatepay.com/checkout/xxx' });
  });

  it('POST /checkout returns 502 when AbacatePay fails', async () => {
    abacatePayClientMock.createCheckout.mockRejectedValue(new Error('AbacatePay indisponível'));

    const res = await app.inject({
      method: 'POST',
      url: '/checkout',
      payload: { productId: 'prod_1', quantity: 1 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(502);
  });
});
