import { beforeEach, describe, expect, it, vi } from "vitest";
import { RankingFeaturesService, affinityTtlSeconds } from "../../src/services/ranking_features.service";
import type { RankingCountersRepository } from "../../src/repositories/ranking_counters.repository";
import { DWELL_MS_SUM_ROW } from "../../src/repositories/ranking_counters.repository";
import { InteractionsNormalizedEvent } from "../../src/schema/events/interactions-normalized.schema";
import { DEFAULT_WEIGHTS } from "../../src/ranking/weights";
import { HeuristicScorer } from "../../src/ranking/heuristic.scorer";
import { rankItems } from "../../src/ranking/types";

type Mock = ReturnType<typeof vi.fn>;

const LEITOR = "leitor-1";
const AUTOR = "autor-1";
const OCORREU = "2026-09-12T02:00:00.000Z";

function mockRepository() {
    return {
        incrementItem: vi.fn().mockResolvedValue(undefined),
        findCountsByItems: vi.fn().mockResolvedValue({}),
        findAffinityPair: vi.fn().mockResolvedValue({}),
        upsertAffinity: vi.fn().mockResolvedValue(undefined),
        findAffinityByUser: vi.fn().mockResolvedValue({}),
    } as unknown as RankingCountersRepository;
}

function interaction(overrides: Record<string, unknown> = {}) {
    return {
        userId: LEITOR,
        eventId: "evt-1",
        type: "IMPRESSION",
        itemId: "post-1",
        itemType: "POST",
        occurredAt: OCORREU,
        authorId: AUTOR,
        sessionId: "sess-1",
        position: 0,
        dwellMs: null,
        source: "FEED",
        ...overrides,
    };
}

function event(interactions: Record<string, unknown>[]): InteractionsNormalizedEvent {
    return { v: 1, interactions } as InteractionsNormalizedEvent;
}

describe("RankingFeaturesService.handleInteractions — contadores por item", () => {
    let repo: RankingCountersRepository;
    let service: RankingFeaturesService;

    beforeEach(() => {
        repo = mockRepository();
        service = new RankingFeaturesService(repo);
    });

    it("agrega em memória: 50 impressões do mesmo item viram UM incremento de +50", async () => {
        await service.handleInteractions(
            event(Array.from({ length: 50 }, (_, i) => interaction({ eventId: `evt-${i}` })))
        );

        expect(repo.incrementItem).toHaveBeenCalledTimes(1);
        expect(repo.incrementItem).toHaveBeenCalledWith("post-1", [
            { signalType: "IMPRESSION", delta: 50 },
        ]);
    });

    it("separa os incrementos por tipo de sinal", async () => {
        await service.handleInteractions(
            event([
                interaction({ type: "IMPRESSION" }),
                interaction({ type: "IMPRESSION", eventId: "evt-2" }),
                interaction({ type: "LIKE", eventId: "evt-3" }),
            ])
        );

        const increments = (repo.incrementItem as Mock).mock.calls[0]![1];

        expect(increments).toEqual(
            expect.arrayContaining([
                { signalType: "IMPRESSION", delta: 2 },
                { signalType: "LIKE", delta: 1 },
            ])
        );
    });

    it("soma o dwell só das impressões, numa linha reservada", async () => {
        await service.handleInteractions(
            event([
                interaction({ type: "IMPRESSION", dwellMs: 4000 }),
                interaction({ type: "IMPRESSION", dwellMs: 2000, eventId: "evt-2" }),
                // DWELL é o sinal derivado de atenção longa: o dwellMs dele não é somado de novo.
                interaction({ type: "DWELL", dwellMs: 9000, eventId: "evt-3" }),
                interaction({ type: "LIKE", dwellMs: null, eventId: "evt-4" }),
            ])
        );

        const increments = (repo.incrementItem as Mock).mock.calls[0]![1];

        expect(increments).toEqual(
            expect.arrayContaining([
                { signalType: "IMPRESSION", delta: 2 },
                { signalType: "DWELL", delta: 1 },
                { signalType: "LIKE", delta: 1 },
                { signalType: DWELL_MS_SUM_ROW, delta: 6000 },
            ])
        );
        expect(increments).toHaveLength(4);
    });

    it("impressão sem dwell não cria a linha de soma", async () => {
        await service.handleInteractions(
            event([interaction({ dwellMs: null }), interaction({ dwellMs: 0, eventId: "evt-2" })])
        );

        const increments = (repo.incrementItem as Mock).mock.calls[0]![1];

        expect(increments).toEqual([{ signalType: "IMPRESSION", delta: 2 }]);
    });

    it("separa itens diferentes em chamadas diferentes", async () => {
        await service.handleInteractions(
            event([interaction({ itemId: "post-1" }), interaction({ itemId: "post-2" })])
        );

        expect(repo.incrementItem).toHaveBeenCalledTimes(2);
    });
});

describe("RankingFeaturesService.handleInteractions — afinidade decaída", () => {
    let repo: RankingCountersRepository;
    let service: RankingFeaturesService;

    beforeEach(() => {
        repo = mockRepository();
        service = new RankingFeaturesService(repo);
    });

    it("não toca afinidade para impressão — o evento mais volumoso, com peso zero", async () => {
        await service.handleInteractions(
            event(Array.from({ length: 50 }, (_, i) => interaction({ eventId: `evt-${i}` })))
        );

        expect(repo.findAffinityPair).not.toHaveBeenCalled();
        expect(repo.upsertAffinity).not.toHaveBeenCalled();
    });

    it("grava a primeira interação de um par com valor 1, no instante em que ocorreu", async () => {
        await service.handleInteractions(event([interaction({ type: "LIKE" })]));

        expect(repo.findAffinityPair).toHaveBeenCalledWith(LEITOR, AUTOR);
        expect(repo.upsertAffinity).toHaveBeenCalledWith(
            LEITOR,
            AUTOR,
            "LIKE",
            1,
            new Date(OCORREU),
            affinityTtlSeconds(DEFAULT_WEIGHTS.affinityTauDays)
        );
    });

    it("decai o valor existente pelo tempo decorrido antes de somar", async () => {
        // Última atualização exatamente 30 dias (1 τ) antes do evento.
        (repo.findAffinityPair as Mock).mockResolvedValue({
            LIKE: { value: 10, updatedAt: new Date("2026-08-13T02:00:00.000Z") },
        });

        await service.handleInteractions(event([interaction({ type: "LIKE" })]));

        const [, , signal, value, updatedAt] = (repo.upsertAffinity as Mock).mock.calls[0]!;

        expect(signal).toBe("LIKE");
        expect(value).toBeCloseTo(10 * Math.exp(-1) + 1, 6);
        expect(updatedAt).toEqual(new Date(OCORREU));
    });

    it("evento atrasado não rejuvenesce o acumulado: soma o incremento já envelhecido", async () => {
        // A última atualização é 30 dias DEPOIS do evento: o lote chegou atrasado.
        const ancora = new Date("2026-10-12T02:00:00.000Z");
        (repo.findAffinityPair as Mock).mockResolvedValue({
            LIKE: { value: 10, updatedAt: ancora },
        });

        await service.handleInteractions(event([interaction({ type: "LIKE" })]));

        const [, , , value, updatedAt] = (repo.upsertAffinity as Mock).mock.calls[0]!;

        expect(value).toBeCloseTo(10 + Math.exp(-1), 6);
        expect(updatedAt).toEqual(ancora);
    });

    it("vários eventos do mesmo sinal no lote: uma leitura e uma escrita", async () => {
        await service.handleInteractions(
            event([
                interaction({ type: "LIKE" }),
                interaction({ type: "LIKE", eventId: "evt-2" }),
                interaction({ type: "LIKE", eventId: "evt-3" }),
            ])
        );

        expect(repo.findAffinityPair).toHaveBeenCalledTimes(1);
        expect(repo.upsertAffinity).toHaveBeenCalledTimes(1);
        expect((repo.upsertAffinity as Mock).mock.calls[0]![3]).toBeCloseTo(3, 6);
    });

    it("sem authorId, conta para o item mas não inventa afinidade", async () => {
        await service.handleInteractions(event([interaction({ type: "LIKE", authorId: null })]));

        expect(repo.incrementItem).toHaveBeenCalledTimes(1);
        expect(repo.findAffinityPair).not.toHaveBeenCalled();
        expect(repo.upsertAffinity).not.toHaveBeenCalled();
    });

    it("não confunde leitores diferentes sobre o mesmo autor", async () => {
        await service.handleInteractions(
            event([
                interaction({ userId: "leitor-a", type: "LIKE" }),
                interaction({ userId: "leitor-b", type: "LIKE", eventId: "evt-2" }),
            ])
        );

        expect(repo.findAffinityPair).toHaveBeenCalledWith("leitor-a", AUTOR);
        expect(repo.findAffinityPair).toHaveBeenCalledWith("leitor-b", AUTOR);
        expect(repo.upsertAffinity).toHaveBeenCalledTimes(2);
    });

    it("processa os pares em sequência, nunca em paralelo — teste-cadeado", async () => {
        // Ler-calcular-gravar só é seguro sem concorrência. Se alguém trocar o laço por
        // Promise.all, este teste falha em vez de a afinidade perder atualização em silêncio.
        let emVoo = 0;
        let pico = 0;
        const lento = async <T>(retorno: T): Promise<T> => {
            emVoo += 1;
            pico = Math.max(pico, emVoo);
            await new Promise((resolve) => setTimeout(resolve, 5));
            emVoo -= 1;
            return retorno;
        };

        (repo.findAffinityPair as Mock).mockImplementation(() => lento({}));
        (repo.upsertAffinity as Mock).mockImplementation(() => lento(undefined));

        await service.handleInteractions(
            event([
                interaction({ userId: "a", type: "LIKE" }),
                interaction({ userId: "b", type: "LIKE", eventId: "evt-2" }),
                interaction({ userId: "c", type: "COMMENT", eventId: "evt-3" }),
            ])
        );

        expect(pico).toBe(1);
    });

    it("usa TTL de seis τ, regravado a cada escrita", () => {
        expect(affinityTtlSeconds(30)).toBe(6 * 30 * 24 * 60 * 60);
    });
});

describe("RankingFeaturesService.buildItemFeatures", () => {
    const AGORA = new Date("2026-09-12T12:00:00.000Z");

    let repo: RankingCountersRepository;
    let service: RankingFeaturesService;

    beforeEach(() => {
        repo = mockRepository();
        service = new RankingFeaturesService(repo);
    });

    it("usa duas queries, independentemente da quantidade de candidatos", async () => {
        const candidatos = Array.from({ length: 40 }, (_, i) => ({
            itemId: `post-${i}`,
            authorId: AUTOR,
            createdAt: AGORA,
        }));

        await service.buildItemFeatures(LEITOR, candidatos, AGORA);

        expect(repo.findCountsByItems).toHaveBeenCalledTimes(1);
        expect(repo.findAffinityByUser).toHaveBeenCalledTimes(1);
    });

    it("calcula a idade em horas a partir do instante do request", async () => {
        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-1", authorId: AUTOR, createdAt: new Date("2026-09-12T04:00:00.000Z") }],
            AGORA
        );

        expect(features[0]!.ageHours).toBe(8);
    });

    it("expõe impressões separadas dos demais sinais, porque é o denominador", async () => {
        (repo.findCountsByItems as Mock).mockResolvedValue({
            "post-1": { IMPRESSION: 300, LIKE: 12 },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-1", authorId: AUTOR, createdAt: AGORA }],
            AGORA
        );

        expect(features[0]!.impressions).toBe(300);
        expect(features[0]!.signals).toEqual({ IMPRESSION: 300, LIKE: 12 });
    });

    it("item sem contador nenhum sai com zero impressão, não com valor inventado", async () => {
        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-novo", authorId: AUTOR, createdAt: AGORA }],
            AGORA
        );

        expect(features[0]!.impressions).toBe(0);
        expect(features[0]!.signals).toEqual({});
    });

    it("extrai a soma de dwell da linha reservada sem vazá-la para os sinais", async () => {
        (repo.findCountsByItems as Mock).mockResolvedValue({
            "post-1": { IMPRESSION: 100, LIKE: 3, [DWELL_MS_SUM_ROW]: 900_000 },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-1", authorId: AUTOR, createdAt: AGORA }],
            AGORA
        );

        expect(features[0]!.dwellMsSum).toBe(900_000);
        expect(features[0]!.signals).toEqual({ IMPRESSION: 100, LIKE: 3 });
    });

    it("item sem dwell registrado sai com soma zero", async () => {
        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-novo", authorId: AUTOR, createdAt: AGORA }],
            AGORA
        );

        expect(features[0]!.dwellMsSum).toBe(0);
    });

    it("deriva a afinidade da contagem decaída com os pesos vigentes", async () => {
        (repo.findAffinityByUser as Mock).mockResolvedValue({
            [AUTOR]: { COMMENT: { value: 8, updatedAt: AGORA } },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-1", authorId: AUTOR, createdAt: AGORA }],
            AGORA
        );

        // 8 comentários × 100 = 800 pontos, com saturação 800 = meia afinidade.
        expect(features[0]!.affinity).toBeCloseTo(0.5, 5);
    });

    it("esquece: a mesma contagem de um mês atrás vale bem menos que a de hoje", async () => {
        const umMesAtras = new Date(AGORA.getTime() - 30 * 24 * 60 * 60 * 1000);

        (repo.findAffinityByUser as Mock).mockResolvedValue({
            [AUTOR]: { COMMENT: { value: 8, updatedAt: AGORA } },
            "autor-antigo": { COMMENT: { value: 8, updatedAt: umMesAtras } },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [
                { itemId: "post-atual", authorId: AUTOR, createdAt: AGORA },
                { itemId: "post-antigo", authorId: "autor-antigo", createdAt: AGORA },
            ],
            AGORA
        );

        // 8 × e^−1 ≈ 2,94 comentários → 294 pontos → 294 / (294 + 800) ≈ 0,27.
        expect(features[1]!.affinity).toBeCloseTo(294.3 / 1094.3, 2);
        expect(features[1]!.affinity).toBeLessThan(features[0]!.affinity);
    });

    it("mudar o peso muda a afinidade sem reprocessar histórico", async () => {
        // É a razão de guardar CONTAGEM decaída e não score.
        (repo.findAffinityByUser as Mock).mockResolvedValue({
            [AUTOR]: { COMMENT: { value: 5, updatedAt: AGORA } },
        });

        const candidatos = [{ itemId: "post-1", authorId: AUTOR, createdAt: AGORA }];

        const comPesoOriginal = await service.buildItemFeatures(LEITOR, candidatos, AGORA);
        const comPesoNovo = await service.buildItemFeatures(LEITOR, candidatos, AGORA, {
            ...DEFAULT_WEIGHTS,
            signals: { ...DEFAULT_WEIGHTS.signals, COMMENT: 200 },
        });

        expect(comPesoNovo[0]!.affinity).toBeGreaterThan(comPesoOriginal[0]!.affinity);
    });

    it("candidato sem autor recebe afinidade 0, sem quebrar", async () => {
        (repo.findAffinityByUser as Mock).mockResolvedValue({
            [AUTOR]: { LIKE: { value: 50, updatedAt: AGORA } },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-1", authorId: null, createdAt: AGORA }],
            AGORA
        );

        expect(features[0]!.affinity).toBe(0);
    });

    it("descarta sinal desconhecido em vez de deixá-lo influenciar o score", async () => {
        (repo.findCountsByItems as Mock).mockResolvedValue({
            "post-1": { LIKE: 3, SINAL_DO_FUTURO: 999 },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-1", authorId: AUTOR, createdAt: AGORA }],
            AGORA
        );

        expect(features[0]!.signals).toEqual({ LIKE: 3 });
    });

    it("lista vazia não vai ao banco", async () => {
        const features = await service.buildItemFeatures(LEITOR, [], AGORA);

        expect(features).toEqual([]);
        expect(repo.findCountsByItems).not.toHaveBeenCalled();
        expect(repo.findAffinityByUser).not.toHaveBeenCalled();
    });

    it("fecha o circuito: features montadas alimentam o scorer e produzem ordem", async () => {
        (repo.findCountsByItems as Mock).mockResolvedValue({
            "post-engajado": { IMPRESSION: 100, LIKE: 60 },
            "post-fraco": { IMPRESSION: 100, LIKE: 1 },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [
                { itemId: "post-fraco", authorId: AUTOR, createdAt: AGORA },
                { itemId: "post-engajado", authorId: AUTOR, createdAt: AGORA },
            ],
            AGORA
        );

        const ordenado = rankItems(new HeuristicScorer(DEFAULT_WEIGHTS), features, { now: AGORA });

        expect(ordenado.map((i) => i.itemId)).toEqual(["post-engajado", "post-fraco"]);
    });
});
