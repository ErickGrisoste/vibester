import { describe, it, expect, vi, beforeEach } from "vitest";
import { LikeService } from "../like.service";
import { LikeRepository } from "../../repository/like.repository";
import { PostRepository } from "../../repository/post.repository";
import { Post, MediaType } from "../../types/post.types";
import { PostLike } from "../../types/like.types";

vi.mock("../../kafka/producer", () => ({
  producer: { send: vi.fn().mockResolvedValue(undefined) },
}));

function createMockLikeRepo() {
  return {
    createLikeByPost: vi.fn().mockResolvedValue(undefined),
    createLikeByUser: vi.fn().mockResolvedValue(undefined),
    findLikeByPostAndUser: vi.fn().mockResolvedValue(null),
    findLikesByPost: vi.fn().mockResolvedValue([]),
    findLikesByUser: vi.fn().mockResolvedValue([]),
    deleteLikeByPost: vi.fn().mockResolvedValue(undefined),
    deleteLikeByUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as LikeRepository;
}

function createMockPostRepo() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    updateTotalLikesById: vi.fn().mockResolvedValue(undefined),
    updateTotalLikesByUser: vi.fn().mockResolvedValue(undefined),
    updateTotalLikesByEstablishment: vi.fn().mockResolvedValue(undefined),
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
    it("should create a like successfully", async () => {
      const post = makePost({ totalLikes: 3 });
      (postRepo.findById as any).mockResolvedValue(post);

      const result = await svc.likePost("post-1", "user-2");

      expect(result.postId).toBe("post-1");
      expect(result.userId).toBe("user-2");
      expect(result.likedAt).toBeInstanceOf(Date);
      expect(likeRepo.createLikeByPost).toHaveBeenCalledOnce();
      expect(likeRepo.createLikeByUser).toHaveBeenCalledOnce();
      expect(postRepo.updateTotalLikesById).toHaveBeenCalledWith(4, "post-1");
      expect(postRepo.updateTotalLikesByEstablishment).not.toHaveBeenCalled();
    });

    it("should update establishment likes when post has establishmentId", async () => {
      const post = makePost({ totalLikes: 0, establishmentId: "est-1" });
      (postRepo.findById as any).mockResolvedValue(post);

      await svc.likePost("post-1", "user-2");

      expect(postRepo.updateTotalLikesByEstablishment).toHaveBeenCalledWith(
        "est-1", post.createdAt, 1, post.postId
      );
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
    });
  });

  describe("unlikePost", () => {
    it("should remove a like successfully", async () => {
      const post = makePost({ totalLikes: 3 });
      const like = makeLike();
      (postRepo.findById as any).mockResolvedValue(post);
      (likeRepo.findLikeByPostAndUser as any).mockResolvedValue(like);

      await svc.unlikePost("post-1", "user-2");

      expect(likeRepo.deleteLikeByPost).toHaveBeenCalledWith("post-1", "user-2");
      expect(likeRepo.deleteLikeByUser).toHaveBeenCalledWith("user-2", like.likedAt, "post-1");
      expect(postRepo.updateTotalLikesById).toHaveBeenCalledWith(2, "post-1");
      expect(postRepo.updateTotalLikesByEstablishment).not.toHaveBeenCalled();
    });

    it("should update establishment on unlike when post has establishmentId", async () => {
      const post = makePost({ totalLikes: 1, establishmentId: "est-1" });
      (postRepo.findById as any).mockResolvedValue(post);
      (likeRepo.findLikeByPostAndUser as any).mockResolvedValue(makeLike());

      await svc.unlikePost("post-1", "user-2");

      expect(postRepo.updateTotalLikesByEstablishment).toHaveBeenCalledWith(
        "est-1", post.createdAt, 0, post.postId
      );
    });

    it("should throw when post not found", async () => {
      await expect(svc.unlikePost("x", "u")).rejects.toThrow("Post not found");
    });

    it("should throw when like does not exist", async () => {
      (postRepo.findById as any).mockResolvedValue(makePost());
      await expect(svc.unlikePost("post-1", "u")).rejects.toThrow("Like not found");
    });

    it("should throw HttpError 400 when totalLikes is zero (inconsistent state)", async () => {
      (postRepo.findById as any).mockResolvedValue(makePost({ totalLikes: 0 }));
      (likeRepo.findLikeByPostAndUser as any).mockResolvedValue(makeLike());
      await expect(svc.unlikePost("post-1", "user-2")).rejects.toThrow("Inconsistent like count");
    });
  });

  describe("findLikesByUser", () => {
    it("should delegate to repository", async () => {
      const likes = [makeLike()];
      (likeRepo.findLikesByUser as any).mockResolvedValue(likes);
      expect(await svc.findLikesByUser("user-2")).toEqual(likes);
    });
  });

  describe("findLikesByPost", () => {
    it("should delegate to repository", async () => {
      const likes = [makeLike()];
      (likeRepo.findLikesByPost as any).mockResolvedValue(likes);
      expect(await svc.findLikesByPost("post-1")).toEqual(likes);
    });
  });
});
