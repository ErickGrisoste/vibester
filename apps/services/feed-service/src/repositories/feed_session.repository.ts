import { BaseRepository } from "./base.repository";

/** Chave de um item do feed: exatamente a chave de clustering de `feed_by_user`. */
export interface FeedItemKey {
    createdAt: Date;
    itemId: string;
}

const INSERT_SESSION_ITEM = `
    INSERT INTO feed_session_items (user_id, session_id, position, created_at, item_id)
    VALUES (?, ?, ?, ?, ?)
    USING TTL ?;
`;

/**
 * Lote de 50: todas as linhas de uma sessão caem na MESMA partição `(user_id, session_id)`,
 * e lote numa partição só é o uso recomendado de batch no Cassandra — sem espalhar carga
 * pelo coordenador. 50 linhas pequenas ficam bem abaixo do limite de aviso de tamanho de
 * lote (5KB); uma sessão de 200 vira 4 lotes em vez de 200 escritas.
 */
const BATCH_SIZE = 50;

/**
 * Sessão de feed rankeado: a ordem calculada na primeira página, congelada por 30 minutos.
 *
 * Sem isso, cada página recalcularia o score com contadores que mudaram desde a anterior,
 * e o usuário veria item repetido ou pulado. A sessão guarda só a chave; o conteúdo vem
 * de `feed_by_user` na hora da página.
 */
export class FeedSessionRepository extends BaseRepository {
    async saveSession(
        userId: string,
        sessionId: string,
        keys: readonly FeedItemKey[],
        ttlSeconds: number
    ): Promise<void> {
        for (let start = 0; start < keys.length; start += BATCH_SIZE) {
            const chunk = keys.slice(start, start + BATCH_SIZE);

            await this.executeBatch(
                chunk.map((key, index) => ({
                    query: INSERT_SESSION_ITEM,
                    params: [userId, sessionId, start + index, key.createdAt, key.itemId, ttlSeconds],
                }))
            );
        }
    }

    /**
     * As chaves a partir de `offset`, na ordem da sessão.
     *
     * Quem chama pede `limit + 1` para saber se há próxima página sem uma segunda query.
     * Sessão expirada devolve lista vazia — não há erro, e quem chama decide o que fazer.
     */
    async findPage(
        userId: string,
        sessionId: string,
        offset: number,
        count: number
    ): Promise<FeedItemKey[]> {
        const result = await this.execute(
            `
                SELECT created_at, item_id
                FROM feed_session_items
                WHERE user_id = ? AND session_id = ? AND position >= ?
                LIMIT ?;
            `,
            [userId, sessionId, offset, count]
        );

        return result.rows.map((row) => ({
            createdAt: row.created_at as Date,
            itemId: String(row.item_id),
        }));
    }
}
