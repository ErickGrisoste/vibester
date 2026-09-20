/**
 * Executa `task` sobre `items` com no máximo `limit` execuções simultâneas.
 *
 * Existe porque `Promise.all` sobre um array de tamanho arbitrário é a dívida
 * conhecida do feed-service: com um lote grande, dispara todas as escritas de uma
 * vez e satura o pool de conexões do Cassandra. Aqui o teto é explícito
 * (`CASSANDRA_WRITE_CONCURRENCY`).
 *
 * Falha rápido: se uma task rejeitar, a rejeição propaga e o worker não faz ack
 * da mensagem Kafka, que será reentregue.
 */
export async function runWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    if (items.length === 0) {
        return [];
    }

    const effectiveLimit = Math.max(1, Math.min(limit, items.length));
    const results = new Array<R>(items.length);
    let cursor = 0;

    const workers = Array.from({ length: effectiveLimit }, async () => {
        while (true) {
            const index = cursor++;

            if (index >= items.length) {
                return;
            }

            results[index] = await task(items[index]!, index);
        }
    });

    await Promise.all(workers);

    return results;
}
