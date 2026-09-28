import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlePostValidationRejectedEvent } from "../postValidationRejected.handler";

const { mockInsertNotification } = vi.hoisted(() => ({
    mockInsertNotification: vi.fn(),
}));

vi.mock("../../../services/insertNotification.service", () => ({
    insertNotification: mockInsertNotification,
}));

function envelope(data: unknown): string {
    return JSON.stringify({
        eventId: "evt-1",
        eventType: "post.validation.rejected",
        occurredAt: "2026-09-20T12:00:00.000Z",
        data,
    });
}

describe("handlePostValidationRejectedEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInsertNotification.mockResolvedValue(undefined);
    });

    it("notifies the author, using the author as actor for a system notification", async () => {
        await handlePostValidationRejectedEvent(
            envelope({
                postId: "post-1",
                authorId: "author-1",
                issues: [{ code: "HATE_SPEECH", field: "content" }],
                validatedAt: "2026-09-20T12:00:00.000Z",
            }),
        );

        expect(mockInsertNotification).toHaveBeenCalledWith(
            "post_rejected",
            "author-1",
            "author-1",
            "post-1",
            expect.stringContaining("diretrizes da comunidade"),
        );
    });

    it("joins every reason into a single message", async () => {
        await handlePostValidationRejectedEvent(
            envelope({
                postId: "post-2",
                authorId: "author-2",
                issues: [
                    { code: "CONTENT_TOO_LONG", field: "content" },
                    { code: "SHORTENED_LINK", field: "content" },
                ],
                validatedAt: "2026-09-20T12:00:00.000Z",
            }),
        );

        const content = mockInsertNotification.mock.calls[0][4];
        expect(content).toContain("limite de caracteres");
        expect(content).toContain("encurtados");
    });

    it("falls back to a generic message for an unknown code", async () => {
        await handlePostValidationRejectedEvent(
            envelope({
                postId: "post-3",
                authorId: "author-3",
                issues: [{ code: "CODIGO_NOVO_QUE_ESTE_SERVICO_AINDA_NAO_CONHECE", field: "content" }],
                validatedAt: "2026-09-20T12:00:00.000Z",
            }),
        );

        expect(mockInsertNotification).toHaveBeenCalledWith(
            "post_rejected",
            "author-3",
            "author-3",
            "post-3",
            expect.stringContaining("diretrizes da comunidade"),
        );
    });

    it("accepts a bare payload without the envelope", async () => {
        await handlePostValidationRejectedEvent(
            JSON.stringify({
                postId: "post-4",
                authorId: "author-4",
                issues: [{ code: "SPAM_SUSPECTED", field: "content" }],
            }),
        );

        expect(mockInsertNotification).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["invalid json", "{ not json"],
        ["missing postId", JSON.stringify({ authorId: "a", issues: [] })],
        ["missing authorId", JSON.stringify({ postId: "p", issues: [] })],
    ])("ignores %s without throwing", async (_label, raw) => {
        await expect(handlePostValidationRejectedEvent(raw)).resolves.toBeUndefined();
        expect(mockInsertNotification).not.toHaveBeenCalled();
    });

    it("does not leak the matched term, because the event never carries it", async () => {
        await handlePostValidationRejectedEvent(
            envelope({
                postId: "post-5",
                authorId: "author-5",
                issues: [{ code: "FORBIDDEN_LANGUAGE", field: "content" }],
                validatedAt: "2026-09-20T12:00:00.000Z",
            }),
        );

        const content = String(mockInsertNotification.mock.calls[0][4]);
        expect(content).toContain("linguagem imprópria");
        expect(content).not.toMatch(/\b(porra|caralho|viado)\b/i);
    });

    /**
     * A revalidação só avisa — o post continua no ar. Dizer "ocultada" seria
     * uma afirmação falsa ao usuário. E como o app só permite excluir (não há
     * edição de legenda), a instrução é essa.
     */
    it("does not claim the post was hidden, and points to the only action available", async () => {
        await handlePostValidationRejectedEvent(
            envelope({
                postId: "post-6",
                authorId: "author-6",
                issues: [{ code: "TOO_MANY_LINKS", field: "content" }],
                validatedAt: "2026-09-26T12:00:00.000Z",
            }),
        );

        const content = String(mockInsertNotification.mock.calls[0][4]);
        expect(content).not.toMatch(/ocultad|removid|escondid/i);
        expect(content).toContain("excluí-la");
        expect(content).toContain("há links demais na publicação");
    });
});
