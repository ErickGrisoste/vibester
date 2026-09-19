import Fastify from 'fastify';
import { writeFileSync } from 'fs';
import { registerSwagger } from './config/swagger';
import { paymentRoutes } from './routes';

const app = Fastify({ ajv: { customOptions: { keywords: ['example'] } } });

(async () => {
  await registerSwagger(app);
  await app.register(paymentRoutes);
  await app.ready();
  writeFileSync(process.argv[2], JSON.stringify(app.swagger()));
  process.exit(0);
})();
