import { afterEach, describe, expect, it } from "vitest";
import { ChronologicalScorer, HeuristicScorer } from "../../src/ranking/heuristic.scorer";
import { ItemFeatures, RankingContext, rankItems } from "../../src/ranking/types";
import { DEFAULT_WEIGHTS, getWeights, loadWeights, resetWeights } from "../../src/ranking/weights";

const CONTEXT: RankingContext = { now: new Date("2026-09-12T02:00:00.000Z") };

function item(overrides: Partial<ItemFeatures> = {}): ItemFeatures {
    return {
        itemId: "post-1",
        ageHours: 1,
        impressions: 100,
        signals: { LIKE: 10 },
        affinity: 0,
        dwellMsSum: 0,
        ...overrides,
    };
}

afterEach(() => {
    resetWeights();
});

describe("HeuristicScorer", () => {
    it("identifica a versão dos pesos no nome, para aparecer no log", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        expect(scorer.name).toBe(`heuristic@${DEFAULT_WEIGHTS.version}`);
    });

    it("é função pura: o mesmo input dá sempre o mesmo score", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);
        const features = item();

        expect(scorer.score(features, CONTEXT).score).toBe(scorer.score(features, CONTEXT).score);
    });

    it("expõe as parcelas do score para depuração", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const { breakdown } = scorer.score(item(), CONTEXT);

        expect(Object.keys(breakdown).sort()).toEqual([
            "affinity",
            "decay",
            "dwell",
            "dwellMultiple",
            "engagement",
            "qualityMultiple",
            "smoothedAvgDwellMs",
            "smoothedRate",
            "weightedActions",
        ]);
    });

    it("prefere o item mais engajado quando idade e afinidade são iguais", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const engajado = scorer.score(item({ itemId: "a", signals: { LIKE: 40 } }), CONTEXT);
        const fraco = scorer.score(item({ itemId: "b", signals: { LIKE: 2 } }), CONTEXT);

        expect(engajado.score).toBeGreaterThan(fraco.score);
    });

    it("prefere o item mais recente quando o engajamento é igual", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const novo = scorer.score(item({ itemId: "a", ageHours: 1 }), CONTEXT);
        const velho = scorer.score(item({ itemId: "b", ageHours: 30 }), CONTEXT);

        expect(novo.score).toBeGreaterThan(velho.score);
    });

    it("prefere o item que prende mais atenção quando o resto é igual", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        // 100 impressões nos dois: 9s médios contra 1s médio.
        const prendeu = scorer.score(item({ itemId: "a", dwellMsSum: 900_000 }), CONTEXT);
        const passou = scorer.score(item({ itemId: "b", dwellMsSum: 100_000 }), CONTEXT);

        expect(prendeu.score).toBeGreaterThan(passou.score);
        expect(prendeu.breakdown.dwellMultiple).toBeGreaterThan(passou.breakdown.dwellMultiple);
    });

    it("uma pessoa só olhando 60s não supera cem pessoas olhando 9s", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const umaPessoa = scorer.score(
            item({ itemId: "a", impressions: 1, dwellMsSum: 60_000, signals: {} }),
            CONTEXT
        );
        const cemPessoas = scorer.score(
            item({ itemId: "b", impressions: 100, dwellMsSum: 900_000, signals: {} }),
            CONTEXT
        );

        expect(cemPessoas.breakdown.dwellMultiple).toBeGreaterThan(umaPessoa.breakdown.dwellMultiple);
    });

    it("afinidade alta levanta um item de engajamento igual", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const comAfinidade = scorer.score(item({ itemId: "a", affinity: 1 }), CONTEXT);
        const semAfinidade = scorer.score(item({ itemId: "b", affinity: 0 }), CONTEXT);

        expect(comAfinidade.score).toBeGreaterThan(semAfinidade.score);
    });

    it("post excelente de anteontem perde do post mediano de agora", () => {
        // É o comportamento pretendido num app de vida noturna: recência é validade.
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const otimoEVelho = scorer.score(
            item({ itemId: "velho", ageHours: 48, signals: { LIKE: 500, EVENT_CHECKIN: 20 }, impressions: 1_000 }),
            CONTEXT
        );
        const medianoEAgora = scorer.score(
            item({ itemId: "novo", ageHours: 0.5, signals: { LIKE: 5 }, impressions: 100 }),
            CONTEXT
        );

        expect(medianoEAgora.score).toBeGreaterThan(otimoEVelho.score);
    });

    it("item rejeitado afunda abaixo de um item sem nenhuma interação", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const rejeitado = scorer.score(
            item({ itemId: "a", signals: { LIKE: 1, NOT_INTERESTED: 5 } }),
            CONTEXT
        );
        const neutro = scorer.score(item({ itemId: "b", signals: {} }), CONTEXT);

        expect(rejeitado.score).toBeLessThan(neutro.score);
        expect(rejeitado.score).toBeLessThan(0);
    });

    it("check-in pesa mais que a mesma quantidade de curtidas no score final", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const comCheckin = scorer.score(item({ itemId: "a", signals: { EVENT_CHECKIN: 10 } }), CONTEXT);
        const comLikes = scorer.score(item({ itemId: "b", signals: { LIKE: 10 } }), CONTEXT);

        expect(comCheckin.score).toBeGreaterThan(comLikes.score);
    });

    it("um item médio recebe qualidade normalizada perto de 1", () => {
        // 100 impressões com 4% de curtidas = a média da plataforma.
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const medio = scorer.score(item({ impressions: 100, signals: { LIKE: 4 } }), CONTEXT);

        expect(medio.breakdown.qualityMultiple).toBeGreaterThan(0.7);
        expect(medio.breakdown.qualityMultiple).toBeLessThan(1.3);
    });

    it("congela os pesos na construção, para não comparar itens com réguas diferentes", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);
        const antes = scorer.score(item(), CONTEXT).score;

        loadWeights({ ...DEFAULT_WEIGHTS, version: "nova", engagementWeight: 99 });

        expect(scorer.score(item(), CONTEXT).score).toBe(antes);
        // Um scorer novo já nasce com a config nova.
        expect(new HeuristicScorer(getWeights()).score(item(), CONTEXT).score).not.toBe(antes);
    });
});

describe("ChronologicalScorer", () => {
    it("ordena só por recência, ignorando engajamento", () => {
        const scorer = new ChronologicalScorer();

        const velhoEBom = scorer.score(
            item({ itemId: "velho", ageHours: 10, signals: { LIKE: 999 } }),
            CONTEXT
        );
        const novoEFraco = scorer.score(
            item({ itemId: "novo", ageHours: 1, signals: {} }),
            CONTEXT
        );

        expect(novoEFraco.score).toBeGreaterThan(velhoEBom.score);
    });
});

describe("rankItems", () => {
    it("ordena por score decrescente", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);

        const ordenado = rankItems(
            scorer,
            [
                item({ itemId: "fraco", signals: { LIKE: 1 } }),
                item({ itemId: "forte", signals: { LIKE: 80 } }),
                item({ itemId: "medio", signals: { LIKE: 20 } }),
            ],
            CONTEXT
        );

        expect(ordenado.map((i) => i.itemId)).toEqual(["forte", "medio", "fraco"]);
    });

    it("desempata de forma estável por itemId", () => {
        const scorer = new HeuristicScorer(DEFAULT_WEIGHTS);
        const iguais = [item({ itemId: "b" }), item({ itemId: "a" }), item({ itemId: "c" })];

        expect(rankItems(scorer, iguais, CONTEXT).map((i) => i.itemId)).toEqual(["a", "b", "c"]);
        // Ordem de entrada diferente, mesma saída — é o que evita feed instável.
        expect(rankItems(scorer, [...iguais].reverse(), CONTEXT).map((i) => i.itemId)).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    it("lista vazia devolve lista vazia", () => {
        expect(rankItems(new HeuristicScorer(DEFAULT_WEIGHTS), [], CONTEXT)).toEqual([]);
    });
});
