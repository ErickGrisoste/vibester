import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditProfileService } from "../editProfile.service";
import { profileSelect } from "../../prisma/profile.select";

const {
  mockUpdate,
  mockUserFollowCreate,
  mockUserFollowDelete,
  mockProducerSend,
  mockTransaction,
} = vi.hoisted(() => {
  const mockUpdate = vi.fn();
  const mockUserFollowCreate = vi.fn();
  const mockUserFollowDelete = vi.fn();
  const mockProducerSend = vi.fn();
  const mockTransaction = vi.fn().mockImplementation((fn: Function) =>
    fn({
      userProfile: { update: mockUpdate },
      userFollow: { create: mockUserFollowCreate, delete: mockUserFollowDelete },
    })
  );
  return { mockUpdate, mockUserFollowCreate, mockUserFollowDelete, mockProducerSend, mockTransaction };
});

vi.mock("../../prisma/index", () => ({
  default: {
    userProfile: { update: mockUpdate },
    userFollow: { create: mockUserFollowCreate, delete: mockUserFollowDelete },
    $transaction: mockTransaction,
  },
}));

vi.mock("../../kafka/producer", () => ({
  producer: { send: mockProducerSend },
}));

const FOLLOWER_ID = "follower-uuid-1";
const FOLLOWING_ID = "following-uuid-2";

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
    userID: FOLLOWING_ID,
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

describe("EditProfileService", () => {
  let service: EditProfileService;

  beforeEach(() => {
    service = new EditProfileService();
    vi.clearAllMocks();
    mockTransaction.mockImplementation((fn: Function) =>
      fn({
        userProfile: { update: mockUpdate },
        userFollow: { create: mockUserFollowCreate, delete: mockUserFollowDelete },
      })
    );
  });

  // ======= updateBio =======

  describe("updateBio", () => {
    it("should update the bio of a user profile", async () => {
      const updatedProfile = makeProfile({ bio: "Minha nova bio" });
      mockUpdate.mockResolvedValue(updatedProfile);

      const result = await service.updateBio({ accountId: FOLLOWING_ID, bio: "Minha nova bio" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userID: FOLLOWING_ID },
        data: { bio: "Minha nova bio" },
        select: profileSelect,
      });
      expect(result.bio).toBe("Minha nova bio");
    });

    it("should throw when user profile is not found", async () => {
      mockUpdate.mockRejectedValue(new Error("Record to update not found."));

      await expect(
        service.updateBio({ accountId: "non-existent", bio: "bio" })
      ).rejects.toThrow("Record to update not found.");
    });
  });

  // ======= updateAvatar =======

  describe("updateAvatar", () => {
    it("should update the avatarUrl of a user profile", async () => {
      const url = "https://example.com/avatar.jpg";
      const updatedProfile = makeProfile({ avatarUrl: url });
      mockUpdate.mockResolvedValue(updatedProfile);

      const result = await service.updateAvatar({ accountId: FOLLOWING_ID, avatarUrl: url });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userID: FOLLOWING_ID },
        data: { avatarUrl: url },
        select: profileSelect,
      });
      expect(result.avatarUrl).toBe(url);
    });

    it("should throw when user profile is not found", async () => {
      mockUpdate.mockRejectedValue(new Error("Record to update not found."));

      await expect(
        service.updateAvatar({ accountId: "non-existent", avatarUrl: "https://example.com/a.jpg" })
      ).rejects.toThrow("Record to update not found.");
    });
  });

  // ======= increaseFollower =======

  describe("increaseFollower", () => {
    it("should create follow, increment counters atomically, send Kafka event and return the followed profile", async () => {
      const updatedFollowingProfile = makeProfile({ followers: 1 });
      mockUserFollowCreate.mockResolvedValue({});
      mockUpdate
        .mockResolvedValueOnce(updatedFollowingProfile)
        .mockResolvedValueOnce(makeProfile({ userID: FOLLOWER_ID, following: 1 }));
      mockProducerSend.mockResolvedValue({});

      const result = await service.increaseFollower(FOLLOWER_ID, FOLLOWING_ID);

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockUserFollowCreate).toHaveBeenCalledWith({
        data: { followerId: FOLLOWER_ID, followingId: FOLLOWING_ID },
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userID: FOLLOWING_ID },
        data: { followers: { increment: 1 } },
        select: profileSelect,
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userID: FOLLOWER_ID },
        data: { following: { increment: 1 } },
        select: profileSelect,
      });
      expect(mockProducerSend).toHaveBeenCalledWith({
        topic: "user.followed",
        messages: [{ value: JSON.stringify({ followerId: FOLLOWER_ID, followingId: FOLLOWING_ID }) }],
      });
      expect(result.followers).toBe(1);
    });

    it("should throw when creating the follow record fails", async () => {
      mockUserFollowCreate.mockRejectedValue(new Error("Unique constraint failed."));

      await expect(
        service.increaseFollower(FOLLOWER_ID, FOLLOWING_ID)
      ).rejects.toThrow("Unique constraint failed.");
    });

    it("should throw when updating profiles fails", async () => {
      mockUserFollowCreate.mockResolvedValue({});
      mockUpdate.mockRejectedValue(new Error("Record to update not found."));

      await expect(
        service.increaseFollower(FOLLOWER_ID, "non-existent")
      ).rejects.toThrow("Record to update not found.");
    });
  });

  // ======= decreaseFollower =======

  describe("decreaseFollower", () => {
    it("should delete follow, decrement counters atomically and return the unfollowed profile", async () => {
      const updatedFollowingProfile = makeProfile({ followers: 0 });
      mockUserFollowDelete.mockResolvedValue({});
      mockUpdate
        .mockResolvedValueOnce(updatedFollowingProfile)
        .mockResolvedValueOnce(makeProfile({ userID: FOLLOWER_ID, following: 0 }));

      const result = await service.decreaseFollower(FOLLOWER_ID, FOLLOWING_ID);

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockUserFollowDelete).toHaveBeenCalledWith({
        where: { followerId_followingId: { followerId: FOLLOWER_ID, followingId: FOLLOWING_ID } },
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userID: FOLLOWING_ID },
        data: { followers: { decrement: 1 } },
        select: profileSelect,
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userID: FOLLOWER_ID },
        data: { following: { decrement: 1 } },
        select: profileSelect,
      });
      expect(result.followers).toBe(0);
    });

    it("should throw when the follow record does not exist", async () => {
      mockUserFollowDelete.mockRejectedValue(new Error("Record to delete does not exist."));

      await expect(
        service.decreaseFollower(FOLLOWER_ID, FOLLOWING_ID)
      ).rejects.toThrow("Record to delete does not exist.");
    });

    it("should throw when updating profiles fails", async () => {
      mockUserFollowDelete.mockResolvedValue({});
      mockUpdate.mockRejectedValue(new Error("Record to update not found."));

      await expect(
        service.decreaseFollower(FOLLOWER_ID, "non-existent")
      ).rejects.toThrow("Record to update not found.");
    });
  });
});
