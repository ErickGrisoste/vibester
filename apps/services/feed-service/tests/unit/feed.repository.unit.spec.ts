import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));
vi.mock("../../src/config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { FeedRepository } from "../../src/repositories/feed.repository";

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

function row(itemId: string, createdAt: Date) {
  return { item_id: itemId, created_at: createdAt, user_id: USER_ID };
}

describe("FeedRepository.findByUser — paginação por cursor com created_at empatado", () => {
  let repository: FeedRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    repository = new FeedRepository();
  });

  it("sem empate na fronteira: uma única query, página cortada em `limit`", async () => {
    const t1 = new Date("2024-01-15T12:00:00.000Z");
    const t2 = new Date("2024-01-15T11:00:00.000Z");
    const t3 = new Date("2024-01-15T10:00:00.000Z");

    // fetchLimit = limit + 1 = 3; a "espiada" (3ª linha) tem created_at diferente
    // do último item da página (2ª linha) — sem empate, nenhuma query extra.
    mockExecute.mockResolvedValueOnce({
      rows: [row("post-1", t1), row("post-2", t2), row("post-3", t3)],
    });

    const result = await repository.findByUser(USER_ID, 2);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r: any) => r.item_id)).toEqual(["post-1", "post-2"]);
  });

  it("empate na fronteira: busca o grupo inteiro e não perde itens", async () => {
    const t1 = new Date("2024-01-15T12:00:00.000Z");
    const tTied = new Date("2024-01-15T11:00:00.000Z");

    // limit=2, fetchLimit=3: a página traz [post-1(t1), post-2(tTied), post-3(tTied)] —
    // a "espiada" (post-3) tem o MESMO created_at do último item que ficaria na página
    // (post-2), então há um grupo de created_at empatado sendo cortado ao meio.
    mockExecute.mockResolvedValueOnce({
      rows: [row("post-1", t1), row("post-2", tTied), row("post-3", tTied)],
    });

    // Query de extensão (WHERE created_at = tTied) revela que o grupo tem, na
    // verdade, 3 membros — post-4 nunca tinha aparecido nem na "espiada".
    mockExecute.mockResolvedValueOnce({
      rows: [row("post-2", tTied), row("post-3", tTied), row("post-4", tTied)],
    });

    const result = await repository.findByUser(USER_ID, 2);

    expect(mockExecute).toHaveBeenCalledTimes(2);
    // Sem a correção, a página teria só [post-1, post-2] e post-3/post-4
    // seriam perdidos para sempre (a próxima página usa created_at < tTied,
    // que exclui o grupo inteiro).
    const itemIds = result.rows.map((r: any) => r.item_id);
    expect(itemIds).toContain("post-1");
    expect(itemIds).toContain("post-2");
    expect(itemIds).toContain("post-3");
    expect(itemIds).toContain("post-4");
    expect(itemIds).toHaveLength(4);
  });

  it("empate na fronteira mas grupo já completo na página: não expande além do necessário", async () => {
    const t1 = new Date("2024-01-15T12:00:00.000Z");
    const tTied = new Date("2024-01-15T11:00:00.000Z");

    mockExecute.mockResolvedValueOnce({
      rows: [row("post-1", t1), row("post-2", tTied), row("post-3", tTied)],
    });

    // O grupo inteiro de tTied é só post-2 e post-3 — nada ficou de fora.
    mockExecute.mockResolvedValueOnce({
      rows: [row("post-2", tTied), row("post-3", tTied)],
    });

    const result = await repository.findByUser(USER_ID, 2);

    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(result.rows.map((r: any) => r.item_id)).toEqual(["post-1", "post-2", "post-3"]);
  });
});
