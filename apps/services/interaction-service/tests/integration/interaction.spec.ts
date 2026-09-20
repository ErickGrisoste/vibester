import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

/**
 * O produtor Kafka é mockado: não há broker nos testes (mesma decisão do
 * post-service). O caminho real API -> Kafka -> worker é validado manualmente,
 * conforme o roteiro de verificação do PR.
 */
const publishInteractions = vi.fn(async () => { });
const isProducerConnected = vi.fn(() => true);

vi.mock("../../src/kafka/producer", () => ({
    publishInteractions: (...args: unknown[]) => publishInteractions(...(args as [])),
    isProducerConnected: () => isProducerConnected(),
    connectProducer: async () => { },
    disconnectProducer: async () => { },
}));

const { buildServer, signToken } = await import("../helpers/fastify.test.helper");

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_USER_ID = "99999999-9999-4999-8999-999999999999";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

function validEvent(overrides: Record<string, unknown> = {}) {
    return {
        eventId: "33333333-3333-4333-8333-333333333333",
        type: "IMPRESSION",
        itemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        itemType: "POST",
        occurredAt: new Date().toISOString(),
        position: 7,
        dwellMs: 1840,
        source: "FEED",
        ...overrides,
    };
}

describe("POST /interactions", () => {
    let app: FastifyInstance;
    let token: string;

    beforeAll(async () => {
        app = await buildServer();
        token = signToken(app, { userId: AUTH_USER_ID, accountId: ACCOUNT_ID });
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        publishInteractions.mockClear();
    });

    it("aceita um lote válido com 202 e publica com o accountId do token", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: `Bearer ${token}` },
            payload: {
                sessionId: SESSION_ID,
                events: [
                    validEvent(),
                    validEvent({ eventId: "44444444-4444-4444-8444-444444444444", type: "DWELL" }),
                ],
            },
        });

        expect(response.statusCode).toBe(202);
        expect(response.json()).toEqual({ accepted: 2, duplicatesInBatch: 0 });

        const [publishedUserId, interactions] = publishInteractions.mock.calls[0] as unknown as [
            string,
            { userId: string }[]
        ];

        expect(publishedUserId).toBe(ACCOUNT_ID);
        expect(interactions.every((i) => i.userId === ACCOUNT_ID)).toBe(true);
    });

    it("responde 401 sem header de autorização", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            payload: { sessionId: SESSION_ID, events: [validEvent()] },
        });

        expect(response.statusCode).toBe(401);
        expect(publishInteractions).not.toHaveBeenCalled();
    });

    it("responde 401 com token inválido", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: "Bearer token-falso" },
            payload: { sessionId: SESSION_ID, events: [validEvent()] },
        });

        expect(response.statusCode).toBe(401);
    });

    it("responde 401 quando o token não tem accountId", async () => {
        const tokenSemAccount = app.jwt.sign({ userId: AUTH_USER_ID } as never);

        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: `Bearer ${tokenSemAccount}` },
            payload: { sessionId: SESSION_ID, events: [validEvent()] },
        });

        expect(response.statusCode).toBe(401);
    });

    it("rejeita tipo derivado enviado pelo cliente: LIKE vem do Kafka, não do app", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: `Bearer ${token}` },
            payload: { sessionId: SESSION_ID, events: [validEvent({ type: "LIKE" })] },
        });

        expect(response.statusCode).toBe(400);
        expect(publishInteractions).not.toHaveBeenCalled();
    });

    it("rejeita lote acima do teto de eventos", async () => {
        const events = Array.from({ length: 51 }, (_, index) =>
            validEvent({ eventId: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}` })
        );

        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: `Bearer ${token}` },
            payload: { sessionId: SESSION_ID, events },
        });

        expect(response.statusCode).toBe(400);
    });

    it("rejeita payload sem sessionId", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: `Bearer ${token}` },
            payload: { events: [validEvent()] },
        });

        expect(response.statusCode).toBe(400);
    });

    it("rejeita occurredAt no futuro", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: `Bearer ${token}` },
            payload: {
                sessionId: SESSION_ID,
                events: [validEvent({ occurredAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() })],
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it("rejeita occurredAt mais antigo que a janela permitida", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: `Bearer ${token}` },
            payload: {
                sessionId: SESSION_ID,
                events: [validEvent({ occurredAt: "2020-01-01T00:00:00.000Z" })],
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it("conta duplicata de eventId dentro do lote sem rejeitar a requisição", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/interactions",
            headers: { authorization: `Bearer ${token}` },
            payload: { sessionId: SESSION_ID, events: [validEvent(), validEvent()] },
        });

        expect(response.statusCode).toBe(202);
        expect(response.json()).toEqual({ accepted: 1, duplicatesInBatch: 1 });
    });
});

describe("probes", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildServer();
    });

    afterAll(async () => {
        await app.close();
    });

    it("/health responde 200 sem checar dependência", async () => {
        const response = await app.inject({ method: "GET", url: "/health" });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ status: "ok" });
    });

    it("/ready responde 200 quando o produtor está conectado", async () => {
        isProducerConnected.mockReturnValueOnce(true);

        const response = await app.inject({ method: "GET", url: "/ready" });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ status: "ready", kafka: true });
    });

    it("/ready responde 503 quando o produtor está desconectado", async () => {
        isProducerConnected.mockReturnValueOnce(false);

        const response = await app.inject({ method: "GET", url: "/ready" });

        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({ status: "not-ready", kafka: false });
    });
});
