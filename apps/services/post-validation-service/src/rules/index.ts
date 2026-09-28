import { emptinessRule } from "./emptiness.rule";
import { limitsRule } from "./limits.rule";
import { forbiddenWordsRule } from "./forbidden-words.rule";
import { linksRule } from "./links.rule";
import { spamRule } from "./spam.rule";
import type { AuditDetail, Rule, RuleResult, ValidationInput } from "../types/validation.types";

/**
 * Ordem das regras. Define a ordem das issues na resposta, e portanto a ordem
 * em que o app mostra os problemas: primeiro o que é objetivo e fácil de
 * corrigir (vazio, tamanho), depois o que é julgamento (linguagem, spam).
 */
export const RULES: Rule[] = [
    emptinessRule,
    limitsRule,
    forbiddenWordsRule,
    linksRule,
    spamRule,
];

/**
 * Aplica todas as regras e junta o resultado.
 *
 * **Nenhuma regra é interrompida pelas outras**: o usuário recebe tudo que está
 * errado numa resposta só, em vez de descobrir um problema por tentativa. Todas
 * são puras e lineares no tamanho do texto, e o texto já vem limitado pelo
 * `bodyLimit` do Fastify — então rodar todas custa praticamente o mesmo que
 * rodar a primeira.
 *
 * Issues são deduplicadas por código; `auditDetails` não são, porque é
 * justamente a lista completa do que casou que torna o log útil depois.
 */
export function runRules(input: ValidationInput): RuleResult {
    const seen = new Set<string>();
    const issues: RuleResult["issues"] = [];
    const auditDetails: AuditDetail[] = [];

    for (const rule of RULES) {
        const result = rule(input);

        for (const issue of result.issues) {
            if (seen.has(issue.code)) { continue; }
            seen.add(issue.code);
            issues.push(issue);
        }

        auditDetails.push(...result.auditDetails);
    }

    return { issues, auditDetails };
}
