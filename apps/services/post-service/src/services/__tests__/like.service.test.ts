import { describe, it, expect, vi, beforeEach } from "vitest";
import { LikeService } from "../like.service";
import { LikeRepository } from "../../repository/like.repository";
import { PostRepository } from "../../repository/post.repository";
import { Post, MediaType } from "../../types/post.types";
import { PostLike } from "../../types/like.types";
import { encodeLikeByPostCursor, encodeLikeCursor } from "../../utils/cursor";

vi.mock("../../kafka/producer", () => ({
  producer: { send: vi.fn().mockResolvedValue(undefined) },
}));

function createMockLikeRepo() {
  return {
    createLikeByPost: vi.fn().mockResolvedValue(true),
    createLikeByUser: vi.fn().mockResolvedValue(undefined),
    findLikeByPostAndUser: vi.fn().mockResolvedValue(null),
    findLikesByPost: vi.fn().mockResolvedValue({ likes: [], nextCursor: null }),
    findLikesByUser: vi.fn().mockResolvedValue({ likes: [], nextCursor: null }),
    deleteLikeByPost: vi.fn().mockResolvedValue(true),
    deleteLikeByUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as LikeRepository;
}

function createMockPostRepo() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    incrementLikes: vi.fn().mockResolvedValue(undefined),
    decrementLikes: vi.fn().mockResolvedValue(undefined),
    getCounters: vi.fn().mockResolvedValue({ totalLikes: 0, totalComments: 0 }),
    updateTotalLikesInAllViews: vi.fn().mockResolvedValue(undefined),
  } as unknown as PostRepository;
}

function makePost(o: Partial<Post> = {}): Post {
  return {
    postId: "post-1", userId: "user-1", media: [{ url: "img.jpg", type: MediaType.IMAGE }], imageUrls: ["img.jpg"],
    caption: "Hi", totalLikes: 5, totalComments: 2,
    isDeleted: false, createdAt: new Date("2026-01-01"), ...o,
  };
}

function makeLike(o: Partial<PostLike> = {}): PostLike {
  return { postId: "post-1", userId: "user-2", likedAt: new Date("2026-01-02"), ...o };
}

describe("LikeService", () => {
  let svc: LikeService;
  let likeRepo: ReturnType<typeof createMockLikeRepo>;
  let postRepo: ReturnType<typeof createMockPostRepo>;

  beforeEach(() => {
    likeRepo = createMockLikeRepo();
    postRepo = createMockPostRepo();
    svc = new LikeService(likeRepo, postRepo);
  });

  describe("likePost", () => {
    it("should create a like, increment the atomic counter and propagate the fresh total", async () => {
      const post = makePost();
      (postRepo.findById as any).mockResolvedValue(post);
      (postRepo.getCounters as any).mockResolvedValue({ totalLikes: 4, totalComments: 2 });

      const result = await svc.likePost("post-1", "user-2");

      expect(result.postId).toBe("post-1");
      expect(result.userId).toBe("user-2");
      expect(result.likedAt).toBeInstanceOf(Date);
      expect(likeRepo.createLikeByPost).toHaveBeenCalledOnce();
      expect(likeRepo.createLikeByUser).toHaveBeenCalledOnce();
      expect(postRepo.incrementLikes).toHaveBeenCalledWith("post-1");
      expect(postRepo.getCounters).toHaveBeenCalledWith("post-1");
      expect(postRepo.updateTotalLikesInAllViews).toHaveBeenCalledWith(post, 4);
    });

    it("should propagate the fresh total to the establishment view when the post has one", async () => {
      const post = makePost({ establishmentId: "est-1" });
      (postRepo.findById as any).mockResolvedValue(post);
      (postRepo.getCounters as any).mockResolvedValue({ totalLikes: 1, totalComments: 0 });

      await svc.likePost("post-1", "user-2");

      expect(postRepo.updateTotalLikesInAllViews).toHaveBeenCalledWith(post, 1);
    });

    it("should throw when post is not found", async () => {
      await expect(svc.likePost("x", "u")).rejects.toThrow("Post not found");
    });

    it("should throw when post is deleted", async () => {
      (postRepo.findById as any).mockResolvedValue(makePost({ isDeleted: true }));
      await expect(svc.likePost("post-1", "u")).rejects.toThrow("Post is deleted");
    });

    it("should throw on duplicate like", async () => {
      (postRepo.findById as any).mockResolvedValue(makePost());
      (likeRepo.findLikeByPostAndUser as any).mockResolvedValue(makeLike());
      await expect(svc.likePost("post-1", "user-2")).rejects.toThrow("Post already liked");
      expect(postRepo.incrementLikes).not.toHaveBeenCalled();
    });

    it("should throw 409 when createLikeByPost loses the race (IF NOT EXISTS not applied)", async () => {
      // findLikeByPostAndUser não viu o like ainda (corrida), mas o INSERT
      // condicional chega depois de outra requisição concorrente já ter
      // criado a linha — createLikeByPost devolve false.
      (postRepo.findById as any).mockResolvedValue(makePost());
      (likeRepo.findLikeByPostAndUser as any).mockResolvedValue(null);
      (likeRepo.createLikeByPost as any).mockResolvedValue(false);

      await expect(svc.likePost("post-1", "user-2")).rejects.toThrow("Post already liked");
      expect(likeRepo.createLikeByUser).not.toHaveBeenCalled();
      expect(postRepo.incrementLikes).not.toHaveBeenCalled();
    });
  });

  describe("unlikePost", () => {
    it("should remove a like, decrement the atomic counter and propagate the fresh total", async () => {
      const post = makePost();
      const like = makeLike();
      (postRepo.findById as any).mockResolvedValue(post);
      (likeRepo.findLikeByPostAndUser as any).mockResolvedValue(like);
      (postRepo.getCounters as any).mockResolvedValue({ totalLikes: 2, totalComments: 2 });

      await svc.unlikePost("post-1", "user-2");

      expect(likeRepo.deleteLikeByPost).toHaveBeenCalledWith("post-1", "user-2");
      expect(likeRepo.deleteLikeByUser).toHaveBeenCalledWith("user-2", like.likedAt, "post-1");
      expect(postRepo.decrementLikes).toHaveBeenCalledWith("post-1");
      expect(postRepo.updateTotalLikesInAllViews).toHaveBeenCalledWith(post, 2);
    });

    it("should propagate the fresh total to the establishment view when the post has one", async () => {
      const post = makePost({ establishmentId: "est-1" });
      (postRepo.findById as any).mockResolvedValue(post);
      (likeRepo.findLikeByPostAndUser as any).mockResolvedValue(makeLike());
      (postRepo.getCounters as any).mockResolvedValue({ totalLikes: 0, totalComments: 0 });

      await svc.unlikePost("post-1", "user-2");

      expect(postRepo.updateTotalLikesInAllViews).toHaveBeenCalledWith(post, 0);
    });

    it("should throw when post not found", async () => {
      await expect(svc.unlikePost("x", "u")).rejects.toThrow("Post not found");
    });

    it("should throw when like does not exist", async () => {
      (postRepo.findById as any).mockResolvedValue(makePost());
      await expect(svc.unlikePost("post-1", "u")).rejects.toThrow("Like not found");
      expect(postRepo.decrementLikes).not.toHaveBeenCalled();
    });

    it("should throw 404 when deleteLikeByPost loses the race (IF EXISTS not applied)", async () => {
      // findLikeByPostAndUser ainda viu o like (corrida), mas o DELETE
      // condicional chega depois de outra requisição concorrente já ter
      // removido a linha — deleteLikeByPost devolve false.
      (postRepo.findById as any).mockResolvedValue(makePost());
      (likeRepo.findLikeByPostAndUser as any).mockResolvedValue(makeLike());
      (likeRepo.deleteLikeByPost as any).mockResolvedValue(false);

      await expect(svc.unlikePost("post-1", "user-2")).rejects.toThrow("Like not found");
      expect(likeRepo.deleteLikeByUser).not.toHaveBeenCalled();
      expect(postRepo.decrementLikes).not.toHaveBeenCalled();
    });
  });

  describe("findLikesByUser", () => {
    it("should delegate to repository with default limit and no cursor", async () => {
      const page = { likes: [makeLike()], nextCursor: null };
      (likeRepo.findLikesByUser as any).mockResolvedValue(page);

      expect(await svc.findLikesByUser("user-2")).toEqual(page);
      expect(likeRepo.findLikesByUser).toHaveBeenCalledWith("user-2", 50, undefined);
    });

    it("should decode the raw cursor before delegating to repository", async () => {
      const likedAt = new Date("2026-01-01");
      const rawCursor = encodeLikeCursor({ likedAt, postId: "post-1" });

      await svc.findLikesByUser("user-2", 10, rawCursor);

      expect(likeRepo.findLikesByUser).toHaveBeenCalledWith("user-2", 10, { likedAt, postId: "post-1" });
    });
  });

  describe("findLikesByPost", () => {
    it("should delegate to repository with default limit and no cursor", async () => {
      const page = { likes: [makeLike()], nextCursor: null };
      (likeRepo.findLikesByPost as any).mockResolvedValue(page);

      expect(await svc.findLikesByPost("post-1")).toEqual(page);
      expect(likeRepo.findLikesByPost).toHaveBeenCalledWith("post-1", 50, undefined);
    });

    it("should decode the raw cursor before delegating to repository", async () => {
      const rawCursor = encodeLikeByPostCursor({ userId: "user-9" });

      await svc.findLikesByPost("post-1", 10, rawCursor);

      expect(likeRepo.findLikesByPost).toHaveBeenCalledWith("post-1", 10, { userId: "user-9" });
    });
  });
});
