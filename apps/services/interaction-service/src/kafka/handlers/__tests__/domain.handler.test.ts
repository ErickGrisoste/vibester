import { describe, expect, it } from "vitest";
import { mapDomainEvent } from "../domain.handler";

const KAFKA_TS = new Date("2026-09-11T23:30:00.000Z");
const LIKER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const POST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("mapDomainEvent", () => {
    it("mapeia post.liked usando likedByUserId, que é o campo que o post-service publica hoje", () => {
        const interaction = mapDomainEvent(
            "post.liked",
            {
                postId: POST,
                postOwnerId: "outro-usuario",
                likedByUserId: LIKER,
                createdAt: "2026-09-11T23:04:12.512Z",
            },
            KAFKA_TS
        );

        expect(interaction).toMatchObject({
            type: "LIKE",
            userId: LIKER,
            itemId: POST,
            itemType: "POST",
            occurredAt: "2026-09-11T23:04:12.512Z",
        });
    });

    it("aceita post.liked com userId, para sobreviver à correção de contrato pendente", () => {
        const interaction = mapDomainEvent(
            "post.liked",
            { postId: POST, userId: LIKER, createdAt: "2026-09-11T23:04:12.512Z" },
            KAFKA_TS
        );

        expect(interaction?.userId).toBe(LIKER);
        expect(interaction?.type).toBe("LIKE");
    });

    it("mapeia post.unliked, que publica userId", () => {
        const interaction = mapDomainEvent(
            "post.unliked",
            { postId: POST, userId: LIKER, createdAt: "2026-09-11T23:04:12.512Z" },
            KAFKA_TS
        );

        expect(interaction).toMatchObject({ type: "UNLIKE", userId: LIKER, itemId: POST });
    });

    it("usa o timestamp da mensagem Kafka quando o payload não traz data (post.commented)", () => {
        const interaction = mapDomainEvent(
            "post.commented",
            { postId: POST, postOwnerId: "dono", commentedByUserId: LIKER, content: "top" },
            KAFKA_TS
        );

        expect(interaction).toMatchObject({ type: "COMMENT", userId: LIKER, itemId: POST });
        expect(interaction?.occurredAt).toBe(KAFKA_TS.toISOString());
    });

    it("mapeia user.followed com o seguido como item", () => {
        const interaction = mapDomainEvent(
            "user.followed",
            { followerId: LIKER, followingId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
            KAFKA_TS
        );

        expect(interaction).toMatchObject({
            type: "FOLLOW",
            userId: LIKER,
            itemId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            itemType: "USER",
        });
    });

    it("não carrega sessão, posição nem dwell: quem publicou não tem essa informação", () => {
        const interaction = mapDomainEvent(
            "post.liked",
            { postId: POST, likedByUserId: LIKER },
            KAFKA_TS
        );

        expect(interaction).toMatchObject({ sessionId: null, position: null, dwellMs: null, source: null });
    });

    it("gera eventId determinístico: o mesmo evento reprocessado produz o mesmo id", () => {
        const payload = { postId: POST, likedByUserId: LIKER, createdAt: "2026-09-11T23:04:12.512Z" };

        const first = mapDomainEvent("post.liked", payload, KAFKA_TS);
        const second = mapDomainEvent("post.liked", payload, new Date("2027-01-01T00:00:00.000Z"));

        expect(first?.eventId).toBe(second?.eventId);
        expect(first?.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("gera eventId diferente para like e unlike do mesmo post", () => {
        const payload = { postId: POST, userId: LIKER, createdAt: "2026-09-11T23:04:12.512Z" };

        const liked = mapDomainEvent("post.liked", payload, KAFKA_TS);
        const unliked = mapDomainEvent("post.unliked", payload, KAFKA_TS);

        expect(liked?.eventId).not.toBe(unliked?.eventId);
    });

    it("devolve null quando falta o ator ou o item, em vez de lançar", () => {
        expect(mapDomainEvent("post.liked", { postId: POST }, KAFKA_TS)).toBeNull();
        expect(mapDomainEvent("post.liked", { likedByUserId: LIKER }, KAFKA_TS)).toBeNull();
        expect(mapDomainEvent("user.followed", { followerId: LIKER }, KAFKA_TS)).toBeNull();
    });

    it("devolve null para payload que não é objeto", () => {
        expect(mapDomainEvent("post.liked", null, KAFKA_TS)).toBeNull();
        expect(mapDomainEvent("post.liked", "texto", KAFKA_TS)).toBeNull();
    });

    it("preenche authorId com o postOwnerId, que é o que habilita afinidade", () => {
        const interaction = mapDomainEvent(
            "post.liked",
            { postId: POST, postOwnerId: "dono-do-post", likedByUserId: LIKER },
            KAFKA_TS
        );

        expect(interaction?.authorId).toBe("dono-do-post");
    });

    it("no follow o autor é o próprio seguido", () => {
        const interaction = mapDomainEvent(
            "user.followed",
            { followerId: LIKER, followingId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
            KAFKA_TS
        );

        expect(interaction?.authorId).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
        expect(interaction?.itemId).toBe(interaction?.authorId);
    });

    it("deixa authorId null quando o produtor não informa, em vez de inventar", () => {
        const interaction = mapDomainEvent(
            "post.commented",
            { postId: POST, commentedByUserId: LIKER },
            KAFKA_TS
        );

        expect(interaction?.authorId).toBeNull();
    });

    it("ignora createdAt inválido e cai no timestamp da mensagem", () => {
        const interaction = mapDomainEvent(
            "post.liked",
            { postId: POST, likedByUserId: LIKER, createdAt: "nao-e-data" },
            KAFKA_TS
        );

        expect(interaction?.occurredAt).toBe(KAFKA_TS.toISOString());
    });
});
