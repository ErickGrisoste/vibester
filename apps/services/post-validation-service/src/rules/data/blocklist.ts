import { normalizeForMatching, escapeRegex } from "../normalize";

/**
 * Severidade do termo. A diferença é operacional, não estética:
 *
 * - `HATE` rejeita SEMPRE. Discurso de ódio não é calibragem de tom, e nenhuma
 *   flag de ambiente desliga.
 * - `PROFANITY` rejeita conforme `PROFANITY_BLOCKS` (env). Num app de vida
 *   noturna, "palavrão" faz parte de como o público de 18-27 escreve; se a
 *   moderação decidir tolerar, é uma troca de config, não um deploy.
 */
export enum TermCategory {
    HATE = "HATE",
    PROFANITY = "PROFANITY",
}

/**
 * Como o termo é procurado:
 *
 * - `word`: só com fronteira de palavra no texto normalizado. É o padrão, e é o
 *   que impede o problema do "Scunthorpe" — `cu` dentro de `cuidado`, `puta`
 *   dentro de `reputacao`. Todo termo curto ou que exista dentro de outra
 *   palavra portuguesa PRECISA ser `word`.
 * - `substring`: além do modo acima, também é procurado no texto sem nenhum
 *   separador, o que pega `c-a-r-a-l-h-o`. Só para termos longos que não são
 *   subpalavra de nada legítimo. `porra` NÃO pode ser `substring`: casaria
 *   dentro de `porrada` e `porrete`.
 */
type MatchMode = "word" | "substring";

interface BlockedTerm {
    term: string;
    category: TermCategory;
    match: MatchMode;
}

/**
 * Lista de partida, em pt-BR. É deliberadamente conservadora: falso positivo
 * aqui silencia um usuário legítimo, e isso custa mais para o produto do que
 * deixar passar um caso que a denúncia manual (`content.reported`, já existente
 * no user-service) resolve depois.
 *
 * O que foi deixado DE FORA de propósito, e por quê:
 *
 * - Xingamentos dependentes de contexto (`macaco`, `urubu`, `baiano`): são
 *   slur quando direcionados a uma pessoa e palavra comum no resto do tempo.
 *   Regex não distingue as duas coisas; isso é trabalho de revisão humana.
 * - Insultos leves (`idiota`, `burro`, `babaca`): bloquear derruba conversa
 *   normal sem proteger ninguém.
 *
 * Ao editar esta lista, nada mais precisa mudar: os padrões são recompilados no
 * carregamento do módulo. Mas lembre de subir `BLOCKLIST_VERSION`, senão
 * veredito velho continua servido pelo cache do Redis.
 */
const TERMS: BlockedTerm[] = [
    // --- Discurso de ódio: homofobia/transfobia ---
    { term: "viado", category: TermCategory.HATE, match: "word" },
    { term: "veado", category: TermCategory.HATE, match: "word" },
    { term: "viadinho", category: TermCategory.HATE, match: "substring" },
    { term: "bicha", category: TermCategory.HATE, match: "word" },
    { term: "traveco", category: TermCategory.HATE, match: "substring" },
    { term: "sapatao", category: TermCategory.HATE, match: "substring" },

    // --- Discurso de ódio: racismo ---
    { term: "crioulo", category: TermCategory.HATE, match: "substring" },
    { term: "macaco preto", category: TermCategory.HATE, match: "word" },
    { term: "volta pra senzala", category: TermCategory.HATE, match: "word" },

    // --- Discurso de ódio: capacitismo ---
    { term: "retardado", category: TermCategory.HATE, match: "substring" },
    { term: "mongoloide", category: TermCategory.HATE, match: "substring" },
    { term: "aleijado", category: TermCategory.HATE, match: "substring" },

    // --- Discurso de ódio: classismo ---
    { term: "favelado", category: TermCategory.HATE, match: "substring" },

    // --- Palavrão forte ---
    { term: "caralho", category: TermCategory.PROFANITY, match: "substring" },
    { term: "porra", category: TermCategory.PROFANITY, match: "word" },
    { term: "buceta", category: TermCategory.PROFANITY, match: "substring" },
    { term: "boceta", category: TermCategory.PROFANITY, match: "substring" },
    { term: "foda se", category: TermCategory.PROFANITY, match: "word" },
    { term: "foder", category: TermCategory.PROFANITY, match: "word" },
    { term: "fodido", category: TermCategory.PROFANITY, match: "word" },
    { term: "merda", category: TermCategory.PROFANITY, match: "word" },
    { term: "bosta", category: TermCategory.PROFANITY, match: "word" },
    { term: "puta que pariu", category: TermCategory.PROFANITY, match: "word" },
    { term: "filho da puta", category: TermCategory.PROFANITY, match: "word" },
    { term: "fdp", category: TermCategory.PROFANITY, match: "word" },
    { term: "pqp", category: TermCategory.PROFANITY, match: "word" },
    { term: "vagabunda", category: TermCategory.PROFANITY, match: "substring" },
    { term: "vadia", category: TermCategory.PROFANITY, match: "word" },
    { term: "cuzao", category: TermCategory.PROFANITY, match: "substring" },
    { term: "arrombado", category: TermCategory.PROFANITY, match: "substring" },
    { term: "desgracado", category: TermCategory.PROFANITY, match: "substring" },
    { term: "escroto", category: TermCategory.PROFANITY, match: "word" },
    { term: "corno", category: TermCategory.PROFANITY, match: "word" },
    { term: "punheta", category: TermCategory.PROFANITY, match: "substring" },
    { term: "pentelho", category: TermCategory.PROFANITY, match: "substring" },
];

/**
 * Entra na chave do cache. **Suba a cada alteração em `TERMS`**: sem isso, um
 * veredito calculado com a lista antiga continua sendo servido pelo Redis até
 * o TTL expirar, e a mudança da moderação só valeria minutos depois.
 */
export const BLOCKLIST_VERSION = 1;

export interface CompiledPattern {
    category: TermCategory;
    regex: RegExp;
}

export interface CompiledBlocklist {
    /** Procurados em `NormalizedText.collapsed`, com fronteira de palavra. */
    word: CompiledPattern[];
    /** Procurados em `NormalizedText.stripped`, sem fronteira. */
    stripped: CompiledPattern[];
}

/**
 * Um regex por categoria, montado como alternância de literais escapados.
 *
 * Alternância de literais não tem quantificador aninhado, então o casamento é
 * linear e não há backtracking catastrófico — ponto que importa porque o texto
 * é do usuário e o orçamento de latência é 200ms. Escapar cada termo também
 * impede que um `.` na lista vire coringa.
 *
 * Os termos passam pela MESMA normalização do texto (`normalizeForMatching`):
 * é isso que põe os dois lados no mesmo alfabeto, já sem acento e com repetição
 * colapsada. Um termo que a normalização esvazie é descartado.
 */
function compile(terms: BlockedTerm[], mode: "word" | "stripped"): CompiledPattern[] {
    const byCategory = new Map<TermCategory, string[]>();

    for (const entry of terms) {
        const normalized = normalizeForMatching(entry.term);
        const value = mode === "word" ? normalized.collapsed : normalized.stripped;

        if (value.length === 0) { continue; }
        if (mode === "stripped" && entry.match !== "substring") { continue; }

        const list = byCategory.get(entry.category) ?? [];
        list.push(escapeRegex(value));
        byCategory.set(entry.category, list);
    }

    return [...byCategory].map(([category, patterns]) => ({
        category,
        // Mais longo primeiro: a alternância do JS devolve a primeira alternativa
        // que casa, e queremos o termo mais específico no log de auditoria.
        regex: new RegExp(
            mode === "word"
                ? `\\b(?:${patterns.sort((a, b) => b.length - a.length).join("|")})\\b`
                : `(?:${patterns.sort((a, b) => b.length - a.length).join("|")})`
        ),
    }));
}

export const BLOCKLIST: CompiledBlocklist = {
    word: compile(TERMS, "word"),
    stripped: compile(TERMS, "stripped"),
};
