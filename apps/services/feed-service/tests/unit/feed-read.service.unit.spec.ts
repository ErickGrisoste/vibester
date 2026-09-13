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

    // Mesmo cenário de empate de created_at na fronteira da página coberto em
    // tests/unit/feed.repository.unit.spec.ts (bug corrigido na Fase 3), mas
    // exercitado aqui a partir do service (getFeedByUser só mocka
    // getCassandraClient.execute, não FeedRepository, então o comportamento real
    // de findByUser/extendPageAcrossTiedTimestamps roda de ponta a ponta e
    // confirma que o service não perde itens do grupo empatado).
    it("não perde itens quando há empate de created_at na fronteira da página (mesmo cenário do repository, agora a partir do service)", async () => {
      const t1 = new Date("2024-01-15T12:00:00.000Z");
      const tTied = new Date("2024-01-15T11:00:00.000Z");

      // "espiada" (limit + 1 = 3): post-2 e post-3 empatados na fronteira do corte.
      mockExecute.mockResolvedValueOnce({
        rows: [
          { item_id: "post-1", created_at: t1, user_id: "user-123" },
          { item_id: "post-2", created_at: tTied, user_id: "user-123" },
          { item_id: "post-3", created_at: tTied, user_id: "user-123" },
        ],
      });

      // extensão do grupo empatado: revela post-4, que não tinha aparecido na espiada.
      mockExecute.mockResolvedValueOnce({
        rows: [
          { item_id: "post-2", created_at: tTied, user_id: "user-123" },
          { item_id: "post-3", created_at: tTied, user_id: "user-123" },
          { item_id: "post-4", created_at: tTied, user_id: "user-123" },
        ],
      });

      const result = await feedReadService.getFeedByUser("user-123", 2);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      const itemIds = result.items.map((item: any) => item.item_id);
      expect(itemIds).toEqual(expect.arrayContaining(["post-1", "post-2", "post-3", "post-4"]));
      expect(itemIds).toHaveLength(4);
    });
  });
});
