import { vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  env: {
    port: 3001,
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
    jwtRefreshExpiresIn: '7d',
    databaseUrl: 'postgresql://user:pass@localhost:5432/db',
    profileServiceUrl: 'http://localhost:3002',
    kafkaBrokers: 'localhost:9092',
    redisUrl: 'redis://localhost:6379',
    corsOrigin: false,
    fetchTimeoutMs: 5000,
    rateLimitMax: 60,
    rateLimitRegisterMax: 5,
    rateLimitVerifyEmailMax: 10,
    rateLimitLoginMax: 10,
    emailVerificationTtlSeconds: 600,
    maxCodeAttempts: 5,
    verificationCodeSecret: 'test-code-secret',
    authFailWindowSeconds: 900,
    authFailNotifyThreshold: 5,
  },
}));
