/**
 * Política de links.
 *
 * O requisito é "links não podem redirecionar para sites maliciosos". Reputação
 * de URL não é decidível localmente: saber para onde `bit.ly/x` aponta exige uma
 * chamada de rede, e o orçamento desta rota é 200ms. Então o que se faz aqui é o
 * que dá para decidir sem I/O — forma, esquema, domínio conhecido e sinais
 * estruturais de phishing — e o que sobra é assumido como risco explícito,
 * documentado no CLAUDE.md ("O que este serviço NÃO garante").
 */

/** Só http(s) viram link em post. `javascript:` e `data:` são vetor de injeção. */
export const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/**
 * Encurtadores. Bloqueados não por serem maliciosos, mas por serem
 * **indecidíveis**: escondem o destino do único lugar onde daria para checá-lo.
 * Aceitar encurtador é aceitar qualquer domínio da lista abaixo por procuração.
 */
export const URL_SHORTENERS = new Set([
    "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
    "adf.ly", "bl.ink", "cutt.ly", "rb.gy", "shorturl.at", "rebrand.ly",
    "tiny.cc", "encurtador.com.br", "linktr.ee", "shorte.st", "bc.vc",
]);

/**
 * Domínios bloqueados por padrão. Lista curta e voltada ao que aparece de fato
 * num app de eventos: cassino/aposta sem licença, "ganhe dinheiro" e phishing
 * de ingresso. `BLOCKED_DOMAINS` (env) soma a esta lista, nunca a substitui —
 * é o caminho de resposta rápida da moderação, sem deploy.
 */
export const BLOCKED_DOMAINS = new Set([
    "free-money.example",
    "ganhe-dinheiro-rapido.example",
    "ingresso-gratis.example",
]);

/**
 * Domínio bloqueado vale para os subdomínios também: bloquear `exemplo.com` e
 * deixar passar `promo.exemplo.com` não bloqueia nada na prática.
 */
export function matchesDomain(hostname: string, blocked: Set<string> | string[]): string | null {
    const list = blocked instanceof Set ? blocked : new Set(blocked);
    const host = hostname.toLowerCase().replace(/^www\./, "");

    if (list.has(host)) { return host; }

    // `a.b.exemplo.com` -> testa `b.exemplo.com`, depois `exemplo.com`.
    const labels = host.split(".");
    for (let i = 1; i < labels.length - 1; i += 1) {
        const suffix = labels.slice(i).join(".");
        if (list.has(suffix)) { return suffix; }
    }

    return null;
}

/** Host que é endereço IP literal. Link legítimo de evento usa nome, não IP. */
const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function isSuspiciousHost(hostname: string): boolean {
    const host = hostname.toLowerCase();

    // IPv4 cru, ou IPv6 (o WHATWG URL entrega entre colchetes).
    if (IPV4.test(host) || host.startsWith("[")) { return true; }

    // Punycode: `xn--pple-43d.com` renderiza como `аpple.com` com "a" cirílico.
    // O ataque homográfico clássico — e um domínio de festa não usa punycode.
    if (host.includes("xn--")) { return true; }

    return false;
}

/**
 * Extrai candidatos a URL do texto CRU (não do normalizado: normalizar destrói
 * a URL).
 *
 * O padrão é deliberadamente simples — `\S+` depois do esquema, sem
 * quantificador aninhado. Um regex "completo" de URL é o exemplo de manual de
 * ReDoS, e aqui o texto vem do usuário.
 *
 * Só casa link com esquema explícito e `www.`. `vibester.com.br` solto no meio
 * da frase não é tratado como link — pegar isso exigiria uma lista de TLDs, e
 * o falso positivo (qualquer `arquivo.zip`, `3.5`) custa mais do que resolve.
 *
 * Os esquemas perigosos são listados à parte porque **não usam `//`**:
 * `javascript:alert(1)` e `data:text/html,...` não casariam com o padrão
 * `esquema://`, e passariam inteiros pela regra sem nunca chegar à checagem de
 * `ALLOWED_SCHEMES`. Listar só esses, em vez de aceitar qualquer `palavra:`,
 * é o que evita tratar `Horario:22h` como link.
 */
const DANGEROUS_SCHEMES = "javascript|data|vbscript|file|blob";

const URL_CANDIDATE = new RegExp(
    `(?:(?:${DANGEROUS_SCHEMES}):|[a-z][a-z0-9+.-]{0,15}://|www\\.)\\S{1,2000}`,
    "gi"
);

export function extractUrlCandidates(text: string): string[] {
    return text.match(URL_CANDIDATE) ?? [];
}

/**
 * Pontuação final costuma ser da frase, não da URL: em "vai em https://x.com."
 * o ponto não pertence ao link. Parêntese/colchete fechando sem abrir, idem.
 */
export function trimTrailingPunctuation(candidate: string): string {
    let result = candidate;

    while (result.length > 0) {
        const last = result[result.length - 1];

        if (".,;:!?".includes(last)) {
            result = result.slice(0, -1);
            continue;
        }

        if ((last === ")" && !result.includes("(")) || (last === "]" && !result.includes("["))) {
            result = result.slice(0, -1);
            continue;
        }

        break;
    }

    return result;
}
