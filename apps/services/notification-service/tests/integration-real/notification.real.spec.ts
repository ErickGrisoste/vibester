import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildServer, generateToken } from "../helpers/fastify.test.helper";
import prismaClient from "../../src/prisma";
import { redis } from "../../src/config/redis";

const RECIPIENT_ID = "11111111-1111-1111-1111-111111111111";
const ACTOR_ID = "22222222-2222-2222-2222-222222222222";

describe("notification-service — Real Integration (Postgres + Redis)", () => {
    let app: Awaited<ReturnType<typeof buildServer>>;
    let token: string;

    beforeAll(async () => {
        app = await buildServer();
        token = generateToken(app, RECIPIENT_ID);

        // Warm-up: o cliente Redis usa lazyConnect + enableOfflineQueue:false, então
        // qualquer comando emitido antes da conexão TCP terminar de subir lança "Stream
        // isn't writeable" (bug pré-existente em src/config/redis.ts, fora do escopo
        // deste card — não afeta o status HTTP de /health, que só depende do Postgres,
        // apenas o campo informativo "redis" no corpo da resposta). Conectamos
        // explicitamente aqui para não testar essa corrida incidental do 1º comando.
        await redis.connect();
    });

    afterAll(async () => {
        await app.close();
        await prismaClient.$disconnect();
    });

    beforeEach(async () => {
        await prismaClient.notification.deleteMany();
        await prismaClient.twoFactorCode.deleteMany();
    });

    describe("GET /health", () => {
        it("retorna 200 com db e redis disponíveis", async () => {
            const res = await app.inject({ method: "GET", url: "/health" });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toMatchObject({ status: "ok", db: "ok", redis: "ok" });
        });
    });

    describe("Fluxo de notificações persistidas no Postgres", () => {
        it("cria uma notificação diretamente no banco e a retorna via GET /notifications autenticado", async () => {
            await prismaClient.notification.create({
                data: {
                    type: "follow",
                    recipientId: RECIPIENT_ID,
                    actorId: ACTOR_ID,
                    refId: "",
                    read: false,
                },
            });

            const res = await app.inject({
                method: "GET",
                url: "/notifications",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.items).toHaveLength(1);
            expect(body.items[0].type).toBe("follow");
        });

        it("PATCH /notifications/read marca as notificações como lidas no banco", async () => {
            await prismaClient.notification.create({
                data: {
                    type: "follow",
                    recipientId: RECIPIENT_ID,
                    actorId: ACTOR_ID,
                    refId: "",
                    read: false,
                },
            });

            const res = await app.inject({
                method: "PATCH",
                url: "/notifications/read",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ updated: 1 });

            const remainingUnread = await prismaClient.notification.count({
                where: { recipientId: RECIPIENT_ID, read: false },
            });
            expect(remainingUnread).toBe(0);
        });
    });
});
