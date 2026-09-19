import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock("../../config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { PostRepository } from "../post.repository";

describe("PostRepository — post_counters (contador atômico)", () => {
  let repo: PostRepository;

  beforeEach(() => {
    repo = new PostRepository();
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ rows: [] });
  });

  it("incrementLikes faz UPDATE ... SET total_likes = total_likes + 1", async () => {
    await repo.incrementLikes("post-1");

    const [query, params] = mockExecute.mock.calls[0];
    expect(query).toContain("total_likes = total_likes + 1");
    expect(params).toEqual(["post-1"]);
  });

  it("decrementLikes faz UPDATE ... SET total_likes = total_likes - 1", async () => {
    await repo.decrementLikes("post-1");

    const [query, params] = mockExecute.mock.calls[0];
    expect(query).toContain("total_likes = total_likes - 1");
    expect(params).toEqual(["post-1"]);
  });

  it("incrementComments faz UPDATE ... SET total_comments = total_comments + 1", async () => {
    await repo.incrementComments("post-1");

    const [query, params] = mockExecute.mock.calls[0];
    expect(query).toContain("total_comments = total_comments + 1");
    expect(params).toEqual(["post-1"]);
  });

  it("decrementComments faz UPDATE ... SET total_comments = total_comments - 1", async () => {
    await repo.decrementComments("post-1");

    const [query, params] = mockExecute.mock.calls[0];
    expect(query).toContain("total_comments = total_comments - 1");
    expect(params).toEqual(["post-1"]);
  });

  describe("getCounters", () => {
    it("retorna zero quando não existe linha (partição nunca incrementada)", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await repo.getCounters("post-1");
      expect(result).toEqual({ totalLikes: 0, totalComments: 0 });
    });

    it("converte number nativo normalmente", async () => {
      mockExecute.mockResolvedValue({ rows: [{ total_likes: 5, total_comments: 2 }] });

      const result = await repo.getCounters("post-1");
      expect(result).toEqual({ totalLikes: 5, totalComments: 2 });
    });

    it("converte um valor tipo Long (cassandra-driver) via toNumber()", async () => {
      const fakeLong = (n: number) => ({ toNumber: () => n });
      mockExecute.mockResolvedValue({
        rows: [{ total_likes: fakeLong(7), total_comments: fakeLong(3) }],
      });

      const result = await repo.getCounters("post-1");
      expect(result).toEqual({ totalLikes: 7, totalComments: 3 });
    });
  });
});
