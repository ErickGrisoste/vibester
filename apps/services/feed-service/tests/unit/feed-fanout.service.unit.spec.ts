import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn().mockResolvedValue({ rows: [] }),
}));
vi.mock("../../src/config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { FeedFanoutService } from "../../src/services/feed-fanout.service";
import { FeedItemType } from "../../src/types/feed.types";

const AUTHOR_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const POST_ID = "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const FOLLOWER_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ESTAB_ID = "e1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const USER_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ISO_DATE = "2024-01-15T12:00:00.000Z";
const CREATED_AT = new Date(ISO_DATE);

const LIKE_EVENT = {
  postId: POST_ID,
  userId: USER_ID,
  createdAt: ISO_DATE,
};

describe("FeedFanoutService — Unitários", () => {
  let feedFanoutService: FeedFanoutService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
    feedFanoutService = new FeedFanoutService();
  });

  describe("handlePostCreated — ESTABLISHMENT_POST", () => {
    it("salva post do estabelecimento sem seguidores", async () => {
      await feedFanoutService.handlePostCreated({
        itemId: POST_ID,
        itemType: FeedItemType.ESTABLISHMENT_POST,
        authorId: ESTAB_ID,
        authorUsername: "estab_do_bar",
        authorVerified: false,
        content: "Promoção de terça!",
        imageUrls: [],
        totalLikes: 0,
        totalComments: 0,
        isSponsored: false,
        isDeleted: false,
        createdAt: ISO_DATE,
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });

    it("distribui post do estabelecimento para seguidores", async () => {
      mockExecute.mockImplementation(async (query: string) =>
        query.includes("FROM feed_keyspace.followers_by_establishment")
          ? { rows: [{ follower_id: FOLLOWER_ID }] }
          : { rows: [] }
      );

      await feedFanoutService.handlePostCreated({
        itemId: POST_ID,
        itemType: FeedItemType.ESTABLISHMENT_POST,
        authorId: ESTAB_ID,
        authorUsername: "estab_do_bar",
        authorVerified: false,
        content: "Promoção de terça!",
        imageUrls: [],
        totalLikes: 0,
        totalComments: 0,
        isSponsored: false,
        isDeleted: false,
        createdAt: ISO_DATE,
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe("handlePostCreated — feed do próprio autor", () => {
    const feedByUserInserts = () =>
      mockExecute.mock.calls.filter(([query]) =>
        (query as string).includes("INSERT INTO feed_keyspace.feed_by_user")
      );

    function userPost() {
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
      } as any;
    }

    it("grava o post no feed do autor mesmo sem seguidores", async () => {
      await feedFanoutService.handlePostCreated(userPost());

      const inserts = feedByUserInserts();
      expect(inserts).toHaveLength(1);
      expect((inserts[0][1] as unknown[])[0]).toBe(AUTHOR_ID);

      const entryInserts = mockExecute.mock.calls.filter(([query]) =>
        (query as string).includes("INSERT INTO feed_keyspace.feed_entries_by_post")
      );
      expect(entryInserts).toHaveLength(1);
      expect(entryInserts[0][1]).toEqual(expect.arrayContaining([POST_ID, AUTHOR_ID]));
    });

    it("grava no feed do autor e no de cada seguidor", async () => {
      mockExecute.mockImplementation(async (query: string) =>
        query.includes("FROM feed_keyspace.followers_by_user")
          ? { rows: [{ follower_id: FOLLOWER_ID }] }
          : { rows: [] }
      );

      await feedFanoutService.handlePostCreated(userPost());

      const donos = feedByUserInserts().map(([, params]) => (params as unknown[])[0]);
      expect(donos).toEqual([AUTHOR_ID, FOLLOWER_ID]);
    });
  });

  describe("distributePostToFollowers — tipo inválido", () => {
    it("lança erro para tipo de item não suportado", async () => {
      const feedItem = {
        itemId: POST_ID,
        itemType: "UNSUPPORTED_TYPE" as FeedItemType,
        authorId: AUTHOR_ID,
        authorUsername: "testuser",
        authorVerified: false,
        totalLikes: 0,
        totalComments: 0,
        isSponsored: false,
        isDeleted: false,
        createdAt: new Date(ISO_DATE),
      };

      await expect(feedFanoutService.distributePostToFollowers(feedItem as any))
        .rejects.toThrow("Unsupported feed item type");
    });
  });

  describe("handleEventCreated — EVENT", () => {
    it("salva evento de estabelecimento e distribui para seguidores", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await feedFanoutService.handleEventCreated({
        itemId: "evt-id",
        itemType: FeedItemType.EVENT,
        authorId: ESTAB_ID,
        authorUsername: "Estab Bar",
        authorVerified: false,
        eventId: "evt-id",
        eventTitle: "Noite de Samba",
        eventBanner: "https://example.com/banner.jpg",
        eventDate: futureDate,
        eventLocation: "Rio de Janeiro",
        eventOrganizerName: "Estab Bar",
        eventOrganizerLogo: "https://example.com/logo.jpg",
        totalLikes: 0,
        totalComments: 0,
        totalConfirmed: 0,
        isSponsored: false,
        isDeleted: false,
        createdAt: ISO_DATE,
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe("handlePostLiked", () => {
    it("executa UPDATE is_liked = true quando a entrada existe no feed", async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ post_id: POST_ID, user_id: USER_ID, created_at: CREATED_AT }],
      });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await feedFanoutService.handlePostLiked(LIKE_EVENT);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("is_liked = true"),
        expect.arrayContaining([USER_ID, CREATED_AT, POST_ID]),
        expect.anything()
      );
    });

    it("não executa UPDATE quando a entrada não existe no feed", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await feedFanoutService.handlePostLiked(LIKE_EVENT);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).not.toHaveBeenCalledWith(
        expect.stringContaining("is_liked = true"),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("handlePostUnliked", () => {
    it("executa UPDATE is_liked = false quando a entrada existe no feed", async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ post_id: POST_ID, user_id: USER_ID, created_at: CREATED_AT }],
      });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await feedFanoutService.handlePostUnliked(LIKE_EVENT);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("is_liked = false"),
        expect.arrayContaining([USER_ID, CREATED_AT, POST_ID]),
        expect.anything()
      );
    });

    it("não executa UPDATE quando a entrada não existe no feed", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await feedFanoutService.handlePostUnliked(LIKE_EVENT);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).not.toHaveBeenCalledWith(
        expect.stringContaining("is_liked = false"),
        expect.anything(),
        expect.anything()
      );
    });
  });
});
