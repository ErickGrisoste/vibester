import { types } from "cassandra-driver";
import { BaseRepository } from "./base.repository";
import { env } from "../config/env";
import { NormalizedInteraction } from "../types/interaction.types";
import { runWithConcurrency } from "../utils/concurrency";
import { toDayBucket } from "../utils/bucket";

const INSERT_INTERACTION = `
    INSERT INTO interactions_by_user (
        user_id, day_bucket, occurred_at, event_id,
        type, item_id, item_type, author_id, session_id,
        feed_position, dwell_ms, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    USING TTL ?
`;

const SELECT_BY_USER_AND_DAY = `
    SELECT user_id, day_bucket, occurred_at, event_id, type, item_id, item_type,
           author_id, session_id, feed_position, dwell_ms, source
    FROM interactions_by_user
    WHERE user_id = ? AND day_bucket = ?
    LIMIT ?
`;

export class InteractionRepository extends BaseRepository {
    /**
     * Persiste um lote de interações.
     *
     * Não usa BATCH do Cassandra: as linhas caem em partições diferentes
     * (`(user_id, day_bucket)`), e BATCH entre partições no Cassandra piora a
     * latência em vez de melhorar, além de não dar atomicidade real. Escritas
     * independentes com concorrência limitada é o padrão correto aqui.
     *
     * Idempotência vem da chave primária: reprocessar a mesma mensagem Kafka
     * reescreve a mesma linha (`event_id` + `occurred_at` vêm do cliente e são
     * capturados juntos, então não variam entre reenvios do mesmo evento).
     */
    async insertMany(interactions: readonly NormalizedInteraction[]): Promise<void> {
        await runWithConcurrency(
            interactions,
            env.cassandra_write_concurrency,
            (interaction) => this.insertOne(interaction)
        );
    }

    private async insertOne(interaction: NormalizedInteraction) {
        const occurredAt = new Date(interaction.occurredAt);

        return this.execute(INSERT_INTERACTION, [
            interaction.userId,
            toDayBucket(occurredAt),
            occurredAt,
            types.Uuid.fromString(interaction.eventId),
            interaction.type,
            interaction.itemId,
            interaction.itemType,
            interaction.authorId,
            interaction.sessionId,
            interaction.position,
            interaction.dwellMs,
            interaction.source,
            env.interaction_ttl_seconds,
        ]);
    }

    /** Leitura de apoio para depuração e para o teste de integração — não é rota pública. */
    async findByUserAndDay(userId: string, dayBucket: string, limit = 100) {
        return this.execute(SELECT_BY_USER_AND_DAY, [userId, dayBucket, limit]);
    }
}
