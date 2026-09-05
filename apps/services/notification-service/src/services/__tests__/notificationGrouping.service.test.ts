import { describe, it, expect } from "vitest";
import { groupNotifications } from "../notificationGrouping.service";
import { NotificationRow } from "../../types/notification.types";

function makeRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
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

describe("groupNotifications", () => {
    it("returns an empty array for empty input", () => {
        expect(groupNotifications([])).toEqual([]);
    });

    it("groups all unread follow notifications into a single follow:unread group", () => {
        const rows = [
            makeRow({ id: "1", type: "follow", actorId: "a1", read: false }),
            makeRow({ id: "2", type: "follow", actorId: "a2", read: false }),
        ];

        const groups = groupNotifications(rows);

        expect(groups).toHaveLength(1);
        expect(groups[0].key).toBe("follow:unread");
        expect(groups[0].totalCount).toBe(2);
    });

    it("groups read follow notifications by day (follow:read:YYYY-MM-DD)", () => {
        const rows = [
            makeRow({ id: "1", type: "follow", actorId: "a1", read: true, createdAt: new Date("2026-01-01T10:00:00.000Z") }),
            makeRow({ id: "2", type: "follow", actorId: "a2", read: true, createdAt: new Date("2026-01-02T10:00:00.000Z") }),
        ];

        const groups = groupNotifications(rows);

        expect(groups.map((g) => g.key)).toEqual(["follow:read:2026-01-01", "follow:read:2026-01-02"]);
    });

    it("groups like/comment notifications by type:refId", () => {
        const rows = [
            makeRow({ id: "1", type: "like", refId: "post-1", actorId: "a1" }),
            makeRow({ id: "2", type: "like", refId: "post-1", actorId: "a2" }),
            makeRow({ id: "3", type: "comment", refId: "post-1", actorId: "a3" }),
        ];

        const groups = groupNotifications(rows);

        expect(groups).toHaveLength(2);
        expect(groups.find((g) => g.key === "like:post-1")?.totalCount).toBe(2);
        expect(groups.find((g) => g.key === "comment:post-1")?.totalCount).toBe(1);
    });

    it("counts distinct actorIds and computes othersCount = totalCount - 1", () => {
        const rows = [
            makeRow({ id: "1", type: "like", refId: "post-1", actorId: "a1" }),
            makeRow({ id: "2", type: "like", refId: "post-1", actorId: "a2" }),
            makeRow({ id: "3", type: "like", refId: "post-1", actorId: "a3" }),
        ];

        const [group] = groupNotifications(rows);

        expect(group.totalCount).toBe(3);
        expect(group.othersCount).toBe(2);
    });

    it("does not duplicate an actorId that appears more than once in the same group", () => {
        const rows = [
            makeRow({ id: "1", type: "like", refId: "post-1", actorId: "a1" }),
            makeRow({ id: "2", type: "like", refId: "post-1", actorId: "a1" }),
        ];

        const [group] = groupNotifications(rows);

        expect(group.actorIds).toEqual(["a1"]);
        expect(group.totalCount).toBe(1);
        expect(group.othersCount).toBe(0);
    });

    it("marks a group as read only when ALL its notifications are read", () => {
        const allRead = groupNotifications([
            makeRow({ id: "1", type: "like", refId: "post-1", read: true }),
            makeRow({ id: "2", type: "like", refId: "post-1", read: true }),
        ]);
        expect(allRead[0].read).toBe(true);

        const mixed = groupNotifications([
            makeRow({ id: "1", type: "like", refId: "post-2", read: true }),
            makeRow({ id: "2", type: "like", refId: "post-2", read: false }),
        ]);
        expect(mixed[0].read).toBe(false);
    });

    it("preserves first-occurrence order of groups", () => {
        const rows = [
            makeRow({ id: "1", type: "like", refId: "post-2", actorId: "a1" }),
            makeRow({ id: "2", type: "like", refId: "post-1", actorId: "a2" }),
            makeRow({ id: "3", type: "like", refId: "post-2", actorId: "a3" }),
        ];

        const groups = groupNotifications(rows);

        expect(groups.map((g) => g.key)).toEqual(["like:post-2", "like:post-1"]);
    });
});
