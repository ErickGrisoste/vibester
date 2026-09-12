import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Diferente do auth-service/user-service, a rota GET /feed/:userId (FeedController →
// FeedService → repositórios Cassandra) nunca chama Kafka — este serviço só produz efeitos
// colaterais de Kafka através do KafkaConsumer (que não é exercitado por esta suíte HTTP).
// Não há producer/consumer para mockar aqui.
import { getCassandraClient } from "../../src/config/cassandra";
import { FeedRepository } from "../../src/repositories/feed.repository";
import { FeedItem, FeedItemType } from "../../src/types/feed.types";
import { buildServer, makeAuthHeader } from "../helpers/fastify.test.helper";
import { truncateFeedTables } from "../helpers/cassandra.test.helper";

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const OTHER_USER_ID = "e1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const AUTHOR_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

function makeFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    userId: USER_ID,
    createdAt: new Date(),
    itemId: crypto.randomUUID(),
    itemType: FeedItemType.USER_POST,
    authorId: AUTHOR_ID,
    authorUsername: "testuser",
    authorVerified: false,
    content: "Ótimo lugar!",
    imageUrls: ["https://example.com/img.jpg"],
    tags: [],
    totalLikes: 5,
    totalComments: 2,
    isLiked: false,
    isSponsored: false,
    isDeleted: false,
    ...overrides,
  };
}

describe("feed-service — HTTP Integration (Cassandra real)", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let authHeader: string;
  const feedRepository = new FeedRepository();

  beforeAll(async () => {
    await getCassandraClient().connect();
    app = await buildServer();
    authHeader = makeAuthHeader(app, USER_ID);
  });

  afterAll(async () => {
    await app.close();
    await getCassandraClient().shutdown();
  });

  beforeEach(async () => {
    await truncateFeedTables(getCassandraClient());
  });

  describe("GET /feed/:userId", () => {
    it("retorna feed vazio quando não há conteúdo no Cassandra", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/feed/${USER_ID}`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it("retorna feed com item persistido de verdade no Cassandra", async () => {
      const item = makeFeedItem();
      await feedRepository.create(item, 3600);

      const res = await app.inject({
        method: "GET",
        url: `/feed/${USER_ID}`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].item_id).toBe(item.itemId);
      expect(body.items[0].content).toBe("Ótimo lugar!");
      expect(body.items[0].total_likes).toBe(5);
    });

    it("respeita o limit informado contra dados reais", async () => {
      const base = Date.now();
      await Promise.all(
        [0, 1, 2].map((i) =>
          feedRepository.create(
            makeFeedItem({ itemId: crypto.randomUUID(), createdAt: new Date(base - i * 1000) }),
            3600
          )
        )
      );

      const res = await app.inject({
        method: "GET",
        url: `/feed/${USER_ID}?limit=2`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items).toHaveLength(2);
    });

    it("pagina por cursor de created_at (clustering key real)", async () => {
      const older = new Date(Date.now() - 60_000);
      const newer = new Date();
      const olderItem = makeFeedItem({ itemId: crypto.randomUUID(), createdAt: older });
      const newerItem = makeFeedItem({ itemId: crypto.randomUUID(), createdAt: newer });

      await feedRepository.create(olderItem, 3600);
      await feedRepository.create(newerItem, 3600);

      const res = await app.inject({
        method: "GET",
        url: `/feed/${USER_ID}?cursor=${encodeURIComponent(newer.toISOString())}`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].item_id).toBe(olderItem.itemId);
    });

    it("retorna nextCursor com o created_at real do último item retornado", async () => {
      const older = new Date(Date.now() - 60_000);
      const newer = new Date();
      await feedRepository.create(makeFeedItem({ itemId: crypto.randomUUID(), createdAt: newer }), 3600);
      await feedRepository.create(makeFeedItem({ itemId: crypto.randomUUID(), createdAt: older }), 3600);

      const res = await app.inject({
        method: "GET",
        url: `/feed/${USER_ID}`,
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.nextCursor).not.toBeNull();
      expect(new Date(body.nextCursor).getTime()).toBe(older.getTime());
    });

    it("retorna 403 quando o token pertence a outro usuário", async () => {
      const otherHeader = makeAuthHeader(app, OTHER_USER_ID);

      const res = await app.inject({
        method: "GET",
        url: `/feed/${USER_ID}`,
        headers: { authorization: otherHeader },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /health", () => {
    it("retorna status ok", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ status: "ok" });
    });
  });
});
