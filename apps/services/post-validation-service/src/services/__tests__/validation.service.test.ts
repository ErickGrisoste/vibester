import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ValidationService } from "../validation.service";
import { getCachedVerdict, setCachedVerdict } from "../../config/redis";
import { ValidationCode } from "../../types/validation.types";

const cachedMock = vi.mocked(getCachedVerdict);
const setMock = vi.mocked(setCachedVerdict);

const CONTEXT = { userId: "conta-123", source: "sync" as const };

describe("ValidationService", () => {
    let service: ValidationService;
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        service = new ValidationService();
        cachedMock.mockReset().mockResolvedValue(null);
        setMock.mockReset().mockResolvedValue(undefined);
        // A auditoria escreve em stdout; silenciar mantém a saída do teste legível
        // sem abrir mão de poder inspecionar o que foi logado.
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it("aprova conteudo limpo", async () => {
        const result = await service.validate(
            { content: "Hoje tem show no bar", tags: [], mediaCount: 1 },
            CONTEXT
        );

        expect(result.valid).toBe(true);
        expect(result.issues).toEqual([]);
        expect(result.cached).toBe(false);
    });

    it("reprova e devolve o motivo", async () => {
        const result = await service.validate(
            { content: "a".repeat(600), tags: [], mediaCount: 1 },
            CONTEXT
        );

        expect(result.valid).toBe(false);
        expect(result.issues.map((issue) => issue.code)).toContain(ValidationCode.CONTENT_TOO_LONG);
    });

    it("grava o veredito no cache no miss", async () => {
        await service.validate({ content: "festa hoje", tags: [], mediaCount: 1 }, CONTEXT);

        expect(setMock).toHaveBeenCalledTimes(1);
        const [, verdict] = setMock.mock.calls[0];
        expect(verdict.valid).toBe(true);
    });

    it("serve do cache sem reaplicar as regras", async () => {
        cachedMock.mockResolvedValue({
            valid: false,
            issues: [{
                code: ValidationCode.SPAM_SUSPECTED,
                field: "content",
                message: "guardado",
            }],
            auditDetails: [],
        });

        const result = await service.validate(
            // Conteúdo impecável: se as regras rodassem, o veredito seria válido.
            { content: "conteudo totalmente inofensivo", tags: [], mediaCount: 1 },
            CONTEXT
        );

        expect(result.cached).toBe(true);
        expect(result.valid).toBe(false);
        expect(setMock).not.toHaveBeenCalled();
    });

    /**
     * A trilha é de "toda validação realizada". Sem auditar o hit, quem reenvia
     * o mesmo texto some do log depois da primeira tentativa — que é exatamente
     * o padrão de quem está sondando o filtro.
     */
    it("audita tambem no cache hit", async () => {
        cachedMock.mockResolvedValue({ valid: false, issues: [], auditDetails: [] });

        await service.validate({ content: "qualquer coisa", tags: [], mediaCount: 1 }, CONTEXT);

        const entries = logSpy.mock.calls.map((call) => JSON.parse(String(call[0])));
        const audit = entries.find((entry) => entry.audit === "post-validation");

        expect(audit).toBeDefined();
        expect(audit.cached).toBe(true);
        expect(audit.userId).toBe("conta-123");
    });

    /**
     * O service NÃO tem try/catch em volta do cache, de propósito: quem absorve
     * falha de Redis é `config/redis.ts`, que devolve `null` em vez de lançar
     * (provado em `src/config/__tests__/redis.test.ts`). Duplicar a proteção
     * aqui esconderia uma regressão lá — se um dia `getCachedVerdict` voltar a
     * lançar, é este teste que documenta o que acontece.
     */
    it("propaga erro do cache, porque a absorcao e responsabilidade do config/redis", async () => {
        cachedMock.mockRejectedValue(new Error("redis fora do ar"));

        await expect(
            service.validate({ content: "festa hoje", tags: [], mediaCount: 1 }, CONTEXT)
        ).rejects.toThrow("redis fora do ar");
    });

    /**
     * O log é trilha de auditoria, não cópia do post: a legenda é dado pessoal
     * e não pode ser derramada na retenção da coleta de logs.
     */
    it("nao registra o conteudo do post no log de auditoria", async () => {
        const segredo = "informacao pessoal que nao pode vazar no log";

        await service.validate({ content: segredo, tags: [], mediaCount: 1 }, CONTEXT);

        const linhas = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
        expect(linhas).not.toContain(segredo);
        expect(linhas).toContain("contentHash");
    });

    it("usa a origem async quando chamado pelo worker", async () => {
        await service.validate(
            { content: "festa", tags: [], mediaCount: 1 },
            { userId: "autor-1", source: "async", postId: "post-9" }
        );

        const entries = logSpy.mock.calls.map((call) => JSON.parse(String(call[0])));
        const audit = entries.find((entry) => entry.audit === "post-validation");

        expect(audit.source).toBe("async");
        expect(audit.postId).toBe("post-9");
    });
});
