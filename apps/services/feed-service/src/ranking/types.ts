/**
 * Contratos do ranking do feed.
 *
 * A ordem do feed nasce na LEITURA (decisão D2): o feed é inventário sem ordem, e
 * quem ordena é um `Scorer` chamado no momento do request, com features vindas de
 * cache. Por isso o ranking mora aqui, dentro do serviço que serve a leitura —
 * um serviço separado significaria uma chamada síncrona no caminho mais quente do
 * produto.
 *
 * A heurística de hoje e o modelo de amanhã implementam a MESMA interface. É o que
 * permite trocar um pelo outro sem tocar no pipeline (decisão D4).
 */

/**
 * Tipos de interação que o ranking sabe interpretar. Espelha o interaction-service.
 *
 * É uma lista em runtime, e não só um tipo, porque o que chega do banco e do Kafka é
 * string: sem a lista não há como descartar um sinal desconhecido antes de ele entrar
 * no score.
 */
export const SIGNAL_TYPES = [
    "IMPRESSION",
    "DWELL",
    "SKIP",
    "TAP_DETAIL",
    "PROFILE_OPEN",
    "NOT_INTERESTED",
    "DIRECTIONS_CLICK",
    "TICKET_CLICK",
    "LIKE",
    "UNLIKE",
    "COMMENT",
    "FOLLOW",
    "SAVE",
    "EVENT_CHECKIN",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export function isSignalType(value: string): value is SignalType {
    return (SIGNAL_TYPES as readonly string[]).includes(value);
}

/** Contagem de sinais acumulada para um item. Vem dos contadores da fase 1. */
export type SignalCounts = Partial<Record<SignalType, number>>;

/**
 * Features de um item candidato, já resolvidas (nada aqui faz I/O).
 *
 * Manter o `Scorer` como função pura sobre features é deliberado: é o que torna o
 * ranking testável com fixtures, comparável entre versões e barato de rodar sobre
 * centenas de candidatos por request.
 */
export interface ItemFeatures {
    itemId: string;
    /** Idade do item em horas no momento do request. */
    ageHours: number;
    /** Quantas vezes o item foi exibido. É o denominador que hoje não existe. */
    impressions: number;
    /** Contagem de sinais do item, para virar ação ponderada. */
    signals: SignalCounts;
    /**
     * Soma do tempo de exibição, em ms, das impressões do item. O scorer divide por
     * `impressions`, com suavização, para obter o tempo médio de atenção.
     */
    dwellMsSum: number;
    /**
     * Afinidade do leitor com o autor, em [0, 1]. Vem da fase 1.
     * Enquanto não houver dado, 0 é o valor honesto — não 0.5.
     */
    affinity: number;
}

/**
 * Contexto do request. Hoje só carrega o instante, porque a fase 2 rankeia apenas
 * o following.
 *
 * Geo, hora local e `busynessScore` do scrapping — a vantagem do Vibester para
 * cold start (decisão D5) — entram na fase 3 e por isso estão explicitamente
 * ausentes aqui, não esquecidos.
 */
export interface RankingContext {
    now: Date;
}

export interface ScoredItem {
    itemId: string;
    score: number;
    /**
     * Contribuição de cada parcela, para depuração e para explicar por que um item
     * subiu. Sem isso, um ranking ruim é indistinguível de um bug.
     */
    breakdown: Record<string, number>;
}

export interface Scorer {
    /** Identifica a versão do scorer nos logs e nas comparações de experimento. */
    readonly name: string;

    score(item: ItemFeatures, context: RankingContext): ScoredItem;
}

/** Ordena candidatos por score decrescente. Empate desempata por itemId, para ser estável. */
export function rankItems(
    scorer: Scorer,
    items: readonly ItemFeatures[],
    context: RankingContext
): ScoredItem[] {
    return items
        .map((item) => scorer.score(item, context))
        .sort((a, b) => (b.score - a.score) || a.itemId.localeCompare(b.itemId));
}
