import { BaseRepository } from "./base.repository";

/** Contagem por tipo de sinal, como sai do banco. */
export type CountsBySignal = Record<string, number>;

/** Contagem por autor, para um leitor. */
export type CountsByAuthor = Record<string, CountsBySignal>;

export interface CounterIncrement {
    signalType: string;
    delta: number;
}

/**
 * Contadores que alimentam o ranking do feed.
 *
 * São colunas `counter` nativas do Cassandra: o incremento é atômico no servidor,
 * sem ler-somar-gravar na aplicação. Isso elimina a condição de corrida clássica de
 * incremento perdido — que é justamente o problema conhecido dos contadores do
 * `post-service`, e o motivo de não copiar aquele padrão para cá.
 *
 * Duas consequências de usar `counter` que precisam ser respeitadas:
 *
 * 1. **Não aceita TTL.** Nenhuma linha daqui expira sozinha, diferente do resto
 *    deste serviço, que depende de `USING TTL`. A partição por item é minúscula
 *    (no máximo uma linha por tipo de sinal), então o custo é de quantidade de
 *    partições, não de partição gorda. Limpeza, se algum dia fizer falta, é job
 *    separado — não tente adicionar TTL, o Cassandra recusa.
 * 2. **Não é idempotente.** Reprocessar a mesma mensagem Kafka incrementa de novo.
 *    Quem chama precisa garantir entrega única, ou aceitar contador levemente
 *    inflado — para ranking, um erro de ±1 não muda ordem, mas isso é uma escolha
 *    consciente, não um descuido.
 */
export class RankingCountersRepository extends BaseRepository {
    /** Incrementa os contadores de um item. */
    async incrementItem(itemId: string, increments: readonly CounterIncrement[]): Promise<void> {
        for (const { signalType, delta } of increments) {
            if (delta === 0) { continue; }

            await this.execute(
                `
                    UPDATE ranking_counters_by_item
                    SET count = count + ?
                    WHERE item_id = ? AND signal_type = ?;
                `,
                [delta, itemId, signalType]
            );
        }
    }

    /** Incrementa os contadores do par leitor → autor. */
    async incrementUserAuthor(
        userId: string,
        authorId: string,
        increments: readonly CounterIncrement[]
    ): Promise<void> {
        for (const { signalType, delta } of increments) {
            if (delta === 0) { continue; }

            await this.execute(
                `
                    UPDATE ranking_counters_by_user_author
                    SET count = count + ?
                    WHERE user_id = ? AND author_id = ? AND signal_type = ?;
                `,
                [delta, userId, authorId, signalType]
            );
        }
    }

    /**
     * Contadores de vários itens numa única query.
     *
     * `IN` na chave de partição é aceitável aqui porque a lista é limitada aos
     * candidatos de UMA página de feed (dezenas), não a uma varredura. Para lotes
     * grandes isso viraria fan-out de partições e precisaria ser quebrado.
     */
    async findCountsByItems(itemIds: readonly string[]): Promise<Record<string, CountsBySignal>> {
        if (itemIds.length === 0) { return {}; }

        const result = await this.execute(
            `
                SELECT item_id, signal_type, count
                FROM ranking_counters_by_item
                WHERE item_id IN ?;
            `,
            [itemIds]
        );

        const byItem: Record<string, CountsBySignal> = {};

        for (const row of result.rows) {
            const itemId = String(row.item_id);
            byItem[itemId] ??= {};
            // `count` vem como Long do driver; Number é seguro na escala de contador
            // de engajamento e mantém o tipo simples para o scorer.
            byItem[itemId]![String(row.signal_type)] = Number(row.count);
        }

        return byItem;
    }

    /** Toda a afinidade de um leitor numa única query de partição. */
    async findCountsByUser(userId: string): Promise<CountsByAuthor> {
        const result = await this.execute(
            `
                SELECT author_id, signal_type, count
                FROM ranking_counters_by_user_author
                WHERE user_id = ?;
            `,
            [userId]
        );

        const byAuthor: CountsByAuthor = {};

        for (const row of result.rows) {
            const authorId = String(row.author_id);
            byAuthor[authorId] ??= {};
            byAuthor[authorId]![String(row.signal_type)] = Number(row.count);
        }

        return byAuthor;
    }
}
