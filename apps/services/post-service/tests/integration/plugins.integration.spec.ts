import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerCorsAndRateLimit } from '../../src/plugins';
import { redis } from '../../src/config/redis';
import { registry } from '../../src/metrics/registry';

const RATE_LIMIT_NAMESPACE = 'post-service-rate-limit-';

async function buildTestApp(options: { corsAllowedOrigins?: string[]; rateLimitMax: number }) {
  const app = Fastify({ logger: false });
  await registerCorsAndRateLimit(app, {
    corsAllowedOrigins: options.corsAllowedOrigins,
    rateLimitMax: options.rateLimitMax,
    redis,
  });
  app.get('/ping', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('registerCorsAndRateLimit', () => {
  let apps: FastifyInstance[] = [];

  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    const keys = await redis.keys(`${RATE_LIMIT_NAMESPACE}*`);
    if (keys.length > 0) { await redis.del(...keys); }
    apps = [];
  });

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  describe('CORS', () => {
    it('permite apenas origens da allowlist quando CORS_ALLOWED_ORIGINS está configurada', async () => {
      const app = await buildTestApp({ corsAllowedOrigins: ['https://app.vibester.com'], rateLimitMax: 1000 });
      apps.push(app);

      const allowed = await app.inject({
        method: 'GET', url: '/ping',
        headers: { origin: 'https://app.vibester.com' },
      });
      expect(allowed.headers['access-control-allow-origin']).toBe('https://app.vibester.com');

      const blocked = await app.inject({
        method: 'GET', url: '/ping',
        headers: { origin: 'https://evil.example.com' },
      });
      expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('aceita qualquer origem quando CORS_ALLOWED_ORIGINS não é informada (fallback documentado)', async () => {
      const app = await buildTestApp({ corsAllowedOrigins: undefined, rateLimitMax: 1000 });
      apps.push(app);

      const res = await app.inject({
        method: 'GET', url: '/ping',
        headers: { origin: 'https://qualquer-coisa.example.com' },
      });
      expect(res.headers['access-control-allow-origin']).toBe('https://qualquer-coisa.example.com');
    });
  });

  describe('Rate limit (store Redis real)', () => {
    it('bloqueia com 429 após exceder o limite e grava o contador no Redis', async () => {
      const app = await buildTestApp({ rateLimitMax: 2 });
      apps.push(app);

      const first = await app.inject({ method: 'GET', url: '/ping' });
      const second = await app.inject({ method: 'GET', url: '/ping' });
      const third = await app.inject({ method: 'GET', url: '/ping' });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(third.statusCode).toBe(429);
      expect(JSON.parse(third.payload).message).toMatch(/Rate limit excedido/);

      const keys = await redis.keys(`${RATE_LIMIT_NAMESPACE}*`);
      expect(keys.length).toBeGreaterThan(0);

      const metricsOutput = await registry.metrics();
      expect(metricsOutput).toMatch(/rate_limit_exceeded_total\{route="\/ping"\} \d+/);
    });

    it('o contador é compartilhado entre duas instâncias diferentes do app (simula réplicas distintas)', async () => {
      const appA = await buildTestApp({ rateLimitMax: 2 });
      const appB = await buildTestApp({ rateLimitMax: 2 });
      apps.push(appA, appB);

      // Mesma IP de origem (app.inject não define uma real, mas ambas batem no
      // mesmo client Redis) — se o contador fosse em memória, cada app
      // permitiria 2 requisições (4 no total); com Redis compartilhado, o
      // limite de 2 vale para as duas instâncias somadas.
      const resA1 = await appA.inject({ method: 'GET', url: '/ping' });
      const resB1 = await appB.inject({ method: 'GET', url: '/ping' });
      const resA2 = await appA.inject({ method: 'GET', url: '/ping' });

      expect(resA1.statusCode).toBe(200);
      expect(resB1.statusCode).toBe(200);
      expect(resA2.statusCode).toBe(429);
    });
  });
});
