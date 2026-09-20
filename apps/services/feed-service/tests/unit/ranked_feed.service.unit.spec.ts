import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    CANDIDATE_LIMIT,
    InvalidFeedCursorError,
    RankedFeedService,
    SESSION_TTL_SECONDS,
} from "../../src/services/ranked_feed.service";
import { isInChronologicalHoldout } from "../../src/ranking/experiment";
import { encodeSessionCursor, parseFeedCursor } from "../../src/utils/feed_cursor";
import type { ItemFeatures } from "../../src/ranking/types";

type Mock = ReturnType<typeof vi.fn>;

const AGORA = new Date("2026-09-12T23:00:00.000Z");
const SESSAO = "7e1f0c8a-1111-4111-8111-aaaaaaaaaaaa";
const HORA = 60 * 60 * 1000;

function acharUsuario(condicao: (id: string) => boolean): string {
    for (let i = 0; i < 10_000; i += 1) {
        const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        if (condicao(id)) { return id; }
    }
    throw new Error("nenhum id satisfaz a condição");
}

const FORA_DO_HOLDOUT = acharUsuario((id) => !isInChronologicalHoldout(id));
const NO_HOLDOUT = acharUsuario((id) => isInChronologicalHoldout(id));

function row(itemId: string, horasAtras: number, authorId = "autor-x") {
    return {
        user_id: FORA_DO_HOLDOUT,
        created_at: new Date(AGORA.getTime() - horasAtras * HORA),
        item_id: itemId,
        item_type: "USER_POST",
        author_id: authorId,
        image_urls: [],
        media: null,
    };
}

function build(rolloutShare: number, afinidades: Record<string, number> = {}) {
    const feedService = {
        getFeedByUser: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    const feedRepository = {
        findByUser: vi.fn().mockResolvedValue({ rows: [] }),
        findByKeys: vi.fn().mockResolvedValue([]),
    };
    const sessionRepository = {
        saveSession: vi.fn().mockResolvedValue(undefined),
        findPage: vi.fn().mockResolvedValue([]),
    };
    const rankingFeaturesService = {
        buildItemFeatures: vi.fn(async (_userId: string, candidates: { itemId: string; createdAt: Date }[], now: Date) =>
            candidates.map<ItemFeatures>((candidate) => ({
                itemId: candidate.itemId,
                ageHours: (now.getTime() - candidate.createdAt.getTime()) / HORA,
                impressions: 0,
                signals: {},
                dwellMsSum: 0,
                affinity: afinidades[candidate.itemId] ?? 0,
            }))
        ),
    };

    const service = new RankedFeedService(
        feedService as never,
        feedRepository as never,
        sessionRepository as never,
        rankingFeaturesService as never,
        rolloutShare
    );

    return { service, feedService, feedRepository, sessionRepository, rankingFeaturesService };
}

describe("RankedFeedService — quem recebe ranking", () => {
    it("com a fatia em 0%, ninguém recebe ranking: o deploy entra desligado", async () => {
        const { service, feedService, feedRepository } = build(0);

        await service.getFeed(FORA_DO_HOLDOUT, 20, undefined, AGORA);

        expect(feedService.getFeedByUser).toHaveBeenCalledWith(FORA_DO_HOLDOUT, 20, undefined);
        expect(feedRepository.findByUser).not.toHaveBeenCalled();
    });

    it("o holdout cronológico nunca recebe ranking, nem com a fatia em 100%", async () => {
        const { service, feedService, feedRepository } = build(1);

        await service.getFeed(NO_HOLDOUT, 20, undefined, AGORA);

        expect(feedService.getFeedByUser).toHaveBeenCalled();
        expect(feedRepository.findByUser).not.toHaveBeenCalled();
    });

    it("fatia inválida é tratada como 0%, não como ligado", () => {
        const { service } = build(Number.NaN);

        expect(service.variantFor(FORA_DO_HOLDOUT)).toBe("chronological");
    });

    it("com a fatia em 100%, quem está fora do holdout recebe ranking", () => {
        const { service } = build(1);

        expect(service.variantFor(FORA_DO_HOLDOUT)).toBe("ranked");
    });
});

describe("RankedFeedService — primeira página rankeada", () => {
    it("lê os candidatos recentes e ordena pelo score, não pela data", async () => {
        // "antigo" é de 3h atrás, mas de um autor com quem o leitor tem afinidade máxima.
        const { service, feedRepository, sessionRepository } = build(1, { antigo: 1 });
        feedRepository.findByUser.mockResolvedValue({ rows: [row("recente", 1), row("antigo", 3)] });

        const page = await service.getFeed(FORA_DO_HOLDOUT, 20, undefined, AGORA);

        expect(feedRepository.findByUser).toHaveBeenCalledWith(FORA_DO_HOLDOUT, CANDIDATE_LIMIT);
        expect((page.items as { item_id: string }[]).map((item) => item.item_id)).toEqual(["antigo", "recente"]);
        // Tudo coube numa página: não há sessão para gravar nem próxima página.
        expect(sessionRepository.saveSession).not.toHaveBeenCalled();
        expect(page.nextCursor).toBeNull();
    });

    it("sem nenhum item no feed devolve página vazia sem calcular features", async () => {
        const { service, rankingFeaturesService } = build(1);

        const page = await service.getFeed(FORA_DO_HOLDOUT, 20, undefined, AGORA);

        expect(page).toEqual({ items: [], nextCursor: null });
        expect(rankingFeaturesService.buildItemFeatures).not.toHaveBeenCalled();
    });

    it("com mais itens que o limite, congela a ordem inteira numa sessão com TTL", async () => {
        const { service, feedRepository, sessionRepository } = build(1);
        feedRepository.findByUser.mockResolvedValue({
            rows: [row("a", 1), row("b", 2), row("c", 3), row("d", 4), row("e", 5)],
        });

        const page = await service.getFeed(FORA_DO_HOLDOUT, 2, undefined, AGORA);

        expect(page.items).toHaveLength(2);
        const [userId, , chaves, ttl] = sessionRepository.saveSession.mock.calls[0]!;
        expect(userId).toBe(FORA_DO_HOLDOUT);
        expect(chaves).toHaveLength(5);
        expect(ttl).toBe(SESSION_TTL_SECONDS);

        const cursor = parseFeedCursor(page.nextCursor!);
        expect(cursor).toMatchObject({ kind: "session", offset: 2, tail: null });
    });

    it("com candidatos no teto, o cursor leva a data do mais antigo para o feed continuar depois", async () => {
        const { service, feedRepository } = build(1);
        const rows = Array.from({ length: CANDIDATE_LIMIT }, (_, i) => row(`item-${i}`, i + 1));
        feedRepository.findByUser.mockResolvedValue({ rows });

        const page = await service.getFeed(FORA_DO_HOLDOUT, 20, undefined, AGORA);

        const cursor = parseFeedCursor(page.nextCursor!);
        expect(cursor).toMatchObject({
            kind: "session",
            tail: new Date(AGORA.getTime() - CANDIDATE_LIMIT * HORA),
        });
    });
});

describe("RankedFeedService — páginas da sessão", () => {
    const k = (itemId: string, horasAtras: number) => ({
        createdAt: new Date(AGORA.getTime() - horasAtras * HORA),
        itemId,
    });

    it("lê a próxima fatia da sessão e devolve na ordem da sessão, não na do banco", async () => {
        const { service, feedRepository, sessionRepository } = build(0);
        sessionRepository.findPage.mockResolvedValue([k("x", 5), k("y", 1), k("z", 3)]);
        // O Cassandra devolve por created_at DESC: y antes de x.
        feedRepository.findByKeys.mockResolvedValue([row("y", 1), row("x", 5)]);

        const page = await service.getFeed(FORA_DO_HOLDOUT, 2, encodeSessionCursor(SESSAO, 2), AGORA);

        expect(sessionRepository.findPage).toHaveBeenCalledWith(FORA_DO_HOLDOUT, SESSAO, 2, 3);
        expect(feedRepository.findByKeys).toHaveBeenCalledWith(FORA_DO_HOLDOUT, [k("x", 5), k("y", 1)]);
        expect((page.items as { item_id: string }[]).map((item) => item.item_id)).toEqual(["x", "y"]);
        expect(parseFeedCursor(page.nextCursor!)).toMatchObject({ kind: "session", offset: 4 });
    });

    it("serve a sessão mesmo com a fatia em 0%: quem começou rankeado termina rankeado", async () => {
        const { service, sessionRepository, feedService } = build(0);
        sessionRepository.findPage.mockResolvedValue([k("x", 5)]);

        await service.getFeed(FORA_DO_HOLDOUT, 2, encodeSessionCursor(SESSAO, 2), AGORA);

        expect(sessionRepository.findPage).toHaveBeenCalled();
        expect(feedService.getFeedByUser).not.toHaveBeenCalled();
    });

    it("pula item que sumiu desde que a sessão foi aberta, sem quebrar a página", async () => {
        const { service, feedRepository, sessionRepository } = build(0);
        sessionRepository.findPage.mockResolvedValue([k("apagado", 5), k("vivo", 1)]);
        feedRepository.findByKeys.mockResolvedValue([row("vivo", 1)]);

        const page = await service.getFeed(FORA_DO_HOLDOUT, 2, encodeSessionCursor(SESSAO, 2), AGORA);

        expect((page.items as { item_id: string }[]).map((item) => item.item_id)).toEqual(["vivo"]);
    });

    it("no fim da sessão com tail, continua cronologicamente a partir do candidato mais antigo", async () => {
        const { service, feedRepository, sessionRepository } = build(0);
        const tail = new Date("2026-09-01T00:00:00.000Z");
        sessionRepository.findPage.mockResolvedValue([k("ultimo", 5)]);
        feedRepository.findByKeys.mockResolvedValue([row("ultimo", 5)]);

        const page = await service.getFeed(FORA_DO_HOLDOUT, 2, encodeSessionCursor(SESSAO, 198, tail), AGORA);

        expect(parseFeedCursor(page.nextCursor!)).toEqual({ kind: "legacy", before: tail });
    });

    it("no fim da sessão sem tail, o feed termina", async () => {
        const { service, feedRepository, sessionRepository } = build(0);
        sessionRepository.findPage.mockResolvedValue([k("ultimo", 5)]);
        feedRepository.findByKeys.mockResolvedValue([row("ultimo", 5)]);

        const page = await service.getFeed(FORA_DO_HOLDOUT, 2, encodeSessionCursor(SESSAO, 4), AGORA);

        expect(page.nextCursor).toBeNull();
    });

    it("sessão expirada termina o feed em vez de reabrir e repetir itens", async () => {
        const { service, feedRepository, sessionRepository } = build(1);
        sessionRepository.findPage.mockResolvedValue([]);

        const page = await service.getFeed(FORA_DO_HOLDOUT, 2, encodeSessionCursor(SESSAO, 40), AGORA);

        expect(page).toEqual({ items: [], nextCursor: null });
        expect(feedRepository.findByUser).not.toHaveBeenCalled();
    });
});

describe("RankedFeedService — compatibilidade", () => {
    it("cursor de data segue cronológico, mesmo para quem está no grupo rankeado", async () => {
        const { service, feedService, feedRepository } = build(1);
        const antes = "2026-09-12T02:00:00.000Z";

        await service.getFeed(FORA_DO_HOLDOUT, 20, antes, AGORA);

        expect(feedService.getFeedByUser).toHaveBeenCalledWith(FORA_DO_HOLDOUT, 20, new Date(antes));
        expect(feedRepository.findByUser).not.toHaveBeenCalled();
    });

    it("o cursor do caminho cronológico sai como data ISO em texto, igual ao contrato antigo", async () => {
        const { service, feedService } = build(0);
        feedService.getFeedByUser.mockResolvedValue({
            items: [{}],
            nextCursor: new Date("2026-09-10T08:00:00.000Z"),
        });

        const page = await service.getFeed(FORA_DO_HOLDOUT, 20, undefined, AGORA);

        expect(page.nextCursor).toBe("2026-09-10T08:00:00.000Z");
    });

    it("cursor inválido lança erro próprio, que a rota traduz em 400", async () => {
        const { service } = build(1);

        await expect(service.getFeed(FORA_DO_HOLDOUT, 20, "not-a-date", AGORA)).rejects.toBeInstanceOf(
            InvalidFeedCursorError
        );
    });
});
