import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Estes testes chamam os métodos do FeedService diretamente (mesma convenção do
// tests/integration/feed.consumer.spec.ts mockado), simulando um handler do KafkaConsumer já
// com o payload validado pelo Zod. Isso significa que nenhuma linha de código deste teste passa
// por kafkajs — nem o `producer.ts` (código morto, não usado em nenhum lugar do src) nem o
// `KafkaConsumer.handleMessage` (parsing/roteamento de tópico) são exercitados aqui, exatamente
// como no mock. Por isso não há nada de Kafka para mockar nesta suíte "real": a única infra real
// em jogo é o Cassandra.
//
// Ressalva importante: como resultado, o parsing/roteamento do `KafkaConsumer.handleMessage`
// (JSON.parse da mensagem, decisão entre `directTopicHandlers` vs. envelope
// `{eventId, eventType, occurredAt, data}`, validação Zod por schema) permanece sem cobertura de
// integração real ou mockada — tanto antes quanto depois desta tarefa. Testar isso de forma
// significativa exigiria subir um broker Kafka real (ou testar `handleMessage` isoladamente com
// mensagens fake), o que está fora do escopo pedido (mockar Kafka na borda em vez de subir um
// broker real em CI). Sinalizando explicitamente esse gap em vez de fingir que está coberto.
import { getCassandraClient } from "../../src/config/cassandra";
import { FeedService } from "../../src/services/feed.service";
import { FeedRepository } from "../../src/repositories/feed.repository";
import { FeedEntriesByPostRepository } from "../../src/repositories/feed_entries.repository";
import { PostsByUserRepository } from "../../src/repositories/posts_by_user.repository";
import { UserFollowerRepository } from "../../src/repositories/followers_by_user.repository";
import { EventsByIdRepository } from "../../src/repositories/events_by_id.repository";
import { EventAttendeesRepository } from "../../src/repositories/attendees_by_event.repository";
import { FeedItemType } from "../../src/types/feed.types";
import { truncateFeedTables } from "../helpers/cassandra.test.helper";

const AUTHOR_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const POST_ID = "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const FOLLOWER_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const EVENT_ID = "d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

function makeUserPostPayload(overrides: Record<string, unknown> = {}) {
  return {
    itemId: POST_ID,
    itemType: FeedItemType.USER_POST,
    authorId: AUTHOR_ID,
    authorUsername: "testuser",
    authorVerified: false,
    content: "Ótimo lugar!",
    imageUrls: ["https://example.com/img.jpg"],
    totalLikes: 0,
    totalComments: 0,
    isSponsored: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("feed-service — Kafka Consumers (Cassandra real)", () => {
  const feedRepository = new FeedRepository();
  const feedEntriesRepository = new FeedEntriesByPostRepository();
  const postsByUserRepository = new PostsByUserRepository();
  const userFollowerRepository = new UserFollowerRepository();
  const eventsByIdRepository = new EventsByIdRepository();
  const attendeesRepository = new EventAttendeesRepository();

  let feedService: FeedService;

  beforeAll(async () => {
    await getCassandraClient().connect();
  });

  afterAll(async () => {
    await getCassandraClient().shutdown();
  });

  beforeEach(async () => {
    await truncateFeedTables(getCassandraClient());
    feedService = new FeedService();
  });

  describe("handlePostCreated", () => {
    it("salva o post do autor em posts_by_user mesmo sem seguidores", async () => {
      await feedService.handlePostCreated(makeUserPostPayload() as any);

      const result = await postsByUserRepository.findRecentPostsByUser(
        AUTHOR_ID,
        new Date(Date.now() - 60_000)
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].post_id.toString()).toBe(POST_ID);
    });

    it("distribui o post para o feed de cada seguidor real", async () => {
      await userFollowerRepository.create(AUTHOR_ID, FOLLOWER_ID);

      await feedService.handlePostCreated(makeUserPostPayload() as any);

      const followerFeed = await feedRepository.findByUser(FOLLOWER_ID, 10);
      expect(followerFeed.rows).toHaveLength(1);
      expect(followerFeed.rows[0].item_id.toString()).toBe(POST_ID);

      const entries = await feedEntriesRepository.findByItemId(POST_ID);
      expect(entries.rows).toHaveLength(1);
      expect(entries.rows[0].user_id.toString()).toBe(FOLLOWER_ID);
    });
  });

  describe("handlePostDeleted", () => {
    it("remove o post de todos os feeds distribuídos e do índice reverso", async () => {
      await userFollowerRepository.create(AUTHOR_ID, FOLLOWER_ID);
      const createdAt = new Date().toISOString();
      await feedService.handlePostCreated(makeUserPostPayload({ createdAt }) as any);

      await feedService.handlePostDeleted({
        authorId: AUTHOR_ID,
        postId: POST_ID,
        createdAt,
      });

      const followerFeed = await feedRepository.findByUser(FOLLOWER_ID, 10);
      expect(followerFeed.rows).toHaveLength(0);

      const entries = await feedEntriesRepository.findByItemId(POST_ID);
      expect(entries.rows).toHaveLength(0);
    });
  });

  describe("handleUserFollowed", () => {
    it("cria a relação de seguidor e migra posts recentes do autor para o feed do novo seguidor", async () => {
      await postsByUserRepository.create(
        {
          postId: POST_ID,
          userId: AUTHOR_ID,
          username: "testuser",
          userProfilePicture: "",
          userVerified: false,
          imageUrls: ["https://example.com/img.jpg"],
          caption: "post recente",
          tags: [],
          totalLikes: 0,
          totalComments: 0,
          isDeleted: false,
          createdAt: new Date(),
        },
        3600
      );

      await feedService.handleUserFollowed({ followerId: FOLLOWER_ID, followedId: AUTHOR_ID });

      const relation = await userFollowerRepository.findFollowersByUser(AUTHOR_ID);
      expect(relation).toContain(FOLLOWER_ID);

      const followerFeed = await feedRepository.findByUser(FOLLOWER_ID, 10);
      expect(followerFeed.rows).toHaveLength(1);
      expect(followerFeed.rows[0].item_id.toString()).toBe(POST_ID);
    });
  });

  describe("handleUserUnfollowed", () => {
    it("remove a relação de seguidor e limpa os posts do autor do feed do seguidor", async () => {
      await userFollowerRepository.create(AUTHOR_ID, FOLLOWER_ID);
      await feedService.handlePostCreated(makeUserPostPayload() as any);

      const beforeUnfollow = await feedRepository.findByUser(FOLLOWER_ID, 10);
      expect(beforeUnfollow.rows).toHaveLength(1);

      await feedService.handleUserUnfollowed({ followerId: FOLLOWER_ID, followedId: AUTHOR_ID });

      const relation = await userFollowerRepository.findFollowersByUser(AUTHOR_ID);
      expect(relation).not.toContain(FOLLOWER_ID);

      const afterUnfollow = await feedRepository.findByUser(FOLLOWER_ID, 10);
      expect(afterUnfollow.rows).toHaveLength(0);
    });
  });

  describe("handleEventConfirmed / handleEventUnconfirmed", () => {
    it("confirma presença: grava em attendees_by_event e adiciona o evento ao feed do usuário", async () => {
      const eventDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 dias (TTL positivo)

      await eventsByIdRepository.create(
        {
          itemId: EVENT_ID,
          itemType: FeedItemType.EVENT,
          eventId: EVENT_ID,
          createdAt: new Date(),
          authorId: AUTHOR_ID,
          authorUsername: "organizer",
          authorVerified: false,
          eventTitle: "Festival de Verão",
          eventBanner: "https://example.com/banner.jpg",
          eventDate,
          eventLocation: "São Paulo",
          eventOrganizerName: "Promotora XYZ",
          eventOrganizerLogo: "https://example.com/logo.jpg",
          totalConfirmed: 0,
          isLiked: false,
          isSponsored: false,
          isDeleted: false,
        },
        3600
      );

      await feedService.handleEventConfirmed({
        eventId: EVENT_ID,
        userId: FOLLOWER_ID,
        eventDate: eventDate.toISOString(),
      });

      const attendees = await attendeesRepository.findAttendeesByEvent(EVENT_ID);
      expect(attendees).toContain(FOLLOWER_ID);

      const feed = await feedRepository.findByUser(FOLLOWER_ID, 10);
      expect(feed.rows).toHaveLength(1);
      expect(feed.rows[0].item_id.toString()).toBe(EVENT_ID);

      await feedService.handleEventUnconfirmed({ eventId: EVENT_ID, userId: FOLLOWER_ID });

      const attendeesAfter = await attendeesRepository.findAttendeesByEvent(EVENT_ID);
      expect(attendeesAfter).not.toContain(FOLLOWER_ID);

      const feedAfter = await feedRepository.findByUser(FOLLOWER_ID, 10);
      expect(feedAfter.rows).toHaveLength(0);
    });
  });
});
