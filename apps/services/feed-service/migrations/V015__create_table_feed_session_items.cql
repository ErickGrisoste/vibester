CREATE TABLE IF NOT EXISTS feed_session_items (
    user_id uuid,
    session_id uuid,
    position int,
    created_at timestamp,
    item_id uuid,
    PRIMARY KEY ((user_id, session_id), position)
) WITH CLUSTERING ORDER BY (position ASC)
  AND comment = 'Sessao de feed rankeado: a ordem calculada na primeira pagina, congelada para as paginas seguintes. Sem isso o score muda entre requests e o usuario ve item repetido ou pulado. Guarda so a chave do item (created_at, item_id); o conteudo e hidratado de feed_by_user. user_id na chave de particao prende o cursor ao dono. TTL aplicado no INSERT (30 min).';
