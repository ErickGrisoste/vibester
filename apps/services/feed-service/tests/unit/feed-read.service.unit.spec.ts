import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn().mockResolvedValue({ rows: [] }),
}));
vi.mock("../../src/config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { FeedReadService } from "../../src/services/feed-read.service";

describe("FeedReadService — Unitários", () => {
  let feedReadService: FeedReadService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
    feedReadService = new FeedReadService();
  });

  describe("getFeedByUser", () => {
    it("retorna items e nextCursor quando há conteúdo", async () => {
      const createdAt = new Date("2024-01-15T10:00:00Z");
      mockExecute.mockResolvedValueOnce({ rows: [{ created_at: createdAt }] });

      const result = await feedReadService.getFeedByUser("user-123", 20);

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toEqual(createdAt);
    });

    it("retorna nextCursor nulo quando feed está vazio", async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await feedReadService.getFeedByUser("user-123", 20);

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it("passa cursor ao repositório quando fornecido", async () => {
      const cursor = new Date("2024-01-10T00:00:00Z");
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await feedReadService.getFeedByUser("user-123", 10, cursor);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("created_at < ?"),
        expect.arrayContaining([cursor]),
        expect.anything()
      );
    });
  });
});
