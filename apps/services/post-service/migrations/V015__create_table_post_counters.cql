-- Contador atômico de curtidas/comentários por post. Substitui o padrão
-- read-modify-write anterior (ler total_likes/total_comments de posts_by_id,
-- somar/subtrair 1 em memória, escrever de volta) que perdia incrementos sob
-- concorrência. Colunas `counter` só podem coexistir com a partition key na
-- mesma tabela — não dá para misturar com colunas normais, por isso é uma
-- tabela própria em vez de uma coluna nova em posts_by_id.
--
-- ATENÇÃO — rollout: uma linha só existe aqui depois do primeiro incremento
-- (contador do Cassandra não aceita INSERT com valor literal). Posts que já
-- têm total_likes/total_comments > 0 em posts_by_id não são migrados
-- automaticamente por esta migration — rode scripts/backfill-post-counters.ts
-- uma vez antes de considerar o rollout completo, ou o primeiro like/comment
-- novo em um post antigo vai "reiniciar" a exibição a partir de 1.
CREATE TABLE IF NOT EXISTS post_counters (
    post_id uuid PRIMARY KEY,
    total_likes counter,
    total_comments counter
);
