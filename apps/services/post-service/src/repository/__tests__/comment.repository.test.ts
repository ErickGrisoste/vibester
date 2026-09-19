import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock("../../config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { CommentRepository } from "../comment.repository";
import { encodeCommentCursor } from "../../utils/cursor";

describe("CommentRepository — escrita condicional (LWT)", () => {
  let repo: CommentRepository;

  beforeEach(() => {
    repo = new CommentRepository();
    mockExecute.mockReset();
  });

  describe("softDeleteCommentById", () => {
    it("usa IF is_deleted = false e retorna true quando aplicado", async () => {
      mockExecute.mockResolvedValue({ rows: [{ "[applied]": true }] });

      const applied = await repo.softDeleteCommentById("cmt-1");

      const [query] = mockExecute.mock.calls[0];
      expect(query).toContain("IF is_deleted = false");
      expect(applied).toBe(true);
    });

    it("retorna false quando o comentário já estava deletado (corrida)", async () => {
      mockExecute.mockResolvedValue({ rows: [{ "[applied]": false, is_deleted: true }] });

      const applied = await repo.softDeleteCommentById("cmt-1");

      expect(applied).toBe(false);
    });
  });
});

describe("CommentRepository — paginação", () => {
  let repo: CommentRepository;

  beforeEach(() => {
    repo = new CommentRepository();
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ rows: [] });
  });

  describe("findByPost", () => {
    it("consulta sem cláusula de cursor na primeira página", async () => {
      await repo.findByPost("post-1", 50);

      const [query, params] = mockExecute.mock.calls[0];
      expect(query).not.toContain("created_at");
      expect(params).toEqual(["post-1", 50]);
    });

    it("aplica a cláusula (created_at, comment_id) < (?, ?) quando há cursor", async () => {
      const createdAt = new Date("2026-01-01");
      await repo.findByPost("post-1", 50, { createdAt, commentId: "cmt-9" });

      const [query, params] = mockExecute.mock.calls[0];
      expect(query).toContain("(created_at, comment_id) < (?, ?)");
      expect(params).toEqual(["post-1", createdAt, "cmt-9", 50]);
    });

    it("retorna nextCursor quando a página está cheia", async () => {
      const createdAt = new Date("2026-01-01");
      mockExecute.mockResolvedValue({
        rows: [{ comment_id: "cmt-1", post_id: "post-1", user_id: "user-1", content: "oi", is_deleted: false, created_at: createdAt, updated_at: null }],
      });

      const result = await repo.findByPost("post-1", 1);
      expect(result.nextCursor).toBe(encodeCommentCursor({ createdAt, commentId: "cmt-1" }));
    });

    it("retorna nextCursor nulo quando a página não está cheia", async () => {
      mockExecute.mockResolvedValue({
        rows: [{ comment_id: "cmt-1", post_id: "post-1", user_id: "user-1", content: "oi", is_deleted: false, created_at: new Date(), updated_at: null }],
      });

      const result = await repo.findByPost("post-1", 50);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("findByUser", () => {
    it("aplica a cláusula (created_at, comment_id) < (?, ?) quando há cursor", async () => {
      const createdAt = new Date("2026-01-01");
      await repo.findByUser("user-1", 50, { createdAt, commentId: "cmt-9" });

      const [query, params] = mockExecute.mock.calls[0];
      expect(query).toContain("(created_at, comment_id) < (?, ?)");
      expect(params).toEqual(["user-1", createdAt, "cmt-9", 50]);
    });
  });
});
