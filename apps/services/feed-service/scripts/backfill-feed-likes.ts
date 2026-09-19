import cassandra from "cassandra-driver";
import { getCassandraClient } from "../src/config/cassandra";
import { FeedEntriesByPostRepository } from "../src/repositories/feed_entries.repository";
import { FeedRepository } from "../src/repositories/feed.repository";

// Reconstrói feed_by_user.is_liked a partir de <POST_KEYSPACE>.likes_by_post
// (fonte de verdade dos likes, no post-service) para likes perdidos por
// post.liked/post.unliked descartados no consumer antes da correção em
// src/kafka/consumer.ts. Só grava em feed_keyspace.feed_by_user — likes_by_post
// e o keyspace do post-service são somente leitura aqui. Requer que
// feed_keyspace e o keyspace do post-service estejam no mesmo banco Astra e
// que o token do feed-service tenha leitura no keyspace do post-service.
const PAGE_SIZE = 500;
const KEYSPACE_PATTERN = /^[a-zA-Z0-9_]+$/;

export interface BackfillResult {
    likesRead: number;
    markedInFeed: number;
    outsideFeed: number;
}

export function validatePostKeyspace(postKeyspace: string | undefined): string {
    if (!postKeyspace || !KEYSPACE_PATTERN.test(postKeyspace)) {
        throw new Error(
            "POST_KEYSPACE não definida ou inválida (esperado apenas [a-zA-Z0-9_])."
        );
    }

    return postKeyspace;
}

// Idempotente: só faz UPDATE de feed_by_user quando a entrada já existe em
// feed_entries_by_post (UPDATE sem linha existente criaria uma linha-fantasma
// no Cassandra) — rodar de novo sobre o mesmo like não muda nada além de
// reafirmar is_liked = true.
export async function backfillFeedLikes(
    postKeyspace: string,
    client: cassandra.Client,
    feedEntriesRepository: FeedEntriesByPostRepository,
    feedRepository: FeedRepository
): Promise<BackfillResult> {
    let likesRead = 0;
    let markedInFeed = 0;
    let outsideFeed = 0;

    let pageState: string | undefined;

    do {
        const page = await client.execute(
            `SELECT post_id, user_id FROM ${postKeyspace}.likes_by_post;`,
            [],
            { prepare: true, fetchSize: PAGE_SIZE, ...(pageState ? { pageState } : {}) }
        );

        // Sequencial, de propósito: baixa carga no cluster de produção em vez
        // de disparar centenas de leituras/escritas em paralelo (ver CLAUDE.md
        // deste serviço sobre não acumular/disparar sem limite).
        for (const row of page.rows) {
            likesRead++;

            const postId = row.post_id.toString();
            const userId = row.user_id.toString();

            const entry = await feedEntriesRepository.findByItemIdAndUser(postId, userId);

            if (!entry) {
                outsideFeed++;
                continue;
            }

            await feedRepository.markAsLiked(userId, entry.created_at, postId);
            markedInFeed++;
        }

        pageState = page.pageState || undefined;
    } while (pageState);

    return { likesRead, markedInFeed, outsideFeed };
}

async function main() {
    const postKeyspace = validatePostKeyspace(process.env.POST_KEYSPACE);

    const client = getCassandraClient();
    await client.connect();

    const result = await backfillFeedLikes(
        postKeyspace,
        client,
        new FeedEntriesByPostRepository(),
        new FeedRepository()
    );

    console.log(`Backfill de feed_by_user.is_liked — likes de ${postKeyspace}.likes_by_post`);
    console.log(
        `Likes lidos: ${result.likesRead} | Marcados no feed: ${result.markedInFeed} | Fora do feed: ${result.outsideFeed}`
    );

    await client.shutdown();
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
