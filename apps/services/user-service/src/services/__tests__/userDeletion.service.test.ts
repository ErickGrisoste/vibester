import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFollowFindMany,
  mockFollowDeleteMany,
  mockProfileUpdateMany,
  mockProfileDeleteMany,
  mockBlockDeleteMany,
  mockReportDeleteMany,
  mockTransaction,
  mockSend,
  mockDel,
} = vi.hoisted(() => ({
  mockFollowFindMany: vi.fn(),
  mockFollowDeleteMany: vi.fn(),
  mockProfileUpdateMany: vi.fn(),
  mockProfileDeleteMany: vi.fn(),
  mockBlockDeleteMany: vi.fn(),
  mockReportDeleteMany: vi.fn(),
  mockTransaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  mockSend: vi.fn(),
  mockDel: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
  default: {
    userFollow: { findMany: mockFollowFindMany, deleteMany: mockFollowDeleteMany },
    userProfile: { updateMany: mockProfileUpdateMany, deleteMany: mockProfileDeleteMany },
    userBlock: { deleteMany: mockBlockDeleteMany },
    contentReport: { deleteMany: mockReportDeleteMany },
    $transaction: mockTransaction,
  },
}));

vi.mock("../../kafka/producer", () => ({ producer: { send: mockSend } }));
vi.mock("../../config/redis", () => ({ redis: { del: mockDel } }));

import { UserDeletionService } from "../userDeletion.service";

const DELETED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("UserDeletionService", () => {
  let service: UserDeletionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserDeletionService();
    mockSend.mockResolvedValue([]);
    mockDel.mockResolvedValue(1);
    for (const fn of [mockFollowDeleteMany, mockProfileUpdateMany, mockProfileDeleteMany, mockBlockDeleteMany, mockReportDeleteMany]) {
      fn.mockResolvedValue({ count: 1 });
    }
  });

  it("desfaz follows de e para a conta, ajusta contadores dos outros e publica unfollow", async () => {
    mockFollowFindMany
      .mockResolvedValueOnce([
        { id: "f1", followerId: DELETED, followingId: A },
        { id: "f2", followerId: B, followingId: DELETED },
      ])
      .mockResolvedValueOnce([]);

    await service.handleUserDeleted(DELETED);

    expect(mockSend).toHaveBeenCalledWith({
      topic: "user.unfollowed",
      messages: [
        { value: JSON.stringify({ followerId: DELETED, followedId: A }) },
        { value: JSON.stringify({ followerId: B, followedId: DELETED }) },
      ],
    });
    expect(mockFollowDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["f1", "f2"] } } });
    expect(mockProfileUpdateMany).toHaveBeenCalledWith({
      where: { userID: { in: [A] }, followers: { gt: 0 } },
      data: { followers: { decrement: 1 } },
    });
    expect(mockProfileUpdateMany).toHaveBeenCalledWith({
      where: { userID: { in: [B] }, following: { gt: 0 } },
      data: { following: { decrement: 1 } },
    });
    expect(mockSend.mock.invocationCallOrder[0]).toBeLessThan(mockFollowDeleteMany.mock.invocationCallOrder[0]);
  });

  it("apaga bloqueios, denúncias e o perfil", async () => {
    mockFollowFindMany.mockResolvedValueOnce([]);

    await service.handleUserDeleted(DELETED);

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockBlockDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ blockerId: DELETED }, { blockedId: DELETED }] },
    });
    expect(mockReportDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ reporterId: DELETED }, { targetType: "USER", targetId: DELETED }] },
    });
    expect(mockProfileDeleteMany).toHaveBeenCalledWith({ where: { userID: DELETED } });
    expect(mockDel).toHaveBeenCalledWith(
      `user:profile:${DELETED}`,
      `user:followers:${DELETED}`,
      `user:following:${DELETED}`,
    );
  });

  it("erro de banco sobe para o Kafka reentregar", async () => {
    mockFollowFindMany.mockResolvedValueOnce([]);
    mockTransaction.mockRejectedValueOnce(new Error("db down"));

    await expect(service.handleUserDeleted(DELETED)).rejects.toThrow("db down");
  });
});
