import { describe, expect, it, vi } from "vitest";
import { InteractionConsumer } from "../consumer";
import type { InteractionRepository } from "../../repository/interaction.repository";
import { NormalizedInteraction } from "../../types/interaction.types";

const KAFKA_TS = String(new Date("2026-09-12T02:00:00.000Z").getTime());

function build() {
    const order: string[] = [];

    const repository = {
        insertMany: vi.fn(async () => { order.push("insert"); }),
    } as unknown as InteractionRepository;

    const publish = vi.fn(async (_interactions: NormalizedInteraction[]) => {
        order.push("publish");
    });

    return { consumer: new InteractionConsumer(repository, publish), repository, publish, order };
}

const RAW_ENVELOPE = JSON.stringify({
    v: 1,
    interactions: [
        {
            userId: "11111111-1111-4111-8111-111111111111",
            eventId: "33333333-3333-4333-8333-333333333333",
            type: "IMPRESSION",
            itemId: "post-1",
            itemType: "POST",
            occurredAt: "2026-09-12T02:00:00.000Z",
            authorId: "autor-1",
            sessionId: "22222222-2222-4222-8222-222222222222",
            position: 0,
            dwellMs: 4200,
            source: "FEED",
        },
    ],
});

describe("InteractionConsumer.processMessage", () => {
    it("republica curtida vinda do post-service — regressão do sinal que nunca chegava ao ranking", async () => {
        // Antes desta correção, post.liked era persistido aqui e morria: a API rejeita
        // LIKE em interactions.raw, e nenhum outro caminho levava a curtida ao feed-service.
        const { consumer, publish } = build();

        await consumer.processMessage(
            "post.liked",
            JSON.stringify({
                postId: "post-1",
                postOwnerId: "autor-1",
                likedByUserId: "leitor-1",
                createdAt: "2026-09-12T02:00:00.000Z",
            }),
            KAFKA_TS
        );

        expect(publish).toHaveBeenCalledTimes(1);
        const [publicadas] = publish.mock.calls[0]!;
        expect(publicadas).toHaveLength(1);
        expect(publicadas[0]).toMatchObject({
            type: "LIKE",
            userId: "leitor-1",
            itemId: "post-1",
            authorId: "autor-1",
        });
    });

    it("republica também os sinais do cliente, para o stream canônico ser completo", async () => {
        const { consumer, publish } = build();

        const processadas = await consumer.processMessage("interactions.raw", RAW_ENVELOPE, KAFKA_TS);

        expect(processadas).toBe(1);
        expect(publish.mock.calls[0]![0][0]).toMatchObject({ type: "IMPRESSION", dwellMs: 4200 });
    });

    it("persiste ANTES de publicar", async () => {
        const { consumer, order } = build();

        await consumer.processMessage("interactions.raw", RAW_ENVELOPE, KAFKA_TS);

        expect(order).toEqual(["insert", "publish"]);
    });

    it("não persiste nem publica mensagem inválida", async () => {
        const { consumer, repository, publish } = build();

        const processadas = await consumer.processMessage("interactions.raw", "{lixo", KAFKA_TS);

        expect(processadas).toBe(0);
        expect(repository.insertMany).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
    });

    it("ignora tópico desconhecido", async () => {
        const { consumer, publish } = build();

        expect(await consumer.processMessage("topico.qualquer", "{}", KAFKA_TS)).toBe(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it("propaga falha de publicação, para o Kafka reentregar a mensagem de origem", async () => {
        const { consumer, publish, repository } = build();
        publish.mockRejectedValueOnce(new Error("broker fora"));

        await expect(
            consumer.processMessage("interactions.raw", RAW_ENVELOPE, KAFKA_TS)
        ).rejects.toThrow("broker fora");

        // A persistência já aconteceu; a reentrega a refaz de forma idempotente.
        expect(repository.insertMany).toHaveBeenCalledTimes(1);
    });

    it("não publica quando a persistência falha", async () => {
        const { consumer, publish, repository } = build();
        (repository.insertMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("cassandra fora"));

        await expect(
            consumer.processMessage("interactions.raw", RAW_ENVELOPE, KAFKA_TS)
        ).rejects.toThrow("cassandra fora");

        // Publicar algo que não foi gravado deixaria o ranking à frente do log.
        expect(publish).not.toHaveBeenCalled();
    });
});
