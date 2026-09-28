import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { FastifyInstance } from "fastify";
import { buildServer, signToken } from "../helpers/fastify.test.helper";
import { ValidationCode } from "../../src/types/validation.types";

describe("POST /validations/post", () => {
    let app: FastifyInstance;
    let token: string;
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
        app = await buildServer();
        token = signToken(app, { userId: "acesso-1", accountId: "conta-1" });
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    function post(payload: unknown, auth = true) {
        return app.inject({
            method: "POST",
            url: "/validations/post",
            headers: auth ? { authorization: `Bearer ${token}` } : {},
            payload,
        });
    }

    describe("autenticacao", () => {
        it("rejeita requisicao sem token", async () => {
            const response = await post({ content: "festa" }, false);

            expect(response.statusCode).toBe(401);
        });

        it("rejeita token assinado com outro segredo", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/validations/post",
                headers: { authorization: "Bearer nao.e.um.token" },
                payload: { content: "festa" },
            });

            expect(response.statusCode).toBe(401);
        });

        /**
         * `accountId` é a identidade pública usada por post-service e
         * feed-service; `userId` é o id da linha de autenticação. Gravar o
         * errado produziria um id que não casa com nenhum outro serviço.
         */
        it("audita o accountId do token, nao o userId", async () => {
            await post({ content: "festa hoje", mediaCount: 1 });

            const audits = logSpy.mock.calls
                .map((call) => JSON.parse(String(call[0])))
                .filter((entry) => entry.audit === "post-validation");

            expect(audits[0].userId).toBe("conta-1");
        });
    });

    describe("veredito", () => {
        /**
         * Conteúdo reprovado responde 200, não 4xx: a validação teve sucesso, a
         * resposta é que foi "não". É o que deixa o cliente distinguir "mostre
         * este aviso ao usuário" de "a chamada falhou, tente de novo".
         */
        it("responde 200 com valid=true para conteudo limpo", async () => {
            const response = await post({ content: "Hoje tem show no bar", mediaCount: 1 });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toMatchObject({ valid: true, issues: [] });
            expect(response.json().contentHash).toEqual(expect.any(String));
        });

        it("responde 200 com valid=false e o motivo para conteudo reprovado", async () => {
            const response = await post({ content: "a".repeat(600), mediaCount: 1 });

            expect(response.statusCode).toBe(200);

            const body = response.json();
            expect(body.valid).toBe(false);
            expect(body.issues.map((issue: { code: string }) => issue.code))
                .toContain(ValidationCode.CONTENT_TOO_LONG);
            expect(body.issues[0].message).toEqual(expect.any(String));
        });

        it("aceita post so de midia", async () => {
            const response = await post({ mediaCount: 2 });

            expect(response.json().valid).toBe(true);
        });

        it("rejeita post sem texto e sem midia", async () => {
            const response = await post({ content: "", mediaCount: 0 });

            expect(response.json().issues.map((issue: { code: string }) => issue.code))
                .toContain(ValidationCode.CONTENT_EMPTY);
        });

        it("aceita corpo vazio e trata como post vazio", async () => {
            const response = await post({});

            expect(response.statusCode).toBe(200);
            expect(response.json().valid).toBe(false);
        });
    });

    describe("seguranca do payload", () => {
        /**
         * A identidade vem do token. Aceitar `userId` do body permitiria
         * atribuir a tentativa de publicar conteúdo proibido a outra pessoa.
         */
        it("recusa userId no body em vez de confiar nele", async () => {
            const response = await post({ content: "festa", userId: "outra-pessoa" });

            expect(response.statusCode).toBe(400);
        });

        it("recusa tipo errado no payload", async () => {
            const response = await post({ content: 42 });

            expect(response.statusCode).toBe(400);
        });

        it("recusa mediaCount negativo", async () => {
            const response = await post({ content: "festa", mediaCount: -1 });

            expect(response.statusCode).toBe(400);
        });

        /**
         * Distinção proposital: texto acima do limite de *transporte* é payload
         * inválido (400); acima do limite de *negócio* é conteúdo inválido
         * (200 + issue), que é o que faz a mensagem chegar ao usuário.
         */
        it("separa limite de transporte de limite de negocio", async () => {
            const acimaDoNegocio = await post({ content: "a".repeat(600), mediaCount: 1 });
            expect(acimaDoNegocio.statusCode).toBe(200);

            const acimaDoTransporte = await post({ content: "a".repeat(10_001), mediaCount: 1 });
            expect(acimaDoTransporte.statusCode).toBe(400);
        });

        it("nao vaza o termo casado nem stack na resposta", async () => {
            const response = await post({ content: "que porra e essa", mediaCount: 1 });
            const raw = response.body.toLowerCase();

            expect(raw).not.toContain("porra");
            expect(raw).not.toContain("blocklist");
            expect(raw).not.toContain("regex");
            expect(raw).not.toContain("stack");
        });
    });

    describe("probes e metricas", () => {
        it("/health nao checa dependencia", async () => {
            const response = await app.inject({ method: "GET", url: "/health" });

            expect(response.statusCode).toBe(200);
            expect(response.json().status).toBe("ok");
        });

        /**
         * Nenhuma dependência é crítica na API: sem Redis valida igual (só mais
         * lento), sem Kafka a rota síncrona continua respondendo. Derrubar o
         * readiness tiraria de rotação um pod que estava funcionando.
         */
        it("/ready responde 200 mesmo com dependencia degradada", async () => {
            const response = await app.inject({ method: "GET", url: "/ready" });

            expect(response.statusCode).toBe(200);
            expect(["ready", "degraded"]).toContain(response.json().status);
        });

        it("/metrics expoe o formato do prometheus", async () => {
            await post({ content: "festa hoje", mediaCount: 1 });

            const response = await app.inject({ method: "GET", url: "/metrics" });

            expect(response.statusCode).toBe(200);
            expect(response.body).toContain("validations_total");
        });
    });
});
