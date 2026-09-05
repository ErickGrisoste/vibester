import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: { del: vi.fn().mockResolvedValue(1), flushall: vi.fn() },
}));
vi.mock("../../config/redis", () => ({
  redis: mockRedis,
  cacheAside: async <T>(_key: string, _ttl: number, fetchFn: () => Promise<T>): Promise<T> => fetchFn(),
}));
vi.mock("../../kafka/producer", () => ({
  producer: { send: vi.fn().mockResolvedValue(undefined) },
}));

import { PostService } from "../post.service";
import { PostRepository } from "../../repository/post.repository";
import { LikeRepository } from "../../repository/like.repository";
import { Post, CreatePostInput, UpdatePostInput, MediaType } from "../../types/post.types";

function createMockPostRepository() {
  return {
    createPostById: vi.fn().mockResolvedValue(undefined),
    createPostByUser: vi.fn().mockResolvedValue(undefined),
    createPostByEstablishment: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByUser: vi.fn().mockResolvedValue({ posts: [], nextCursor: null }),
    findByEstablishment: vi.fn().mockResolvedValue({ posts: [], nextCursor: null }),
    updateCaptionById: vi.fn().mockResolvedValue(undefined),
    updateCaptionByUser: vi.fn().mockResolvedValue(undefined),
    updateCaptionByEstablishment: vi.fn().mockResolvedValue(undefined),
    softDeleteById: vi.fn().mockResolvedValue(undefined),
    softDeleteByUser: vi.fn().mockResolvedValue(undefined),
    softDeleteByEstablishment: vi.fn().mockResolvedValue(undefined),
    updateTotalLikesById: vi.fn().mockResolvedValue(undefined),
    updateTotalLikesByUser: vi.fn().mockResolvedValue(undefined),
    updateTotalLikesByEstablishment: vi.fn().mockResolvedValue(undefined),
    updateTotalCommentsById: vi.fn().mockResolvedValue(undefined),
    updateTotalCommentsByUser: vi.fn().mockResolvedValue(undefined),
    updateTotalCommentsByEstablishment: vi.fn().mockResolvedValue(undefined),
  } as unknown as PostRepository;
}

function createMockLikeRepository() {
  return {
    findLikedPostIds: vi.fn().mockResolvedValue(new Set()),
  } as unknown as LikeRepository;
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    postId: "post-1",
    userId: "user-1",
    media: [{ url: "https://img.example.com/1.jpg", type: MediaType.IMAGE }],
    imageUrls: ["https://img.example.com/1.jpg"],
    caption: "Hello world",
    totalLikes: 0,
    totalComments: 0,
    isDeleted: false,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("PostService", () => {
  let service: PostService;
  let repo: ReturnType<typeof createMockPostRepository>;
  let likeRepo: ReturnType<typeof createMockLikeRepository>;

  beforeEach(() => {
    repo = createMockPostRepository();
    likeRepo = createMockLikeRepository();
    mockRedis.del.mockResolvedValue(1);
    service = new PostService(repo, likeRepo);
  });


  describe("create", () => {
    it("should create a post without establishmentId", async () => {
      const input: CreatePostInput = {
        userId: "user-1",
        media: [{ url: "https://img.example.com/1.jpg", type: MediaType.IMAGE }],
        caption: "Test caption",
      };

      const result = await service.create(input);

      expect(result.postId).toBeDefined();
      expect(result.userId).toBe(input.userId);
      expect(result.caption).toBe(input.caption);
      expect(result.media).toEqual(input.media);
      expect(result.imageUrls).toEqual(["https://img.example.com/1.jpg"]);
      expect(result.totalLikes).toBe(0);
      expect(result.totalComments).toBe(0);
      expect(result.isDeleted).toBe(false);
      expect(result.createdAt).toBeInstanceOf(Date);

      expect(repo.createPostById).toHaveBeenCalledOnce();
      expect(repo.createPostByUser).toHaveBeenCalledOnce();
      expect(repo.createPostByEstablishment).not.toHaveBeenCalled();
    });

    it("should create a post with establishmentId", async () => {
      const input: CreatePostInput = {
        userId: "user-1",
        establishmentId: "est-1",
        media: [{ url: "https://img.example.com/1.jpg", type: MediaType.IMAGE }],
        caption: "At the bar",
      };

      const result = await service.create(input);

      expect(result.establishmentId).toBe("est-1");
      expect(repo.createPostByEstablishment).toHaveBeenCalledOnce();
    });
  });


  describe("findById", () => {
    it("should return the post when found", async () => {
      const post = makePost();
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(post);

      const result = await service.findById("post-1");
      expect(result).toEqual(post);
      expect(repo.findById).toHaveBeenCalledWith("post-1");
    });

    it("should return null when post is not found", async () => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findById("nonexistent");
      expect(result).toBeNull();
    });
  });


  describe("findByUser", () => {
    it("should delegate to repository with default limit", async () => {
      const posts = [makePost()];
      (repo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue({ posts, nextCursor: null });

      const result = await service.findByUser("user-1");
      expect(result.posts).toEqual([{ ...posts[0], isLiked: false }]);
      expect(repo.findByUser).toHaveBeenCalledWith("user-1", 50, undefined);
    });

    it("should delegate to repository with custom limit", async () => {
      const posts = [makePost()];
      (repo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue({ posts, nextCursor: null });

      const result = await service.findByUser("user-1", 20);
      expect(result.posts).toEqual([{ ...posts[0], isLiked: false }]);
      expect(repo.findByUser).toHaveBeenCalledWith("user-1", 20, undefined);
    });

    it("should mark posts liked by the viewer as isLiked", async () => {
      const posts = [makePost({ postId: "post-1" }), makePost({ postId: "post-2" })];
      (repo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue({ posts, nextCursor: null });
      (likeRepo.findLikedPostIds as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["post-2"]));

      const result = await service.findByUser("user-1", 50, undefined, "viewer-1");

      expect(likeRepo.findLikedPostIds).toHaveBeenCalledWith(["post-1", "post-2"], "viewer-1");
      expect(result.posts.find((p) => p.postId === "post-1")?.isLiked).toBe(false);
      expect(result.posts.find((p) => p.postId === "post-2")?.isLiked).toBe(true);
    });

    it("should not query likes when no viewerId is given", async () => {
      const posts = [makePost()];
      (repo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue({ posts, nextCursor: null });

      await service.findByUser("user-1");

      expect(likeRepo.findLikedPostIds).not.toHaveBeenCalled();
    });
  });


  describe("findByEstablishment", () => {
    it("should delegate to repository with default limit", async () => {
      const posts = [makePost({ establishmentId: "est-1" })];
      (repo.findByEstablishment as ReturnType<typeof vi.fn>).mockResolvedValue({ posts, nextCursor: null });

      const result = await service.findByEstablishment("est-1");
      expect(result.posts).toEqual([{ ...posts[0], isLiked: false }]);
      expect(repo.findByEstablishment).toHaveBeenCalledWith("est-1", 50, undefined);
    });
  });


  describe("updateCaption", () => {
    it("should update caption when post exists and is not deleted", async () => {
      const post = makePost();
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(post);

      const input: UpdatePostInput = { postId: "post-1", caption: "Updated caption" };
      const result = await service.updateCaption(input);

      expect(result.caption).toBe("Updated caption");
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(repo.updateCaptionById).toHaveBeenCalledOnce();
      expect(repo.updateCaptionByUser).toHaveBeenCalledOnce();
      expect(repo.updateCaptionByEstablishment).not.toHaveBeenCalled();
    });

    it("should also update establishment table when post has establishmentId", async () => {
      const post = makePost({ establishmentId: "est-1" });
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(post);

      const input: UpdatePostInput = { postId: "post-1", caption: "Updated" };
      await service.updateCaption(input);

      expect(repo.updateCaptionByEstablishment).toHaveBeenCalledOnce();
    });

    it("should throw when post is not found", async () => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const input: UpdatePostInput = { postId: "nonexistent", caption: "x" };
      await expect(service.updateCaption(input)).rejects.toThrow("Post not found");
    });

    it("should throw when post is deleted", async () => {
      const post = makePost({ isDeleted: true });
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(post);

      const input: UpdatePostInput = { postId: "post-1", caption: "x" };
      await expect(service.updateCaption(input)).rejects.toThrow("Post is deleted");
    });
  });


  describe("softDelete", () => {
    it("should soft-delete a post without establishmentId", async () => {
      const post = makePost();
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(post);

      await service.softDelete("post-1");

      expect(repo.softDeleteById).toHaveBeenCalledWith("post-1");
      expect(repo.softDeleteByUser).toHaveBeenCalledWith(post.userId, post.createdAt, "post-1");
      expect(repo.softDeleteByEstablishment).not.toHaveBeenCalled();
    });

    it("should also soft-delete from establishment table when post has establishmentId", async () => {
      const post = makePost({ establishmentId: "est-1" });
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(post);

      await service.softDelete("post-1");

      expect(repo.softDeleteByEstablishment).toHaveBeenCalledWith("est-1", post.createdAt, post.postId);
    });

    it("should throw when post is not found", async () => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.softDelete("nonexistent")).rejects.toThrow("Post not found");
    });
  });
});
