import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockBlockCreate,
  mockBlockDeleteMany,
  mockBlockCount,
  mockBlockFindMany,
  mockFollowFindMany,
  mockProfileFindMany,
} = vi.hoisted(() => ({
  mockBlockCreate: vi.fn(),
  mockBlockDeleteMany: vi.fn(),
  mockBlockCount: vi.fn(),
  mockBlockFindMany: vi.fn(),
  mockFollowFindMany: vi.fn(),
  mockProfileFindMany: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
  default: {
    userBlock: {
      create: mockBlockCreate,
      deleteMany: mockBlockDeleteMany,
      count: mockBlockCount,
      findMany: mockBlockFindMany,
    },
    userFollow: { findMany: mockFollowFindMany },
    userProfile: { findMany: mockProfileFindMany },
  },
}));

vi.mock("../../kafka/producer", () => ({ producer: { send: vi.fn() } }));
vi.mock("../../config/redis", () => ({ redis: { del: vi.fn().mockResolvedValue(1) } }));

import { BlockService } from "../block.service";
import { SafetyError } from "../safetyError";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("BlockService", () => {
  let decreaseFollower: ReturnType<typeof vi.fn>;
  let service: BlockService;

  beforeEach(() => {
    vi.clearAllMocks();
    decreaseFollower = vi.fn().mockResolvedValue({});
    service = new BlockService({ decreaseFollower } as never);
    mockBlockCreate.mockResolvedValue({});
    mockFollowFindMany.mockResolvedValue([]);
  });

  it("recusa bloquear a si mesmo", async () => {
    await expect(service.block(ME, ME)).rejects.toBeInstanceOf(SafetyError);
    expect(mockBlockCreate).not.toHaveBeenCalled();
  });

  it("cria o bloqueio e desfaz o follow nas duas direções", async () => {
    mockFollowFindMany.mockResolvedValue([
      { followerId: ME, followingId: OTHER },
      { followerId: OTHER, followingId: ME },
    ]);

    await service.block(ME, OTHER);

    expect(mockBlockCreate).toHaveBeenCalledWith({ data: { blockerId: ME, blockedId: OTHER } });
    expect(decreaseFollower).toHaveBeenCalledWith(ME, OTHER);
    expect(decreaseFollower).toHaveBeenCalledWith(OTHER, ME);
  });

  it("bloquear de novo não é erro", async () => {
    mockBlockCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(service.block(ME, OTHER)).resolves.toBeUndefined();
  });

  it("ignora follow já desfeito por concorrência, mas propaga outros erros", async () => {
    mockFollowFindMany.mockResolvedValue([{ followerId: ME, followingId: OTHER }]);

    decreaseFollower.mockRejectedValueOnce(Object.assign(new Error("gone"), { code: "P2025" }));
    await expect(service.block(ME, OTHER)).resolves.toBeUndefined();

    decreaseFollower.mockRejectedValueOnce(new Error("db down"));
    await expect(service.block(ME, OTHER)).rejects.toThrow("db down");
  });

  it("desbloqueia só o par do usuário", async () => {
    mockBlockDeleteMany.mockResolvedValue({ count: 1 });
    await service.unblock(ME, OTHER);
    expect(mockBlockDeleteMany).toHaveBeenCalledWith({ where: { blockerId: ME, blockedId: OTHER } });
  });

  it("isBlockedEitherWay olha as duas direções", async () => {
    mockBlockCount.mockResolvedValue(1);
    await expect(service.isBlockedEitherWay(ME, OTHER)).resolves.toBe(true);
    expect(mockBlockCount).toHaveBeenCalledWith({
      where: { OR: [{ blockerId: ME, blockedId: OTHER }, { blockerId: OTHER, blockedId: ME }] },
    });
  });

  it("status separa quem bloqueou quem", async () => {
    mockBlockFindMany.mockResolvedValue([{ blockerId: OTHER }]);
    await expect(service.status(ME, OTHER)).resolves.toEqual({ blocking: false, blockedBy: true });
  });

  it("lista bloqueados com o perfil e o cursor da próxima página", async () => {
    const blockedAt = new Date("2026-09-10T10:00:00.000Z");
    mockBlockFindMany.mockResolvedValue([{ blockedId: OTHER, createdAt: blockedAt }]);
    mockProfileFindMany.mockResolvedValue([{ userID: OTHER, name: "Outra", username: "@outra", avatarUrl: null }]);

    const page = await service.listBlocked(ME, 1);

    expect(page).toEqual({
      data: [{ accountId: OTHER, name: "Outra", username: "@outra", avatarUrl: null, blockedAt }],
      nextCursor: blockedAt.toISOString(),
    });
  });

  it("lista vazia não consulta perfis", async () => {
    mockBlockFindMany.mockResolvedValue([]);
    await expect(service.listBlocked(ME)).resolves.toEqual({ data: [], nextCursor: null });
    expect(mockProfileFindMany).not.toHaveBeenCalled();
  });
});
