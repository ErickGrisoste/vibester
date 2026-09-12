import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleFollowEvent } from "../follow.handler";

const { mockInsertNotification } = vi.hoisted(() => ({
    mockInsertNotification: vi.fn(),
}));

vi.mock("../../../services/insertNotification.service", () => ({
    insertNotification: mockInsertNotification,
}));

describe("handleFollowEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInsertNotification.mockResolvedValue(undefined);
    });

    it("calls insertNotification('follow', followingId, followerId, '') when followingId is present", async () => {
        await handleFollowEvent(JSON.stringify({ followerId: "follower-1", followingId: "following-1" }));

        expect(mockInsertNotification).toHaveBeenCalledWith("follow", "following-1", "follower-1", "");
    });

    it("uses followedId as a fallback when followingId is absent", async () => {
        await handleFollowEvent(JSON.stringify({ followerId: "follower-1", followedId: "followed-1" }));

        expect(mockInsertNotification).toHaveBeenCalledWith("follow", "followed-1", "follower-1", "");
    });

    it("ignores (does not call insertNotification) on self-follow", async () => {
        await handleFollowEvent(JSON.stringify({ followerId: "user-1", followingId: "user-1" }));

        expect(mockInsertNotification).not.toHaveBeenCalled();
    });

    it("ignores and logs a warning when followerId or recipientId is missing", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await handleFollowEvent(JSON.stringify({ followerId: "follower-1" }));

        expect(mockInsertNotification).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("captures malformed JSON without throwing", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(handleFollowEvent("not-json")).resolves.toBeUndefined();

        expect(mockInsertNotification).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
