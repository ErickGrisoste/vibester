import { beforeEach, describe, expect, it, vi } from "vitest";
import { RankingFeaturesService } from "../../src/services/ranking_features.service";
import type { RankingCountersRepository } from "../../src/repositories/ranking_counters.repository";
import { InteractionsRawEvent } from "../../src/schema/events/interactions-raw.schema";
import { DEFAULT_WEIGHTS } from "../../src/ranking/weights";
import { HeuristicScorer } from "../../src/ranking/heuristic.scorer";
import { rankItems } from "../../src/ranking/types";

const LEITOR = "leitor-1";
const AUTOR = "autor-1";

function mockRepository() {
    return {
        incrementItem: vi.fn().mockResolvedValue(undefined),
        incrementUserAuthor: vi.fn().mockResolvedValue(undefined),
        findCountsByItems: vi.fn().mockResolvedValue({}),
        findCountsByUser: vi.fn().mockResolvedValue({}),
    } as unknown as RankingCountersRepository;
}

function interaction(overrides: Record<string, unknown> = {}) {
    return {
        userId: LEITOR,
        eventId: "evt-1",
        type: "IMPRESSION",
        itemId: "post-1",
        itemType: "POST",
        occurredAt: "2026-09-12T02:00:00.000Z",
        authorId: AUTOR,
        sessionId: "sess-1",
        position: 0,
        dwellMs: null,
        source: "FEED",
        ...overrides,
    };
}

function event(interactions: Record<string, unknown>[]): InteractionsRawEvent {
    return { v: 1, interactions } as InteractionsRawEvent;
}

describe("RankingFeaturesService.handleInteractions", () => {
    let repo: RankingCountersRepository;
    let service: RankingFeaturesService;

    beforeEach(() => {
        repo = mockRepository();
        service = new RankingFeaturesService(repo);
    });

    it("agrega em memória: 50 impressões do mesmo item viram UM incremento de +50", async () => {
        // É a maior economia de escrita do fluxo — no volume projetado a diferença é
        // entre 1,2M e 60 mil operações por dia.
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

        const increments = (repo.incrementItem as ReturnType<typeof vi.fn>).mock.calls[0]![1];

        expect(increments).toEqual(
            expect.arrayContaining([
                { signalType: "IMPRESSION", delta: 2 },
                { signalType: "LIKE", delta: 1 },
            ])
        );
    });

    it("separa itens diferentes em chamadas diferentes", async () => {
        await service.handleInteractions(
            event([interaction({ itemId: "post-1" }), interaction({ itemId: "post-2" })])
        );

        expect(repo.incrementItem).toHaveBeenCalledTimes(2);
    });

    it("alimenta a afinidade leitor→autor junto do contador do item", async () => {
        await service.handleInteractions(event([interaction({ type: "LIKE" })]));

        expect(repo.incrementUserAuthor).toHaveBeenCalledWith(LEITOR, AUTOR, [
            { signalType: "LIKE", delta: 1 },
        ]);
    });

    it("sem authorId, conta para o item mas não inventa afinidade", async () => {
        await service.handleInteractions(event([interaction({ authorId: null })]));

        expect(repo.incrementItem).toHaveBeenCalledTimes(1);
        expect(repo.incrementUserAuthor).not.toHaveBeenCalled();
    });

    it("não confunde leitores diferentes sobre o mesmo autor", async () => {
        await service.handleInteractions(
            event([
                interaction({ userId: "leitor-a", type: "LIKE" }),
                interaction({ userId: "leitor-b", type: "LIKE" }),
            ])
        );

        expect(repo.incrementUserAuthor).toHaveBeenCalledTimes(2);
        expect(repo.incrementUserAuthor).toHaveBeenCalledWith("leitor-a", AUTOR, expect.anything());
        expect(repo.incrementUserAuthor).toHaveBeenCalledWith("leitor-b", AUTOR, expect.anything());
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
        expect(repo.findCountsByUser).toHaveBeenCalledTimes(1);
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
        (repo.findCountsByItems as ReturnType<typeof vi.fn>).mockResolvedValue({
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

    it("deriva a afinidade dos contadores do autor com os pesos vigentes", async () => {
        (repo.findCountsByUser as ReturnType<typeof vi.fn>).mockResolvedValue({
            [AUTOR]: { LIKE: 20 },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-1", authorId: AUTOR, createdAt: AGORA }],
            AGORA
        );

        // 20 pontos com saturação 20 = meia afinidade.
        expect(features[0]!.affinity).toBeCloseTo(0.5, 5);
    });

    it("mudar o peso muda a afinidade sem reprocessar histórico", async () => {
        // É a razão de guardar CONTAGEM e não score.
        (repo.findCountsByUser as ReturnType<typeof vi.fn>).mockResolvedValue({
            [AUTOR]: { COMMENT: 5 },
        });

        const candidatos = [{ itemId: "post-1", authorId: AUTOR, createdAt: AGORA }];

        const comPesoOriginal = await service.buildItemFeatures(LEITOR, candidatos, AGORA);
        const comPesoNovo = await service.buildItemFeatures(LEITOR, candidatos, AGORA, {
            ...DEFAULT_WEIGHTS,
            signals: { ...DEFAULT_WEIGHTS.signals, COMMENT: 10 },
        });

        expect(comPesoNovo[0]!.affinity).toBeGreaterThan(comPesoOriginal[0]!.affinity);
    });

    it("candidato sem autor recebe afinidade 0, sem quebrar", async () => {
        (repo.findCountsByUser as ReturnType<typeof vi.fn>).mockResolvedValue({
            [AUTOR]: { LIKE: 50 },
        });

        const features = await service.buildItemFeatures(
            LEITOR,
            [{ itemId: "post-1", authorId: null, createdAt: AGORA }],
            AGORA
        );

        expect(features[0]!.affinity).toBe(0);
    });

    it("descarta sinal desconhecido em vez de deixá-lo influenciar o score", async () => {
        (repo.findCountsByItems as ReturnType<typeof vi.fn>).mockResolvedValue({
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
        expect(repo.findCountsByUser).not.toHaveBeenCalled();
    });

    it("fecha o circuito: features montadas alimentam o scorer e produzem ordem", async () => {
        (repo.findCountsByItems as ReturnType<typeof vi.fn>).mockResolvedValue({
            "post-engajado": { IMPRESSION: 100, LIKE: 60 },
            "post-fraco": { IMPRESSION: 100, LIKE: 1 },
        });
        (repo.findCountsByUser as ReturnType<typeof vi.fn>).mockResolvedValue({});

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
