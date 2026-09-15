import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/redis", () => ({
  redis: { del: vi.fn().mockResolvedValue(1) },
  cacheAside: async <T>(_key: string, _ttl: number, fetchFn: () => Promise<T>): Promise<T> => fetchFn(),
}));
vi.mock("../../kafka/producer", () => ({
  producer: { send: vi.fn().mockResolvedValue(undefined) },
}));

import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { AccountContentDeletionService, DELETION_PAGE_SIZE } from "../account-content-deletion.service";
import { HttpError } from "../../errors/http.error";
import { encodeCursor, encodeLikeCursor } from "../../utils/cursor";
import { MediaType, Post } from "../../types/post.types";

const USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function makePost(postId: string): Post {
  return {
    postId,
    userId: USER,
    media: [{ url: "https://test.r2.dev/posts/x.jpg", type: MediaType.IMAGE }],
    imageUrls: [],
    caption: "legenda",
    totalLikes: 0,
    totalComments: 0,
    isDeleted: false,
    createdAt: new Date("2026-01-01"),
  };
}

describe("AccountContentDeletionService", () => {
  let postRepository: any;
  let postService: any;
  let likeRepository: any;
  let likeService: any;
  let commentRepository: any;
  let commentService: any;
  let storage: { send: ReturnType<typeof vi.fn> };
  let service: AccountContentDeletionService;

  beforeEach(() => {
    postRepository = {
      findByUser: vi.fn().mockResolvedValue({ posts: [], nextCursor: null }),
      updateCaptionInAllViews: vi.fn().mockResolvedValue(undefined),
    };
    postService = { softDelete: vi.fn().mockResolvedValue(undefined) };
    likeRepository = { findLikesByUser: vi.fn().mockResolvedValue({ likes: [], nextCursor: null }) };
    likeService = { unlikePost: vi.fn().mockResolvedValue(undefined) };
    commentRepository = { findByUser: vi.fn().mockResolvedValue({ comments: [], nextCursor: null }) };
    commentService = { softDelete: vi.fn().mockResolvedValue(undefined) };
    storage = { send: vi.fn().mockResolvedValue({ Contents: [], IsTruncated: false }) };

    service = new AccountContentDeletionService(
      postRepository, postService, likeRepository, likeService, commentRepository, commentService, storage as never,
    );
  });

  it("apaga a legenda e remove cada post, seguindo o cursor até o fim", async () => {
    const p1 = makePost("p1");
    const p2 = makePost("p2");
    postRepository.findByUser
      .mockResolvedValueOnce({ posts: [p1], nextCursor: encodeCursor({ createdAt: p1.createdAt, postId: "p1" }) })
      .mockResolvedValueOnce({ posts: [p2], nextCursor: null });

    await service.deleteAllContent(USER);

    expect(postRepository.findByUser).toHaveBeenCalledTimes(2);
    expect(postRepository.findByUser.mock.calls[0]).toEqual([USER, DELETION_PAGE_SIZE, undefined]);
    expect(postRepository.findByUser.mock.calls[1][2]).toEqual({ createdAt: p1.createdAt, postId: "p1" });
    expect(postRepository.updateCaptionInAllViews).toHaveBeenCalledWith(p1, "", expect.any(Date));
    expect(postService.softDelete).toHaveBeenCalledWith("p1", USER);
    expect(postService.softDelete).toHaveBeenCalledWith("p2", USER);
  });

  it("desfaz curtidas e remove comentários ainda ativos", async () => {
    const likedAt = new Date("2026-02-01");
    likeRepository.findLikesByUser
      .mockResolvedValueOnce({ likes: [{ postId: "a", userId: USER, likedAt }], nextCursor: encodeLikeCursor({ likedAt, postId: "a" }) })
      .mockResolvedValueOnce({ likes: [{ postId: "b", userId: USER, likedAt }], nextCursor: null });
    commentRepository.findByUser.mockResolvedValueOnce({
      comments: [
        { commentId: "c1", postId: "a", userId: USER, isDeleted: false },
        { commentId: "c2", postId: "a", userId: USER, isDeleted: true },
      ],
      nextCursor: null,
    });

    await service.deleteAllContent(USER);

    expect(likeService.unlikePost).toHaveBeenCalledWith("a", USER);
    expect(likeService.unlikePost).toHaveBeenCalledWith("b", USER);
    expect(commentService.softDelete).toHaveBeenCalledTimes(1);
    expect(commentService.softDelete).toHaveBeenCalledWith("c1", USER);
  });

  it("ignora 404/409 de algo já apagado e propaga os demais erros", async () => {
    postRepository.findByUser.mockResolvedValue({ posts: [makePost("p1")], nextCursor: null });

    postService.softDelete.mockRejectedValueOnce(new HttpError("Post not found", 404));
    await expect(service.deleteAllContent(USER)).resolves.toBeUndefined();

    postService.softDelete.mockRejectedValueOnce(new Error("cassandra down"));
    await expect(service.deleteAllContent(USER)).rejects.toThrow("cassandra down");
  });

  it("apaga toda mídia do prefixo da conta no R2, página por página", async () => {
    storage.send
      .mockResolvedValueOnce({ Contents: [{ Key: `posts/${USER}/1.jpg` }], IsTruncated: true, NextContinuationToken: "t1" })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Contents: [{ Key: `posts/${USER}/2.mp4` }], IsTruncated: false })
      .mockResolvedValueOnce({});

    await service.deleteAllContent(USER);

    const commands = storage.send.mock.calls.map((call) => call[0]);
    expect(commands[0]).toBeInstanceOf(ListObjectsV2Command);
    expect(commands[0].input).toMatchObject({ Bucket: "test-bucket", Prefix: `posts/${USER}/` });
    expect(commands[1]).toBeInstanceOf(DeleteObjectsCommand);
    expect(commands[1].input.Delete.Objects).toEqual([{ Key: `posts/${USER}/1.jpg` }]);
    expect(commands[2].input.ContinuationToken).toBe("t1");
    expect(commands[3].input.Delete.Objects).toEqual([{ Key: `posts/${USER}/2.mp4` }]);
  });

  it("sem mídia não chama DeleteObjects", async () => {
    await service.deleteAllContent(USER);
    expect(storage.send).toHaveBeenCalledTimes(1);
  });
});
