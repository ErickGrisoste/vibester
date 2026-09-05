import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommentService } from "../comment.service";
import { CommentRepository } from "../../repository/comment.repository";
import { PostRepository } from "../../repository/post.repository";
import { Post, MediaType } from "../../types/post.types";
import { Comment, CreateCommentInput, UpdateCommentInput } from "../../types/comment.type";

vi.mock("../../kafka/producer", () => ({
  producer: { send: vi.fn().mockResolvedValue(undefined) },
}));

function createMockCommentRepo() {
  return {
    createCommentById: vi.fn().mockResolvedValue(undefined),
    createCommentByPost: vi.fn().mockResolvedValue(undefined),
    createCommentByUser: vi.fn().mockResolvedValue(undefined),
    findByPost: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    updateCommentById: vi.fn().mockResolvedValue(undefined),
    updateCommentByPost: vi.fn().mockResolvedValue(undefined),
    updateCommentByUser: vi.fn().mockResolvedValue(undefined),
    softDeleteCommentById: vi.fn().mockResolvedValue(undefined),
    softDeleteCommentByPost: vi.fn().mockResolvedValue(undefined),
    softDeleteCommentByUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as CommentRepository;
}

function createMockPostRepo() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    updateTotalCommentsById: vi.fn().mockResolvedValue(undefined),
    updateTotalCommentsByUser: vi.fn().mockResolvedValue(undefined),
    updateTotalCommentsByEstablishment: vi.fn().mockResolvedValue(undefined),
  } as unknown as PostRepository;
}

function makePost(o: Partial<Post> = {}): Post {
  return {
    postId: "post-1", userId: "user-1", media: [{ url: "img.jpg", type: MediaType.IMAGE }], imageUrls: ["img.jpg"],
    caption: "Hi", totalLikes: 0, totalComments: 5,
    isDeleted: false, createdAt: new Date("2026-01-01"), ...o,
  };
}

function makeComment(o: Partial<Comment> = {}): Comment {
  return {
    commentId: "cmt-1", postId: "post-1", userId: "user-2",
    content: "Nice!", isDeleted: false,
    createdAt: new Date("2026-01-02"), updatedAt: null, ...o,
  };
}

describe("CommentService", () => {
  let svc: CommentService;
  let commentRepo: ReturnType<typeof createMockCommentRepo>;
  let postRepo: ReturnType<typeof createMockPostRepo>;

  beforeEach(() => {
    commentRepo = createMockCommentRepo();
    postRepo = createMockPostRepo();
    svc = new CommentService(commentRepo, postRepo);
  });

  // ======= create =======

  describe("create", () => {
    it("should create a comment and increment totalComments", async () => {
      const post = makePost({ totalComments: 2 });
      (postRepo.findById as any).mockResolvedValue(post);

      const input: CreateCommentInput = { postId: "post-1", userId: "user-2", content: "Cool!" };
      const result = await svc.create(input);

      expect(result.commentId).toBeDefined();
      expect(result.postId).toBe("post-1");
      expect(result.userId).toBe("user-2");
      expect(result.content).toBe("Cool!");
      expect(result.isDeleted).toBe(false);

      expect(commentRepo.createCommentById).toHaveBeenCalledOnce();
      expect(commentRepo.createCommentByPost).toHaveBeenCalledOnce();
      expect(commentRepo.createCommentByUser).toHaveBeenCalledOnce();
      expect(postRepo.updateTotalCommentsById).toHaveBeenCalledWith(3, "post-1");
      expect(postRepo.updateTotalCommentsByEstablishment).not.toHaveBeenCalled();
    });

    it("should update establishment comments when post has establishmentId", async () => {
      const post = makePost({ totalComments: 0, establishmentId: "est-1" });
      (postRepo.findById as any).mockResolvedValue(post);

      await svc.create({ postId: "post-1", userId: "user-2", content: "Hey" });

      expect(postRepo.updateTotalCommentsByEstablishment).toHaveBeenCalledWith(
        "est-1", post.createdAt, 1, "post-1"
      );
    });

    it("should throw when post is not found", async () => {
      await expect(
        svc.create({ postId: "x", userId: "u", content: "c" })
      ).rejects.toThrow("Post not found");
    });

    it("should throw when post is deleted", async () => {
      (postRepo.findById as any).mockResolvedValue(makePost({ isDeleted: true }));
      await expect(
        svc.create({ postId: "post-1", userId: "u", content: "c" })
      ).rejects.toThrow("Post is deleted");
    });
  });

  // ======= find operations =======

  describe("findByPost", () => {
    it("should delegate to repository", async () => {
      const comments = [makeComment()];
      (commentRepo.findByPost as any).mockResolvedValue(comments);
      expect(await svc.findByPost("post-1")).toEqual(comments);
    });
  });

  describe("findByUser", () => {
    it("should delegate to repository", async () => {
      const comments = [makeComment()];
      (commentRepo.findByUser as any).mockResolvedValue(comments);
      expect(await svc.findByUser("user-2")).toEqual(comments);
    });
  });

  describe("findById", () => {
    it("should return comment when found", async () => {
      const comment = makeComment();
      (commentRepo.findById as any).mockResolvedValue(comment);
      expect(await svc.findById("cmt-1")).toEqual(comment);
    });

    it("should return null when not found", async () => {
      expect(await svc.findById("x")).toBeNull();
    });
  });

  // ======= update =======

  describe("update", () => {
    it("should update comment content successfully", async () => {
      const comment = makeComment();
      (commentRepo.findById as any).mockResolvedValue(comment);

      const input: UpdateCommentInput = { commentId: "cmt-1", content: "Edited!" };
      const result = await svc.update(input, "user-2");

      expect(result.content).toBe("Edited!");
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(commentRepo.updateCommentById).toHaveBeenCalledOnce();
      expect(commentRepo.updateCommentByPost).toHaveBeenCalledOnce();
      expect(commentRepo.updateCommentByUser).toHaveBeenCalledOnce();
    });

    it("should throw when comment not found", async () => {
      await expect(
        svc.update({ commentId: "x", content: "c" }, "u")
      ).rejects.toThrow("Comment not found");
    });

    it("should throw when user is not the comment author", async () => {
      (commentRepo.findById as any).mockResolvedValue(makeComment({ userId: "user-2" }));
      await expect(
        svc.update({ commentId: "cmt-1", content: "c" }, "other-user")
      ).rejects.toThrow("You cannot update this comment.");
    });

    it("should throw when comment is deleted", async () => {
      (commentRepo.findById as any).mockResolvedValue(
        makeComment({ userId: "user-2", isDeleted: true })
      );
      await expect(
        svc.update({ commentId: "cmt-1", content: "c" }, "user-2")
      ).rejects.toThrow("Comment is deleted");
    });
  });

  // ======= softDelete =======

  describe("softDelete", () => {
    it("should soft-delete a comment and decrement totalComments", async () => {
      const comment = makeComment();
      const post = makePost({ totalComments: 3 });
      (commentRepo.findById as any).mockResolvedValue(comment);
      (postRepo.findById as any).mockResolvedValue(post);

      await svc.softDelete("cmt-1", "user-2");

      expect(commentRepo.softDeleteCommentById).toHaveBeenCalledWith("cmt-1");
      expect(commentRepo.softDeleteCommentByPost).toHaveBeenCalledOnce();
      expect(commentRepo.softDeleteCommentByUser).toHaveBeenCalledOnce();
      expect(postRepo.updateTotalCommentsById).toHaveBeenCalledWith(2, "post-1");
      expect(postRepo.updateTotalCommentsByEstablishment).not.toHaveBeenCalled();
    });

    it("should update establishment on delete when post has establishmentId", async () => {
      const comment = makeComment();
      const post = makePost({ totalComments: 1, establishmentId: "est-1" });
      (commentRepo.findById as any).mockResolvedValue(comment);
      (postRepo.findById as any).mockResolvedValue(post);

      await svc.softDelete("cmt-1", "user-2");

      expect(postRepo.updateTotalCommentsByEstablishment).toHaveBeenCalledWith(
        "est-1", post.createdAt, 0, post.postId
      );
    });

    it("should throw when comment not found", async () => {
      await expect(svc.softDelete("x", "u")).rejects.toThrow("Comment not found");
    });

    it("should throw when user is not the comment author", async () => {
      (commentRepo.findById as any).mockResolvedValue(makeComment({ userId: "user-2" }));
      await expect(svc.softDelete("cmt-1", "other-user")).rejects.toThrow(
        "You cannot delete this comment."
      );
    });

    it("should throw when comment is already deleted", async () => {
      (commentRepo.findById as any).mockResolvedValue(
        makeComment({ userId: "user-2", isDeleted: true })
      );
      await expect(svc.softDelete("cmt-1", "user-2")).rejects.toThrow("Comment already deleted");
    });

    it("should throw when post is deleted", async () => {
      (commentRepo.findById as any).mockResolvedValue(makeComment());
      (postRepo.findById as any).mockResolvedValue(makePost({ isDeleted: true }));
      await expect(svc.softDelete("cmt-1", "user-2")).rejects.toThrow("Post deleted");
    });

    it("should throw HttpError 400 when totalComments is zero (inconsistent state)", async () => {
      (commentRepo.findById as any).mockResolvedValue(makeComment());
      (postRepo.findById as any).mockResolvedValue(makePost({ totalComments: 0 }));

      await expect(svc.softDelete("cmt-1", "user-2")).rejects.toThrow("Inconsistent comment count");
    });
  });
});
