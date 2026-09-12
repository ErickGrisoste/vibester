import { describe, it, expect, vi, beforeEach } from "vitest";
import { countUnreadGroups } from "../unreadCount.service";

const { mockFindMany } = vi.hoisted(() => ({
    mockFindMany: vi.fn(),
}));

vi.mock("../../prisma", () => ({
    default: {
        notification: {
            findMany: mockFindMany,
        },
    },
}));

function makeRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "row-1",
        type: "like",
        recipientId: "recipient-1",
        actorId: "actor-1",
        refId: "post-1",
        content: null,
        read: false,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        ...overrides,
    };
}

describe("countUnreadGroups", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("fetches up to 500 unread notifications for the recipient", async () => {
        mockFindMany.mockResolvedValue([]);

        await countUnreadGroups("recipient-1");

        expect(mockFindMany).toHaveBeenCalledWith({
            where: { recipientId: "recipient-1", read: false },
            orderBy: { createdAt: "desc" },
            take: 500,
        });
    });

    it("returns the number of GROUPS, not rows — multiple rows for the same post count as one", async () => {
        mockFindMany.mockResolvedValue([
            makeRow({ id: "1", type: "like", refId: "post-1", actorId: "a1" }),
            makeRow({ id: "2", type: "like", refId: "post-1", actorId: "a2" }),
            makeRow({ id: "3", type: "comment", refId: "post-2", actorId: "a3" }),
        ]);

        const count = await countUnreadGroups("recipient-1");

        expect(count).toBe(2);
    });

    it("returns 0 when there are no unread notifications", async () => {
        mockFindMany.mockResolvedValue([]);

        const count = await countUnreadGroups("recipient-1");

        expect(count).toBe(0);
    });
});
