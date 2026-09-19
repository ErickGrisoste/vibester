import { randomUUID } from "crypto";
import { types } from "cassandra-driver";
import { env } from "../config/env";
import { FeedRepository } from "../repositories/feed.repository";
import { FeedItemKey, FeedSessionRepository } from "../repositories/feed_session.repository";
import { FeedReadService } from "./feed-read.service";
import { HttpError } from "../errors/http.error";
import { RankingFeaturesService } from "./ranking_features.service";
import { HeuristicScorer } from "../ranking/heuristic.scorer";
import { rankItems } from "../ranking/types";
import { getWeights } from "../ranking/weights";
import { assignVariant, isInChronologicalHoldout } from "../ranking/experiment";
import { encodeLegacyCursor, encodeSessionCursor, parseFeedCursor } from "../utils/feed_cursor";
import { toFeedResponseItem } from "../utils/feed_item";

/** Nome do experimento. Trocar a string reembaralha quem está em cada grupo. */
export const RANKING_EXPERIMENT = "ranking-v1";

/**
 * Quantos itens recentes entram no ranking por sessão.
 *
 * 200 são ~10 páginas de 20 — mais do que uma rolagem típica. É também o custo da primeira
 * página: uma leitura de partição de 200 linhas, duas queries de features e 4 lotes de
 * sessão. Aumentar isso encarece TODA primeira página rankeada.
 */
export const CANDIDATE_LIMIT = 200;

/** Quanto tempo a ordem de uma sessão fica congelada. */
export const SESSION_TTL_SECONDS = 30 * 60;

export interface FeedPage {
    items: unknown[];
    nextCursor: string | null;
}

/**
 * Cursor que não é nem data legada nem token de sessão.
 *
 * É um `HttpError` 400 para que o errorHandler global responda por ele, como por
 * qualquer outro erro do serviço — o controller não precisa de try/catch próprio.
 */
export class InvalidFeedCursorError extends HttpError {
    constructor() {
        super("Invalid cursor", 400);
        this.name = "InvalidFeedCursorError";
    }
}

export type FeedVariant = "ranked" | "chronological";

/**
 * Feed com ranking na leitura (fase 2 do roteiro): ordena o following, não busca
 * conteúdo novo.
 *
 * Quem recebe ranking:
 *
 * 1. o holdout cronológico permanente (5%) NUNCA recebe — é a régua que permite afirmar
 *    que o ranking melhorou alguma coisa;
 * 2. do resto, a fatia `rolloutShare` do experimento `ranking-v1`. O padrão é 0: o código
 *    vai para produção desligado e alguém liga quando o pipeline de interações estiver no ar.
 *
 * O que muda para o app: nada. A resposta continua `{ items, nextCursor }`, e o cursor
 * continua sendo um texto que o app só repassa.
 */
export class RankedFeedService {
    constructor(
        private readonly feedReadService: Pick<FeedReadService, "getFeedByUser"> = new FeedReadService(),
        private readonly feedRepository: Pick<FeedRepository, "findByUser" | "findByKeys"> = new FeedRepository(),
        private readonly sessionRepository: Pick<FeedSessionRepository, "saveSession" | "findPage"> = new FeedSessionRepository(),
        private readonly rankingFeaturesService: Pick<RankingFeaturesService, "buildItemFeatures"> = new RankingFeaturesService(),
        private readonly rolloutShare: number = env.ranking_rollout_share
    ) { }

    variantFor(userId: string): FeedVariant {
        if (isInChronologicalHoldout(userId)) { return "chronological"; }

        const share = clampShare(this.rolloutShare);

        if (share <= 0) { return "chronological"; }

        return assignVariant(userId, RANKING_EXPERIMENT, [
            { name: "ranked", share },
            { name: "chronological", share: 1 - share },
        ]) as FeedVariant;
    }

    async getFeed(userId: string, limit: number, rawCursor?: string, now: Date = new Date()): Promise<FeedPage> {
        const cursor = parseFeedCursor(rawCursor);

        switch (cursor.kind) {
            case "invalid":
                throw new InvalidFeedCursorError();

            // Cursor de data: quem estava rolando o feed antigo durante o deploy, quem está
            // no grupo cronológico, ou quem esgotou uma sessão rankeada.
            case "legacy":
                return this.chronological(userId, limit, cursor.before);

            // Sessão é servida mesmo que a fatia do experimento tenha mudado desde que ela
            // foi aberta: a pessoa termina de rolar com a ordem que começou.
            case "session":
                return this.sessionPage(userId, cursor.sessionId, cursor.offset, cursor.tail, limit);

            case "none":
                return this.variantFor(userId) === "ranked"
                    ? this.firstRankedPage(userId, limit, now)
                    : this.chronological(userId, limit);
        }
    }

    private async chronological(userId: string, limit: number, before?: Date): Promise<FeedPage> {
        const page = await this.feedReadService.getFeedByUser(userId, limit, before);

        return {
            items: page.items,
            nextCursor: page.nextCursor ? encodeLegacyCursor(new Date(page.nextCursor)) : null,
        };
    }

    private async firstRankedPage(userId: string, limit: number, now: Date): Promise<FeedPage> {
        const result = await this.feedRepository.findByUser(userId, CANDIDATE_LIMIT);
        const rows = uniqueByItem(result.rows);

        if (rows.length === 0) { return { items: [], nextCursor: null }; }

        const features = await this.rankingFeaturesService.buildItemFeatures(
            userId,
            rows.map((row) => ({
                itemId: String(row.item_id),
                authorId: row.author_id ? String(row.author_id) : null,
                createdAt: row.created_at as Date,
            })),
            now
        );

        const ranked = rankItems(new HeuristicScorer(getWeights()), features, { now });
        const rowsById = new Map(rows.map((row) => [String(row.item_id), row]));
        const ordered = ranked
            .map((scored) => rowsById.get(scored.itemId))
            .filter((row): row is types.Row => row !== undefined);

        const page = ordered.slice(0, limit).map(toFeedResponseItem);

        if (ordered.length <= limit) { return { items: page, nextCursor: null }; }

        // Candidatos no teto: podem existir itens mais antigos fora da sessão. O cursor leva a
        // data do mais antigo para o feed continuar dali quando a sessão acabar.
        const tail = result.rows.length >= CANDIDATE_LIMIT ? oldestCreatedAt(rows) : null;
        const sessionId = randomUUID();

        await this.sessionRepository.saveSession(userId, sessionId, ordered.map(toKey), SESSION_TTL_SECONDS);

        return { items: page, nextCursor: encodeSessionCursor(sessionId, limit, tail) };
    }

    private async sessionPage(
        userId: string,
        sessionId: string,
        offset: number,
        tail: Date | null,
        limit: number
    ): Promise<FeedPage> {
        const keys = await this.sessionRepository.findPage(userId, sessionId, offset, limit + 1);

        // Nenhuma chave com um cursor de sessão válido significa sessão expirada (30 min
        // parado): a página anterior teria devolvido outro cursor se a sessão tivesse
        // simplesmente acabado. Termina o feed em vez de reabrir uma sessão, que mostraria
        // itens repetidos; puxar para atualizar abre uma nova.
        if (keys.length === 0) { return { items: [], nextCursor: null }; }

        const hasMore = keys.length > limit;
        const pageKeys = keys.slice(0, limit);
        const rows = await this.feedRepository.findByKeys(userId, pageKeys);
        const rowsByKey = new Map(rows.map((row) => [keyOf(row.created_at as Date, String(row.item_id)), row]));

        // Reordena pela sessão (o Cassandra devolve por created_at) e pula quem sumiu no
        // meio tempo — post apagado ou item expirado não quebra a página.
        const items = pageKeys
            .map((key) => rowsByKey.get(keyOf(key.createdAt, key.itemId)))
            .filter((row): row is types.Row => row !== undefined)
            .map(toFeedResponseItem);

        let nextCursor: string | null = null;

        if (hasMore) {
            nextCursor = encodeSessionCursor(sessionId, offset + limit, tail);
        } else if (tail) {
            nextCursor = encodeLegacyCursor(tail);
        }

        return { items, nextCursor };
    }
}

function clampShare(share: number): number {
    if (!Number.isFinite(share)) { return 0; }

    return Math.min(1, Math.max(0, share));
}

/**
 * `feed_by_user` tem chave `(created_at, item_id)`, então em tese o mesmo item poderia
 * aparecer duas vezes com datas diferentes. O fanout grava cada item uma vez por seguidor,
 * mas se acontecer, fica a primeira ocorrência — a mais recente, pela ordem da partição.
 */
function uniqueByItem(rows: types.Row[]): types.Row[] {
    const seen = new Set<string>();

    return rows.filter((row) => {
        const id = String(row.item_id);

        if (seen.has(id)) { return false; }

        seen.add(id);
        return true;
    });
}

function oldestCreatedAt(rows: types.Row[]): Date {
    return rows.reduce<Date>((oldest, row) => {
        const createdAt = row.created_at as Date;

        return createdAt.getTime() < oldest.getTime() ? createdAt : oldest;
    }, rows[0]!.created_at as Date);
}

function toKey(row: types.Row): FeedItemKey {
    return { createdAt: row.created_at as Date, itemId: String(row.item_id) };
}

function keyOf(createdAt: Date, itemId: string): string {
    return `${createdAt.getTime()}|${itemId}`;
}
