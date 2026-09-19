import { vi, describe, it, expect, afterEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../src/config/cassandra', () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { buildServerWithPlugins, makeAuthHeader } from '../helpers/fastify.test.helper';

const USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

describe('feed-service — CORS e rate limit (src/plugins.ts)', () => {
  afterEach(() => {
    vi.resetAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
  });

  describe('rate limit', () => {
    it('permite requisições dentro do limite configurado', async () => {
      const app = await buildServerWithPlugins({ rateLimitMax: 3 });
      const authHeader = makeAuthHeader(app, USER_ID);

      for (let i = 0; i < 3; i++) {
        const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeader } });
        expect(res.statusCode).toBe(200);
      }

      await app.close();
    });

    it('retorna 429 após exceder o máximo configurado dentro da janela', async () => {
      const app = await buildServerWithPlugins({ rateLimitMax: 3 });
      const authHeader = makeAuthHeader(app, USER_ID);

      for (let i = 0; i < 3; i++) {
        const res = await app.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeader } });
        expect(res.statusCode).toBe(200);
      }

      const blocked = await app.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeader } });
      expect(blocked.statusCode).toBe(429);

      await app.close();
    });

    it('cada réplica (processo) conta o limite separadamente — nova instância não herda o contador da anterior', async () => {
      // Documenta em teste a limitação descrita em src/plugins.ts: o store é em
      // memória do processo, então uma segunda instância do app não "sabe"
      // que a primeira já esgotou o limite.
      const appA = await buildServerWithPlugins({ rateLimitMax: 1 });
      const authHeaderA = makeAuthHeader(appA, USER_ID);
      const firstOnA = await appA.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeaderA } });
      expect(firstOnA.statusCode).toBe(200);
      const blockedOnA = await appA.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeaderA } });
      expect(blockedOnA.statusCode).toBe(429);
      await appA.close();

      const appB = await buildServerWithPlugins({ rateLimitMax: 1 });
      const authHeaderB = makeAuthHeader(appB, USER_ID);
      const firstOnB = await appB.inject({ method: 'GET', url: `/feed/${USER_ID}`, headers: { authorization: authHeaderB } });
      expect(firstOnB.statusCode).toBe(200);
      await appB.close();
    });
  });

  describe('CORS', () => {
    it('com CORS_ALLOWED_ORIGINS definida, aceita origem presente na allowlist', async () => {
      const app = await buildServerWithPlugins({
        rateLimitMax: 100,
        corsAllowedOrigins: ['https://app.vibester.com'],
      });
      const authHeader = makeAuthHeader(app, USER_ID);

      const res = await app.inject({
        method: 'GET',
        url: `/feed/${USER_ID}`,
        headers: { authorization: authHeader, origin: 'https://app.vibester.com' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://app.vibester.com');

      await app.close();
    });

    it('com CORS_ALLOWED_ORIGINS definida, rejeita (não ecoa) origem fora da allowlist', async () => {
      const app = await buildServerWithPlugins({
        rateLimitMax: 100,
        corsAllowedOrigins: ['https://app.vibester.com'],
      });
      const authHeader = makeAuthHeader(app, USER_ID);

      const res = await app.inject({
        method: 'GET',
        url: `/feed/${USER_ID}`,
        headers: { authorization: authHeader, origin: 'https://evil.example.com' },
      });

      // A rota em si não é bloqueada (a defesa de CORS é do navegador, não do
      // servidor) — o que muda é a ausência do header que autorizaria o browser
      // a expor a resposta ao JS da origem não permitida.
      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();

      await app.close();
    });

    it('sem CORS_ALLOWED_ORIGINS, cai no fallback origin:true (ecoa qualquer origem)', async () => {
      const app = await buildServerWithPlugins({ rateLimitMax: 100 });
      const authHeader = makeAuthHeader(app, USER_ID);

      const res = await app.inject({
        method: 'GET',
        url: `/feed/${USER_ID}`,
        headers: { authorization: authHeader, origin: 'https://qualquer-origem.example.com' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://qualquer-origem.example.com');

      await app.close();
    });
  });
});
