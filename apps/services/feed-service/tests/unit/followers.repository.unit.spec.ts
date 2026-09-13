import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));
vi.mock("../../src/config/cassandra", () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { UserFollowerRepository } from "../../src/repositories/followers_by_user.repository";
import { EstablishmentFollowersRepository } from "../../src/repositories/followers_by_establishment.repository";

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ESTAB_ID = "e1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

function row(followerId: string) {
  return { follower_id: followerId };
}

describe("UserFollowerRepository.findFollowersByUser — paginação por cursor", () => {
  let repository: UserFollowerRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    repository = new UserFollowerRepository();
  });

  it("sem cursor: consulta sem `follower_id > ?`, LIMIT igual ao tamanho pedido", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row("f1"), row("f2")] });

    const page = await repository.findFollowersByUser(USER_ID, 2);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.not.stringContaining("follower_id > ?"),
      [USER_ID, 2],
      expect.anything()
    );
    expect(page.followerIds).toEqual(["f1", "f2"]);
  });

  it("com cursor: consulta usa `follower_id > ?` com o cursor informado", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row("f3")] });

    const page = await repository.findFollowersByUser(USER_ID, 2, "f2");

    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining("follower_id > ?"),
      [USER_ID, "f2", 2],
      expect.anything()
    );
    expect(page.followerIds).toEqual(["f3"]);
  });

  it("página cheia (rows.length === limit): sinaliza nextCursor com o último follower_id", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row("f1"), row("f2")] });

    const page = await repository.findFollowersByUser(USER_ID, 2);

    expect(page.nextCursor).toBe("f2");
  });

  it("página parcial (rows.length < limit): nextCursor é null — não há próxima página", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row("f1")] });

    const page = await repository.findFollowersByUser(USER_ID, 2);

    expect(page.nextCursor).toBeNull();
  });

  it("sem seguidores: retorna lista vazia e nextCursor null", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const page = await repository.findFollowersByUser(USER_ID, 2);

    expect(page.followerIds).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});

describe("EstablishmentFollowersRepository.findFollowersByEstablishment — paginação por cursor", () => {
  let repository: EstablishmentFollowersRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    repository = new EstablishmentFollowersRepository();
  });

  it("sem cursor: consulta sem `follower_id > ?`, LIMIT igual ao tamanho pedido", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row("f1"), row("f2")] });

    const page = await repository.findFollowersByEstablishment(ESTAB_ID, 2);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.not.stringContaining("follower_id > ?"),
      [ESTAB_ID, 2],
      expect.anything()
    );
    expect(page.followerIds).toEqual(["f1", "f2"]);
  });

  it("com cursor: consulta usa `follower_id > ?` com o cursor informado", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row("f3")] });

    const page = await repository.findFollowersByEstablishment(ESTAB_ID, 2, "f2");

    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining("follower_id > ?"),
      [ESTAB_ID, "f2", 2],
      expect.anything()
    );
    expect(page.followerIds).toEqual(["f3"]);
  });

  it("página cheia: sinaliza nextCursor com o último follower_id; página parcial: nextCursor null", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row("f1"), row("f2")] });
    const fullPage = await repository.findFollowersByEstablishment(ESTAB_ID, 2);
    expect(fullPage.nextCursor).toBe("f2");

    mockExecute.mockResolvedValueOnce({ rows: [row("f1")] });
    const partialPage = await repository.findFollowersByEstablishment(ESTAB_ID, 2);
    expect(partialPage.nextCursor).toBeNull();
  });
});
