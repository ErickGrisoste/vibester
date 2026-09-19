import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';
import { setupRoutes } from '../../src/routes';

export async function buildServer() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // Mesmo registro do server.ts: as rotas de bloqueio/denúncia verificam o JWT.
  await app.register(jwt, { secret: 'test-secret' });
  await setupRoutes(app);
  return app;
}
