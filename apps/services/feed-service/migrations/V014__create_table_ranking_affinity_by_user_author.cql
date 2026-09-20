CREATE TABLE IF NOT EXISTS ranking_affinity_by_user_author (
    user_id text,
    author_id text,
    signal_type text,
    decayed_count double,
    updated_at timestamp,
    PRIMARY KEY ((user_id), author_id, signal_type)
) WITH comment = 'Afinidade leitor-autor com decaimento temporal. decayed_count e a CONTAGEM de interacoes por sinal ja decaida ate updated_at: novo = antigo * exp(-dt/tau) + 1. Pesos sao aplicados na leitura, entao recalibrar peso nao exige reprocessar. Coluna double normal, nao counter, porque decair e multiplicar e counter nao multiplica; como consequencia aceita TTL, aplicado no INSERT (~6 tau). A escrita e ler-calcular-gravar e so e segura porque cada linha pertence a um unico leitor e interactions.normalized tem key=userId, consumida em ordem.';
