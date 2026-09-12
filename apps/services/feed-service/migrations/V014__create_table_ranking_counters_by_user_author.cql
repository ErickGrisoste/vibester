CREATE TABLE IF NOT EXISTS ranking_counters_by_user_author (
    user_id text,
    author_id text,
    signal_type text,
    count counter,
    PRIMARY KEY ((user_id), author_id, signal_type)
) WITH comment = 'Contagem de interacoes de um leitor com cada autor, base do calculo de afinidade. Guarda CONTAGEM e nao score: score tem os pesos embutidos, e recalibrar peso invalidaria todo o historico gravado. O score e derivado na leitura com os pesos vigentes. Uma particao por leitor, clusterizada por (author_id, signal_type).';
