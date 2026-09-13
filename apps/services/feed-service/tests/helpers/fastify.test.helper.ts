import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { feedRoutes } from '../../src/routes';
import { registerErrorHandler } from '../../src/errors/error.handler';
import { registerCorsAndRateLimit, CorsAndRateLimitOptions } from '../../src/plugins';

const TEST_JWT_SECRET = 'test-secret';

export async function buildServer() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(jwt, { secret: TEST_JWT_SECRET });
  await app.register(feedRoutes);
  return app;
}

/**
 * Variante de `buildServer` que também registra `registerCorsAndRateLimit`
 * (src/plugins.ts) — usada só pelos testes de CORS/rate limit
 * (tests/integration/plugins.integration.spec.ts). O `buildServer` acima
 * continua minimalista de propósito (sem cors/rate-limit), mesmo padrão já
 * documentado no post-service, para não acoplar todo teste de rota a esses
 * plugins.
 */
export async function buildServerWithPlugins(options: CorsAndRateLimitOptions) {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  await registerCorsAndRateLimit(app, options);
  await app.register(jwt, { secret: TEST_JWT_SECRET });
  await app.register(feedRoutes);
  return app;
}

export function makeAuthHeader(app: Awaited<ReturnType<typeof buildServer>>, userId: string): string {
  const token = app.jwt.sign({ accountId: userId, userId });
  return `Bearer ${token}`;
}
