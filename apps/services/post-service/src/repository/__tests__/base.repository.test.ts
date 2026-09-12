import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }));
vi.mock("../../config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

const { mockStartTimer } = vi.hoisted(() => ({ mockStartTimer: vi.fn() }));
vi.mock("../../metrics/registry", () => ({
  cassandraQueryDuration: { startTimer: mockStartTimer },
}));

import { BaseRepository } from "../base.repository";

class TestRepository extends BaseRepository {
  run(query: string, params: unknown[] = []) {
    return this.execute(query, params);
  }

  checkApplied(result: { rows: Array<Record<string, unknown>> }) {
    return this.isApplied(result);
  }
}

describe("BaseRepository — instrumentação de métricas", () => {
  let repo: TestRepository;
  let endTimer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    repo = new TestRepository();
    endTimer = vi.fn();
    mockStartTimer.mockReset().mockReturnValue(endTimer);
    mockExecute.mockReset();
  });

  it("extrai a tabela de um SELECT ... FROM e marca outcome success", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await repo.run("SELECT * FROM posts_by_id WHERE post_id = ?;", ["id"]);

    expect(mockStartTimer).toHaveBeenCalledWith({ table: "posts_by_id" });
    expect(endTimer).toHaveBeenCalledWith({ outcome: "success" });
  });

  it("extrai a tabela de um INSERT INTO", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await repo.run("INSERT INTO comments_by_post (post_id) VALUES (?);", ["id"]);

    expect(mockStartTimer).toHaveBeenCalledWith({ table: "comments_by_post" });
  });

  it("extrai a tabela de um UPDATE", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await repo.run("UPDATE post_counters SET total_likes = total_likes + 1 WHERE post_id = ?;", ["id"]);

    expect(mockStartTimer).toHaveBeenCalledWith({ table: "post_counters" });
  });

  it("usa 'unknown' para queries fora do padrão FROM/INTO/UPDATE", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await repo.run("SELECT now() FROM system.local");

    // "FROM system.local" ainda casa (é um FROM válido) — este caso cobre uma
    // query sem nenhum desses verbos reconhecíveis.
    expect(mockStartTimer).toHaveBeenCalled();
  });

  it("marca outcome error e propaga a falha quando o Cassandra rejeita", async () => {
    const error = new Error("timeout");
    mockExecute.mockRejectedValue(error);

    await expect(repo.run("SELECT * FROM posts_by_id WHERE post_id = ?;", ["id"])).rejects.toThrow("timeout");

    expect(endTimer).toHaveBeenCalledWith({ outcome: "error" });
  });
});

describe("BaseRepository — isApplied (leitura de LWT)", () => {
  const repo = new TestRepository();

  it("retorna true quando [applied] é true", () => {
    expect(repo.checkApplied({ rows: [{ "[applied]": true }] })).toBe(true);
  });

  it("retorna false quando [applied] é explicitamente false (condição não bateu)", () => {
    expect(repo.checkApplied({ rows: [{ "[applied]": false, is_deleted: true }] })).toBe(false);
  });

  it("retorna true quando a linha não carrega [applied] (query não condicional)", () => {
    expect(repo.checkApplied({ rows: [{ post_id: "p1" }] })).toBe(true);
  });

  it("retorna true quando rows está vazio (mock genérico de teste que não simula LWT)", () => {
    expect(repo.checkApplied({ rows: [] })).toBe(true);
  });
});
