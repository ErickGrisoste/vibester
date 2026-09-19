import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));
vi.mock("../../src/config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { FeedFanoutService, FANOUT_BATCH_SIZE } from "../../src/services/feed-fanout.service";
import { FeedItemType } from "../../src/types/feed.types";

const AUTHOR_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const POST_ID = "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ISO_DATE = "2024-01-15T12:00:00.000Z";

function makeUserPostPayload() {
  return {
    itemId: POST_ID,
    itemType: FeedItemType.USER_POST,
    authorId: AUTHOR_ID,
    authorUsername: "testuser",
    authorVerified: false,
    content: "Ótimo lugar!",
    imageUrls: [],
    totalLikes: 0,
    totalComments: 0,
    isSponsored: false,
    isDeleted: false,
    createdAt: ISO_DATE,
  };
}

/** Gera N ids de seguidor com o mesmo comprimento, para que a comparação lexicográfica usada
 *  pelo mock (equivalente ao `follower_id > ?` do Cassandra) coincida com a ordem numérica. */
function makeFollowerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `f${String(i).padStart(6, "0")}`);
}

/** Mock de `getCassandraClient().execute` que entende três formatos de query:
 *  1) leitura paginada de followers_by_user (responde com uma fatia de `followers`, respeitando cursor/limit);
 *  2) INSERT em feed_entries_by_post / feed_by_user (a "escrita" real do fan-out) — rastreada para
 *     concorrência e para conferir que todo seguidor recebeu o item;
 *  3) qualquer outra query (posts_by_user, etc.) — resolve vazio, sem relevância para este teste. */
function buildMockExecute(followers: string[], trackConcurrency: { inFlight: number; max: number }) {
  return vi.fn(async (query: string, params: unknown[]) => {
    if (query.includes("FROM feed_keyspace.followers_by_user")) {
      const hasCursor = query.includes("follower_id > ?");
      const cursor = hasCursor ? (params[1] as string) : undefined;
      const limit = params[params.length - 1] as number;

      const startIndex = cursor ? followers.indexOf(cursor) + 1 : 0;
      const page = followers.slice(startIndex, startIndex + limit);

      return { rows: page.map((followerId) => ({ follower_id: followerId })) };
    }

    if (query.includes("INSERT INTO feed_keyspace.feed_by_user") || query.includes("INSERT INTO feed_keyspace.feed_entries_by_post")) {
      trackConcurrency.inFlight += 1;
      trackConcurrency.max = Math.max(trackConcurrency.max, trackConcurrency.inFlight);

      // pequeno atraso assíncrono real para permitir que as escritas concorrentes
      // do mesmo lote realmente se sobreponham no tempo (sem isso, promises que
      // resolvem em uma única microtask não expõem sobreposição no contador).
      await new Promise((resolve) => setTimeout(resolve, 0));

      trackConcurrency.inFlight -= 1;
      return { rows: [] };
    }

    return { rows: [] };
  });
}

describe("FeedFanoutService — fan-out em lote de seguidores", () => {
  let feedFanoutService: FeedFanoutService;

  beforeEach(() => {
    vi.resetAllMocks();
    feedFanoutService = new FeedFanoutService();
  });

  it("(a) poucos seguidores (menos que o lote): uma única página de leitura de seguidores", async () => {
    const followers = makeFollowerIds(3);
    const concurrency = { inFlight: 0, max: 0 };
    mockExecute.mockImplementation(buildMockExecute(followers, concurrency));

    await feedFanoutService.distributePostToFollowers(makeUserPostPayload() as any);

    const followerReadCalls = mockExecute.mock.calls.filter(([query]) =>
      (query as string).includes("FROM feed_keyspace.followers_by_user")
    );
    expect(followerReadCalls).toHaveLength(1);

    // cada seguidor gera 2 escritas (feed_entries_by_post + feed_by_user)
    const writeCalls = mockExecute.mock.calls.filter(
      ([query]) =>
        (query as string).includes("INSERT INTO feed_keyspace.feed_by_user") ||
        (query as string).includes("INSERT INTO feed_keyspace.feed_entries_by_post")
    );
    expect(writeCalls).toHaveLength(followers.length * 2);
  });

  it("(b) mais seguidores que o tamanho do lote: busca múltiplas páginas e distribui para todos", async () => {
    const totalFollowers = FANOUT_BATCH_SIZE * 2 + 200; // 3 páginas: cheia, cheia, parcial
    const followers = makeFollowerIds(totalFollowers);
    const concurrency = { inFlight: 0, max: 0 };
    mockExecute.mockImplementation(buildMockExecute(followers, concurrency));

    await feedFanoutService.distributePostToFollowers(makeUserPostPayload() as any);

    const followerReadCalls = mockExecute.mock.calls.filter(([query]) =>
      (query as string).includes("FROM feed_keyspace.followers_by_user")
    );
    expect(followerReadCalls).toHaveLength(3);

    const feedByUserInserts = mockExecute.mock.calls.filter(([query]) =>
      (query as string).includes("INSERT INTO feed_keyspace.feed_by_user")
    );
    expect(feedByUserInserts).toHaveLength(totalFollowers);

    // confirma que TODOS os seguidores (das 3 páginas) efetivamente receberam o item,
    // sem duplicidade e sem lacunas — user_id é o primeiro parâmetro do INSERT em feed_by_user.
    const distributedFollowerIds = feedByUserInserts.map(([, params]) => (params as unknown[])[0]);
    expect(new Set(distributedFollowerIds).size).toBe(totalFollowers);
    for (const followerId of followers) {
      expect(distributedFollowerIds).toContain(followerId);
    }
  }, 15000);

  it("(c) concorrência por lote é limitada: nunca mais que FANOUT_BATCH_SIZE escritas simultâneas", async () => {
    const totalFollowers = FANOUT_BATCH_SIZE * 2 + 200;
    const followers = makeFollowerIds(totalFollowers);
    const concurrency = { inFlight: 0, max: 0 };
    mockExecute.mockImplementation(buildMockExecute(followers, concurrency));

    await feedFanoutService.distributePostToFollowers(makeUserPostPayload() as any);

    // sem limite de lote, as 1200 escritas de feed_by_user (mais as 1200 de feed_entries_by_post)
    // seriam todas disparadas de uma vez — o pico observado precisa ficar no tamanho do lote,
    // nunca no total de seguidores.
    expect(concurrency.max).toBeLessThanOrEqual(FANOUT_BATCH_SIZE);
    expect(concurrency.max).toBeLessThan(totalFollowers);
  }, 15000);
});
