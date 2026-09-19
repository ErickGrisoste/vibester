import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock("../../config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { LikeRepository } from "../like.repository";
import { encodeLikeByPostCursor, encodeLikeCursor } from "../../utils/cursor";

describe("LikeRepository — escrita condicional (LWT)", () => {
  let repo: LikeRepository;

  beforeEach(() => {
    repo = new LikeRepository();
    mockExecute.mockReset();
  });

  describe("createLikeByPost", () => {
    it("usa IF NOT EXISTS e retorna true quando aplicado", async () => {
      mockExecute.mockResolvedValue({ rows: [{ "[applied]": true }] });

      const applied = await repo.createLikeByPost({ postId: "post-1", userId: "user-1", likedAt: new Date() });

      const [query] = mockExecute.mock.calls[0];
      expect(query).toContain("IF NOT EXISTS");
      expect(applied).toBe(true);
    });

    it("retorna false quando a linha já existia (like duplicado/corrida)", async () => {
      mockExecute.mockResolvedValue({ rows: [{ "[applied]": false }] });

      const applied = await repo.createLikeByPost({ postId: "post-1", userId: "user-1", likedAt: new Date() });

      expect(applied).toBe(false);
    });
  });

  describe("deleteLikeByPost", () => {
    it("usa IF EXISTS e retorna true quando aplicado", async () => {
      mockExecute.mockResolvedValue({ rows: [{ "[applied]": true }] });

      const applied = await repo.deleteLikeByPost("post-1", "user-1");

      const [query] = mockExecute.mock.calls[0];
      expect(query).toContain("IF EXISTS");
      expect(applied).toBe(true);
    });

    it("retorna false quando a linha já não existia (unlike duplicado/corrida)", async () => {
      mockExecute.mockResolvedValue({ rows: [{ "[applied]": false }] });

      const applied = await repo.deleteLikeByPost("post-1", "user-1");

      expect(applied).toBe(false);
    });
  });
});

describe("LikeRepository — paginação", () => {
  let repo: LikeRepository;

  beforeEach(() => {
    repo = new LikeRepository();
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ rows: [] });
  });

  describe("findLikesByPost", () => {
    it("consulta sem cláusula de cursor na primeira página", async () => {
      await repo.findLikesByPost("post-1", 50);

      const [query, params] = mockExecute.mock.calls[0];
      expect(query).not.toContain("user_id >");
      expect(params).toEqual(["post-1", 50]);
    });

    it("aplica a cláusula user_id > ? quando há cursor", async () => {
      await repo.findLikesByPost("post-1", 50, { userId: "user-5" });

      const [query, params] = mockExecute.mock.calls[0];
      expect(query).toContain("user_id > ?");
      expect(params).toEqual(["post-1", "user-5", 50]);
    });

    it("retorna nextCursor (baseado em user_id) quando a página está cheia", async () => {
      const rows = [
        { post_id: "post-1", user_id: "user-0", liked_at: new Date("2026-01-01") },
        { post_id: "post-1", user_id: "user-1", liked_at: new Date("2026-01-02") },
      ];
      mockExecute.mockResolvedValue({ rows });

      const result = await repo.findLikesByPost("post-1", 2);

      expect(result.likes).toHaveLength(2);
      expect(result.nextCursor).toBe(encodeLikeByPostCursor({ userId: "user-1" }));
    });

    it("retorna nextCursor nulo quando a página não está cheia", async () => {
      mockExecute.mockResolvedValue({
        rows: [{ post_id: "post-1", user_id: "user-0", liked_at: new Date() }],
      });

      const result = await repo.findLikesByPost("post-1", 50);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("findLikesByUser", () => {
    it("consulta sem cláusula de cursor na primeira página", async () => {
      await repo.findLikesByUser("user-1", 50);

      const [query, params] = mockExecute.mock.calls[0];
      expect(query).not.toContain("liked_at");
      expect(params).toEqual(["user-1", 50]);
    });

    it("aplica a cláusula (liked_at, post_id) < (?, ?) quando há cursor", async () => {
      const likedAt = new Date("2026-01-01");
      await repo.findLikesByUser("user-1", 50, { likedAt, postId: "post-9" });

      const [query, params] = mockExecute.mock.calls[0];
      expect(query).toContain("(liked_at, post_id) < (?, ?)");
      expect(params).toEqual(["user-1", likedAt, "post-9", 50]);
    });

    it("retorna nextCursor quando a página está cheia", async () => {
      const likedAt = new Date("2026-01-01");
      mockExecute.mockResolvedValue({
        rows: [{ post_id: "post-1", user_id: "user-1", liked_at: likedAt }],
      });

      const result = await repo.findLikesByUser("user-1", 1);
      expect(result.nextCursor).toBe(encodeLikeCursor({ likedAt, postId: "post-1" }));
    });
  });
});
