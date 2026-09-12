CREATE TABLE IF NOT EXISTS ranking_counters_by_item (
    item_id text,
    signal_type text,
    count counter,
    PRIMARY KEY ((item_id), signal_type)
) WITH comment = 'Contadores de sinal por item, para o ranking do feed. Coluna counter NATIVA: o incremento e atomico no Cassandra, sem read-modify-write, o que elimina incremento perdido sob concorrencia. Particao por item com no maximo uma linha por tipo de sinal (~14 linhas), entao a particao e minuscula e limitada; o que cresce e a quantidade de particoes, que e exatamente para o que o Cassandra serve. ATENCAO: coluna counter NAO aceita TTL, logo estas linhas nao expiram sozinhas.';
