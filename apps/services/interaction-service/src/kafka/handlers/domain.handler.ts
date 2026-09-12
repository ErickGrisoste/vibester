import { NormalizedInteraction } from "../../types/interaction.types";
import { deterministicUuid } from "../../utils/deterministic-uuid";

/**
 * Tópicos que outros serviços JÁ publicam e que este worker traduz para o log de
 * interação. O cliente não deve reenviar nada disso.
 */
export const DOMAIN_TOPICS = [
    "post.liked",
    "post.unliked",
    "post.commented",
    "user.followed",
] as const;

export type DomainTopic = (typeof DOMAIN_TOPICS)[number];

export function isDomainTopic(topic: string): topic is DomainTopic {
    return (DOMAIN_TOPICS as readonly string[]).includes(topic);
}

/**
 * Os payloads desses tópicos são INCONSISTENTES entre si, verificado no código dos
 * produtores:
 *
 * | tópico          | quem agiu             | timestamp   |
 * |-----------------|-----------------------|-------------|
 * | post.liked      | `likedByUserId`       | `createdAt` |
 * | post.unliked    | `userId`              | `createdAt` |
 * | post.commented  | `commentedByUserId`   | ausente     |
 * | user.followed   | `followerId`          | ausente     |
 *
 * Por isso cada leitura aceita mais de uma grafia do campo de ator: existe uma
 * correção de contrato pendente nesses tópicos, e este serviço precisa continuar
 * funcionando tanto antes quanto depois dela. Quando o payload não traz
 * timestamp, cai no timestamp da própria mensagem Kafka — que é o momento em que
 * o broker recebeu, aproximação boa o suficiente para ranking.
 */
interface DomainPayload {
    postId?: string;
    postOwnerId?: string;
    userId?: string;
    likedByUserId?: string;
    commentedByUserId?: string;
    followerId?: string;
    followingId?: string;
    createdAt?: string;
}

function firstPresent(...candidates: (string | undefined)[]): string | undefined {
    return candidates.find((candidate) => typeof candidate === "string" && candidate.length > 0);
}

/**
 * Traduz um evento de domínio em interação canônica.
 *
 * Devolve `null` quando o payload não tem o mínimo para ser útil (sem ator ou sem
 * item). Devolver null em vez de lançar é deliberado: um payload malformado não
 * deve travar a partição do Kafka em retry infinito — o worker loga e segue.
 */
export function mapDomainEvent(
    topic: DomainTopic,
    raw: unknown,
    messageTimestamp: Date
): NormalizedInteraction | null {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }

    const payload = raw as DomainPayload;
    const occurredAt = resolveOccurredAt(payload.createdAt, messageTimestamp);

    switch (topic) {
        case "post.liked":
            return build("LIKE", firstPresent(payload.likedByUserId, payload.userId), payload.postId, "POST", occurredAt, payload.postOwnerId);

        case "post.unliked":
            return build("UNLIKE", firstPresent(payload.userId, payload.likedByUserId), payload.postId, "POST", occurredAt, payload.postOwnerId);

        case "post.commented":
            return build("COMMENT", firstPresent(payload.commentedByUserId, payload.userId), payload.postId, "POST", occurredAt, payload.postOwnerId);

        // No follow o item JÁ É o autor: seguir alguém é o sinal de afinidade mais
        // direto que existe, e o "item" e o "autor" coincidem.
        case "user.followed":
            return build("FOLLOW", payload.followerId, payload.followingId, "USER", occurredAt, payload.followingId);
    }
}

function resolveOccurredAt(createdAt: string | undefined, fallback: Date): string {
    if (createdAt && !Number.isNaN(Date.parse(createdAt))) {
        return new Date(createdAt).toISOString();
    }

    return fallback.toISOString();
}

function build(
    type: NormalizedInteraction["type"],
    userId: string | undefined,
    itemId: string | undefined,
    itemType: NormalizedInteraction["itemType"],
    occurredAt: string,
    authorId?: string
): NormalizedInteraction | null {
    if (!userId || !itemId) {
        return null;
    }

    return {
        userId,
        // Derivado do conteúdo: reprocessar a mesma mensagem reescreve a mesma linha.
        eventId: deterministicUuid(type, userId, itemId, occurredAt),
        type,
        itemId,
        itemType,
        occurredAt,
        // `postOwnerId` quando o produtor informa; null quando não. Afinidade só é
        // calculada para o que tem autor conhecido.
        authorId: authorId ?? null,
        // Eventos de domínio não pertencem a uma sessão de navegação, e não há
        // posição nem dwell: quem publicou não tem essa informação.
        sessionId: null,
        position: null,
        dwellMs: null,
        source: null,
    };
}
