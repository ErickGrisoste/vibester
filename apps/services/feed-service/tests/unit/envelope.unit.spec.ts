import { describe, expect, it } from "vitest";
import { unwrapEventData } from "../../src/kafka/envelope";
import { postLikedSchema } from "../../src/schema/events/post-liked.schema";
import { postUnlikedSchema } from "../../src/schema/events/post-unliked.schema";
import { followSchema } from "../../src/schema/events/follow.schema";

const postId = "c6ff9f8c-6ab2-4276-9739-ced6dd836312";
const likerId = "b5a40662-90e9-42e8-808d-f8194c3ce630";
const ownerId = "a70fa5d1-0847-4797-866a-e6b6155954d0";

const envelope = (eventType: string, data: unknown) => ({
    eventId: "0c5e7d8a-1f1b-4a57-9a38-5b8a3a0d2f10",
    eventType,
    occurredAt: "2026-09-13T12:00:00.000Z",
    data,
});

describe("unwrapEventData", () => {
    it("desembrulha post.liked publicado pelo post-service (publishEvent)", () => {
        const raw = envelope("post.liked", { postId, postOwnerId: ownerId, likedByUserId: likerId });

        expect(postLikedSchema.parse(unwrapEventData(raw)).userId).toBe(likerId);
    });

    it("desembrulha post.unliked publicado pelo post-service", () => {
        const raw = envelope("post.unliked", { postId, userId: likerId, createdAt: "2026-09-13T12:00:00.000Z" });

        expect(postUnlikedSchema.parse(unwrapEventData(raw))).toMatchObject({ postId, userId: likerId });
    });

    it("mantém payload solto como está (user.followed do user-service)", () => {
        const raw = { followerId: likerId, followedId: ownerId };

        expect(unwrapEventData(raw)).toBe(raw);
        expect(() => followSchema.parse(unwrapEventData(raw))).not.toThrow();
    });
});
