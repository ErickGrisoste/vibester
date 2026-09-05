import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlePostLikedEvent } from "../postLiked.handler";

const { mockInsertNotification } = vi.hoisted(() => ({
    mockInsertNotification: vi.fn(),
}));

vi.mock("../../../services/insertNotification.service", () => ({
    insertNotification: mockInsertNotification,
}));

describe("handlePostLikedEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInsertNotification.mockResolvedValue(undefined);
    });

    it("calls insertNotification('like', postOwnerId, likerId, postId) using likedByUserId", async () => {
        await handlePostLikedEvent(
            JSON.stringify({ postId: "post-1", postOwnerId: "owner-1", likedByUserId: "liker-1" }),
        );

        expect(mockInsertNotification).toHaveBeenCalledWith("like", "owner-1", "liker-1", "post-1");
    });

    it("uses userId as a fallback for likerId when likedByUserId is absent", async () => {
        await handlePostLikedEvent(JSON.stringify({ postId: "post-1", postOwnerId: "owner-1", userId: "liker-2" }));

        expect(mockInsertNotification).toHaveBeenCalledWith("like", "owner-1", "liker-2", "post-1");
    });

    it("ignores likes on one's own post", async () => {
        await handlePostLikedEvent(JSON.stringify({ postId: "post-1", postOwnerId: "user-1", userId: "user-1" }));

        expect(mockInsertNotification).not.toHaveBeenCalled();
    });

    it("ignores when postId/postOwnerId/likerId is missing", async () => {
        await handlePostLikedEvent(JSON.stringify({ postId: "post-1" }));

        expect(mockInsertNotification).not.toHaveBeenCalled();
    });

    it("captures malformed JSON without throwing", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(handlePostLikedEvent("not-json")).resolves.toBeUndefined();

        errorSpy.mockRestore();
    });
});
