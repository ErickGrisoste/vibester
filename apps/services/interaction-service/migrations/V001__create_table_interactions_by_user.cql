CREATE TABLE IF NOT EXISTS interactions_by_user (
    user_id text,
    day_bucket text,
    occurred_at timestamp,
    event_id uuid,
    type text,
    item_id text,
    item_type text,
    author_id text,
    session_id text,
    feed_position int,
    dwell_ms int,
    source text,
    PRIMARY KEY ((user_id, day_bucket), occurred_at, event_id)
) WITH CLUSTERING ORDER BY (occurred_at DESC, event_id ASC)
  AND comment = 'Log bruto de interacoes por usuario. Particao = (user_id, day_bucket) para manter a particao limitada; event_id fecha a chave para dar idempotencia em replay do Kafka. TTL por linha e aplicado no INSERT (INTERACTION_TTL_DAYS), nao aqui.';
