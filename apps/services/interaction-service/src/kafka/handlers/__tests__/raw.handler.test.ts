import { describe, expect, it } from "vitest";
import { mapRawMessage } from "../raw.handler";
import { NormalizedInteraction } from "../../../types/interaction.types";

const VALID_INTERACTION: NormalizedInteraction = {
    userId: "11111111-1111-4111-8111-111111111111",
    eventId: "33333333-3333-4333-8333-333333333333",
    type: "IMPRESSION",
    itemId: "post-1",
    itemType: "POST",
    occurredAt: "2026-09-11T23:04:12.512Z",
    sessionId: "22222222-2222-4222-8222-222222222222",
    position: 7,
    dwellMs: 1840,
    source: "FEED",
};

function envelope(interactions: unknown[]): string {
    return JSON.stringify({ v: 1, interactions });
}

describe("mapRawMessage", () => {
    it("devolve as interações de um envelope válido", () => {
        const result = mapRawMessage(envelope([VALID_INTERACTION]));

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ type: "IMPRESSION", position: 7 });
    });

    it("devolve lista vazia para JSON inválido em vez de lançar", () => {
        expect(mapRawMessage("{isso nao e json")).toEqual([]);
    });

    it("devolve lista vazia quando a versão do envelope não é conhecida", () => {
        expect(mapRawMessage(JSON.stringify({ v: 2, interactions: [VALID_INTERACTION] }))).toEqual([]);
    });

    it("rejeita o envelope inteiro se alguma interação estiver malformada", () => {
        expect(mapRawMessage(envelope([VALID_INTERACTION, { type: "IMPRESSION" }]))).toEqual([]);
    });

    it("aceita interação de tipo derivado, porque o worker também persiste LIKE e FOLLOW", () => {
        const result = mapRawMessage(envelope([{ ...VALID_INTERACTION, type: "LIKE" }]));

        expect(result[0]?.type).toBe("LIKE");
    });

    it("não aplica a janela de frescor da API: evento antigo represado no tópico é aceito", () => {
        const result = mapRawMessage(
            envelope([{ ...VALID_INTERACTION, occurredAt: "2020-01-01T00:00:00.000Z" }])
        );

        expect(result).toHaveLength(1);
    });
});
