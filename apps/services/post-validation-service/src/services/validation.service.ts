import { runRules } from "../rules";
import { cacheKey, contentHash } from "../utils/content-hash";
import { getCachedVerdict, setCachedVerdict } from "../config/redis";
import { recordAudit } from "./audit.service";
import {
    validationIssuesTotal,
    validationRulesDuration,
    validationsTotal,
} from "../metrics/registry";
import type {
    CachedVerdict,
    ValidationInput,
    ValidationResponse,
} from "../types/validation.types";

export class ValidationService {

    /**
     * Valida um conteúdo e devolve o veredito.
     *
     * Caminho: cache -> regras -> cache. O cache é best-effort nas duas pontas
     * (`config/redis.ts` nunca lança), então uma queda do Redis vira só mais
     * CPU, nunca erro para o usuário.
     *
     * A auditoria acontece **também no cache hit**, de propósito: a trilha é de
     * "toda validação realizada", e uma tentativa de publicar conteúdo proibido
     * não deixa de ter acontecido porque o veredito já estava calculado. Sem
     * isso, quem reenvia o mesmo texto some do log depois da primeira vez — que
     * é exatamente o comportamento de quem está sondando o filtro.
     */
    async validate(
        input: ValidationInput,
        context: { userId: string; source: "sync" | "async"; postId?: string }
    ): Promise<ValidationResponse> {
        const startedAt = process.hrtime.bigint();
        const hash = contentHash(input);
        const key = cacheKey(hash);

        const cached = await getCachedVerdict(key);

        if (cached) {
            this.report(cached, context.source, true);
            recordAudit({
                source: context.source,
                userId: context.userId,
                postId: context.postId,
                contentHash: hash,
                contentLength: input.content.length,
                valid: cached.valid,
                issues: cached.issues,
                auditDetails: cached.auditDetails,
                durationMs: elapsedMs(startedAt),
                cached: true,
            });

            return { valid: cached.valid, issues: cached.issues, contentHash: hash, cached: true };
        }

        const rulesStartedAt = process.hrtime.bigint();
        const { issues, auditDetails } = runRules(input);
        validationRulesDuration.observe(elapsedMs(rulesStartedAt) / 1000);

        const verdict: CachedVerdict = { valid: issues.length === 0, issues, auditDetails };

        await setCachedVerdict(key, verdict);

        this.report(verdict, context.source, false);
        recordAudit({
            source: context.source,
            userId: context.userId,
            postId: context.postId,
            contentHash: hash,
            contentLength: input.content.length,
            valid: verdict.valid,
            issues,
            auditDetails,
            durationMs: elapsedMs(startedAt),
            cached: false,
        });

        return { valid: verdict.valid, issues, contentHash: hash, cached: false };
    }

    private report(verdict: CachedVerdict, source: "sync" | "async", _cached: boolean): void {
        validationsTotal.inc({ result: verdict.valid ? "valid" : "invalid", source });

        for (const issue of verdict.issues) {
            validationIssuesTotal.inc({ code: issue.code, source });
        }
    }
}

/** `hrtime.bigint()` e não `Date.now()`: relógio monotônico, imune a ajuste de NTP. */
function elapsedMs(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}
