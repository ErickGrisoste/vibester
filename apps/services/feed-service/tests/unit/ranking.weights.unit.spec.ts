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
        // priorRate agora é ponto por impressão, então 5 é válido; negativo não é.
        const result = loadWeights({ ...DEFAULT_WEIGHTS, priorRate: -1 });

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

    it("recusa peso de atenção negativo", () => {
        expect(loadWeights({ ...DEFAULT_WEIGHTS, dwellWeight: -1 }).ok).toBe(false);
    });

    it("resetWeights volta para o chute inicial", () => {
        loadWeights({ ...DEFAULT_WEIGHTS, version: "temporaria" });
        resetWeights();

        expect(getWeights()).toBe(DEFAULT_WEIGHTS);
    });
});

describe("DEFAULT_WEIGHTS", () => {
    it("usa a escala de teto 100, com LIKE em 60", () => {
        expect(DEFAULT_WEIGHTS.signals.LIKE).toBe(60);
    });

    it("respeita o teto 100 em todos os pesos, exceto NOT_INTERESTED", () => {
        for (const [sinal, peso] of Object.entries(DEFAULT_WEIGHTS.signals)) {
            if (sinal === "NOT_INTERESTED") { continue; }
            expect(Math.abs(peso)).toBeLessThanOrEqual(100);
        }
    });

    it("rompe o teto em NOT_INTERESTED para preservar a assimetria de custo", () => {
        const maiorPositivo = Math.max(...Object.values(DEFAULT_WEIGHTS.signals));

        expect(DEFAULT_WEIGHTS.signals.NOT_INTERESTED).toBe(-200);
        expect(Math.abs(DEFAULT_WEIGHTS.signals.NOT_INTERESTED)).toBe(2 * maiorPositivo);
    });

    it("usa τ de 30 dias para a afinidade com autor, como no desenho", () => {
        expect(DEFAULT_WEIGHTS.affinityTauDays).toBe(30);
    });

    it("recusa τ não positivo", () => {
        expect(loadWeights({ ...DEFAULT_WEIGHTS, affinityTauDays: 0 }).ok).toBe(false);
    });

    it("mantém a ordem relativa do catálogo entre as ações de intenção", () => {
        const { TICKET_CLICK, LIKE, SAVE, PROFILE_OPEN, DWELL } = DEFAULT_WEIGHTS.signals;

        expect(TICKET_CLICK).toBeGreaterThan(LIKE);
        expect(LIKE).toBeGreaterThan(SAVE);
        expect(SAVE).toBeGreaterThan(PROFILE_OPEN);
        expect(PROFILE_OPEN).toBeGreaterThan(DWELL);
    });

    it("coloca comentário e check-in no topo da escala", () => {
        expect(DEFAULT_WEIGHTS.signals.COMMENT).toBe(100);
        expect(DEFAULT_WEIGHTS.signals.EVENT_CHECKIN).toBe(100);
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
