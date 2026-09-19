import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostCounterService } from "../postCounter.service";

const { mockUpdateMany, mockExists, mockSet, mockDel } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
  mockExists: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
  default: { userProfile: { updateMany: mockUpdateMany } },
}));

vi.mock("../../config/redis", () => ({
  redis: { exists: mockExists, set: mockSet, del: mockDel },
}));

const AUTHOR_ID = "author-uuid-1";

describe("PostCounterService", () => {
  let service: PostCounterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PostCounterService();
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockExists.mockResolvedValue(0);
    mockSet.mockResolvedValue("OK");
    mockDel.mockResolvedValue(1);
  });

  it("incrementa totalPosts no post.created e invalida o cache do perfil", async () => {
    await service.handlePostCreated("evt-1", AUTHOR_ID);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userID: AUTHOR_ID },
      data: { totalPosts: { increment: 1 } },
    });
    expect(mockDel).toHaveBeenCalledWith(`user:profile:${AUTHOR_ID}`);
    expect(mockSet).toHaveBeenCalledWith("user:post-event:evt-1", "1", "EX", expect.any(Number));
  });

  it("decrementa totalPosts no post.deleted sem deixar ficar negativo", async () => {
    await service.handlePostDeleted("evt-2", AUTHOR_ID);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userID: AUTHOR_ID, totalPosts: { gt: 0 } },
      data: { totalPosts: { decrement: 1 } },
    });
  });

  it("ignora evento já processado (redelivery do Kafka)", async () => {
    mockExists.mockResolvedValue(1);

    await service.handlePostCreated("evt-1", AUTHOR_ID);

    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("continua contando quando o Redis está fora", async () => {
    mockExists.mockRejectedValue(new Error("redis down"));
    mockSet.mockRejectedValue(new Error("redis down"));
    mockDel.mockRejectedValue(new Error("redis down"));

    await expect(service.handlePostCreated("evt-3", AUTHOR_ID)).resolves.toBeUndefined();
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("propaga erro do banco para o Kafka não commitar o offset", async () => {
    mockUpdateMany.mockRejectedValue(new Error("DB connection lost"));

    await expect(service.handlePostCreated("evt-4", AUTHOR_ID)).rejects.toThrow("DB connection lost");
    expect(mockSet).not.toHaveBeenCalled();
  });
});
