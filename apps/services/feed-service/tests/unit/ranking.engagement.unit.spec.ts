import { describe, expect, it } from "vitest";
import {
    recencyDecay,
    smoothedEngagementRate,
    weightedActions,
} from "../../src/ranking/engagement";
import { DEFAULT_WEIGHTS } from "../../src/ranking/weights";

// Media da plataforma em pontos por impressao (4% x peso 60 do like) e 30
// impressoes de credito a priori.
const SMOOTHING = { priorRate: 2.4, priorWeight: 30 };

describe("smoothedEngagementRate", () => {
    /**
     * O teste que justifica a existência da suavização: a MESMA taxa crua de 50% em
     * volumes diferentes tem que produzir confiança diferente.
     */
    it("separa ruído de evidência na mesma proporção crua", () => {
        // Em todos os casos metade de quem viu curtiu: 30 pontos por impressão
        // (0,5 × peso 60). O que muda é só quanta evidência existe.
        const casos = [
            { acoes: 60, impressoes: 2, esperado: 4.125 },
            { acoes: 600, impressoes: 20, esperado: 13.44 },
            { acoes: 3_000, impressoes: 100, esperado: 23.63 },
            { acoes: 30_000, impressoes: 1_000, esperado: 29.20 },
            { acoes: 300_000, impressoes: 10_000, esperado: 29.92 },
        ];

        for (const { acoes, impressoes, esperado } of casos) {
            expect(smoothedEngagementRate(acoes, impressoes, SMOOTHING)).toBeCloseTo(esperado, 2);
        }
    });

    it("cresce monotonicamente com o volume, mantendo a proporção crua fixa", () => {
        const taxas = [2, 20, 100, 1_000, 10_000].map((impressoes) =>
            smoothedEngagementRate(impressoes * 30, impressoes, SMOOTHING)
        );

        for (let i = 1; i < taxas.length; i += 1) {
            expect(taxas[i]!).toBeGreaterThan(taxas[i - 1]!);
        }

        // Converge para os 30 pontos crus, mas nunca os ultrapassa.
        expect(taxas[taxas.length - 1]!).toBeLessThan(30);
    });

    it("devolve a média a priori quando não houve impressão, em vez de dividir por zero", () => {
        expect(smoothedEngagementRate(0, 0, SMOOTHING)).toBe(2.4);
        expect(smoothedEngagementRate(5, 0, SMOOTHING)).toBe(2.4);
        expect(smoothedEngagementRate(5, -3, SMOOTHING)).toBe(2.4);
    });

    it("item sem impressão não é penalizado como item ruim — é tratado como não medido", () => {
        const naoMedido = smoothedEngagementRate(0, 0, SMOOTHING);
        const medidoERuim = smoothedEngagementRate(0, 500, SMOOTHING);

        expect(naoMedido).toBeGreaterThan(medidoERuim);
    });

    it("ação ponderada negativa afunda a taxa abaixo da priori", () => {
        // Um NOT_INTERESTED vale -100, então cinco deles derrubam o numerador bem
        // abaixo do crédito a priori.
        const comRejeicao = smoothedEngagementRate(-500, 100, SMOOTHING);

        expect(comRejeicao).toBeLessThan(0);
    });
});

describe("weightedActions", () => {
    const pesos = DEFAULT_WEIGHTS.signals;

    it("ignora IMPRESSION, que é denominador e não numerador", () => {
        expect(weightedActions({ IMPRESSION: 1_000 }, pesos)).toBe(0);
    });

    it("soma os sinais positivos pelos pesos configurados", () => {
        // 2 likes (60) + 1 comentário (100) = 220
        expect(weightedActions({ LIKE: 2, COMMENT: 1 }, pesos)).toBe(220);
    });

    it("empata o check-in com o comentário no topo da escala", () => {
        // Na escala de teto 100, check-in e comentário são ambos o máximo.
        expect(weightedActions({ EVENT_CHECKIN: 1 }, pesos)).toBe(
            weightedActions({ COMMENT: 1 }, pesos)
        );
    });

    it("põe o check-in acima de uma curtida e abaixo de duas", () => {
        const checkin = weightedActions({ EVENT_CHECKIN: 1 }, pesos);

        expect(checkin).toBeGreaterThan(weightedActions({ LIKE: 1 }, pesos));
        expect(checkin).toBeLessThan(weightedActions({ LIKE: 2 }, pesos));
    });

    it("um NOT_INTERESTED anula quase duas curtidas", () => {
        // ATENÇÃO: na escala de teto 100 o negativo mais forte (-100) apenas EMPATA
        // com o positivo mais forte (COMMENT/EVENT_CHECKIN = 100). A assimetria de
        // custo que existia na escala ancorada em 1 não sobrevive ao teto — se ela
        // for desejada, NOT_INTERESTED precisa romper o teto de propósito.
        expect(weightedActions({ LIKE: 1, NOT_INTERESTED: 1 }, pesos)).toBe(-40);
        expect(weightedActions({ LIKE: 2, NOT_INTERESTED: 1 }, pesos)).toBe(20);
        expect(weightedActions({ COMMENT: 1, NOT_INTERESTED: 1 }, pesos)).toBe(0);
    });

    it("ignora sinal desconhecido em vez de quebrar", () => {
        const comLixo = { LIKE: 1, SINAL_INEXISTENTE: 99 } as never;

        expect(weightedActions(comLixo, pesos)).toBe(60);
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
