import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

vi.mock("../../src/config/redis", async () => {
    const { default: RedisMock } = await import("ioredis-mock");
    const redisMock = new RedisMock();
    return {
        redis: redisMock,
        cacheAside: async <T>(_key: string, _ttl: number, fetchFn: () => Promise<T>): Promise<T> => fetchFn(),
    };
});

const { mockFindMany, mockUpdateManyNotification, mockQueryRaw } = vi.hoisted(() => ({
    mockFindMany: vi.fn(),
    mockUpdateManyNotification: vi.fn(),
    mockQueryRaw: vi.fn(),
}));

vi.mock("../../src/prisma/index", () => ({
    default: {
        notification: {
            findMany: mockFindMany,
            updateMany: mockUpdateManyNotification,
        },
        $queryRaw: mockQueryRaw,
    },
}));

const { mockGetProfile, mockGetPost } = vi.hoisted(() => ({
    mockGetProfile: vi.fn(),
    mockGetPost: vi.fn(),
}));

vi.mock("../../src/clients/user.client", () => ({
    UserClient: class {
        getProfile = mockGetProfile;
    },
}));

vi.mock("../../src/clients/post.client", () => ({
    PostClient: class {
        getPost = mockGetPost;
    },
}));

import { buildServer, generateToken } from "../helpers/fastify.test.helper";

const RECIPIENT_ID = "recipient-1";

function makeRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "row-1",
        type: "like",
        recipientId: RECIPIENT_ID,
        actorId: "actor-1",
        refId: "post-1",
        content: null,
        read: false,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        ...overrides,
    };
}

describe("notification-service — HTTP Integration (/notifications)", () => {
    let app: Awaited<ReturnType<typeof buildServer>>;
    let token: string;

    beforeAll(async () => {
        app = await buildServer();
        token = generateToken(app, RECIPIENT_ID);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockFindMany.mockResolvedValue([]);
        mockUpdateManyNotification.mockResolvedValue({ count: 0 });
        mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
        mockGetProfile.mockResolvedValue({ accountId: "actor-1", name: "A", username: "a", avatarUrl: "" });
        mockGetPost.mockResolvedValue({ postId: "post-1", imageUrl: "", caption: "c", isDeleted: false });
    });

    describe("GET /health", () => {
        it("retorna 200 com status de db e redis quando ambos estão disponíveis", async () => {
            const res = await app.inject({ method: "GET", url: "/health" });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body).toMatchObject({ status: "ok", db: "ok", redis: "ok" });
        });

        it("retorna 503 e status db=unavailable quando o Postgres está indisponível", async () => {
            mockQueryRaw.mockRejectedValueOnce(new Error("DB down"));

            const res = await app.inject({ method: "GET", url: "/health" });

            expect(res.statusCode).toBe(503);
            expect(JSON.parse(res.payload)).toMatchObject({ status: "degraded", db: "unavailable" });
        });
    });

    describe("GET /notifications", () => {
        it("retorna 401 sem token", async () => {
            const res = await app.inject({ method: "GET", url: "/notifications" });
            expect(res.statusCode).toBe(401);
        });

        it("retorna 200 com items e nextCursor quando autenticado", async () => {
            mockFindMany.mockResolvedValue([makeRow()]);

            const res = await app.inject({
                method: "GET",
                url: "/notifications",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.items).toHaveLength(1);
            expect(body).toHaveProperty("nextCursor");
        });

        it("aplica paginação por cursor via querystring 'before'", async () => {
            mockFindMany.mockResolvedValue([]);

            const res = await app.inject({
                method: "GET",
                url: "/notifications?before=2026-01-05T00:00:00.000Z",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            const callArg = mockFindMany.mock.calls[0][0];
            expect(callArg.where.createdAt).toEqual({ lt: new Date("2026-01-05T00:00:00.000Z") });
        });

        it("agrupa notificações do mesmo tipo/post na resposta", async () => {
            mockFindMany.mockResolvedValue([
                makeRow({ id: "1", actorId: "a1" }),
                makeRow({ id: "2", actorId: "a2" }),
            ]);

            const res = await app.inject({
                method: "GET",
                url: "/notifications",
                headers: { authorization: `Bearer ${token}` },
            });

            const body = JSON.parse(res.payload);
            expect(body.items).toHaveLength(1);
            expect(body.items[0].totalCount).toBe(2);
        });

        it("retorna 500 quando o Prisma lança", async () => {
            mockFindMany.mockRejectedValue(new Error("db down"));

            const res = await app.inject({
                method: "GET",
                url: "/notifications",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(500);
        });
    });

    describe("GET /notifications/unread-count", () => {
        it("retorna 401 sem token", async () => {
            const res = await app.inject({ method: "GET", url: "/notifications/unread-count" });
            expect(res.statusCode).toBe(401);
        });

        it("retorna 200 com a contagem de grupos não lidos", async () => {
            mockFindMany.mockResolvedValue([makeRow(), makeRow({ id: "2", actorId: "a2" })]);

            const res = await app.inject({
                method: "GET",
                url: "/notifications/unread-count",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ count: 1 });
        });
    });

    describe("PATCH /notifications/read", () => {
        it("retorna 401 sem token", async () => {
            const res = await app.inject({ method: "PATCH", url: "/notifications/read" });
            expect(res.statusCode).toBe(401);
        });

        it("retorna 200 com {updated: N}", async () => {
            mockUpdateManyNotification.mockResolvedValue({ count: 5 });

            const res = await app.inject({
                method: "PATCH",
                url: "/notifications/read",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ updated: 5 });
        });
    });

    describe("GET /notifications/:userId (legacy, sem auth)", () => {
        it("retorna 200 SEM token — documenta que esta rota não exige autenticação", async () => {
            mockFindMany.mockResolvedValue([]);

            const res = await app.inject({ method: "GET", url: `/notifications/${RECIPIENT_ID}` });

            expect(res.statusCode).toBe(200);
        });

        it("retorna os dados do usuário informado na URL, não do token", async () => {
            mockFindMany.mockResolvedValue([makeRow({ recipientId: "other-user" })]);

            const res = await app.inject({
                method: "GET",
                url: "/notifications/other-user",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            const callArg = mockFindMany.mock.calls[0][0];
            expect(callArg.where.recipientId).toBe("other-user");
        });
    });

    describe("GET /notifications/:userId/unread-count (legacy, sem auth)", () => {
        it("retorna 200 SEM token", async () => {
            mockFindMany.mockResolvedValue([]);

            const res = await app.inject({ method: "GET", url: `/notifications/${RECIPIENT_ID}/unread-count` });

            expect(res.statusCode).toBe(200);
        });
    });

    describe("PATCH /notifications/:userId/read (legacy, sem auth)", () => {
        it("retorna 200 SEM token", async () => {
            mockUpdateManyNotification.mockResolvedValue({ count: 0 });

            const res = await app.inject({ method: "PATCH", url: `/notifications/${RECIPIENT_ID}/read` });

            expect(res.statusCode).toBe(200);
        });
    });
});
