import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerateShareLinkService } from "../generateShareLink.service";
import { env } from "../../config/env";

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));

vi.mock("../../prisma/index", () => ({
  default: { userProfile: { update: mockUpdate } },
}));

const { mockRedisSet } = vi.hoisted(() => ({ mockRedisSet: vi.fn() }));

vi.mock("../../config/redis", () => ({
  redis: { set: mockRedisSet, get: vi.fn() },
}));

const ACCOUNT_ID = "account-uuid-1";

describe("GenerateShareLinkService", () => {
  let service: GenerateShareLinkService;

  beforeEach(() => {
    service = new GenerateShareLinkService();
    vi.clearAllMocks();
  });

  it("should increment shareCount, store the token in Redis with TTL and return shareUrl/expiresAt", async () => {
    mockUpdate.mockResolvedValue({ userID: ACCOUNT_ID, shareCount: 1 });
    mockRedisSet.mockResolvedValue("OK");

    const result = await service.generate({ accountId: ACCOUNT_ID });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userID: ACCOUNT_ID },
      data: { shareCount: { increment: 1 } },
    });
    expect(mockRedisSet).toHaveBeenCalledWith(
      `share:token:${result.token}`,
      ACCOUNT_ID,
      "EX",
      env.shareLinkTtlSeconds,
    );
    expect(result.shareUrl).toBe(`${env.webBaseUrl}/u/${result.token}`);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("should throw when accountId does not exist", async () => {
    mockUpdate.mockRejectedValue(new Error("Record to update not found."));

    await expect(
      service.generate({ accountId: "non-existent" }),
    ).rejects.toThrow("Record to update not found.");
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("should propagate the error when Redis fails to store the token", async () => {
    mockUpdate.mockResolvedValue({ userID: ACCOUNT_ID, shareCount: 1 });
    mockRedisSet.mockRejectedValue(new Error("Redis unavailable"));

    await expect(
      service.generate({ accountId: ACCOUNT_ID }),
    ).rejects.toThrow("Redis unavailable");
  });
});
