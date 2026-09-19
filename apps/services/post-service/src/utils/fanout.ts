import { cassandraFanoutPartialFailureTotal } from "../metrics/registry";

/**
 * Executa um fan-out de escritas para várias tabelas denormalizadas e
 * preserva o comportamento de antes (`Promise.all`: qualquer falha propaga um
 * erro pro chamador) — mas usa `Promise.allSettled` por baixo para saber
 * quantas das escritas realmente terminaram antes de propagar, e registra
 * `cassandra_fanout_partial_failure_total` quando só parte delas teve
 * sucesso. Sem BATCH/LWT entre as tabelas (ver CLAUDE.md), essa é a única
 * forma de saber que `posts_by_id`/`posts_by_user`/`posts_by_establishment`
 * ficaram divergentes — antes disso era invisível.
 */
export async function runFanout(operation: string, tasks: Array<() => Promise<unknown>>): Promise<void> {
    const results = await Promise.allSettled(tasks.map((task) => task()));
    const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    if (failures.length > 0 && failures.length < results.length) {
        cassandraFanoutPartialFailureTotal.inc({ operation });
    }

    if (failures.length > 0) {
        throw failures[0].reason;
    }
}
