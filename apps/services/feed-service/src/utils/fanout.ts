import { cassandraFanoutPartialFailureTotal } from "../metrics/registry";

/**
 * Executa um fan-out de escritas para várias linhas/tabelas denormalizadas e
 * preserva o comportamento anterior (`Promise.all`: qualquer falha propaga um
 * erro pro chamador) — mas usa `Promise.allSettled` por baixo para saber
 * quantas escritas realmente terminaram antes de propagar. Sem BATCH/LWT entre
 * as tabelas/linhas do feed, um `Promise.all` puro escondia justamente o pior
 * caso: falha parcial deixa algumas cópias atualizadas e outras não, sem
 * nenhum sinal — o log de falha parcial abaixo (Fase 4) e a métrica
 * `cassandra_fanout_partial_failure_total` (Fase 8) tornam isso visível, um
 * pro debug local, outra pro alerta em produção — mantidas juntas de
 * propósito, uma não substitui a outra.
 *
 * Portado do mesmo utilitário do post-service.
 */
export async function runFanout(operation: string, tasks: Array<() => Promise<unknown>>): Promise<void> {
    const results = await Promise.allSettled(tasks.map((task) => task()));
    const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    if (failures.length > 0 && failures.length < results.length) {
        console.warn(
            `[fanout] falha parcial em "${operation}": ${failures.length}/${results.length} escritas falharam`,
            failures.map((failure) => failure.reason)
        );
        cassandraFanoutPartialFailureTotal.inc({ operation });
    }

    if (failures.length > 0) {
        throw failures[0].reason;
    }
}
