import { normalizeForMatching } from "./normalize";
import { ValidationCode, type Rule } from "../types/validation.types";

/**
 * Heurística de spam.
 *
 * O ponto de calibragem: o público do Vibester tem 18-27 anos e escreve
 * "VAMOOOO HOJE TEM FESTA!!!". Isso **não** é spam, e um filtro que derrube
 * esse texto é pior do que não ter filtro. Por isso os limiares são altos e
 * quase nenhum sinal sozinho rejeita — é preciso somar peso.
 *
 * Os pesos e o limiar estão aqui em cima, explícitos, porque são a parte que
 * mais vai mudar depois que houver dado real de moderação.
 */

/** Pontuação a partir da qual o texto é tratado como spam. */
const SPAM_THRESHOLD = 3;

const WEIGHTS = {
    /** Caixa alta sustentada por um texto longo. Sozinho não rejeita: gritar não é spam. */
    shouting: 2,
    /** `aaaaaaaaaaaaaaaaaaaa` — 20+ do mesmo caractere não é ênfase, é ruído. */
    extremeCharRun: 3,
    /** 10-19 repetições: `vamooooooooo` cabe aqui, e por isso pesa pouco. */
    mildCharRun: 1,
    /** Mesma palavra 8+ vezes é o padrão clássico de keyword stuffing. */
    extremeWordRepeat: 3,
    mildWordRepeat: 1,
    /** Texto longo com vocabulário minúsculo: copia-e-cola repetido. */
    lowVocabulary: 2,
};

/** Maior sequência do mesmo caractere. Laço O(n), sem regex com backreference. */
function longestCharRun(text: string): number {
    let longest = 0;
    let current = 0;
    let previous = "";

    for (const char of text) {
        current = char === previous ? current + 1 : 1;
        previous = char;
        if (current > longest) { longest = current; }
    }

    return longest;
}

function countUppercaseRatio(text: string): { ratio: number; letters: number } {
    let letters = 0;
    let uppercase = 0;

    for (const char of text) {
        if (!/\p{L}/u.test(char)) { continue; }

        letters += 1;
        // Comparar com a versão minúscula cobre acento (`Á`) sem lista de letras.
        if (char !== char.toLowerCase() && char === char.toUpperCase()) { uppercase += 1; }
    }

    return { ratio: letters === 0 ? 0 : uppercase / letters, letters };
}

export const spamRule: Rule = (input) => {
    const { collapsed } = normalizeForMatching(input.content);
    const words = collapsed.split(" ").filter((word) => word.length > 2);

    const occurrences = new Map<string, number>();
    for (const word of words) {
        occurrences.set(word, (occurrences.get(word) ?? 0) + 1);
    }

    const maxWordRepeat = Math.max(0, ...occurrences.values());
    const uniqueRatio = words.length === 0 ? 1 : occurrences.size / words.length;
    const charRun = longestCharRun(input.content);
    const { ratio: capsRatio, letters } = countUppercaseRatio(input.content);

    let score = 0;
    const signals: string[] = [];

    if (letters >= 40 && capsRatio > 0.8) {
        score += WEIGHTS.shouting;
        signals.push("shouting");
    }

    if (charRun >= 20) {
        score += WEIGHTS.extremeCharRun;
        signals.push("extreme_char_run");
    } else if (charRun >= 10) {
        score += WEIGHTS.mildCharRun;
        signals.push("mild_char_run");
    }

    if (maxWordRepeat >= 8) {
        score += WEIGHTS.extremeWordRepeat;
        signals.push("extreme_word_repeat");
    } else if (maxWordRepeat >= 5) {
        score += WEIGHTS.mildWordRepeat;
        signals.push("mild_word_repeat");
    }

    if (words.length >= 20 && uniqueRatio < 0.3) {
        score += WEIGHTS.lowVocabulary;
        signals.push("low_vocabulary");
    }

    if (score < SPAM_THRESHOLD) {
        return { issues: [], auditDetails: [] };
    }

    return {
        issues: [{
            code: ValidationCode.SPAM_SUSPECTED,
            field: "content",
            message: "A publicação foi identificada como spam. Revise o texto e tente novamente.",
        }],
        // Os sinais (não o texto) vão para a auditoria: é o que permite recalibrar
        // os pesos depois, olhando o que de fato dispara em produção.
        auditDetails: [{
            code: ValidationCode.SPAM_SUSPECTED,
            matched: `score=${score};${signals.join(",")}`,
        }],
    };
};
