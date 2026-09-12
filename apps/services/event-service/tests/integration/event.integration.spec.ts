import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const isoDateRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const dateReviver = (_k: string, v: unknown) =>
    typeof v === "string" && isoDateRe.test(v) ? new Date(v) : v;

vi.mock("../../src/config/redis", async () => {
    const { default: RedisMock } = await import("ioredis-mock");
    const redisMock = new RedisMock();
    return {
        redis: redisMock,
        cacheAside: async <T>(key: string, ttl: number, fetchFn: () => Promise<T>): Promise<T> => {
            try {
                const cached = await redisMock.get(key);
                if (cached !== null) return JSON.parse(cached, dateReviver) as T;
            } catch {}
            const data = await fetchFn();
            try {
                await redisMock.set(key, JSON.stringify(data), "EX", ttl);
            } catch {}
            return data;
        },
        nearbyKey: (lat: number, lon: number, r: number) =>
            `events:nearby:${Math.round(lat * 100) / 100}:${Math.round(lon * 100) / 100}:${r}`,
        invalidateNearbyCache: async () => {
            const keys = await redisMock.keys("events:nearby:*");
            if (keys.length > 0) await redisMock.del(...keys);
        },
    };
});

const { mockEvent, mockEventCheckIn, mockTransaction, mockQueryRaw } = vi.hoisted(() => ({
    mockEvent: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
    },
    mockEventCheckIn: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn(),
    },
    mockTransaction: vi.fn(),
    mockQueryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
}));

vi.mock("../../src/prisma/index", () => ({
    default: {
        event: mockEvent,
        eventCheckIn: mockEventCheckIn,
        $transaction: mockTransaction,
        $queryRaw: mockQueryRaw,
    },
}));

import { buildServer, generateToken } from "../helpers/fastify.test.helper";
import { redis } from "../../src/config/redis";

const ESTABLISHMENT_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const EVENT_ID = "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

function makeEvent(overrides: Record<string, unknown> = {}) {
    return {
        id: EVENT_ID,
        name: "Show do Rock",
        photoUrl: "https://example.com/photo.jpg",
        category: "music",
        organizer: "Promotora XYZ",
        location: "Rua A, 100",
        informacoes: null,
        startDate: new Date("2026-07-01T20:00:00.000Z"),
        endDate: new Date("2026-07-01T23:00:00.000Z"),
        ticketLink: "https://ingresso.com/show",
        totalConfirmed: 0,
        latitude: -23.5,
        longitude: -46.6,
        isFeatured: false,
        establishmentId: ESTABLISHMENT_ID,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        ...overrides,
    };
}

const CREATE_BODY = {
    name: "Show do Rock",
    photoUrl: "https://example.com/photo.jpg",
    category: "music",
    organizer: "Promotora XYZ",
    location: "Rua A, 100",
    startDate: "2026-07-01T20:00:00.000Z",
    endDate: "2026-07-01T23:00:00.000Z",
    ticketLink: "https://ingresso.com/show",
    latitude: -23.5,
    longitude: -46.6,
    establishmentId: ESTABLISHMENT_ID,
};

describe("event-service — HTTP Integration", () => {
    let app: Awaited<ReturnType<typeof buildServer>>;
    let token: string;

    beforeAll(async () => {
        app = await buildServer();
        token = generateToken(app);
    });
    afterAll(async () => { await app.close(); });
    beforeEach(async () => {
        vi.clearAllMocks();
        mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
        mockTransaction.mockResolvedValue([]);
        await redis.flushall();
    });

    describe("GET /health", () => {
        it("retorna 200 com status de db e redis", async () => {
            const res = await app.inject({ method: "GET", url: "/health" });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body).toHaveProperty("status", "ok");
            expect(body).toHaveProperty("db", "ok");
            expect(body).toHaveProperty("redis");
        });

        it("retorna 503 quando banco está indisponível", async () => {
            mockQueryRaw.mockRejectedValueOnce(new Error("DB down"));
            const res = await app.inject({ method: "GET", url: "/health" });
            expect(res.statusCode).toBe(503);
            expect(JSON.parse(res.payload)).toMatchObject({ status: "degraded", db: "unavailable" });
        });
    });

    describe("POST /events", () => {
        it("retorna 401 sem token", async () => {
            const res = await app.inject({ method: "POST", url: "/events", payload: CREATE_BODY });
            expect(res.statusCode).toBe(401);
        });

        it("cria evento e retorna 201", async () => {
            mockEvent.create.mockResolvedValue(makeEvent());

            const res = await app.inject({
                method: "POST",
                url: "/events",
                payload: CREATE_BODY,
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.payload);
            expect(body).toHaveProperty("id", EVENT_ID);
            expect(body).toHaveProperty("name", "Show do Rock");
            expect(mockEvent.create).toHaveBeenCalledTimes(1);
        });

        it("invalida cache do estabelecimento ao criar evento", async () => {
            mockEvent.findMany.mockResolvedValue([makeEvent()]);
            await app.inject({ method: "GET", url: `/events/establishment/${ESTABLISHMENT_ID}` });
            expect(mockEvent.findMany).toHaveBeenCalledTimes(1);

            mockEvent.create.mockResolvedValue(makeEvent());
            await app.inject({
                method: "POST",
                url: "/events",
                payload: CREATE_BODY,
                headers: { authorization: `Bearer ${token}` },
            });

            mockEvent.findMany.mockResolvedValue([makeEvent(), makeEvent()]);
            await app.inject({ method: "GET", url: `/events/establishment/${ESTABLISHMENT_ID}` });
            expect(mockEvent.findMany).toHaveBeenCalledTimes(2);
        });

        it("rejeita payload com campos excedendo tamanho máximo", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/events",
                payload: { ...CREATE_BODY, name: "A".repeat(201) },
                headers: { authorization: `Bearer ${token}` },
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe("PATCH /events/:eventId/featured", () => {
        it("retorna 401 sem token", async () => {
            const res = await app.inject({
                method: "PATCH",
                url: `/events/${EVENT_ID}/featured`,
                payload: { isFeatured: true },
            });
            expect(res.statusCode).toBe(401);
        });

        it("atualiza destaque do evento com token válido", async () => {
            mockEvent.update.mockResolvedValue({ id: EVENT_ID, isFeatured: true });

            const res = await app.inject({
                method: "PATCH",
                url: `/events/${EVENT_ID}/featured`,
                payload: { isFeatured: true },
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toMatchObject({ id: EVENT_ID, isFeatured: true });
        });

        it("retorna 404 quando evento não existe", async () => {
            const { Prisma } = await import("../../src/generated/prisma/client");
            mockEvent.update.mockRejectedValueOnce(
                Object.assign(new Prisma.PrismaClientKnownRequestError("Not found", {
                    code: "P2025",
                    clientVersion: "7.0.0",
                })),
            );

            const res = await app.inject({
                method: "PATCH",
                url: `/events/${EVENT_ID}/featured`,
                payload: { isFeatured: true },
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(404);
        });
    });

    describe("GET /events", () => {
        it("retorna todos os eventos", async () => {
            mockEvent.findMany.mockResolvedValue([makeEvent(), makeEvent({ id: "outro-id", isFeatured: true })]);

            const res = await app.inject({ method: "GET", url: "/events" });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toHaveLength(2);
            expect(mockEvent.findMany).toHaveBeenCalledWith({ orderBy: { startDate: "asc" } });
        });

        it("retorna lista vazia quando não há eventos", async () => {
            mockEvent.findMany.mockResolvedValue([]);

            const res = await app.inject({ method: "GET", url: "/events" });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual([]);
        });

        it("usa cache na segunda chamada", async () => {
            mockEvent.findMany.mockResolvedValue([makeEvent()]);

            await app.inject({ method: "GET", url: "/events" });
            await app.inject({ method: "GET", url: "/events" });

            expect(mockEvent.findMany).toHaveBeenCalledTimes(1);
        });

        it("invalida o cache ao criar um evento novo", async () => {
            mockEvent.findMany.mockResolvedValue([makeEvent()]);
            await app.inject({ method: "GET", url: "/events" });
            expect(mockEvent.findMany).toHaveBeenCalledTimes(1);

            mockEvent.create.mockResolvedValue(makeEvent());
            await app.inject({
                method: "POST",
                url: "/events",
                payload: CREATE_BODY,
                headers: { authorization: `Bearer ${token}` },
            });

            mockEvent.findMany.mockResolvedValue([makeEvent(), makeEvent()]);
            await app.inject({ method: "GET", url: "/events" });
            expect(mockEvent.findMany).toHaveBeenCalledTimes(2);
        });
    });

    describe("GET /events/nearby", () => {
        it("retorna 400 para coordenadas inválidas", async () => {
            const res = await app.inject({
                method: "GET",
                url: "/events/nearby?latitude=abc&longitude=-46.6",
            });
            expect(res.statusCode).toBe(400);
        });

        it("retorna eventos filtrados por raio geográfico", async () => {
            const events = [makeEvent({ latitude: -23.5, longitude: -46.6 })];
            mockEvent.findMany.mockResolvedValue(events);

            const res = await app.inject({
                method: "GET",
                url: "/events/nearby?latitude=-23.5&longitude=-46.6&radiusKm=10",
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body).toHaveLength(1);
            expect(body[0]).toHaveProperty("distanceKm");
        });

        it("retorna lista vazia quando nenhum evento está no raio", async () => {
            const farEvent = makeEvent({ latitude: -30.0, longitude: -51.0 });
            mockEvent.findMany.mockResolvedValue([farEvent]);

            const res = await app.inject({
                method: "GET",
                url: "/events/nearby?latitude=-23.5&longitude=-46.6&radiusKm=1",
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toHaveLength(0);
        });

        it("usa cache na segunda chamada com mesmas coordenadas", async () => {
            mockEvent.findMany.mockResolvedValue([makeEvent()]);

            await app.inject({ method: "GET", url: "/events/nearby?latitude=-23.5&longitude=-46.6&radiusKm=10" });
            await app.inject({ method: "GET", url: "/events/nearby?latitude=-23.5&longitude=-46.6&radiusKm=10" });

            expect(mockEvent.findMany).toHaveBeenCalledTimes(1);
        });
    });

    describe("GET /events/establishment/:establishmentId — Redis cache", () => {
        it("cache miss chama banco, cache hit não chama banco", async () => {
            const events = [{ name: "Show", organizer: "Org", location: "Loc", totalConfirmed: 0, ticketLink: null }];
            mockEvent.findMany.mockResolvedValue(events);

            await app.inject({ method: "GET", url: `/events/establishment/${ESTABLISHMENT_ID}` });
            await app.inject({ method: "GET", url: `/events/establishment/${ESTABLISHMENT_ID}` });

            expect(mockEvent.findMany).toHaveBeenCalledTimes(1);
        });
    });

    describe("GET /events/:eventId — Redis cache", () => {
        it("retorna detalhes do evento com cache", async () => {
            const event = makeEvent();
            mockEvent.findUnique.mockResolvedValue(event);

            const res1 = await app.inject({ method: "GET", url: `/events/${EVENT_ID}` });
            expect(res1.statusCode).toBe(200);
            expect(JSON.parse(res1.payload)).toHaveProperty("name", "Show do Rock");

            const res2 = await app.inject({ method: "GET", url: `/events/${EVENT_ID}` });
            expect(res2.statusCode).toBe(200);
            expect(mockEvent.findUnique).toHaveBeenCalledTimes(1);
        });

        it("retorna 404 quando evento não existe", async () => {
            mockEvent.findUnique.mockResolvedValue(null);
            const res = await app.inject({ method: "GET", url: `/events/${EVENT_ID}` });
            expect(res.statusCode).toBe(404);
        });
    });

    const USER_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

    describe("POST /events/:eventId/checkin", () => {
        it("realiza check-in com sucesso e retorna { checkedIn: true }", async () => {
            const res = await app.inject({
                method: "POST",
                url: `/events/${EVENT_ID}/checkin`,
                payload: { userId: USER_ID },
            });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ checkedIn: true });
            expect(mockTransaction).toHaveBeenCalledTimes(1);
        });

        it("retorna 409 quando usuário já fez check-in", async () => {
            const { Prisma } = await import("../../src/generated/prisma/client");
            mockTransaction.mockRejectedValueOnce(
                Object.assign(new Prisma.PrismaClientKnownRequestError("Unique", {
                    code: "P2002",
                    clientVersion: "7.0.0",
                })),
            );
            const res = await app.inject({
                method: "POST",
                url: `/events/${EVENT_ID}/checkin`,
                payload: { userId: USER_ID },
            });
            expect(res.statusCode).toBe(409);
            expect(JSON.parse(res.payload)).toHaveProperty("message", "Usuário já fez check-in neste evento");
        });

        it("retorna 404 quando evento não existe", async () => {
            const { Prisma } = await import("../../src/generated/prisma/client");
            mockTransaction.mockRejectedValueOnce(
                Object.assign(new Prisma.PrismaClientKnownRequestError("Not found", {
                    code: "P2025",
                    clientVersion: "7.0.0",
                })),
            );
            const res = await app.inject({
                method: "POST",
                url: `/events/${EVENT_ID}/checkin`,
                payload: { userId: USER_ID },
            });
            expect(res.statusCode).toBe(404);
        });

        it("retorna 400 para userId inválido", async () => {
            const res = await app.inject({
                method: "POST",
                url: `/events/${EVENT_ID}/checkin`,
                payload: { userId: "nao-e-uuid" },
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe("DELETE /events/:eventId/checkin", () => {
        it("remove check-in com sucesso e retorna { checkedIn: false }", async () => {
            mockEventCheckIn.findUnique.mockResolvedValue({ id: "checkin-id" });
            const res = await app.inject({
                method: "DELETE",
                url: `/events/${EVENT_ID}/checkin`,
                payload: { userId: USER_ID },
            });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ checkedIn: false });
        });

        it("retorna 404 quando check-in não existe", async () => {
            mockEventCheckIn.findUnique.mockResolvedValue(null);
            const res = await app.inject({
                method: "DELETE",
                url: `/events/${EVENT_ID}/checkin`,
                payload: { userId: USER_ID },
            });
            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.payload)).toHaveProperty("message", "Check-in não encontrado");
        });
    });

    describe("GET /events/checkins/:userId", () => {
        it("retorna lista de eventos com checkedInAt", async () => {
            const checkedInAt = new Date("2026-07-01T12:00:00.000Z");
            mockEventCheckIn.findMany.mockResolvedValue([
                { event: makeEvent(), createdAt: checkedInAt },
            ]);
            const res = await app.inject({
                method: "GET",
                url: `/events/checkins/${USER_ID}`,
            });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body).toHaveLength(1);
            expect(body[0]).toHaveProperty("id", EVENT_ID);
            expect(body[0]).toHaveProperty("checkedInAt");
        });

        it("retorna lista vazia quando usuário não tem check-ins", async () => {
            mockEventCheckIn.findMany.mockResolvedValue([]);
            const res = await app.inject({
                method: "GET",
                url: `/events/checkins/${USER_ID}`,
            });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual([]);
        });
    });

    describe("GET /events/:eventId/checkin/:userId", () => {
        it("retorna { checkedIn: true } quando check-in existe", async () => {
            mockEventCheckIn.findUnique.mockResolvedValue({ id: "checkin-id" });
            const res = await app.inject({
                method: "GET",
                url: `/events/${EVENT_ID}/checkin/${USER_ID}`,
            });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ checkedIn: true });
        });

        it("retorna { checkedIn: false } quando check-in não existe", async () => {
            mockEventCheckIn.findUnique.mockResolvedValue(null);
            const res = await app.inject({
                method: "GET",
                url: `/events/${EVENT_ID}/checkin/${USER_ID}`,
            });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ checkedIn: false });
        });
    });
});
