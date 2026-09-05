import { describe, it, expect, vi, beforeEach } from "vitest";
import { markAllReadByRecipient } from "../markAllRead.service";

const { mockUpdateMany } = vi.hoisted(() => ({
    mockUpdateMany: vi.fn(),
}));

vi.mock("../../prisma", () => ({
    default: {
        notification: {
            updateMany: mockUpdateMany,
        },
    },
}));

describe("markAllReadByRecipient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls updateMany with where {recipientId, read:false} and data {read:true}", async () => {
        mockUpdateMany.mockResolvedValue({ count: 3 });

        await markAllReadByRecipient("recipient-1");

        expect(mockUpdateMany).toHaveBeenCalledWith({
            where: { recipientId: "recipient-1", read: false },
            data: { read: true },
        });
    });

    it("returns the count from the Prisma result", async () => {
        mockUpdateMany.mockResolvedValue({ count: 3 });

        const result = await markAllReadByRecipient("recipient-1");

        expect(result).toBe(3);
    });

    it("returns 0 when there are no unread notifications", async () => {
        mockUpdateMany.mockResolvedValue({ count: 0 });

        const result = await markAllReadByRecipient("recipient-1");

        expect(result).toBe(0);
    });
});
