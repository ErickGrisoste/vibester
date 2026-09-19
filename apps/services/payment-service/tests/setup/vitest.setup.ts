import { vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  env: {
    port: 8080,
    databaseUrl: 'postgresql://user:pass@localhost:5432/db',
    jwtSecret: 'test-secret',
    abacatePayApiKey: 'test-api-key',
    abacatePayWebhookSecret: 'test-webhook-secret',
    kafkaBrokers: 'localhost:9092',
    corsOrigin: false,
    fetchTimeoutMs: 15000,
    rateLimitMax: 60,
    rateLimitCheckoutMax: 10,
  },
}));
