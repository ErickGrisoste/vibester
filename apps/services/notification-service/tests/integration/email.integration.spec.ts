import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

vi.mock("../../src/config/redis", async () => {
    const { default: RedisMock } = await import("ioredis-mock");
    const redisMock = new RedisMock();
    return {
        redis: redisMock,
        cacheAside: async <T>(_key: string, _ttl: number, fetchFn: () => Promise<T>): Promise<T> => fetchFn(),
    };
});

const { mockCreateTwoFactor, mockFindFirstTwoFactor, mockUpdateManyTwoFactor } = vi.hoisted(() => ({
    mockCreateTwoFactor: vi.fn(),
    mockFindFirstTwoFactor: vi.fn(),
    mockUpdateManyTwoFactor: vi.fn(),
}));

vi.mock("../../src/prisma/index", () => ({
    default: {
        twoFactorCode: {
            create: mockCreateTwoFactor,
            findFirst: mockFindFirstTwoFactor,
            updateMany: mockUpdateManyTwoFactor,
        },
        $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    },
}));

const { mockRenderTemplate, mockEnqueueEmail } = vi.hoisted(() => ({
    mockRenderTemplate: vi.fn(),
    mockEnqueueEmail: vi.fn(),
}));

vi.mock("../../src/services/templateRenderer.service", () => ({
    renderTemplate: mockRenderTemplate,
}));

vi.mock("../../src/workers/email.worker", () => ({
    enqueueEmail: mockEnqueueEmail,
}));

import { buildServer } from "../helpers/fastify.test.helper";

describe("notification-service — HTTP Integration (/notifications email)", () => {
    let app: Awaited<ReturnType<typeof buildServer>>;

    beforeAll(async () => {
        app = await buildServer();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockRenderTemplate.mockResolvedValue("<html>rendered</html>");
        mockCreateTwoFactor.mockResolvedValue(undefined);
        mockFindFirstTwoFactor.mockResolvedValue(null);
        mockUpdateManyTwoFactor.mockResolvedValue({ count: 1 });
    });

    describe("POST /notifications/email", () => {
        it("retorna 200 e chama enqueueEmail com to/subject/message", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/notifications/email",
                payload: { to: "user@example.com", subject: "Hi", message: "body" },
            });

            expect(res.statusCode).toBe(200);
            expect(mockEnqueueEmail).toHaveBeenCalledWith({
                to: "user@example.com",
                subject: "Hi",
                message: "body",
            });
        });

        it("aplica subject padrão 'Notificação Vibester' quando omitido", async () => {
            await app.inject({
                method: "POST",
                url: "/notifications/email",
                payload: { to: "user@example.com" },
            });

            expect(mockEnqueueEmail).toHaveBeenCalledWith(
                expect.objectContaining({ subject: "Notificação Vibester" }),
            );
        });

        it("retorna 400 para 'to' com email inválido", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/notifications/email",
                payload: { to: "not-an-email" },
            });

            expect(res.statusCode).toBe(400);
        });
    });

    describe("POST /notifications/reset-password", () => {
        it("retorna 202, chama renderTemplate e enqueueEmail", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/notifications/reset-password",
                payload: { name: "Ana", to: "user@example.com", resetLink: "https://vibester.com.br/reset/abc" },
            });

            expect(res.statusCode).toBe(202);
            expect(mockRenderTemplate).toHaveBeenCalledWith("reset_password.html", {
                name: "Ana",
                resetLink: "https://vibester.com.br/reset/abc",
            });
            expect(mockEnqueueEmail).toHaveBeenCalledWith(
                expect.objectContaining({ to: "user@example.com", subject: "Recuperação de Senha" }),
            );
        });
    });

    describe("POST /notifications/welcome", () => {
        it("retorna 202, chama renderTemplate e enqueueEmail", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/notifications/welcome",
                payload: { name: "Ana", to: "user@example.com" },
            });

            expect(res.statusCode).toBe(202);
            expect(mockRenderTemplate).toHaveBeenCalledWith("welcome.html", {
                name: "Ana",
                platformLink: "https://vibester.com.br",
            });
            expect(mockEnqueueEmail).toHaveBeenCalled();
        });
    });

    describe("POST /notifications/2fa", () => {
        it("retorna 202, persiste código e enfileira email", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/notifications/2fa",
                payload: { name: "Ana", to: "user@example.com" },
            });

            expect(res.statusCode).toBe(202);
            expect(mockCreateTwoFactor).toHaveBeenCalledTimes(1);
            expect(mockEnqueueEmail).toHaveBeenCalled();
        });
    });

    describe("POST /notifications/2fa/validate", () => {
        it("retorna 200 {valid:true} e marca o código como usado quando válido", async () => {
            mockFindFirstTwoFactor.mockResolvedValue({ id: "code-1" });

            const res = await app.inject({
                method: "POST",
                url: "/notifications/2fa/validate",
                payload: { email: "user@example.com", code: "123456" },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ valid: true });
            expect(mockUpdateManyTwoFactor).toHaveBeenCalledTimes(1);
        });

        it("retorna 401 {valid:false} e NÃO marca como usado quando o código não é encontrado", async () => {
            mockFindFirstTwoFactor.mockResolvedValue(null);

            const res = await app.inject({
                method: "POST",
                url: "/notifications/2fa/validate",
                payload: { email: "user@example.com", code: "000000" },
            });

            expect(res.statusCode).toBe(401);
            expect(JSON.parse(res.payload)).toEqual({ valid: false });
            expect(mockUpdateManyTwoFactor).not.toHaveBeenCalled();
        });

        it("retorna 400 para body inválido", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/notifications/2fa/validate",
                payload: { email: "not-an-email", code: "" },
            });

            expect(res.statusCode).toBe(400);
        });

        it("retorna 500 quando o Prisma lança", async () => {
            mockFindFirstTwoFactor.mockRejectedValue(new Error("db down"));

            const res = await app.inject({
                method: "POST",
                url: "/notifications/2fa/validate",
                payload: { email: "user@example.com", code: "123456" },
            });

            expect(res.statusCode).toBe(500);
        });
    });
});
