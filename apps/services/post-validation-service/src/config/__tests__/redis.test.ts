import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Aqui o módulo real é exercitado — `tests/setup/vitest.setup.ts` mocka
 * `src/config/redis` para todo o resto da suíte, e é justamente a implementação
 * mockada lá que precisa ser provada em algum lugar.
 */
vi.unmock("../redis");

/** Cliente de Redis que falha em tudo, para provar que a falha é absorvida. */
const brokenClient = {
    get: vi.fn(async () => { throw new Error("ECONNREFUSED"); }),
    set: vi.fn(async () => { throw new Error("ECONNREFUSED"); }),
    on: vi.fn(),
    connect: vi.fn(async () => { throw new Error("ECONNREFUSED"); }),
    quit: vi.fn(async () => undefined),
    disconnect: vi.fn(),
};

vi.mock("ioredis", () => ({
    default: class { constructor() { return brokenClient; } },
}));

describe("config/redis — cache best-effort", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    /**
     * O cache existe para latência, não para correção: as regras são puras, e
     * recalcular dá sempre o mesmo veredito. Então uma falha de Redis tem que
     * custar CPU, nunca uma requisição com erro.
     */
    it("devolve null em vez de lancar quando a leitura falha", async () => {
        const { getCachedVerdict } = await import("../redis");

        await expect(getCachedVerdict("pv:verdict:x")).resolves.toBeNull();
    });

    it("engole a falha de escrita", async () => {
        const { setCachedVerdict } = await import("../redis");

        await expect(
            setCachedVerdict("pv:verdict:x", { valid: true, issues: [], auditDetails: [] })
        ).resolves.toBeUndefined();
    });

    /**
     * Redis fora do ar no boot não pode impedir o serviço de subir — o cache é
     * opcional por design, e um serviço de validação indisponível por causa do
     * cache seria pior do que um lento.
     */
    it("nao impede o boot quando a conexao inicial falha", async () => {
        const { connectRedis } = await import("../redis");

        await expect(connectRedis()).resolves.toBeUndefined();
    });
});
