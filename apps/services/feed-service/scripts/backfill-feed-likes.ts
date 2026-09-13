/**
 * Backfill único de feed_by_user.is_liked a partir dos likes gravados pelo
 * post-service (likes_by_post).
 *
 * Por que existe: até esta correção, todo `post.liked` era descartado pelo
 * consumer — primeiro porque o schema exigia `userId` (o post-service manda
 * `likedByUserId`), depois porque o post-service passou a publicar no envelope
 * `{ eventId, eventType, occurredAt, data }` e os tópicos diretos liam o
 * payload solto. O total de likes chegava (post.stats.updated), mas nenhum
 * `is_liked` foi gravado. Sem este script, só likes feitos após o deploy
 * aparecem como curtidos no feed.
 *
 * QUANDO RODAR: uma vez, depois do deploy do consumer corrigido.
 *
 * IDEMPOTÊNCIA: só faz `SET is_liked = true` para likes que existem hoje em
 * likes_by_post — rodar de novo não muda nada. Um unlike que aconteça durante a
 * execução pode ser sobrescrito se a leitura do like vier antes dele; rode em
 * horário de pouco tráfego.
 *
 * Lê de outro keyspace (o do post-service) na mesma sessão: requer que os dois
 * keyspaces estejam no mesmo cluster/banco Astra e que a credencial do
 * feed-service tenha leitura em POST_KEYSPACE.
 *
 * NÃO TESTADO CONTRA CASSANDRA REAL — revise e rode primeiro em staging.
 */
import "dotenv/config";
import { getCassandraClient } from "../src/config/cassandra";

const POST_KEYSPACE = process.env.POST_KEYSPACE;

if (!POST_KEYSPACE || !/^[a-zA-Z0-9_]+$/.test(POST_KEYSPACE)) {
    throw new Error("POST_KEYSPACE (keyspace do post-service) não definida ou inválida");
}

async function markLikedInFeed(postId: string, userId: string): Promise<boolean> {
    const client = getCassandraClient();

    const entries = await client.execute(
        `
            SELECT created_at
            FROM feed_keyspace.feed_entries_by_post
            WHERE post_id = ?
                AND user_id = ?;
        `,
        [postId, userId],
        { prepare: true }
    );

    // Post fora do feed de quem curtiu (não segue o autor, ou já expirou pelo
    // TTL): não há linha para marcar — e UPDATE no Cassandra criaria uma.
    if (entries.rows.length === 0) { return false; }

    await Promise.all(
        entries.rows.map((entry) =>
            client.execute(
                `
                    UPDATE feed_keyspace.feed_by_user
                    SET is_liked = true
                    WHERE user_id = ?
                        AND created_at = ?
                        AND item_id = ?;
                `,
                [userId, entry.created_at, postId],
                { prepare: true }
            )
        )
    );

    return true;
}

async function run() {
    const client = getCassandraClient();
    await client.connect();
    console.log(`Backfill de feed_by_user.is_liked — likes de ${POST_KEYSPACE}.likes_by_post`);

    let processed = 0;
    let marked = 0;
    let notInFeed = 0;
    let pageState: string | undefined;

    // Paginação manual, sequencial — mesmo raciocínio do backfill-post-counters
    // do post-service: simples de auditar num script de execução única.
    do {
        const result = await client.execute(
            `SELECT post_id, user_id FROM ${POST_KEYSPACE}.likes_by_post;`,
            [],
            { prepare: true, fetchSize: 500, pageState }
        );

        for (const row of result.rows) {
            processed++;
            const didMark = await markLikedInFeed(row.post_id.toString(), row.user_id.toString());
            if (didMark) { marked++; } else { notInFeed++; }
        }

        pageState = result.pageState || undefined;
    } while (pageState);

    console.log(`Likes lidos: ${processed} | Marcados no feed: ${marked} | Fora do feed: ${notInFeed}`);
    await client.shutdown();
}

run().catch((error) => {
    console.error("Erro ao rodar o backfill de is_liked no feed");
    console.error(error);
    process.exit(1);
});
