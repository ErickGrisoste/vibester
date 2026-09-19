/**
 * Backfill único de post_counters a partir dos valores hoje gravados em
 * posts_by_id.total_likes/total_comments (colunas `int`, mantidas como
 * read-modify-write manual até esta migração).
 *
 * Por que existe: coluna `counter` do Cassandra não aceita INSERT com valor
 * literal — só existe incremento/decremento (`SET col = col + ?`). A
 * migration V015 cria a tabela vazia; sem este script, um post com
 * total_likes/total_comments > 0 hoje "reinicia" a exibição a partir de 1 no
 * primeiro like/comentário novo após o deploy, porque post_counters começa
 * sem nenhuma linha para ele.
 *
 * QUANDO RODAR: uma vez, antes (ou durante uma janela de manutenção) do
 * deploy do código que passa a escrever em post_counters
 * (LikeService/CommentService). Rodar depois que o tráfego novo já começou a
 * incrementar post_counters é seguro (idempotente — ver abaixo), mas qualquer
 * post que já tenha recebido um like/comentário novo antes do backfill rodar
 * já vai ter sido "pulado" (ver idempotência) e ficará com a contagem restrita
 * ao que aconteceu depois do deploy, não ao histórico completo.
 *
 * IDEMPOTÊNCIA: para cada post, o script só aplica o backfill se
 * post_counters ainda não tiver nenhuma linha para aquele post_id — rodar de
 * novo não soma o valor histórico duas vezes, mas também não corrige um post
 * que já recebeu tráfego novo antes do backfill (nesse caso o post_counters já
 * existe com o valor "pós-deploy", e o script preserva esse valor em vez de
 * sobrescrever).
 *
 * NÃO TESTADO CONTRA CASSANDRA REAL — revise e rode primeiro em staging.
 */
import "dotenv/config";
import { Client } from "cassandra-driver";

const KEYSPACE = process.env.ASTRA_KEYSPACE;
const BUNDLE_PATH = process.env.ASTRA_SECURE_CONNECT_BUNDLE;
const CLIENT_ID = process.env.ASTRA_CLIENT_ID;
const CLIENT_SECRET = process.env.ASTRA_CLIENT_SECRET;

const CONTACT_POINTS = process.env.CASSANDRA_CONTACT_POINTS;
const LOCAL_DATA_CENTER = process.env.CASSANDRA_LOCAL_DATA_CENTER || "datacenter1";
const IS_LOCAL = Boolean(CONTACT_POINTS);

if (!KEYSPACE) { throw new Error("ASTRA_KEYSPACE não definida"); }

if (!IS_LOCAL) {
    if (!BUNDLE_PATH) { throw new Error("ASTRA_SECURE_CONNECT_BUNDLE não definida"); }
    if (!CLIENT_ID) { throw new Error("ASTRA_CLIENT_ID não definida"); }
    if (!CLIENT_SECRET) { throw new Error("ASTRA_CLIENT_SECRET não definida"); }
}

const client = IS_LOCAL
    ? new Client({
        contactPoints: CONTACT_POINTS!.split(",").map((cp) => cp.trim()),
        localDataCenter: LOCAL_DATA_CENTER,
        keyspace: KEYSPACE,
    })
    : new Client({
        cloud: { secureConnectBundle: BUNDLE_PATH! },
        credentials: { username: CLIENT_ID!, password: CLIENT_SECRET! },
        keyspace: KEYSPACE,
    });

async function alreadyBackfilled(postId: string): Promise<boolean> {
    const result = await client.execute(
        `SELECT total_likes, total_comments FROM post_counters WHERE post_id = ?;`,
        [postId],
        { prepare: true }
    );
    return result.rows.length > 0;
}

async function backfillPost(postId: string, totalLikes: number, totalComments: number): Promise<void> {
    const writes: Promise<unknown>[] = [];

    if (totalLikes > 0) {
        writes.push(client.execute(
            `UPDATE post_counters SET total_likes = total_likes + ? WHERE post_id = ?;`,
            [totalLikes, postId],
            { prepare: true }
        ));
    }

    if (totalComments > 0) {
        writes.push(client.execute(
            `UPDATE post_counters SET total_comments = total_comments + ? WHERE post_id = ?;`,
            [totalComments, postId],
            { prepare: true }
        ));
    }

    await Promise.all(writes);
}

async function run() {
    await client.connect();
    console.log(`Backfill de post_counters — keyspace ${KEYSPACE}`);

    let processed = 0;
    let backfilled = 0;
    let skipped = 0;
    let pageState: string | undefined;

    // Paginação manual (não client.stream/eachRow) de propósito: cada linha
    // dispara escritas assíncronas (alreadyBackfilled + backfillPost) que
    // precisam terminar antes de seguir para a próxima — processamento
    // sequencial simples é mais fácil de auditar num script de execução única
    // do que coordenar concorrência com paginação automática.
    do {
        const result = await client.execute(
            `SELECT post_id, total_likes, total_comments FROM posts_by_id;`,
            [],
            { prepare: true, fetchSize: 500, pageState }
        );

        for (const row of result.rows) {
            processed++;
            const postId: string = row.post_id;
            const totalLikes: number = row.total_likes ?? 0;
            const totalComments: number = row.total_comments ?? 0;

            if (totalLikes === 0 && totalComments === 0) { continue; }

            if (await alreadyBackfilled(postId)) {
                skipped++;
                continue;
            }

            await backfillPost(postId, totalLikes, totalComments);
            backfilled++;
        }

        pageState = result.pageState || undefined;
    } while (pageState);

    console.log(`Processados: ${processed} | Backfilled: ${backfilled} | Já existentes (pulados): ${skipped}`);
    await client.shutdown();
}

run().catch((error) => {
    console.error("Erro ao rodar o backfill de post_counters");
    console.error(error);
    process.exit(1);
});
