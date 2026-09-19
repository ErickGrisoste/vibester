import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateProfileService } from "../createProfile.service";
import { profileSelect } from "../../prisma/profile.select";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
  default: {
    userProfile: {
      create: mockCreate,
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

describe("CreateProfileService", () => {
  let service: CreateProfileService;

  beforeEach(() => {
    service = new CreateProfileService();
    vi.clearAllMocks();
  });

  it("should create a profile with the given accountId", async () => {
    const profile = makeProfile({ userID: "user-uuid-1" });
    mockCreate.mockResolvedValue(profile);

    const result = await service.createProfile({ accountId: "user-uuid-1" });

    expect(mockCreate).toHaveBeenCalledWith({
      data: { userID: "user-uuid-1" },
      select: profileSelect,
    });
    expect(result).toEqual(profile);
  });

  it("should return the profile returned by prisma", async () => {
    const profile = makeProfile({ userID: "user-uuid-2", followers: 5 });
    mockCreate.mockResolvedValue(profile);

    const result = await service.createProfile({ accountId: "user-uuid-2" });

    expect(result.userID).toBe("user-uuid-2");
    expect(result.followers).toBe(5);
  });

  it("should throw when prisma fails", async () => {
    mockCreate.mockRejectedValue(new Error("Database error"));

    await expect(
      service.createProfile({ accountId: "user-uuid-1" })
    ).rejects.toThrow("Database error");
  });
});
