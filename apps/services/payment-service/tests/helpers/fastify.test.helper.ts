import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { paymentRoutes } from '../../src/routes';

export async function buildServer() {
  const app = Fastify({ ajv: { customOptions: { keywords: ["example"] } } });
  await app.register(jwt, { secret: 'test-secret' });
  await app.register(paymentRoutes);
  return app;
}

export function generateToken(app: FastifyInstance): string {
  return app.jwt.sign({ sub: 'test-user-id' });
}
