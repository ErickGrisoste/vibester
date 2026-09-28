/**
 * Normalização para casamento de termos proibidos.
 *
 * Sem isto, a blocklist é contornada com um acento, um zero no lugar do "o" ou
 * um hífen entre as letras. Com isto, `p0rr4`, `pôrra`, `p-o-r-r-a` e
 * `poooorra` caem todos no mesmo texto normalizado.
 *
 * Regra de ouro deste arquivo: **tudo é O(n) sobre o texto**. Nenhuma função
 * aqui pode usar regex com quantificador aninhado — o texto vem do usuário, e
 * backtracking catastrófico num endpoint com orçamento de 200ms é um DoS de
 * uma linha só. Ver também o corte por tamanho em `runRules`, que garante que
 * nada aqui roda sobre texto ilimitado.
 */

/**
 * Homoglifos cirílicos/gregos que se parecem com letras latinas. São o caminho
 * de evasão mais barato que existe (copiar e colar do teclado russo), e o mapa
 * é pequeno o bastante para não custar nada.
 */
const HOMOGLYPHS: Record<string, string> = {
    "а": "a", "в": "b", "с": "c", "е": "e", "н": "h", "к": "k", "м": "m",
    "о": "o", "р": "p", "т": "t", "у": "y", "х": "x", "і": "i", "ѕ": "s",
    "ο": "o", "α": "a", "ε": "e", "ι": "i", "κ": "k", "ρ": "p", "τ": "t", "ν": "v",
};

/**
 * Dígitos que imitam letra. Substituídos em qualquer posição: dígito no meio de
 * palavra não é pontuação, é tentativa de disfarce.
 */
const LEET_DIGITS: Record<string, string> = {
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g",
};

/**
 * Pontuação que imita letra. Só vale **entre dois caracteres alfanuméricos**, e
 * essa condição não é detalhe: `!` é a pontuação mais comum do público do app.
 *
 * Substituir sempre foi tentado e abriu um buraco de evasão no sentido oposto —
 * `porra!` virava `porrai`, e o casamento por palavra inteira (`\bporra\b`)
 * deixava de encontrar o termo justamente na forma mais natural de escrevê-lo.
 * Entre letras (`p!ranha`) a substituição é o que se quer; na borda da palavra
 * é pontuação, e pontuação vira separador.
 */
const LEET_SYMBOLS: Record<string, string> = {
    "@": "a", "$": "s", "!": "i", "+": "t", "€": "e", "¢": "c", "£": "l",
};

function isAlphanumeric(char: string | undefined): boolean {
    if (char === undefined) { return false; }
    return (char >= "a" && char <= "z") || (char >= "0" && char <= "9");
}

/** Remove acentos via decomposição canônica. `ç` vira `c`, `ã` vira `a`. */
function stripDiacritics(text: string): string {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Colapsa repetição do mesmo caractere para uma ocorrência só.
 *
 * `caraaaalho` -> `caralho`. Também achata dobras legítimas (`carro` -> `caro`),
 * por isso a blocklist passa pela MESMA função em tempo de carga
 * (`collapseRepeats` em data/blocklist.ts): os dois lados ficam no mesmo
 * alfabeto, e o casamento continua valendo.
 *
 * Laço explícito em vez de regex com backreference (`/(.)\1+/g`): mesma saída,
 * sem risco de backtracking.
 */
function collapseRepeats(text: string): string {
    let out = "";
    let previous = "";

    for (const char of text) {
        if (char !== previous) {
            out += char;
            previous = char;
        }
    }

    return out;
}

export interface NormalizedText {
    /**
     * Texto normalizado preservando separadores como espaço único. É onde o
     * casamento por palavra inteira (`\b`) funciona — e é o modo padrão da
     * blocklist, porque é o que evita o problema do "Scunthorpe": `cu` dentro
     * de `cuidado` não pode virar rejeição.
     */
    collapsed: string;
    /**
     * Mesmo texto sem NENHUM separador. Pega `p-o-r-r-a` e `p.o.r.r.a`, que
     * escapam do modo acima. Não tem fronteira de palavra, então só termos
     * marcados como `substring` (longos e inequívocos) são procurados aqui.
     */
    stripped: string;
}

/**
 * Pipeline: NFKD -> sem acento -> minúscula -> homoglifo -> leet -> colapso.
 *
 * NFKD (e não NFC) resolve de quebra as variantes tipográficas do Unicode —
 * `ｐｏｒｒａ` (fullwidth) e `𝐩𝐨𝐫𝐫𝐚` (matemático negrito) viram ASCII.
 */
export function normalizeForMatching(text: string): NormalizedText {
    const base = stripDiacritics(text.normalize("NFKD")).toLowerCase();

    const chars = [...base];
    let mapped = "";

    for (let i = 0; i < chars.length; i += 1) {
        const char = chars[i];

        const homoglyph = HOMOGLYPHS[char];
        if (homoglyph !== undefined) {
            mapped += homoglyph;
            continue;
        }

        const digit = LEET_DIGITS[char];
        if (digit !== undefined) {
            mapped += digit;
            continue;
        }

        const symbol = LEET_SYMBOLS[char];
        if (symbol !== undefined && isAlphanumeric(chars[i - 1]) && isAlphanumeric(chars[i + 1])) {
            mapped += symbol;
            continue;
        }

        mapped += char;
    }

    // Tudo que não é letra/dígito vira espaço: mantém a fronteira de palavra
    // sem depender da pontuação original.
    const separated = mapped.replace(/[^a-z0-9]+/g, " ").trim();

    return {
        collapsed: collapseRepeats(separated),
        stripped: collapseRepeats(separated.replace(/ /g, "")),
    };
}

/** Mesmo colapso aplicado ao texto, exposto para a blocklist se alinhar. */
export { collapseRepeats };

/**
 * Comprimento em grafemas, não em code units.
 *
 * `"👨‍👩‍👧".length` é 8 em JavaScript, e um emoji de família consumiria 8 dos
 * 500 caracteres do usuário. Num app de vida noturna, legenda é cheia de
 * emoji — contar por code unit seria um limite bem menor do que o anunciado.
 * `Intl.Segmenter` existe no Node 22 (runtime deste serviço); o fallback por
 * code point cobre qualquer runtime sem ICU completo.
 */
export function countCharacters(text: string): number {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
        const segmenter = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });
        let count = 0;
        for (const _ of segmenter.segment(text)) {
            count += 1;
        }
        return count;
    }

    return [...text].length;
}

/** Escapa um literal para uso dentro de regex. Sem isto, um `.` na blocklist viraria coringa. */
export function escapeRegex(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
