import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { mockProducerSend } = vi.hoisted(() => ({
    mockProducerSend: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/kafka/producer", () => ({
    producer: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        send: mockProducerSend,
    },
}));

import prismaClient from "../../src/prisma/index";
import { redis } from "../../src/config/redis";
import { buildServer } from "../helpers/fastify.test.helper";

const BASE_PAYLOAD = {
    username: "testuser",
    name: "Test User",
    email: "test@example.com",
    password: "senha123",
    bornAt: "1998-05-20",
};

// O código em texto puro não é mais persistido no Redis (só o HMAC, ver
// email-verification.service.ts) — quem "recebe" o código de verdade é o
// evento Kafka publicado para o notification-service, então é de lá que o
// teste precisa ler pra simular o que o usuário veria no email.
function getEmittedCode(email: string): string {
    const call = mockProducerSend.mock.calls
        .map(([args]) => JSON.parse(args.messages[0].value) as { email: string; code: string })
        .reverse()
        .find((msg) => msg.email === email);
    if (!call) throw new Error(`Nenhum código emitido via Kafka para ${email}`);
    return call.code;
}

async function getPendingCode(email: string): Promise<{ codeHash?: string; passwordHash: string; username: string }> {
    const raw = await redis.get(`pending:reg:${email}`);
    if (!raw) throw new Error(`Nenhum registro pendente para ${email}`);
    return JSON.parse(raw);
}

async function completeRegistration(app: any, payload: typeof BASE_PAYLOAD) {
    await app.inject({ method: "POST", url: "/register", payload });
    const code = getEmittedCode(payload.email);
    return app.inject({
        method: "POST",
        url: "/verify-email",
        payload: { email: payload.email, code },
    });
}

describe("auth-service — HTTP Integration (Postgres real)", () => {
    let app: Awaited<ReturnType<typeof buildServer>>;

    beforeAll(async () => {
        await redis.connect();
        app = await buildServer();
    });

    afterAll(async () => {
        await app.close();
        await redis.disconnect();
        await prismaClient.$disconnect();
    });

    beforeEach(async () => {
        await prismaClient.access.deleteMany();
        mockProducerSend.mockClear();
        mockFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ accountId: "profile-acc-uuid" }),
        });
    });

    describe("POST /register", () => {
        it("retorna 202 e armazena o registro pendente no Redis", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/register",
                payload: BASE_PAYLOAD,
            });

            expect(res.statusCode).toBe(202);
            const body = JSON.parse(res.payload);
            expect(body).toHaveProperty("message");

            const pending = await getPendingCode(BASE_PAYLOAD.email);
            expect(pending).toHaveProperty("codeHash");
            expect(pending.username).toBe("testuser");

            const code = getEmittedCode(BASE_PAYLOAD.email);
            expect(code).toHaveLength(6);
        });

        it("retorna 409 quando email ou username já existe (conta confirmada)", async () => {
            await completeRegistration(app, BASE_PAYLOAD);

            const res = await app.inject({
                method: "POST",
                url: "/register",
                payload: { ...BASE_PAYLOAD, email: "outro@example.com" },
            });

            expect(res.statusCode).toBe(409);
        });
    });

    describe("POST /verify-email", () => {
        it("cria conta e persiste no banco após verificação", async () => {
            await app.inject({ method: "POST", url: "/register", payload: BASE_PAYLOAD });

            const code = getEmittedCode(BASE_PAYLOAD.email);

            const res = await app.inject({
                method: "POST",
                url: "/verify-email",
                payload: { email: BASE_PAYLOAD.email, code },
            });

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.payload);
            expect(body).toHaveProperty("authId");
            expect(body).toHaveProperty("accountId", "profile-acc-uuid");
            expect(body.username).toBe("testuser");
            expect(body.email).toBe("test@example.com");

            const row = await prismaClient.access.findFirst({ where: { username: "testuser" } });
            expect(row).not.toBeNull();
            expect(row?.email).toBe("test@example.com");
        });

        it("faz hash da senha antes de persistir", async () => {
            await app.inject({ method: "POST", url: "/register", payload: BASE_PAYLOAD });

            const pending = await getPendingCode(BASE_PAYLOAD.email);
            expect(pending.passwordHash).not.toBe("senha123");
            expect(pending.passwordHash).toMatch(/^\$2[aby]\$.{56}$/);

            const code = getEmittedCode(BASE_PAYLOAD.email);
            await app.inject({
                method: "POST",
                url: "/verify-email",
                payload: { email: BASE_PAYLOAD.email, code },
            });

            const row = await prismaClient.access.findFirst({ where: { username: "testuser" } });
            expect(row?.passwordHash).toMatch(/^\$2[aby]\$.{56}$/);
        });

        it("retorna 422 quando o código é inválido", async () => {
            await app.inject({ method: "POST", url: "/register", payload: BASE_PAYLOAD });

            const res = await app.inject({
                method: "POST",
                url: "/verify-email",
                payload: { email: BASE_PAYLOAD.email, code: "000000" },
            });

            expect(res.statusCode).toBe(422);
        });

        it("retorna 404 quando não há verificação pendente", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/verify-email",
                payload: { email: "naoexiste@example.com", code: "123456" },
            });

            expect(res.statusCode).toBe(404);
        });

        it("retorna 502 e não persiste quando user-service falha", async () => {
            mockFetch.mockResolvedValueOnce({ ok: false });

            await app.inject({ method: "POST", url: "/register", payload: BASE_PAYLOAD });
            const code = getEmittedCode(BASE_PAYLOAD.email);

            const res = await app.inject({
                method: "POST",
                url: "/verify-email",
                payload: { email: BASE_PAYLOAD.email, code },
            });

            expect(res.statusCode).toBe(502);

            const row = await prismaClient.access.findFirst({ where: { username: "testuser" } });
            expect(row).toBeNull();
        });
    });
});
