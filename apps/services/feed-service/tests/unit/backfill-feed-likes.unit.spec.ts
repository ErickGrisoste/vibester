import { describe, it, expect, vi, beforeEach } from "vitest";
import { backfillFeedLikes, validatePostKeyspace } from "../../scripts/backfill-feed-likes";
import { FeedEntriesByPostRepository } from "../../src/repositories/feed_entries.repository";
import { FeedRepository } from "../../src/repositories/feed.repository";

function makeRow(postId: string, userId: string) {
    return {
        post_id: { toString: () => postId },
        user_id: { toString: () => userId },
    };
}

describe("validatePostKeyspace", () => {
    it("aceita um keyspace válido ([a-zA-Z0-9_])", () => {
        expect(validatePostKeyspace("post_keyspace")).toBe("post_keyspace");
    });

    it("rejeita quando a variável não está definida", () => {
        expect(() => validatePostKeyspace(undefined)).toThrow(/POST_KEYSPACE/);
    });

    it("rejeita caractere fora de [a-zA-Z0-9_] (ex.: tentativa de injeção via nome de keyspace)", () => {
        expect(() => validatePostKeyspace("post_keyspace; DROP TABLE x")).toThrow(/POST_KEYSPACE/);
    });
});

describe("backfillFeedLikes", () => {
    let mockExecute: ReturnType<typeof vi.fn>;
    let findByItemIdAndUser: ReturnType<typeof vi.fn>;
    let markAsLiked: ReturnType<typeof vi.fn>;
    let client: any;
    let feedEntriesRepository: FeedEntriesByPostRepository;
    let feedRepository: FeedRepository;

    beforeEach(() => {
        mockExecute = vi.fn();
        findByItemIdAndUser = vi.fn();
        markAsLiked = vi.fn().mockResolvedValue(undefined);
        client = { execute: mockExecute };
        feedEntriesRepository = { findByItemIdAndUser } as unknown as FeedEntriesByPostRepository;
        feedRepository = { markAsLiked } as unknown as FeedRepository;
    });

    it("pagina likes_by_post inteiro seguindo pageState até a última página", async () => {
        mockExecute
            .mockResolvedValueOnce({ rows: [makeRow("post-1", "user-1")], pageState: "next-page" })
            .mockResolvedValueOnce({ rows: [makeRow("post-2", "user-2")], pageState: undefined });
        findByItemIdAndUser.mockResolvedValue(null);

        const result = await backfillFeedLikes("post_keyspace", client, feedEntriesRepository, feedRepository);

        expect(mockExecute).toHaveBeenCalledTimes(2);
        expect(mockExecute).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining("post_keyspace.likes_by_post"),
            [],
            expect.not.objectContaining({ pageState: expect.anything() })
        );
        expect(mockExecute).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("post_keyspace.likes_by_post"),
            [],
            expect.objectContaining({ pageState: "next-page" })
        );
        expect(result.likesRead).toBe(2);
    });

    it("marca is_liked = true quando a entrada existe em feed_entries_by_post e conta em markedInFeed", async () => {
        mockExecute.mockResolvedValueOnce({ rows: [makeRow("post-1", "user-1")], pageState: undefined });
        const createdAt = new Date("2024-01-15T12:00:00.000Z");
        findByItemIdAndUser.mockResolvedValue({ created_at: createdAt });

        const result = await backfillFeedLikes("post_keyspace", client, feedEntriesRepository, feedRepository);

        expect(findByItemIdAndUser).toHaveBeenCalledWith("post-1", "user-1");
        expect(markAsLiked).toHaveBeenCalledWith("user-1", createdAt, "post-1");
        expect(result.markedInFeed).toBe(1);
        expect(result.outsideFeed).toBe(0);
    });

    it("não escreve nada (evita linha-fantasma) e conta em outsideFeed quando o post não está no feed do usuário", async () => {
        mockExecute.mockResolvedValueOnce({ rows: [makeRow("post-1", "user-1")], pageState: undefined });
        findByItemIdAndUser.mockResolvedValue(null);

        const result = await backfillFeedLikes("post_keyspace", client, feedEntriesRepository, feedRepository);

        expect(markAsLiked).not.toHaveBeenCalled();
        expect(result.outsideFeed).toBe(1);
        expect(result.markedInFeed).toBe(0);
    });

    it("é idempotente: rodar duas vezes sobre o mesmo like só reafirma is_liked = true, sem erro nem contagem duplicada inconsistente", async () => {
        mockExecute
            .mockResolvedValueOnce({ rows: [makeRow("post-1", "user-1")], pageState: undefined })
            .mockResolvedValueOnce({ rows: [makeRow("post-1", "user-1")], pageState: undefined });
        const createdAt = new Date("2024-01-15T12:00:00.000Z");
        findByItemIdAndUser.mockResolvedValue({ created_at: createdAt });

        const first = await backfillFeedLikes("post_keyspace", client, feedEntriesRepository, feedRepository);
        const second = await backfillFeedLikes("post_keyspace", client, feedEntriesRepository, feedRepository);

        expect(first).toEqual({ likesRead: 1, markedInFeed: 1, outsideFeed: 0 });
        expect(second).toEqual({ likesRead: 1, markedInFeed: 1, outsideFeed: 0 });
        expect(markAsLiked).toHaveBeenCalledTimes(2);
    });

    it("processa vários likes na mesma página, cada um com seu próprio resultado (existe/não existe no feed)", async () => {
        mockExecute.mockResolvedValueOnce({
            rows: [makeRow("post-1", "user-1"), makeRow("post-2", "user-2"), makeRow("post-3", "user-3")],
            pageState: undefined,
        });
        const createdAt = new Date("2024-01-15T12:00:00.000Z");
        findByItemIdAndUser.mockImplementation(async (postId: string) =>
            postId === "post-2" ? null : { created_at: createdAt }
        );

        const result = await backfillFeedLikes("post_keyspace", client, feedEntriesRepository, feedRepository);

        expect(result).toEqual({ likesRead: 3, markedInFeed: 2, outsideFeed: 1 });
        expect(markAsLiked).toHaveBeenCalledWith("user-1", createdAt, "post-1");
        expect(markAsLiked).toHaveBeenCalledWith("user-3", createdAt, "post-3");
        expect(markAsLiked).not.toHaveBeenCalledWith("user-2", expect.anything(), "post-2");
    });
});
