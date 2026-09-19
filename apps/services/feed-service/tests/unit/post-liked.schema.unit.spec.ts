import { describe, expect, it } from "vitest";
import { postLikedSchema } from "../../src/schema/events/post-liked.schema";

const postId = "c6ff9f8c-6ab2-4276-9739-ced6dd836312";
const likerId = "b5a40662-90e9-42e8-808d-f8194c3ce630";
const ownerId = "a70fa5d1-0847-4797-866a-e6b6155954d0";

describe("postLikedSchema", () => {
    it("aceita o payload real do post-service (likedByUserId) e expõe userId", () => {
        const event = postLikedSchema.parse({
            postId,
            postOwnerId: ownerId,
            likedByUserId: likerId,
            createdAt: "2026-09-13T12:00:00.000Z",
        });

        expect(event).toEqual({
            postId,
            userId: likerId,
            createdAt: "2026-09-13T12:00:00.000Z",
        });
    });

    it("aceita userId como reserva para eventos antigos", () => {
        expect(postLikedSchema.parse({ postId, userId: likerId }).userId).toBe(likerId);
    });

    it("prefere likedByUserId quando os dois vêm", () => {
        expect(
            postLikedSchema.parse({ postId, likedByUserId: likerId, userId: ownerId }).userId,
        ).toBe(likerId);
    });

    it("rejeita evento sem quem curtiu", () => {
        expect(() => postLikedSchema.parse({ postId, postOwnerId: ownerId })).toThrow();
    });
});
