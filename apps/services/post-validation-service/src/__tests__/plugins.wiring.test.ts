import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";

/**
 * Trava a configuração do rate limit de produção.
 *
 * O teste comportamental (`plugins.ratelimit.test.ts`) prova que `rateLimitKey`
 * funciona; este prova que `registerCorsAndRateLimit` de fato o usa. Sem ele,
 * remover a linha `keyGenerator` voltaria a chave para IP — e o sintoma em
 * produção seria a validação se desligar sozinha sob carga, sem nenhum teste
 * quebrando.
 */
const captured: Record<string, unknown>[] = [];

vi.mock("@fastify/rate-limit", () => ({
    default: Object.assign(
        async (_app: unknown, options: Record<string, unknown>) => { captured.push(options); },
        // Sem isto o Fastify encapsularia o plugin e o registro não chegaria aqui.
        { [Symbol.for("skip-override")]: true },
    ),
}));

vi.mock("@fastify/cors", () => ({
    default: Object.assign(async () => undefined, { [Symbol.for("skip-override")]: true }),
}));

const { registerCorsAndRateLimit, rateLimitKey } = await import("../plugins");

describe("registerCorsAndRateLimit", () => {
    it("usa a chave por conta, nao o IP padrao do plugin", async () => {
        captured.length = 0;
        await registerCorsAndRateLimit(Fastify({ logger: false }));

        expect(captured).toHaveLength(1);
        expect(captured[0].keyGenerator).toBe(rateLimitKey);
    });

    /**
     * `onExceeding` roda em toda requisição ainda DENTRO do limite. Usá-lo
     * fazia `rate_limit_exceeded_total` contar tráfego normal como bloqueio.
     */
    it("conta bloqueio em onExceeded, nunca em onExceeding", async () => {
        captured.length = 0;
        await registerCorsAndRateLimit(Fastify({ logger: false }));

        expect(typeof captured[0].onExceeded).toBe("function");
        expect(captured[0].onExceeding).toBeUndefined();
    });

    it("nao derruba a requisicao quando o Redis do rate limit falha", async () => {
        captured.length = 0;
        await registerCorsAndRateLimit(Fastify({ logger: false }));

        expect(captured[0].skipOnError).toBe(true);
    });
});
