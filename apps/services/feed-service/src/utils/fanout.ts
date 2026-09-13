/**
 * Executa um fan-out de escritas para várias linhas/tabelas denormalizadas e
 * preserva o comportamento anterior (`Promise.all`: qualquer falha propaga um
 * erro pro chamador) — mas usa `Promise.allSettled` por baixo para saber
 * quantas escritas realmente terminaram antes de propagar. Sem BATCH/LWT entre
 * as tabelas/linhas do feed, um `Promise.all` puro escondia justamente o pior
 * caso: falha parcial deixa algumas cópias atualizadas e outras não, sem
 * nenhum sinal — só o log de falha parcial abaixo torna isso visível.
 *
 * Portado do mesmo utilitário do post-service; ainda sem métrica Prometheus
 * (feed-service não tem `prom-client` — ver plano de refatoração, Fase 8).
 * Quando a métrica existir, este é o único lugar que precisa mudar.
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
    }

    if (failures.length > 0) {
        throw failures[0].reason;
    }
}
