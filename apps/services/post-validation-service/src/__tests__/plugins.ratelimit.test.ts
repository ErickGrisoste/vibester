import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { rateLimitKey } from "../plugins";

const SECRET = "segredo-do-teste";

/**
 * Plugin de rate limit REAL (store em memória) com a chave de produção.
 *
 * O cenário que importa é o de produção: todas as requisições chegam do mesmo
 * IP — o do pod do post-service — em nome de autores diferentes. Com a chave
 * por IP do padrão do plugin, o terceiro autor abaixo receberia 429 sem ter
 * feito nada, e o post-service publicaria sem validar.
 */
describe("rate limit por conta", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = Fastify({ logger: false });
        await app.register(jwt, { secret: SECRET });
        await app.register(rateLimit, {
            global: true,
            max: 2,
            timeWindow: "1 minute",
            keyGenerator: rateLimitKey,
        });
        app.post("/validations/post", async () => ({ ok: true }));
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    function tokenFor(accountId: string) {
        return app.jwt.sign({ userId: `acesso-${accountId}`, accountId });
    }

    function callAs(token?: string) {
        return app.inject({
            method: "POST",
            url: "/validations/post",
            // Mesmo IP em todas as chamadas: é o post-service repassando.
            remoteAddress: "10.0.0.7",
            headers: token ? { authorization: `Bearer ${token}` } : {},
            payload: {},
        });
    }

    it("da a cada conta o proprio balde, mesmo vindo todas do mesmo IP", async () => {
        const autores = ["ana", "bia", "caio", "duda", "edu"];

        for (const autor of autores) {
            const response = await callAs(tokenFor(autor));
            expect(response.statusCode, `autor ${autor}`).toBe(200);
        }
    });

    it("ainda limita a mesma conta", async () => {
        const token = tokenFor("ana");

        expect((await callAs(token)).statusCode).toBe(200);
        expect((await callAs(token)).statusCode).toBe(200);
        expect((await callAs(token)).statusCode).toBe(429);
    });

    /**
     * Decodificar sem verificar deixaria alguém fabricar um accountId novo por
     * requisição e ganhar um balde vazio de graça.
     */
    it("nao aceita accountId de token forjado como chave propria", async () => {
        const forjado = (id: string) => {
            const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
            const body = Buffer.from(JSON.stringify({ accountId: id })).toString("base64url");
            return `${header}.${body}.assinatura-invalida`;
        };

        // Três ids diferentes, todos forjados: caem na mesma chave de IP.
        expect((await callAs(forjado("x1"))).statusCode).toBe(200);
        expect((await callAs(forjado("x2"))).statusCode).toBe(200);
        expect((await callAs(forjado("x3"))).statusCode).toBe(429);
    });

    it("sem token, limita por IP", async () => {
        expect((await callAs()).statusCode).toBe(200);
        expect((await callAs()).statusCode).toBe(200);
        expect((await callAs()).statusCode).toBe(429);
    });
});
