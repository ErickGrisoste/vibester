import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { paymentRoutes } from './routes';
import { env } from './config/env';
import { registerSwagger } from './config/swagger';
import { producer } from './kafka/producer';
import { pool } from './prisma';

const app = Fastify({
    logger: { level: 'info' },
    ajv: { customOptions: { keywords: ["example"] } },
});

const start = async () => {
    await app.register(cors, {
        origin: env.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
    });
    await app.register(jwt, { secret: env.jwtSecret });
    await app.register(rateLimit, {
        max: env.rateLimitMax,
        timeWindow: '1 minute',
    });
    await registerSwagger(app);
    await app.register(paymentRoutes);

    try {
        await producer.connect();
        await app.listen({ port: env.port, host: '0.0.0.0' });
    } catch (err) {
        app.log.error(err, 'Falha ao iniciar o servidor');
        process.exit(1);
    }
};

const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Encerrando servidor...');
    await app.close();
    await producer.disconnect();
    await pool.end();
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
