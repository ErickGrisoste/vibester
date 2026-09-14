import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NormalizedInteraction } from "../../types/interaction.types";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("../client", () => ({
    INTERACTIONS_RAW_TOPIC: "interactions.raw",
    INTERACTIONS_NORMALIZED_TOPIC: "interactions.normalized",
    kafka: {
        producer: () => ({
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            on: vi.fn(),
            send,
        }),
    },
}));

import { connectProducer, disconnectProducer, publishNormalizedInteractions } from "../producer";

function interaction(userId: string, eventId: string): NormalizedInteraction {
    return {
        userId,
        eventId,
        type: "LIKE",
        itemId: "post-1",
        itemType: "POST",
        occurredAt: "2026-09-12T02:00:00.000Z",
        authorId: "autor-1",
        sessionId: null,
        position: null,
        dwellMs: null,
        source: null,
    };
}

describe("publishNormalizedInteractions", () => {
    beforeEach(async () => {
        send.mockReset().mockResolvedValue(undefined);
        await connectProducer();
    });

    afterEach(async () => {
        await disconnectProducer();
    });

    it("publica em interactions.normalized, uma mensagem por pessoa", async () => {
        await publishNormalizedInteractions([
            interaction("pessoa-a", "e1"),
            interaction("pessoa-b", "e2"),
            interaction("pessoa-a", "e3"),
        ]);

        expect(send).toHaveBeenCalledTimes(1);
        const { topic, messages } = send.mock.calls[0]![0];

        expect(topic).toBe("interactions.normalized");
        expect(messages).toHaveLength(2);
    });

    it("usa o userId como chave de partição — teste-cadeado da afinidade decaída", async () => {
        // O feed-service grava afinidade por ler-calcular-gravar. Isso só é seguro porque
        // tudo de uma pessoa cai na mesma partição e é consumido em ordem. Se a chave
        // deixar de ser o userId, dois consumidores podem atualizar o mesmo par ao mesmo
        // tempo e uma interação some em silêncio.
        await publishNormalizedInteractions([
            interaction("pessoa-a", "e1"),
            interaction("pessoa-b", "e2"),
            interaction("pessoa-a", "e3"),
        ]);

        const { messages } = send.mock.calls[0]![0];

        for (const message of messages as { key: string; value: string }[]) {
            const { v, interactions } = JSON.parse(message.value);

            expect(v).toBe(1);
            for (const item of interactions as NormalizedInteraction[]) {
                expect(message.key).toBe(item.userId);
            }
        }
    });

    it("não publica lista vazia", async () => {
        await publishNormalizedInteractions([]);

        expect(send).not.toHaveBeenCalled();
    });

    it("lança sem produtor conectado, para o worker não fazer ack", async () => {
        await disconnectProducer();

        await expect(publishNormalizedInteractions([interaction("pessoa-a", "e1")])).rejects.toThrow(
            /não conectado/
        );
    });
});
