import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ValidationClient } from "../validation.client";
import { env } from "../../config/env";

const AUTH = "Bearer token-do-app";

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

describe("ValidationClient", () => {
    let client: ValidationClient;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        client = new ValidationClient();
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        // O env é mockado como objeto estático pelo setup; cada teste que muda
        // o modo restaura no final via `unstubAllGlobals` + reatribuição.
        (env as { post_validation_mode: string }).post_validation_mode = "block";
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        (env as { post_validation_mode: string }).post_validation_mode = "block";
    });

    describe("veredito", () => {
        it("devolve checked/valid quando o conteudo passa", async () => {
            fetchMock.mockResolvedValue(jsonResponse({ valid: true, issues: [] }));

            const outcome = await client.validatePost({
                content: "festa hoje",
                mediaCount: 1,
                authorization: AUTH,
            });

            expect(outcome).toEqual({ status: "checked", verdict: { valid: true, issues: [] } });
        });

        it("devolve checked/invalid com as issues", async () => {
            const issues = [{ code: "HATE_SPEECH", field: "content", message: "reprovado" }];
            fetchMock.mockResolvedValue(jsonResponse({ valid: false, issues }));

            const outcome = await client.validatePost({
                content: "ruim",
                mediaCount: 1,
                authorization: AUTH,
            });

            expect(outcome).toEqual({ status: "checked", verdict: { valid: false, issues } });
        });

        /**
         * O header vai como veio. É o que faz a auditoria do outro serviço
         * registrar o autor de verdade, em vez de um token de serviço genérico.
         */
        it("repassa o header Authorization original", async () => {
            fetchMock.mockResolvedValue(jsonResponse({ valid: true, issues: [] }));

            await client.validatePost({ content: "x", mediaCount: 1, authorization: AUTH });

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("http://post-validation.test/validations/post");
            expect(init.headers.Authorization).toBe(AUTH);
        });

        it("envia tags e mediaCount no corpo", async () => {
            fetchMock.mockResolvedValue(jsonResponse({ valid: true, issues: [] }));

            await client.validatePost({
                content: "festa",
                tags: ["rock"],
                mediaCount: 3,
                authorization: AUTH,
            });

            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
                content: "festa",
                tags: ["rock"],
                mediaCount: 3,
            });
        });
    });

    describe("nao consultavel", () => {
        it("pula quando o modo e off, sem tocar na rede", async () => {
            (env as { post_validation_mode: string }).post_validation_mode = "off";

            const outcome = await client.validatePost({
                content: "x",
                mediaCount: 1,
                authorization: AUTH,
            });

            expect(outcome).toEqual({ status: "skipped", reason: "mode_off" });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        /**
         * Chamador que não é o app (painel, script) não manda token. O endpoint
         * de validação exige JWT, então não há o que consultar.
         */
        it("pula quando nao ha Authorization", async () => {
            const outcome = await client.validatePost({ content: "x", mediaCount: 1 });

            expect(outcome).toEqual({ status: "skipped", reason: "missing_authorization" });
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("indisponibilidade — nunca lanca", () => {
        it("trata erro de rede como unavailable", async () => {
            fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

            const outcome = await client.validatePost({
                content: "x",
                mediaCount: 1,
                authorization: AUTH,
            });

            expect(outcome).toEqual({ status: "unavailable", reason: "network" });
        });

        it("trata abort como timeout", async () => {
            const abort = new Error("aborted");
            abort.name = "AbortError";
            fetchMock.mockRejectedValue(abort);

            const outcome = await client.validatePost({
                content: "x",
                mediaCount: 1,
                authorization: AUTH,
            });

            expect(outcome).toEqual({ status: "unavailable", reason: "timeout" });
        });

        it("trata 5xx como unavailable", async () => {
            fetchMock.mockResolvedValue(jsonResponse({}, 503));

            const outcome = await client.validatePost({
                content: "x",
                mediaCount: 1,
                authorization: AUTH,
            });

            expect(outcome).toEqual({ status: "unavailable", reason: "http_503" });
        });

        /**
         * Token expirado é problema de sessão, não de conteúdo. Virar
         * "reprovado" daria ao autor uma mensagem sobre o texto dele que não
         * tem nada a ver com o que aconteceu.
         */
        it("trata 401 como unavailable, nunca como reprovado", async () => {
            fetchMock.mockResolvedValue(jsonResponse({ message: "Token inválido" }, 401));

            const outcome = await client.validatePost({
                content: "x",
                mediaCount: 1,
                authorization: "Bearer expirado",
            });

            expect(outcome).toEqual({ status: "unavailable", reason: "http_401" });
        });

        it("trata resposta sem o campo valid como unavailable", async () => {
            fetchMock.mockResolvedValue(jsonResponse({ algo: "inesperado" }));

            const outcome = await client.validatePost({
                content: "x",
                mediaCount: 1,
                authorization: AUTH,
            });

            expect(outcome).toEqual({ status: "unavailable", reason: "malformed_response" });
        });

        it("aborta a requisicao quando estoura o tempo", async () => {
            // Prova que o AbortController é de fato ligado ao fetch: sem signal,
            // um serviço que trava no meio da resposta seguraria a criação do
            // post pelo tempo todo.
            fetchMock.mockImplementation((_url: string, init: RequestInit) => {
                return new Promise((_resolve, reject) => {
                    init.signal?.addEventListener("abort", () => {
                        const err = new Error("aborted");
                        err.name = "AbortError";
                        reject(err);
                    });
                });
            });

            (env as { post_validation_timeout_ms: number }).post_validation_timeout_ms = 20;

            const outcome = await client.validatePost({
                content: "x",
                mediaCount: 1,
                authorization: AUTH,
            });

            expect(outcome).toEqual({ status: "unavailable", reason: "timeout" });

            (env as { post_validation_timeout_ms: number }).post_validation_timeout_ms = 1000;
        });
    });
});
