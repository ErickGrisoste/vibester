/**
 * Tópicos "diretos" recebem dois formatos: o post-service publica tudo no
 * envelope `{ eventId, eventType, occurredAt, data }` (`publishEvent`), enquanto
 * o user-service ainda manda `user.followed`/`user.unfollowed` com o payload
 * solto. Sem desembrulhar, `post.liked`/`post.unliked` falhavam na validação e
 * eram descartados — `is_liked` nunca era gravado no feed.
 */
export function unwrapEventData(raw: unknown): unknown {
    if (
        raw !== null &&
        typeof raw === "object" &&
        "eventType" in raw &&
        "data" in raw &&
        typeof (raw as { data: unknown }).data === "object"
    ) {
        return (raw as { data: unknown }).data;
    }
    return raw;
}
