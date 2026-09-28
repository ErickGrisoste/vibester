import { env } from "../config/env";
import { countCharacters } from "./normalize";
import { ValidationCode, type Rule, type ValidationIssue } from "../types/validation.types";

/**
 * Limites de tamanho: caracteres da legenda e quantidade de tags.
 *
 * Não interrompe as demais regras: quem escreveu 900 caracteres com um link
 * bloqueado merece as duas mensagens de uma vez, não uma a cada tentativa. O
 * que protege o CPU de texto gigante é o `bodyLimit` do Fastify
 * (`MAX_BODY_BYTES`), aplicado antes de qualquer regra rodar — e todas as
 * regras são lineares no tamanho do texto.
 *
 * O comprimento é contado em grafemas, não em `.length` — ver `countCharacters`.
 */
export const limitsRule: Rule = (input) => {
    const issues: ValidationIssue[] = [];
    const length = countCharacters(input.content);

    if (length > env.max_content_length) {
        issues.push({
            code: ValidationCode.CONTENT_TOO_LONG,
            field: "content",
            message: `A publicação excede o limite de ${env.max_content_length} caracteres (tem ${length}).`,
        });
    }

    if (input.tags.length > env.max_tags) {
        issues.push({
            code: ValidationCode.TOO_MANY_TAGS,
            field: "tags",
            message: `Use no máximo ${env.max_tags} tags por publicação.`,
        });
    }

    return { issues, auditDetails: [] };
};
