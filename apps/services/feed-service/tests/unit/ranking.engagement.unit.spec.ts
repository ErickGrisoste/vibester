import { describe, expect, it } from "vitest";
import {
    recencyDecay,
    smoothedEngagementRate,
    weightedActions,
} from "../../src/ranking/engagement";
import { DEFAULT_WEIGHTS } from "../../src/ranking/weights";

const SMOOTHING = { priorRate: 0.08, priorWeight: 50 };

describe("smoothedEngagementRate", () => {
    /**
     * O teste que justifica a existência da suavização: a MESMA taxa crua de 50% em
     * volumes diferentes tem que produzir confiança diferente.
     */
    it("separa ruído de evidência na mesma taxa crua de 50%", () => {
        const casos = [
            { acoes: 1, impressoes: 2, esperado: 0.0962 },
            { acoes: 10, impressoes: 20, esperado: 0.2 },
            { acoes: 50, impressoes: 100, esperado: 0.36 },
            { acoes: 500, impressoes: 1_000, esperado: 0.48 },
            { acoes: 5_000, impressoes: 10_000, esperado: 0.4979 },
        ];

        for (const { acoes, impressoes, esperado } of casos) {
            expect(smoothedEngagementRate(acoes, impressoes, SMOOTHING)).toBeCloseTo(esperado, 3);
        }
    });

    it("cresce monotonicamente com o volume, mantendo a taxa crua fixa", () => {
        const taxas = [2, 20, 100, 1_000, 10_000].map((impressoes) =>
            smoothedEngagementRate(impressoes / 2, impressoes, SMOOTHING)
        );

        for (let i = 1; i < taxas.length; i += 1) {
            expect(taxas[i]!).toBeGreaterThan(taxas[i - 1]!);
        }

        // Converge para a taxa crua, mas nunca a ultrapassa.
        expect(taxas[taxas.length - 1]!).toBeLessThan(0.5);
    });

    it("devolve a média a priori quando não houve impressão, em vez de dividir por zero", () => {
        expect(smoothedEngagementRate(0, 0, SMOOTHING)).toBe(0.08);
        expect(smoothedEngagementRate(5, 0, SMOOTHING)).toBe(0.08);
        expect(smoothedEngagementRate(5, -3, SMOOTHING)).toBe(0.08);
    });

    it("item sem impressão não é penalizado como item ruim — é tratado como não medido", () => {
        const naoMedido = smoothedEngagementRate(0, 0, SMOOTHING);
        const medidoERuim = smoothedEngagementRate(0, 500, SMOOTHING);

        expect(naoMedido).toBeGreaterThan(medidoERuim);
    });

    it("ação ponderada negativa afunda a taxa abaixo da priori", () => {
        const comRejeicao = smoothedEngagementRate(-30, 100, SMOOTHING);

        expect(comRejeicao).toBeLessThan(0);
    });
});

describe("weightedActions", () => {
    const pesos = DEFAULT_WEIGHTS.signals;

    it("ignora IMPRESSION, que é denominador e não numerador", () => {
        expect(weightedActions({ IMPRESSION: 1_000 }, pesos)).toBe(0);
    });

    it("soma os sinais positivos pelos pesos configurados", () => {
        // 2 likes (1) + 1 comentário (3) = 5
        expect(weightedActions({ LIKE: 2, COMMENT: 1 }, pesos)).toBe(5);
    });

    it("dá ao check-in em evento o peso de dez curtidas", () => {
        expect(weightedActions({ EVENT_CHECKIN: 1 }, pesos)).toBe(
            weightedActions({ LIKE: 10 }, pesos)
        );
    });

    it("um NOT_INTERESTED supera dez curtidas, por assimetria de custo", () => {
        const total = weightedActions({ LIKE: 10, NOT_INTERESTED: 1 }, pesos);

        expect(total).toBe(0);
        expect(weightedActions({ LIKE: 9, NOT_INTERESTED: 1 }, pesos)).toBeLessThan(0);
    });

    it("ignora sinal desconhecido em vez de quebrar", () => {
        const comLixo = { LIKE: 1, SINAL_INEXISTENTE: 99 } as never;

        expect(weightedActions(comLixo, pesos)).toBe(1);
    });

    it("contagem zero ou ausente não contribui", () => {
        expect(weightedActions({}, pesos)).toBe(0);
        expect(weightedActions({ LIKE: 0 }, pesos)).toBe(0);
    });
});

describe("recencyDecay", () => {
    it("vale 1 no instante da criação e 0.5 em uma meia-vida", () => {
        expect(recencyDecay(0, 8)).toBe(1);
        expect(recencyDecay(8, 8)).toBeCloseTo(0.5, 10);
        expect(recencyDecay(16, 8)).toBeCloseTo(0.25, 10);
    });

    it("derruba um post de ontem para ~12,5% com meia-vida de 8h", () => {
        expect(recencyDecay(24, 8)).toBeCloseTo(0.125, 10);
    });

    it("trata idade negativa como recém-criado, sem virar bônus", () => {
        expect(recencyDecay(-5, 8)).toBe(1);
    });

    it("meia-vida inválida desliga o decaimento em vez de zerar tudo", () => {
        expect(recencyDecay(100, 0)).toBe(1);
        expect(recencyDecay(100, -1)).toBe(1);
    });
});
