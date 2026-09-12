import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlePostCommentedEvent } from "../postCommented.handler";

const { mockInsertNotification } = vi.hoisted(() => ({
    mockInsertNotification: vi.fn(),
}));

vi.mock("../../../services/insertNotification.service", () => ({
    insertNotification: mockInsertNotification,
}));

describe("handlePostCommentedEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInsertNotification.mockResolvedValue(undefined);
    });

    it("calls insertNotification('comment', postOwnerId, commenterId, postId, content)", async () => {
        await handlePostCommentedEvent(
            JSON.stringify({
                postId: "post-1",
                postOwnerId: "owner-1",
                commentedByUserId: "commenter-1",
                content: "Great post!",
            }),
        );

        expect(mockInsertNotification).toHaveBeenCalledWith("comment", "owner-1", "commenter-1", "post-1", "Great post!");
    });

    it("uses content='' when content is absent", async () => {
        await handlePostCommentedEvent(
            JSON.stringify({ postId: "post-1", postOwnerId: "owner-1", commentedByUserId: "commenter-1" }),
        );

        expect(mockInsertNotification).toHaveBeenCalledWith("comment", "owner-1", "commenter-1", "post-1", "");
    });

    it("uses userId as a fallback for commentedByUserId", async () => {
        await handlePostCommentedEvent(JSON.stringify({ postId: "post-1", postOwnerId: "owner-1", userId: "commenter-2" }));

        expect(mockInsertNotification).toHaveBeenCalledWith("comment", "owner-1", "commenter-2", "post-1", "");
    });

    it("ignores self-comment", async () => {
        await handlePostCommentedEvent(JSON.stringify({ postId: "post-1", postOwnerId: "user-1", userId: "user-1" }));

        expect(mockInsertNotification).not.toHaveBeenCalled();
    });

    it("ignores when a required field is missing", async () => {
        await handlePostCommentedEvent(JSON.stringify({ postId: "post-1" }));

        expect(mockInsertNotification).not.toHaveBeenCalled();
    });
});
