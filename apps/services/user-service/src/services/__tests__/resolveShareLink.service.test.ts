import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResolveShareLinkService } from "../resolveShareLink.service";
import { profileSelect } from "../../prisma/profile.select";

const { mockRedisGet } = vi.hoisted(() => ({ mockRedisGet: vi.fn() }));

vi.mock("../../config/redis", () => ({
  redis: { get: mockRedisGet, set: vi.fn() },
  cacheAside: async <T>(_k: string, _t: number, fetchFn: () => Promise<T>): Promise<T> => fetchFn(),
}));

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock("../../prisma/index", () => ({
  default: { userProfile: { findUnique: mockFindUnique } },
}));

const ACCOUNT_ID = "account-uuid-1";
const TOKEN = "share-token-1";

describe("ResolveShareLinkService", () => {
  let service: ResolveShareLinkService;

  beforeEach(() => {
    service = new ResolveShareLinkService();
    vi.clearAllMocks();
  });

  it("should return the profile when the token exists in Redis", async () => {
    mockRedisGet.mockResolvedValue(ACCOUNT_ID);
    mockFindUnique.mockResolvedValue({ userID: ACCOUNT_ID, name: "Fulano" });

    const result = await service.resolve(TOKEN);

    expect(mockRedisGet).toHaveBeenCalledWith(`share:token:${TOKEN}`);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { userID: ACCOUNT_ID }, select: profileSelect });
    expect(result).toMatchObject({ userID: ACCOUNT_ID, name: "Fulano" });
  });

  it("should return null when the token does not exist or has expired", async () => {
    mockRedisGet.mockResolvedValue(null);

    const result = await service.resolve("expired-token");

    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("should return null when the profile linked to the token no longer exists", async () => {
    mockRedisGet.mockResolvedValue(ACCOUNT_ID);
    mockFindUnique.mockResolvedValue(null);

    const result = await service.resolve(TOKEN);

    expect(result).toBeNull();
  });
});
