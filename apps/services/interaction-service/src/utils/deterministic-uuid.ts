import { createHash } from "crypto";

/**
 * UUID determinístico (formato v5) derivado das partes informadas.
 *
 * Os eventos que outros serviços já publicam (`post.liked`, `post.commented`,
 * `user.followed`) não carregam `eventId`. Sem um id estável, reprocessar uma
 * partição do Kafka — o que acontece em rebalance, redeploy ou replay — criaria
 * uma linha nova para a mesma curtida, e o contador de LIKE ficaria inflado.
 *
 * Derivando o id do conteúdo do evento, reprocessar reescreve a mesma linha.
 */
export function deterministicUuid(...parts: string[]): string {
    const digest = createHash("sha1").update(parts.join("|")).digest();
    const bytes = Buffer.from(digest.subarray(0, 16));

    bytes[6] = (bytes[6]! & 0x0f) | 0x50; // versão 5
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC 4122

    const hex = bytes.toString("hex");

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join("-");
}
