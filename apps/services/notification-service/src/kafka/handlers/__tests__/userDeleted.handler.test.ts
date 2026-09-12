import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUserDeletedEvent } from "../userDeleted.handler";

const { mockDeleteMany } = vi.hoisted(() => ({
    mockDeleteMany: vi.fn(),
}));

vi.mock("../../../prisma", () => ({
    default: {
        notification: {
            deleteMany: mockDeleteMany,
        },
    },
}));

describe("handleUserDeletedEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDeleteMany.mockResolvedValue({ count: 2 });
    });

    it("calls notification.deleteMany with OR [{recipientId:userId},{actorId:userId}]", async () => {
        await handleUserDeletedEvent(JSON.stringify({ userId: "user-1" }));

        expect(mockDeleteMany).toHaveBeenCalledWith({
            where: {
                OR: [{ recipientId: "user-1" }, { actorId: "user-1" }],
            },
        });
    });

    it("ignores (does not call deleteMany) when userId is absent from the payload", async () => {
        await handleUserDeletedEvent(JSON.stringify({}));

        expect(mockDeleteMany).not.toHaveBeenCalled();
    });

    it("captures Prisma errors without throwing", async () => {
        mockDeleteMany.mockRejectedValue(new Error("db down"));
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(handleUserDeletedEvent(JSON.stringify({ userId: "user-1" }))).resolves.toBeUndefined();

        errorSpy.mockRestore();
    });
});
