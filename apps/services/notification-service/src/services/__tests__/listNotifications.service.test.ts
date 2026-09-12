import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListNotificationsService } from "../listNotifications.service";

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

const { mockGetProfile, mockGetPost } = vi.hoisted(() => ({
    mockGetProfile: vi.fn(),
    mockGetPost: vi.fn(),
}));

vi.mock("../../clients/user.client", () => ({
    UserClient: class {
        getProfile = mockGetProfile;
    },
}));

vi.mock("../../clients/post.client", () => ({
    PostClient: class {
        getPost = mockGetPost;
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

describe("ListNotificationsService.buildFeed", () => {
    let service: ListNotificationsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ListNotificationsService();
        mockGetProfile.mockResolvedValue({ accountId: "actor-1", name: "A", username: "a", avatarUrl: "" });
        mockGetPost.mockResolvedValue({ postId: "post-1", imageUrl: "", caption: "c", isDeleted: false });
        mockFindMany.mockResolvedValue([]);
    });

    it("uses limit=50 and does not filter createdAt when 'before' is not provided", async () => {
        await service.buildFeed("recipient-1");

        const callArg = mockFindMany.mock.calls[0][0];
        expect(callArg.where).toEqual({ recipientId: "recipient-1" });
    });

    it("filters createdAt < before when 'before' is provided", async () => {
        const before = new Date("2026-01-05T00:00:00.000Z");
        await service.buildFeed("recipient-1", 50, before);

        const callArg = mockFindMany.mock.calls[0][0];
        expect(callArg.where.createdAt).toEqual({ lt: before });
    });

    it("falls back to limit=50 when limit <= 0", async () => {
        mockFindMany.mockResolvedValue([makeRow()]);
        const result = await service.buildFeed("recipient-1", 0);

        expect(result.items).toHaveLength(1);
    });

    it("groups notifications via groupNotifications before paginating", async () => {
        mockFindMany.mockResolvedValue([
            makeRow({ id: "1", type: "like", refId: "post-1", actorId: "a1" }),
            makeRow({ id: "2", type: "like", refId: "post-1", actorId: "a2" }),
        ]);

        const result = await service.buildFeed("recipient-1");

        expect(result.items).toHaveLength(1);
        expect(result.items[0].totalCount).toBe(2);
    });

    it("enriches like/comment groups by calling PostClient.getPost", async () => {
        mockFindMany.mockResolvedValue([makeRow({ type: "like", refId: "post-1" })]);

        await service.buildFeed("recipient-1");

        expect(mockGetPost).toHaveBeenCalledWith("post-1");
    });

    it("does NOT call PostClient.getPost for follow groups", async () => {
        mockFindMany.mockResolvedValue([makeRow({ type: "follow", refId: "", read: false })]);

        await service.buildFeed("recipient-1");

        expect(mockGetPost).not.toHaveBeenCalled();
    });

    it("calls UserClient.getProfile for the actorId of each group", async () => {
        mockFindMany.mockResolvedValue([makeRow({ actorId: "actor-42" })]);

        await service.buildFeed("recipient-1");

        expect(mockGetProfile).toHaveBeenCalledWith("actor-42");
    });

    it("caches lookups: getProfile/getPost called once per distinct id even across multiple groups", async () => {
        mockFindMany.mockResolvedValue([
            makeRow({ id: "1", type: "like", refId: "post-1", actorId: "actor-1" }),
            makeRow({ id: "2", type: "comment", refId: "post-2", actorId: "actor-1" }),
        ]);

        await service.buildFeed("recipient-1");

        expect(mockGetProfile).toHaveBeenCalledTimes(1);
    });

    it("returns nextCursor null when there are no more pages", async () => {
        mockFindMany.mockResolvedValue([makeRow()]);

        const result = await service.buildFeed("recipient-1", 50);

        expect(result.nextCursor).toBeNull();
    });

    it("returns nextCursor when groups.length > limit (truncation)", async () => {
        mockFindMany.mockResolvedValue([
            makeRow({ id: "1", type: "like", refId: "post-1" }),
            makeRow({ id: "2", type: "like", refId: "post-2" }),
            makeRow({ id: "3", type: "like", refId: "post-3" }),
        ]);

        const result = await service.buildFeed("recipient-1", 2);

        expect(result.items).toHaveLength(2);
        expect(result.nextCursor).not.toBeNull();
    });

    it("returns nextCursor when rawRows.length >= 200 (rawFetchLimit), even without limit truncation", async () => {
        const rows = Array.from({ length: 200 }, (_, i) =>
            makeRow({ id: `row-${i}`, type: "like", refId: `post-${i}` }),
        );
        mockFindMany.mockResolvedValue(rows);

        const result = await service.buildFeed("recipient-1", 500);

        expect(result.nextCursor).not.toBeNull();
    });

    it("returns items=[] and nextCursor=null when there are no notifications", async () => {
        mockFindMany.mockResolvedValue([]);

        const result = await service.buildFeed("recipient-1");

        expect(result.items).toEqual([]);
        expect(result.nextCursor).toBeNull();
    });
});
