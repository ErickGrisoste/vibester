import { env } from "../config/env";
import { normalizeForMatching } from "./normalize";
import { BLOCKLIST, TermCategory } from "./data/blocklist";
import {
    ValidationCode,
    type AuditDetail,
    type Rule,
    type ValidationIssue,
} from "../types/validation.types";

const CODE_BY_CATEGORY: Record<TermCategory, ValidationCode> = {
    [TermCategory.HATE]: ValidationCode.HATE_SPEECH,
    [TermCategory.PROFANITY]: ValidationCode.FORBIDDEN_LANGUAGE,
};

const MESSAGE_BY_CATEGORY: Record<TermCategory, string> = {
    [TermCategory.HATE]:
        "A publicação contém conteúdo que viola as diretrizes da comunidade.",
    [TermCategory.PROFANITY]:
        "A publicação contém linguagem imprópria. Revise o texto e tente novamente.",
};

/**
 * Termos proibidos na legenda e nas tags.
 *
 * Duas coisas importam aqui:
 *
 * 1. **A resposta nunca diz qual termo casou.** O termo vai só para
 *    `auditDetails`, que alimenta log e métrica. Devolver "a palavra X é
 *    proibida" transforma o endpoint num oráculo: um script sonda a lista
 *    inteira em minutos e depois escreve tudo em volta dela. É também o
 *    requisito de segurança de não expor detalhe de implementação.
 * 2. **Tags entram no mesmo casamento.** Palavrão em `#hashtag` é o desvio
 *    mais óbvio de um filtro que só olha a legenda.
 */
export const forbiddenWordsRule: Rule = (input) => {
    const issues: ValidationIssue[] = [];
    const auditDetails: AuditDetail[] = [];

    const haystack = normalizeForMatching([input.content, ...input.tags].join(" "));
    const seen = new Set<TermCategory>();

    for (const { category, regex } of BLOCKLIST.word) {
        const match = regex.exec(haystack.collapsed);
        if (match) {
            seen.add(category);
            auditDetails.push({ code: CODE_BY_CATEGORY[category], matched: match[0] });
        }
    }

    // Segunda passada, sem separador: pega `c-a-r-a-l-h-o` e `c.a.r.a.l.h.o`.
    // Só termos marcados `substring` chegam aqui — ver data/blocklist.ts.
    for (const { category, regex } of BLOCKLIST.stripped) {
        if (seen.has(category)) { continue; }

        const match = regex.exec(haystack.stripped);
        if (match) {
            seen.add(category);
            auditDetails.push({ code: CODE_BY_CATEGORY[category], matched: match[0] });
        }
    }

    for (const category of seen) {
        // Ódio rejeita sempre. Palavrão obedece a flag de moderação — mas o
        // detalhe continua indo para a auditoria mesmo quando não rejeita, que
        // é o que permite medir o custo de ligar a flag antes de ligá-la.
        if (category === TermCategory.PROFANITY && !env.profanity_blocks) { continue; }

        issues.push({
            code: CODE_BY_CATEGORY[category],
            field: "content",
            message: MESSAGE_BY_CATEGORY[category],
        });
    }

    return { issues, auditDetails };
};
