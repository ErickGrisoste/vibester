import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertNotification } from "../insertNotification.service";

const { mockCreate } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
}));

vi.mock("../../prisma", () => ({
    default: {
        notification: {
            create: mockCreate,
        },
    },
}));

describe("insertNotification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreate.mockResolvedValue(undefined);
    });

    it("calls notification.create with the correct type/recipientId/actorId/refId", async () => {
        await insertNotification("like", "recipient-1", "actor-1", "post-1");

        expect(mockCreate).toHaveBeenCalledWith({
            data: {
                type: "like",
                recipientId: "recipient-1",
                actorId: "actor-1",
                refId: "post-1",
                content: null,
            },
        });
    });

    it("uses content: null when content is not provided", async () => {
        await insertNotification("follow", "recipient-1", "actor-1", "");

        const callArg = mockCreate.mock.calls[0][0].data;
        expect(callArg.content).toBeNull();
    });

    it("propagates content when provided", async () => {
        await insertNotification("comment", "recipient-1", "actor-1", "post-1", "Nice post!");

        const callArg = mockCreate.mock.calls[0][0].data;
        expect(callArg.content).toBe("Nice post!");
    });
});
