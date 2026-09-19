import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetProfileService } from "../getProfile.service";
import { profileSelect } from "../../prisma/profile.select";

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
  default: {
    userProfile: {
      findUnique: mockFindUnique,
    },
  },
}));

function makeProfile(overrides: Partial<{
  id: string;
  userID: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followers: number;
  following: number;
  totalPosts: number;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: "profile-id-1",
    userID: "user-uuid-1",
    name: null,
    username: null,
    avatarUrl: null,
    bio: null,
    followers: 0,
    following: 0,
    totalPosts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("GetProfileService", () => {
  let service: GetProfileService;

  beforeEach(() => {
    service = new GetProfileService();
    vi.clearAllMocks();
  });

  it("should return the profile when found by accountId", async () => {
    const profile = makeProfile({ userID: "user-uuid-1" });
    mockFindUnique.mockResolvedValue(profile);

    const result = await service.getProfileByAccountId("user-uuid-1");

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { userID: "user-uuid-1" }, select: profileSelect });
    expect(result).toEqual(profile);
  });

  it("should return null when profile is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await service.getProfileByAccountId("non-existent-id");

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { userID: "non-existent-id" }, select: profileSelect });
    expect(result).toBeNull();
  });

  it("should throw when prisma fails", async () => {
    mockFindUnique.mockRejectedValue(new Error("Database error"));

    await expect(service.getProfileByAccountId("user-uuid-1")).rejects.toThrow("Database error");
  });
});
