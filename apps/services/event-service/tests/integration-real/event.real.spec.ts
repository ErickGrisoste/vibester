import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// event-service não tem Kafka (nem produtor, nem consumidor) — nada a mockar aqui.
// Diferente do user-service, o cliente Redis deste serviço usa lazyConnect: false,
// então a conexão já começa a ser aberta assim que o módulo é importado; esperamos
// o status "ready" antes de rodar qualquer comando (enableOfflineQueue está desligado).
import prismaClient from "../../src/prisma/index";
import { redis } from "../../src/config/redis";
import { buildServer, generateToken } from "../helpers/fastify.test.helper";

async function waitForRedisReady() {
    if (redis.status === "ready") return;
    await new Promise<void>((resolve, reject) => {
        const onReady = () => {
            redis.off("error", onError);
            resolve();
        };
        const onError = (err: Error) => {
            redis.off("ready", onReady);
            reject(err);
        };
        redis.once("ready", onReady);
        redis.once("error", onError);
    });
}

const ESTABLISHMENT_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ESTABLISHMENT_ID_2 = "d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const USER_ID = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const USER_ID_2 = "e1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const NON_EXISTENT_EVENT_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const CREATE_BODY = {
    name: "Show do Rock",
    photoUrl: "https://example.com/photo.jpg",
    category: "music",
    organizer: "Promotora XYZ",
    location: "Rua A, 100",
    startDate: "2026-09-01T20:00:00.000Z",
    endDate: "2026-09-01T23:00:00.000Z",
    ticketLink: "https://ingresso.com/show",
    latitude: -23.5,
    longitude: -46.6,
    establishmentId: ESTABLISHMENT_ID,
};

describe("event-service — HTTP Integration (Postgres + Redis reais)", () => {
    let app: Awaited<ReturnType<typeof buildServer>>;
    let token: string;

    beforeAll(async () => {
        await waitForRedisReady();
        app = await buildServer();
        token = generateToken(app);
    });

    afterAll(async () => {
        await app.close();
        await prismaClient.$disconnect();
        redis.disconnect();
    });

    beforeEach(async () => {
        // Ordem FK-safe: EventCheckIn referencia Event.
        await prismaClient.eventCheckIn.deleteMany();
        await prismaClient.event.deleteMany();
        await redis.flushall();
    });

    async function createEventViaApi(overrides: Partial<typeof CREATE_BODY> = {}) {
        const res = await app.inject({
            method: "POST",
            url: "/events",
            payload: { ...CREATE_BODY, ...overrides },
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(201);
        return JSON.parse(res.payload) as { id: string; establishmentId: string };
    }

    describe("GET /health", () => {
        it("retorna 200 com status ok de db e redis reais", async () => {
            const res = await app.inject({ method: "GET", url: "/health" });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body).toMatchObject({ status: "ok", db: "ok", redis: "ok" });
        });
    });

    describe("POST /events", () => {
        it("retorna 401 sem token", async () => {
            const res = await app.inject({ method: "POST", url: "/events", payload: CREATE_BODY });
            expect(res.statusCode).toBe(401);
        });

        it("cria evento e persiste no banco", async () => {
            const body = await createEventViaApi();

            expect(body).toHaveProperty("name", "Show do Rock");
            expect(body).toHaveProperty("totalConfirmed", 0);
            expect(body).toHaveProperty("isFeatured", false);

            const row = await prismaClient.event.findUnique({ where: { id: body.id } });
            expect(row).not.toBeNull();
            expect(row?.establishmentId).toBe(ESTABLISHMENT_ID);
        });

        it("rejeita payload com campos excedendo tamanho máximo (400)", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/events",
                payload: { ...CREATE_BODY, name: "A".repeat(201) },
                headers: { authorization: `Bearer ${token}` },
            });
            expect(res.statusCode).toBe(400);

            const rows = await prismaClient.event.findMany();
            expect(rows).toHaveLength(0);
        });

        it("invalida o cache de eventos por estabelecimento ao criar um evento novo", async () => {
            // Cache miss — grava event:establishment:{id} vazio no Redis
            const before = await app.inject({
                method: "GET",
                url: `/events/establishment/${ESTABLISHMENT_ID}`,
            });
            expect(JSON.parse(before.payload)).toHaveLength(0);

            await createEventViaApi();

            // Sem a invalidação, o cache (TTL 120s) ainda retornaria a lista vazia
            const after = await app.inject({
                method: "GET",
                url: `/events/establishment/${ESTABLISHMENT_ID}`,
            });
            expect(JSON.parse(after.payload)).toHaveLength(1);
        });
    });

    describe("PATCH /events/:eventId/featured", () => {
        it("retorna 401 sem token", async () => {
            const res = await app.inject({
                method: "PATCH",
                url: `/events/${NON_EXISTENT_EVENT_ID}/featured`,
                payload: { isFeatured: true },
            });
            expect(res.statusCode).toBe(401);
        });

        it("atualiza destaque do evento e persiste no banco", async () => {
            const created = await createEventViaApi();

            const res = await app.inject({
                method: "PATCH",
                url: `/events/${created.id}/featured`,
                payload: { isFeatured: true },
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toMatchObject({ id: created.id, isFeatured: true });

            const row = await prismaClient.event.findUnique({ where: { id: created.id } });
            expect(row?.isFeatured).toBe(true);
        });

        it("retorna 404 quando evento não existe", async () => {
            const res = await app.inject({
                method: "PATCH",
                url: `/events/${NON_EXISTENT_EVENT_ID}/featured`,
                payload: { isFeatured: true },
                headers: { authorization: `Bearer ${token}` },
            });
            expect(res.statusCode).toBe(404);
        });
    });

    describe("GET /events", () => {
        it("retorna lista vazia quando não há eventos", async () => {
            const res = await app.inject({ method: "GET", url: "/events" });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual([]);
        });

        it("retorna todos os eventos ordenados por startDate", async () => {
            const later = await createEventViaApi({ name: "Evento tarde", startDate: "2026-10-01T20:00:00.000Z", endDate: "2026-10-01T23:00:00.000Z" });
            const earlier = await createEventViaApi({ name: "Evento cedo", startDate: "2026-09-01T20:00:00.000Z", endDate: "2026-09-01T23:00:00.000Z" });

            const res = await app.inject({ method: "GET", url: "/events" });
            const body = JSON.parse(res.payload);

            expect(res.statusCode).toBe(200);
            expect(body).toHaveLength(2);
            expect(body[0].id).toBe(earlier.id);
            expect(body[1].id).toBe(later.id);
        });

        it("segunda requisição usa cache (Redis) e não reflete escrita direta no banco", async () => {
            await createEventViaApi();

            // Cache miss — lê do banco e grava event:all (TTL 60s)
            const first = await app.inject({ method: "GET", url: "/events" });
            expect(JSON.parse(first.payload)).toHaveLength(1);

            // Insere outro evento direto no banco, sem passar pela invalidação do service
            await prismaClient.event.create({
                data: {
                    name: "Evento fora do cache",
                    photoUrl: "https://example.com/x.jpg",
                    category: "music",
                    organizer: "Outro",
                    location: "Rua B",
                    startDate: new Date("2026-11-01T20:00:00.000Z"),
                    endDate: new Date("2026-11-01T23:00:00.000Z"),
                    latitude: -23.4,
                    longitude: -46.5,
                    establishmentId: ESTABLISHMENT_ID_2,
                },
            });

            // Cache hit — deve continuar retornando só o primeiro evento
            const second = await app.inject({ method: "GET", url: "/events" });
            expect(JSON.parse(second.payload)).toHaveLength(1);
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

        it("retorna apenas eventos dentro do raio, com distanceKm calculada", async () => {
            const near = await createEventViaApi({ latitude: -23.5, longitude: -46.6 });
            await createEventViaApi({ latitude: -30.0, longitude: -51.0 }); // fora do raio

            const res = await app.inject({
                method: "GET",
                url: "/events/nearby?latitude=-23.5&longitude=-46.6&radiusKm=10",
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body).toHaveLength(1);
            expect(body[0].id).toBe(near.id);
            expect(body[0]).toHaveProperty("distanceKm");
        });

        it("usa cache (Redis) na segunda chamada com as mesmas coordenadas", async () => {
            await createEventViaApi({ latitude: -23.5, longitude: -46.6 });

            const first = await app.inject({
                method: "GET",
                url: "/events/nearby?latitude=-23.5&longitude=-46.6&radiusKm=10",
            });
            expect(JSON.parse(first.payload)).toHaveLength(1);

            // Segundo evento próximo criado direto no banco, sem invalidar events:nearby:*
            await prismaClient.event.create({
                data: {
                    name: "Evento próximo fora do cache",
                    photoUrl: "https://example.com/y.jpg",
                    category: "music",
                    organizer: "Outro",
                    location: "Rua C",
                    startDate: new Date("2026-09-05T20:00:00.000Z"),
                    endDate: new Date("2026-09-05T23:00:00.000Z"),
                    latitude: -23.5,
                    longitude: -46.6,
                    establishmentId: ESTABLISHMENT_ID_2,
                },
            });

            const second = await app.inject({
                method: "GET",
                url: "/events/nearby?latitude=-23.5&longitude=-46.6&radiusKm=10",
            });
            expect(JSON.parse(second.payload)).toHaveLength(1);
        });
    });

    describe("GET /events/establishment/:establishmentId", () => {
        it("retorna apenas eventos do estabelecimento informado", async () => {
            const e1 = await createEventViaApi({ establishmentId: ESTABLISHMENT_ID });
            await createEventViaApi({ establishmentId: ESTABLISHMENT_ID_2 });

            const res = await app.inject({
                method: "GET",
                url: `/events/establishment/${ESTABLISHMENT_ID}`,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body).toHaveLength(1);
            expect(body[0].id).toBe(e1.id);
        });
    });

    describe("GET /events/:eventId", () => {
        it("retorna detalhes do evento real", async () => {
            const created = await createEventViaApi();

            const res = await app.inject({ method: "GET", url: `/events/${created.id}` });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toHaveProperty("name", "Show do Rock");
        });

        it("retorna 404 quando evento não existe", async () => {
            const res = await app.inject({ method: "GET", url: `/events/${NON_EXISTENT_EVENT_ID}` });
            expect(res.statusCode).toBe(404);
        });

        it("cacheia detalhes por até 300s e não reflete alteração direta no banco", async () => {
            const created = await createEventViaApi();

            // Cache miss — grava event:id:{id}
            await app.inject({ method: "GET", url: `/events/${created.id}` });

            await prismaClient.event.update({
                where: { id: created.id },
                data: { name: "Nome alterado direto no banco" },
            });

            // Cache hit — deve retornar o nome original
            const res = await app.inject({ method: "GET", url: `/events/${created.id}` });
            expect(JSON.parse(res.payload).name).toBe("Show do Rock");
        });
    });

    describe("POST /events/:eventId/checkin", () => {
        it("realiza check-in, incrementa totalConfirmed e persiste a linha de check-in", async () => {
            const created = await createEventViaApi();

            const res = await app.inject({
                method: "POST",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ checkedIn: true });

            const row = await prismaClient.event.findUnique({ where: { id: created.id } });
            expect(row?.totalConfirmed).toBe(1);

            const checkIn = await prismaClient.eventCheckIn.findUnique({
                where: { eventId_userId: { eventId: created.id, userId: USER_ID } },
            });
            expect(checkIn).not.toBeNull();
        });

        it("retorna 409 quando usuário já fez check-in no evento", async () => {
            const created = await createEventViaApi();
            await app.inject({
                method: "POST",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });

            const res = await app.inject({
                method: "POST",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });

            expect(res.statusCode).toBe(409);
            expect(JSON.parse(res.payload)).toHaveProperty("message", "Usuário já fez check-in neste evento");

            const row = await prismaClient.event.findUnique({ where: { id: created.id } });
            expect(row?.totalConfirmed).toBe(1);
        });

        it("retorna 404 quando evento não existe", async () => {
            const res = await app.inject({
                method: "POST",
                url: `/events/${NON_EXISTENT_EVENT_ID}/checkin`,
                payload: { userId: USER_ID },
            });
            expect(res.statusCode).toBe(404);
        });

        it("retorna 400 para userId inválido", async () => {
            const created = await createEventViaApi();
            const res = await app.inject({
                method: "POST",
                url: `/events/${created.id}/checkin`,
                payload: { userId: "nao-e-uuid" },
            });
            expect(res.statusCode).toBe(400);
        });

        it("comportamento atual conhecido: check-in não invalida o cache de detalhes do evento", async () => {
            const created = await createEventViaApi();

            // Prime cache com totalConfirmed = 0
            const primed = await app.inject({ method: "GET", url: `/events/${created.id}` });
            expect(JSON.parse(primed.payload).totalConfirmed).toBe(0);

            await app.inject({
                method: "POST",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });

            // totalConfirmed já é 1 no banco, mas o cache (invalidação comentada no service) ainda está desatualizado
            const stale = await app.inject({ method: "GET", url: `/events/${created.id}` });
            expect(JSON.parse(stale.payload).totalConfirmed).toBe(0);

            const row = await prismaClient.event.findUnique({ where: { id: created.id } });
            expect(row?.totalConfirmed).toBe(1);
        });
    });

    describe("DELETE /events/:eventId/checkin", () => {
        it("remove check-in, decrementa totalConfirmed e apaga a linha do banco", async () => {
            const created = await createEventViaApi();
            await app.inject({
                method: "POST",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });

            const res = await app.inject({
                method: "DELETE",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ checkedIn: false });

            const row = await prismaClient.event.findUnique({ where: { id: created.id } });
            expect(row?.totalConfirmed).toBe(0);

            const checkIn = await prismaClient.eventCheckIn.findUnique({
                where: { eventId_userId: { eventId: created.id, userId: USER_ID } },
            });
            expect(checkIn).toBeNull();
        });

        it("retorna 404 quando check-in não existe", async () => {
            const created = await createEventViaApi();
            const res = await app.inject({
                method: "DELETE",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });
            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.payload)).toHaveProperty("message", "Check-in não encontrado");
        });
    });

    describe("GET /events/checkins/:userId", () => {
        it("retorna eventos confirmados pelo usuário, com checkedInAt", async () => {
            const created = await createEventViaApi();
            await app.inject({
                method: "POST",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });

            const res = await app.inject({ method: "GET", url: `/events/checkins/${USER_ID}` });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body).toHaveLength(1);
            expect(body[0]).toHaveProperty("id", created.id);
            expect(body[0]).toHaveProperty("checkedInAt");
        });

        it("retorna lista vazia quando usuário não tem check-ins", async () => {
            const res = await app.inject({ method: "GET", url: `/events/checkins/${USER_ID_2}` });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual([]);
        });
    });

    describe("GET /events/:eventId/checkin/:userId", () => {
        it("retorna { checkedIn: true } quando check-in existe no banco", async () => {
            const created = await createEventViaApi();
            await app.inject({
                method: "POST",
                url: `/events/${created.id}/checkin`,
                payload: { userId: USER_ID },
            });

            const res = await app.inject({
                method: "GET",
                url: `/events/${created.id}/checkin/${USER_ID}`,
            });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ checkedIn: true });
        });

        it("retorna { checkedIn: false } quando check-in não existe", async () => {
            const created = await createEventViaApi();
            const res = await app.inject({
                method: "GET",
                url: `/events/${created.id}/checkin/${USER_ID}`,
            });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ checkedIn: false });
        });
    });
});
