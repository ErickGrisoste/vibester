import Fastify from 'fastify';
import { routes } from '../../src/routes';
import { registerErrorHandler } from '../../src/errors/error.handler';

export async function buildServer() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(routes);
  await app.ready();
  return app;
}
