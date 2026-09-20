import { BaseRepository } from "./base.repository";

/** Contagem por tipo de sinal, como sai do banco. */
export type CountsBySignal = Record<string, number>;

export interface CounterIncrement {
    signalType: string;
    delta: number;
}

/**
 * Linha reservada em `ranking_counters_by_item` que acumula a SOMA do tempo de
 * exibição (ms) das impressões do item.
 *
 * Mora na mesma tabela, com a mesma chave `signal_type`, para não exigir tabela nova:
 * é só mais um `counter` incrementado atomicamente. O sublinhado inicial garante que
 * nunca colida com um tipo de sinal real, e `toSignalCounts` a descarta ao montar os
 * sinais — ela nunca entra na ação ponderada.
 *
 * Guarda soma, não média: média não se atualiza incrementalmente sem saber quantos
 * itens já tem. Soma e impressões dão a média na leitura.
 */
export const DWELL_MS_SUM_ROW = "_dwell_ms_sum";

/** Valor de afinidade já decaído até `updatedAt`. */
export interface AffinityValue {
    value: number;
    updatedAt: Date;
}

export type AffinityBySignal = Record<string, AffinityValue>;
export type AffinityByAuthor = Record<string, AffinityBySignal>;

/**
 * Armazenamento das features do ranking do feed.
 *
 * Dois modelos convivem aqui, e a diferença entre eles é deliberada:
 *
 * | tabela                            | modelo                        | escrita concorrente? | TTL        |
 * |-----------------------------------|-------------------------------|----------------------|------------|
 * | `ranking_counters_by_item`        | `counter`, incremento atômico | sim                  | não aceita |
 * | `ranking_affinity_by_user_author` | `double` decaído, ler-calcular-gravar | não          | ~6 τ       |
 *
 * **Contadores por item** recebem escrita de muitas pessoas ao mesmo tempo: interações
 * sobre um mesmo post chegam por partições Kafka diferentes, consumidas em paralelo.
 * Por isso precisam de incremento atômico no servidor, sem ler-somar-gravar na
 * aplicação — é o que evita a condição de corrida de incremento perdido que os
 * contadores do post-service têm. Consequências: (1) `counter` não aceita TTL, não
 * tente; (2) não é idempotente — reprocessar incrementa de novo, erro de ±1 que não
 * muda ordem.
 *
 * **Afinidade** precisa esquecer, e esquecer é multiplicar — algo que `counter` não faz.
 * Então é um `double` com o valor já decaído e o instante da última atualização,
 * gravado por ler-calcular-gravar. Isso SÓ é seguro porque cada linha pertence a um
 * único leitor, e tudo de um leitor chega na mesma partição de `interactions.normalized`
 * (key = userId), consumida em ordem por um único consumidor. Paralelizar o
 * processamento de mensagens, ou trocar a chave de partição no produtor, reintroduz
 * perda de atualização em silêncio — há testes-cadeado para as duas coisas. Por não ser
 * `counter`, aceita TTL: par leitor-autor que ficou inativo expira sozinho.
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

    /** Afinidade atual de um par leitor-autor, por sinal. Usado na escrita. */
    async findAffinityPair(userId: string, authorId: string): Promise<AffinityBySignal> {
        const result = await this.execute(
            `
                SELECT signal_type, decayed_count, updated_at
                FROM ranking_affinity_by_user_author
                WHERE user_id = ? AND author_id = ?;
            `,
            [userId, authorId]
        );

        const bySignal: AffinityBySignal = {};

        for (const row of result.rows) {
            bySignal[String(row.signal_type)] = toAffinityValue(row);
        }

        return bySignal;
    }

    /**
     * Grava o valor decaído de um sinal do par leitor-autor.
     *
     * O TTL é regravado a cada escrita, então só expira par que ficou sem interação
     * durante todo o período.
     */
    async upsertAffinity(
        userId: string,
        authorId: string,
        signalType: string,
        value: number,
        updatedAt: Date,
        ttlSeconds: number
    ): Promise<void> {
        await this.execute(
            `
                INSERT INTO ranking_affinity_by_user_author (
                    user_id, author_id, signal_type, decayed_count, updated_at
                ) VALUES (?, ?, ?, ?, ?)
                USING TTL ?;
            `,
            [userId, authorId, signalType, value, updatedAt, ttlSeconds]
        );
    }

    /** Toda a afinidade de um leitor numa única query de partição. Usado na leitura. */
    async findAffinityByUser(userId: string): Promise<AffinityByAuthor> {
        const result = await this.execute(
            `
                SELECT author_id, signal_type, decayed_count, updated_at
                FROM ranking_affinity_by_user_author
                WHERE user_id = ?;
            `,
            [userId]
        );

        const byAuthor: AffinityByAuthor = {};

        for (const row of result.rows) {
            const authorId = String(row.author_id);
            byAuthor[authorId] ??= {};
            byAuthor[authorId]![String(row.signal_type)] = toAffinityValue(row);
        }

        return byAuthor;
    }
}

function toAffinityValue(row: Record<string, unknown>): AffinityValue {
    const updatedAt = row.updated_at;

    return {
        value: Number(row.decayed_count),
        updatedAt: updatedAt instanceof Date ? updatedAt : new Date(String(updatedAt)),
    };
}
