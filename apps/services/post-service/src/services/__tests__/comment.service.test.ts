import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommentService } from "../comment.service";
import { CommentRepository } from "../../repository/comment.repository";
import { PostRepository } from "../../repository/post.repository";
import { Post, MediaType } from "../../types/post.types";
import { Comment, CreateCommentInput, UpdateCommentInput } from "../../types/comment.type";
import { encodeCommentCursor } from "../../utils/cursor";

vi.mock("../../kafka/producer", () => ({
  producer: { send: vi.fn().mockResolvedValue(undefined) },
}));

function createMockCommentRepo() {
  return {
    createCommentById: vi.fn().mockResolvedValue(undefined),
    createCommentByPost: vi.fn().mockResolvedValue(undefined),
    createCommentByUser: vi.fn().mockResolvedValue(undefined),
    findByPost: vi.fn().mockResolvedValue({ comments: [], nextCursor: null }),
    findByUser: vi.fn().mockResolvedValue({ comments: [], nextCursor: null }),
    findById: vi.fn().mockResolvedValue(null),
    updateCommentById: vi.fn().mockResolvedValue(undefined),
    updateCommentByPost: vi.fn().mockResolvedValue(undefined),
    updateCommentByUser: vi.fn().mockResolvedValue(undefined),
    softDeleteCommentById: vi.fn().mockResolvedValue(true),
    softDeleteCommentByPost: vi.fn().mockResolvedValue(undefined),
    softDeleteCommentByUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as CommentRepository;
}

function createMockPostRepo() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    incrementComments: vi.fn().mockResolvedValue(undefined),
    decrementComments: vi.fn().mockResolvedValue(undefined),
    getCounters: vi.fn().mockResolvedValue({ totalLikes: 0, totalComments: 0 }),
    updateTotalCommentsInAllViews: vi.fn().mockResolvedValue(undefined),
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
    it("should create a comment, increment the atomic counter and propagate the fresh total", async () => {
      const post = makePost();
      (postRepo.findById as any).mockResolvedValue(post);
      (postRepo.getCounters as any).mockResolvedValue({ totalLikes: 0, totalComments: 3 });

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
      expect(postRepo.incrementComments).toHaveBeenCalledWith("post-1");
      expect(postRepo.getCounters).toHaveBeenCalledWith("post-1");
      expect(postRepo.updateTotalCommentsInAllViews).toHaveBeenCalledWith(post, 3);
    });

    it("should propagate the fresh total to the establishment view when the post has one", async () => {
      const post = makePost({ establishmentId: "est-1" });
      (postRepo.findById as any).mockResolvedValue(post);
      (postRepo.getCounters as any).mockResolvedValue({ totalLikes: 0, totalComments: 1 });

      await svc.create({ postId: "post-1", userId: "user-2", content: "Hey" });

      expect(postRepo.updateTotalCommentsInAllViews).toHaveBeenCalledWith(post, 1);
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
    it("should delegate to repository with default limit and no cursor", async () => {
      const page = { comments: [makeComment()], nextCursor: null };
      (commentRepo.findByPost as any).mockResolvedValue(page);

      expect(await svc.findByPost("post-1")).toEqual(page);
      expect(commentRepo.findByPost).toHaveBeenCalledWith("post-1", 50, undefined);
    });

    it("should decode the raw cursor before delegating to repository", async () => {
      const createdAt = new Date("2026-01-01");
      const rawCursor = encodeCommentCursor({ createdAt, commentId: "cmt-1" });

      await svc.findByPost("post-1", 10, rawCursor);

      expect(commentRepo.findByPost).toHaveBeenCalledWith("post-1", 10, { createdAt, commentId: "cmt-1" });
    });
  });

  describe("findByUser", () => {
    it("should delegate to repository with default limit and no cursor", async () => {
      const page = { comments: [makeComment()], nextCursor: null };
      (commentRepo.findByUser as any).mockResolvedValue(page);

      expect(await svc.findByUser("user-2")).toEqual(page);
      expect(commentRepo.findByUser).toHaveBeenCalledWith("user-2", 50, undefined);
    });

    it("should decode the raw cursor before delegating to repository", async () => {
      const createdAt = new Date("2026-01-01");
      const rawCursor = encodeCommentCursor({ createdAt, commentId: "cmt-1" });

      await svc.findByUser("user-2", 10, rawCursor);

      expect(commentRepo.findByUser).toHaveBeenCalledWith("user-2", 10, { createdAt, commentId: "cmt-1" });
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
    it("should soft-delete a comment, decrement the atomic counter and propagate the fresh total", async () => {
      const comment = makeComment();
      const post = makePost();
      (commentRepo.findById as any).mockResolvedValue(comment);
      (postRepo.findById as any).mockResolvedValue(post);
      (postRepo.getCounters as any).mockResolvedValue({ totalLikes: 0, totalComments: 2 });

      await svc.softDelete("cmt-1", "user-2");

      expect(commentRepo.softDeleteCommentById).toHaveBeenCalledWith("cmt-1");
      expect(commentRepo.softDeleteCommentByPost).toHaveBeenCalledOnce();
      expect(commentRepo.softDeleteCommentByUser).toHaveBeenCalledOnce();
      expect(postRepo.decrementComments).toHaveBeenCalledWith(comment.postId);
      expect(postRepo.updateTotalCommentsInAllViews).toHaveBeenCalledWith(post, 2);
    });

    it("should propagate the fresh total to the establishment view when the post has one", async () => {
      const comment = makeComment();
      const post = makePost({ establishmentId: "est-1" });
      (commentRepo.findById as any).mockResolvedValue(comment);
      (postRepo.findById as any).mockResolvedValue(post);
      (postRepo.getCounters as any).mockResolvedValue({ totalLikes: 0, totalComments: 0 });

      await svc.softDelete("cmt-1", "user-2");

      expect(postRepo.updateTotalCommentsInAllViews).toHaveBeenCalledWith(post, 0);
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
      expect(postRepo.decrementComments).not.toHaveBeenCalled();
    });

    it("should still decrement the atomic counter even if the post row is missing", async () => {
      // post_counters é independente de posts_by_id existir — o counter não
      // deve ficar "preso" caso a linha denormalizada do post já não exista.
      (commentRepo.findById as any).mockResolvedValue(makeComment());
      (postRepo.findById as any).mockResolvedValue(null);

      await svc.softDelete("cmt-1", "user-2");

      expect(postRepo.decrementComments).toHaveBeenCalledWith("post-1");
      expect(postRepo.updateTotalCommentsInAllViews).not.toHaveBeenCalled();
    });

    it("should throw 409 when softDeleteCommentById loses the race (IF is_deleted = false not applied)", async () => {
      // findById ainda viu o comentário como não deletado (corrida), mas o
      // UPDATE condicional chega depois de outra requisição concorrente já
      // ter marcado is_deleted — softDeleteCommentById devolve false.
      (commentRepo.findById as any).mockResolvedValue(makeComment());
      (postRepo.findById as any).mockResolvedValue(makePost());
      (commentRepo.softDeleteCommentById as any).mockResolvedValue(false);

      await expect(svc.softDelete("cmt-1", "user-2")).rejects.toThrow("Comment already deleted");
      expect(commentRepo.softDeleteCommentByPost).not.toHaveBeenCalled();
      expect(postRepo.decrementComments).not.toHaveBeenCalled();
    });
  });
});
