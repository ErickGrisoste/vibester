/**
 * Cursor da rota de feed.
 *
 * O app trata o cursor como texto opaco: recebe `nextCursor` e devolve igual na próxima
 * chamada, sem interpretar. É isso que permite trocar o formato sem mudar o cliente.
 *
 * Três formatos convivem:
 *
 * | formato                  | exemplo                     | origem |
 * |--------------------------|-----------------------------|--------|
 * | nenhum                   | —                           | primeira página |
 * | data ISO 8601 (legado)   | `2026-09-12T02:00:00.000Z`  | feed cronológico, ou continuação depois de uma sessão |
 * | sessão                   | `s1.eyJzIjoi...`            | páginas seguintes de um feed rankeado |
 *
 * O prefixo `s1.` separa sem ambiguidade um cursor de sessão de uma data, e o `1` é versão:
 * mudar o conteúdo do token exige um prefixo novo, porque cursores antigos continuam
 * circulando em apps abertos.
 */

const SESSION_PREFIX = "s1.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Guarda contra token forjado com offset absurdo; muito acima de qualquer sessão real. */
const MAX_OFFSET = 10_000;

export type ParsedFeedCursor =
    | { kind: "none" }
    | { kind: "legacy"; before: Date }
    | { kind: "session"; sessionId: string; offset: number; tail: Date | null }
    | { kind: "invalid" };

interface SessionPayload {
    s: string;
    o: number;
    t?: string;
}

/**
 * @param tail data do candidato mais antigo da sessão, quando podem existir itens mais
 * antigos fora dela. Quando a sessão acaba, o feed continua cronologicamente a partir
 * dali, em vez de terminar num beco sem saída.
 */
export function encodeSessionCursor(sessionId: string, offset: number, tail: Date | null = null): string {
    const payload: SessionPayload = { s: sessionId, o: offset };

    if (tail) { payload.t = tail.toISOString(); }

    return SESSION_PREFIX + Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function encodeLegacyCursor(before: Date): string {
    return before.toISOString();
}

/**
 * Cursor inválido vira `invalid`, e a rota responde 400. Nunca 500: é um parâmetro que o
 * cliente controla, e um token corrompido não pode chegar a um bind do Cassandra (um
 * `session_id` que não é uuid estouraria lá dentro).
 */
export function parseFeedCursor(raw: string | undefined): ParsedFeedCursor {
    if (raw === undefined || raw === "") { return { kind: "none" }; }

    if (raw.startsWith(SESSION_PREFIX)) {
        return parseSessionCursor(raw.slice(SESSION_PREFIX.length));
    }

    const timestamp = Date.parse(raw);

    return Number.isNaN(timestamp) ? { kind: "invalid" } : { kind: "legacy", before: new Date(timestamp) };
}

function parseSessionCursor(encoded: string): ParsedFeedCursor {
    let payload: Partial<SessionPayload>;

    try {
        payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
        return { kind: "invalid" };
    }

    if (typeof payload?.s !== "string" || !UUID_PATTERN.test(payload.s)) { return { kind: "invalid" }; }

    if (!Number.isInteger(payload.o) || payload.o! < 0 || payload.o! > MAX_OFFSET) { return { kind: "invalid" }; }

    let tail: Date | null = null;

    if (payload.t !== undefined) {
        const timestamp = typeof payload.t === "string" ? Date.parse(payload.t) : Number.NaN;

        if (Number.isNaN(timestamp)) { return { kind: "invalid" }; }

        tail = new Date(timestamp);
    }

    return { kind: "session", sessionId: payload.s, offset: payload.o!, tail };
}
