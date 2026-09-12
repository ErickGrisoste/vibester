import { describe, expect, it, vi } from "vitest";
import { InteractionService } from "../interaction.service";
import { NormalizedInteraction } from "../../types/interaction.types";
import { InteractionBatchInput } from "../../schema/interaction.schema";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_USER_ID = "99999999-9999-4999-8999-999999999999";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

function buildBatch(events: Partial<InteractionBatchInput["events"][number]>[]): InteractionBatchInput {
    return {
        sessionId: SESSION_ID,
        events: events.map((event, index) => ({
            eventId: event.eventId ?? `33333333-3333-4333-8333-00000000000${index}`,
            type: event.type ?? "IMPRESSION",
            itemId: event.itemId ?? "post-1",
            itemType: event.itemType ?? "POST",
            occurredAt: event.occurredAt ?? "2026-09-11T23:04:12.512Z",
            authorId: event.authorId,
            position: event.position,
            dwellMs: event.dwellMs,
            source: event.source,
        })),
    } as InteractionBatchInput;
}

function buildService() {
    const publish = vi.fn<(userId: string, interactions: NormalizedInteraction[]) => Promise<void>>(
        async () => { }
    );
    const service = new InteractionService(publish);

    return { service, publish };
}

describe("InteractionService.ingest", () => {
    it("grava o accountId do token como userId, nunca o userId do token", async () => {
        const { service, publish } = buildService();

        await service.ingest(ACCOUNT_ID, buildBatch([{}]));

        const [userIdKey, interactions] = publish.mock.calls[0]!;

        expect(userIdKey).toBe(ACCOUNT_ID);
        expect(interactions[0]!.userId).toBe(ACCOUNT_ID);
        expect(interactions[0]!.userId).not.toBe(AUTH_USER_ID);
    });

    it("descarta eventId repetido dentro do mesmo lote", async () => {
        const { service, publish } = buildService();
        const duplicated = "44444444-4444-4444-8444-444444444444";

        const result = await service.ingest(
            ACCOUNT_ID,
            buildBatch([
                { eventId: duplicated },
                { eventId: duplicated },
                { eventId: "55555555-5555-4555-8555-555555555555" },
            ])
        );

        expect(result.accepted).toBe(2);
        expect(result.duplicatesInBatch).toBe(1);
        expect(publish.mock.calls[0]![1]).toHaveLength(2);
    });

    it("preenche campos opcionais ausentes com null em vez de undefined", async () => {
        const { service, publish } = buildService();

        await service.ingest(ACCOUNT_ID, buildBatch([{}]));

        const interaction = publish.mock.calls[0]![1][0]!;

        expect(interaction.position).toBeNull();
        expect(interaction.dwellMs).toBeNull();
        expect(interaction.source).toBeNull();
    });

    it("propaga os campos opcionais quando o cliente os envia", async () => {
        const { service, publish } = buildService();

        await service.ingest(
            ACCOUNT_ID,
            buildBatch([{ type: "DWELL", position: 7, dwellMs: 1840, source: "FEED" }])
        );

        const interaction = publish.mock.calls[0]![1][0]!;

        expect(interaction).toMatchObject({
            type: "DWELL",
            position: 7,
            dwellMs: 1840,
            source: "FEED",
            sessionId: SESSION_ID,
        });
    });

    it("propaga o authorId enviado pelo cliente", async () => {
        const { service, publish } = buildService();

        await service.ingest(ACCOUNT_ID, buildBatch([{ authorId: "autor-1" }]));

        expect(publish.mock.calls[0]![1][0]!.authorId).toBe("autor-1");
    });

    it("grava authorId null quando o cliente não envia, sem impedir a ingestão", async () => {
        const { service, publish } = buildService();

        const result = await service.ingest(ACCOUNT_ID, buildBatch([{}]));

        expect(result.accepted).toBe(1);
        expect(publish.mock.calls[0]![1][0]!.authorId).toBeNull();
    });

    it("normaliza occurredAt para ISO em UTC", async () => {
        const { service, publish } = buildService();

        await service.ingest(
            ACCOUNT_ID,
            buildBatch([{ occurredAt: "2026-09-11T20:04:12.512-03:00" }])
        );

        expect(publish.mock.calls[0]![1][0]!.occurredAt).toBe("2026-09-11T23:04:12.512Z");
    });

    it("não publica nada quando o lote não gera nenhuma interação", async () => {
        const { service, publish } = buildService();

        const result = await service.ingest(ACCOUNT_ID, { sessionId: SESSION_ID, events: [] });

        expect(result.accepted).toBe(0);
        expect(publish).not.toHaveBeenCalled();
    });
});
