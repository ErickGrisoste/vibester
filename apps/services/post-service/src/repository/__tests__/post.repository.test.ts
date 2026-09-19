import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostRepository } from "../post.repository";
import { Post, MediaType } from "../../types/post.types";

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

describe("PostRepository — coordenação de fan-out entre views denormalizadas", () => {
  let repo: PostRepository;

  beforeEach(() => {
    repo = new PostRepository();
    vi.spyOn(repo, "createPostById").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "createPostByUser").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "createPostByEstablishment").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateCaptionById").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateCaptionByUser").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateCaptionByEstablishment").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "softDeleteById").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "softDeleteByUser").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "softDeleteByEstablishment").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateTotalLikesById").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateTotalLikesByUser").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateTotalLikesByEstablishment").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateTotalCommentsById").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateTotalCommentsByUser").mockResolvedValue(undefined as never);
    vi.spyOn(repo, "updateTotalCommentsByEstablishment").mockResolvedValue(undefined as never);
  });

  describe("createInAllViews", () => {
    it("grava em _by_id e _by_user quando o post não tem estabelecimento", async () => {
      const post = makePost();
      await repo.createInAllViews(post);

      expect(repo.createPostById).toHaveBeenCalledWith(post);
      expect(repo.createPostByUser).toHaveBeenCalledWith(post);
      expect(repo.createPostByEstablishment).not.toHaveBeenCalled();
    });

    it("também grava em _by_establishment quando o post tem um", async () => {
      const post = makePost({ establishmentId: "est-1" });
      await repo.createInAllViews(post);

      expect(repo.createPostByEstablishment).toHaveBeenCalledWith(post);
    });
  });

  describe("updateCaptionInAllViews", () => {
    it("atualiza _by_id e _by_user quando o post não tem estabelecimento", async () => {
      const post = makePost();
      const updatedAt = new Date("2026-02-01");

      await repo.updateCaptionInAllViews(post, "nova legenda", updatedAt);

      expect(repo.updateCaptionById).toHaveBeenCalledWith(post.postId, "nova legenda", updatedAt);
      expect(repo.updateCaptionByUser).toHaveBeenCalledWith(
        post.userId, post.createdAt, post.postId, "nova legenda", updatedAt
      );
      expect(repo.updateCaptionByEstablishment).not.toHaveBeenCalled();
    });

    it("também atualiza _by_establishment quando o post tem um", async () => {
      const post = makePost({ establishmentId: "est-1" });
      const updatedAt = new Date("2026-02-01");

      await repo.updateCaptionInAllViews(post, "nova legenda", updatedAt);

      expect(repo.updateCaptionByEstablishment).toHaveBeenCalledWith(
        "est-1", post.createdAt, post.postId, "nova legenda", updatedAt
      );
    });
  });

  describe("softDeleteInAllViews", () => {
    it("remove de _by_id e _by_user quando o post não tem estabelecimento", async () => {
      const post = makePost();
      await repo.softDeleteInAllViews(post);

      expect(repo.softDeleteById).toHaveBeenCalledWith(post.postId);
      expect(repo.softDeleteByUser).toHaveBeenCalledWith(post.userId, post.createdAt, post.postId);
      expect(repo.softDeleteByEstablishment).not.toHaveBeenCalled();
    });

    it("também remove de _by_establishment quando o post tem um", async () => {
      const post = makePost({ establishmentId: "est-1" });
      await repo.softDeleteInAllViews(post);

      expect(repo.softDeleteByEstablishment).toHaveBeenCalledWith("est-1", post.createdAt, post.postId);
    });
  });

  describe("updateTotalLikesInAllViews", () => {
    it("atualiza _by_id e _by_user quando o post não tem estabelecimento", async () => {
      const post = makePost();
      await repo.updateTotalLikesInAllViews(post, 5);

      expect(repo.updateTotalLikesById).toHaveBeenCalledWith(5, post.postId);
      expect(repo.updateTotalLikesByUser).toHaveBeenCalledWith(post.userId, post.createdAt, 5, post.postId);
      expect(repo.updateTotalLikesByEstablishment).not.toHaveBeenCalled();
    });

    it("também atualiza _by_establishment quando o post tem um", async () => {
      const post = makePost({ establishmentId: "est-1" });
      await repo.updateTotalLikesInAllViews(post, 5);

      expect(repo.updateTotalLikesByEstablishment).toHaveBeenCalledWith("est-1", post.createdAt, 5, post.postId);
    });
  });

  describe("updateTotalCommentsInAllViews", () => {
    it("atualiza _by_id e _by_user quando o post não tem estabelecimento", async () => {
      const post = makePost();
      await repo.updateTotalCommentsInAllViews(post, 3);

      expect(repo.updateTotalCommentsById).toHaveBeenCalledWith(3, post.postId);
      expect(repo.updateTotalCommentsByUser).toHaveBeenCalledWith(post.userId, post.createdAt, 3, post.postId);
      expect(repo.updateTotalCommentsByEstablishment).not.toHaveBeenCalled();
    });

    it("também atualiza _by_establishment quando o post tem um", async () => {
      const post = makePost({ establishmentId: "est-1" });
      await repo.updateTotalCommentsInAllViews(post, 3);

      expect(repo.updateTotalCommentsByEstablishment).toHaveBeenCalledWith("est-1", post.createdAt, 3, post.postId);
    });
  });
});
