import { ValidationCode, type Rule } from "../types/validation.types";

/**
 * Post sem nada dentro.
 *
 * Legenda vazia **não** é erro: post só de foto/vídeo é o caso mais comum do
 * Vibester, e o `createPostSchema` do post-service trata `caption` como
 * opcional com `media` obrigatório. O que não existe é post sem legenda E sem
 * mídia — daí a regra olhar os dois campos, não só o texto.
 */
export const emptinessRule: Rule = (input) => {
    const hasText = input.content.trim().length > 0;
    const hasMedia = input.mediaCount > 0;

    if (hasText || hasMedia) {
        return { issues: [], auditDetails: [] };
    }

    return {
        issues: [{
            code: ValidationCode.CONTENT_EMPTY,
            field: "content",
            message: "A publicação precisa de um texto ou de pelo menos uma mídia.",
        }],
        auditDetails: [],
    };
};
