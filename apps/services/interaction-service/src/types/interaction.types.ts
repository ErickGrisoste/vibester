/**
 * Tipos de interação aceitos do cliente.
 *
 * Regra de origem: o cliente só manda o que SÓ ELE sabe. Impressão, tempo de
 * exibição, posição na lista e skip não existem em nenhum outro serviço — se o
 * cliente não contar, ninguém conta.
 */
export const CLIENT_INTERACTION_TYPES = [
    "IMPRESSION",
    "DWELL",
    "SKIP",
    "TAP_DETAIL",
    "PROFILE_OPEN",
    "NOT_INTERESTED",
    "DIRECTIONS_CLICK",
    "TICKET_CLICK",
] as const;

/**
 * Tipos derivados de eventos Kafka que outros serviços JÁ publicam.
 *
 * O cliente não pode enviá-los: seriam duplicata do que o post-service e o
 * user-service já emitem, e um cliente hostil poderia forjar um LIKE que nunca
 * aconteceu. A API rejeita esses tipos; só o worker os escreve.
 */
export const DERIVED_INTERACTION_TYPES = [
    "LIKE",
    "UNLIKE",
    "COMMENT",
    "FOLLOW",
] as const;

export const INTERACTION_TYPES = [
    ...CLIENT_INTERACTION_TYPES,
    ...DERIVED_INTERACTION_TYPES,
] as const;

export type ClientInteractionType = (typeof CLIENT_INTERACTION_TYPES)[number];
export type DerivedInteractionType = (typeof DERIVED_INTERACTION_TYPES)[number];
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const ITEM_TYPES = ["POST", "EVENT", "ESTABLISHMENT", "USER"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Onde no app a interação aconteceu. Permite medir o feed sem misturar com busca/perfil. */
export const INTERACTION_SOURCES = [
    "FEED",
    "EXPLORE",
    "PROFILE",
    "SEARCH",
    "EVENT_DETAIL",
    "ESTABLISHMENT_DETAIL",
    "NOTIFICATION",
] as const;
export type InteractionSource = (typeof INTERACTION_SOURCES)[number];

/** Um evento como o cliente envia (já validado pelo Zod). */
export interface ClientInteractionEvent {
    eventId: string;
    type: ClientInteractionType;
    itemId: string;
    itemType: ItemType;
    occurredAt: string;
    position?: number;
    dwellMs?: number;
    source?: InteractionSource;
}

export interface InteractionBatch {
    sessionId: string;
    events: ClientInteractionEvent[];
}

/**
 * Formato canônico que trafega no Kafka e é persistido.
 *
 * `userId` é sempre o `accountId` do token — o mesmo identificador que
 * post-service, user-service e feed-service usam. Nunca o `userId` do JWT,
 * que é o id da linha de autenticação.
 */
export interface NormalizedInteraction {
    userId: string;
    eventId: string;
    type: InteractionType;
    itemId: string;
    itemType: ItemType;
    occurredAt: string;
    sessionId: string | null;
    position: number | null;
    dwellMs: number | null;
    source: InteractionSource | null;
}
