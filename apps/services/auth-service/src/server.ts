import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes';
import { env } from './config/env';
import { registerSwagger } from './config/swagger';
import { producer } from './kafka/producer';
import { redis } from './config/redis';
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
    // Store no Redis, nao em memoria: o HPA deste servico vai de 2 a 6 replicas,
    // e um contador por processo faz o limite efetivo virar
    // (max x numero de pods) — justamente nas rotas de brute force.
    // skipOnError deixa passar se o Redis cair: rate limit indisponivel nao
    // pode virar indisponibilidade de login.
    await app.register(rateLimit, {
        max: env.rateLimitMax,
        timeWindow: '1 minute',
        redis: redis.client(),
        skipOnError: true,
        nameSpace: 'auth-rl:',
    });
    await registerSwagger(app);
    await app.register(authRoutes);

    try {
        await producer.connect();
        await redis.connect();
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
    await redis.disconnect();
    await pool.end();
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
