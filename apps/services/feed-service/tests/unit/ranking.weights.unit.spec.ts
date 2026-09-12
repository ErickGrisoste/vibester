import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, getWeights, loadWeights, resetWeights } from "../../src/ranking/weights";

afterEach(() => {
    resetWeights();
});

describe("loadWeights", () => {
    it("aceita e passa a usar uma config válida", () => {
        const nova = { ...DEFAULT_WEIGHTS, version: "2026-10-01.medido", engagementWeight: 2 };

        const result = loadWeights(nova);

        expect(result.ok).toBe(true);
        expect(getWeights().version).toBe("2026-10-01.medido");
        expect(getWeights().engagementWeight).toBe(2);
    });

    it("config inválida NÃO entra em uso e o ranking segue com os pesos anteriores", () => {
        // Um feed com peso errado é pior que um feed com peso velho.
        const antes = getWeights();

        const result = loadWeights({ ...DEFAULT_WEIGHTS, halfLifeHours: -5 });

        expect(result.ok).toBe(false);
        expect(getWeights()).toBe(antes);
    });

    it("devolve o motivo da recusa, com o caminho do campo", () => {
        const result = loadWeights({ ...DEFAULT_WEIGHTS, priorRate: 5 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain("priorRate");
        }
    });

    it("recusa config sem versão, que impediria rastrear qual peso gerou qual feed", () => {
        const { version: _version, ...semVersao } = DEFAULT_WEIGHTS;

        expect(loadWeights(semVersao).ok).toBe(false);
    });

    it("recusa config com sinal faltando em vez de assumir zero silenciosamente", () => {
        const { EVENT_CHECKIN: _checkin, ...sinaisIncompletos } = DEFAULT_WEIGHTS.signals;

        const result = loadWeights({ ...DEFAULT_WEIGHTS, signals: sinaisIncompletos });

        expect(result.ok).toBe(false);
    });

    it("recusa lixo completo sem lançar", () => {
        expect(loadWeights(null).ok).toBe(false);
        expect(loadWeights("config").ok).toBe(false);
        expect(loadWeights(42).ok).toBe(false);
    });

    it("resetWeights volta para o chute inicial", () => {
        loadWeights({ ...DEFAULT_WEIGHTS, version: "temporaria" });
        resetWeights();

        expect(getWeights()).toBe(DEFAULT_WEIGHTS);
    });
});

describe("DEFAULT_WEIGHTS", () => {
    it("ancora os positivos em LIKE = 1", () => {
        expect(DEFAULT_WEIGHTS.signals.LIKE).toBe(1);
    });

    it("mantém os positivos numa faixa comprimida de 1 a 5, exceto o check-in", () => {
        const positivos = Object.entries(DEFAULT_WEIGHTS.signals)
            .filter(([signal, peso]) => peso > 0 && signal !== "EVENT_CHECKIN")
            .map(([, peso]) => peso);

        for (const peso of positivos) {
            expect(peso).toBeGreaterThanOrEqual(1);
            expect(peso).toBeLessThanOrEqual(5);
        }
    });

    it("dá ao check-in o peso que rompe a faixa, por ser prova de comportamento real", () => {
        expect(DEFAULT_WEIGHTS.signals.EVENT_CHECKIN).toBe(10);
    });

    it("mantém IMPRESSION em zero, porque é denominador", () => {
        expect(DEFAULT_WEIGHTS.signals.IMPRESSION).toBe(0);
    });

    it("faz o negativo mais forte superar em módulo qualquer positivo", () => {
        const maiorPositivo = Math.max(...Object.values(DEFAULT_WEIGHTS.signals));
        const menorNegativo = Math.min(...Object.values(DEFAULT_WEIGHTS.signals));

        expect(Math.abs(menorNegativo)).toBeGreaterThanOrEqual(maiorPositivo);
    });
});
