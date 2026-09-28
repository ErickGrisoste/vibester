import { env } from "../config/env";
import {
    ALLOWED_SCHEMES,
    BLOCKED_DOMAINS,
    URL_SHORTENERS,
    extractUrlCandidates,
    isSuspiciousHost,
    matchesDomain,
    trimTrailingPunctuation,
} from "./data/link-policy";
import {
    ValidationCode,
    type AuditDetail,
    type Rule,
    type ValidationIssue,
} from "../types/validation.types";

/**
 * Forma e destino dos links.
 *
 * O parsing é do `URL` do WHATWG (nativo), não de regex: é o mesmo parser que o
 * navegador usa, então o que ele entende por "host" é o que o usuário vai
 * visitar de fato. Um regex caseiro erra justamente nos casos que interessam
 * (`http://bom.com@malicioso.com` tem host `malicioso.com`, e quase todo regex
 * de URL lê `bom.com`).
 *
 * Cada issue aparece no máximo uma vez, mesmo com vários links problemáticos: a
 * mensagem é a mesma e repetir só polui a resposta.
 */
export const linksRule: Rule = (input) => {
    const issues: ValidationIssue[] = [];
    const auditDetails: AuditDetail[] = [];
    const emitted = new Set<ValidationCode>();

    const add = (code: ValidationCode, message: string, matched: string) => {
        auditDetails.push({ code, matched });

        if (emitted.has(code)) { return; }
        emitted.add(code);
        issues.push({ code, field: "content", message });
    };

    const candidates = extractUrlCandidates(input.content).map(trimTrailingPunctuation);

    if (candidates.length > env.max_links) {
        add(
            ValidationCode.TOO_MANY_LINKS,
            `Use no máximo ${env.max_links} link(s) por publicação.`,
            String(candidates.length)
        );
    }

    for (const candidate of candidates) {
        // `www.exemplo.com` sem esquema é link para o leitor; o parser precisa
        // de um esquema para aceitar.
        const href = candidate.toLowerCase().startsWith("www.") ? `https://${candidate}` : candidate;

        let url: URL;
        try {
            url = new URL(href);
        } catch {
            add(
                ValidationCode.MALFORMED_LINK,
                "A publicação contém um link em formato inválido.",
                candidate
            );
            continue;
        }

        // `javascript:` e `data:` não são link de evento — são vetor de injeção
        // no cliente que renderizar a legenda como HTML.
        if (!ALLOWED_SCHEMES.has(url.protocol)) {
            add(
                ValidationCode.MALFORMED_LINK,
                "A publicação contém um link em formato inválido.",
                url.protocol
            );
            continue;
        }

        // Credencial embutida (`https://banco.com@phishing.com`) existe para
        // fazer o começo da URL parecer um site confiável. Nenhum link legítimo
        // de evento usa isso.
        if (url.username.length > 0 || url.password.length > 0) {
            add(
                ValidationCode.BLOCKED_LINK,
                "A publicação contém um link que não pode ser compartilhado.",
                url.hostname
            );
            continue;
        }

        if (isSuspiciousHost(url.hostname)) {
            add(
                ValidationCode.BLOCKED_LINK,
                "A publicação contém um link que não pode ser compartilhado.",
                url.hostname
            );
            continue;
        }

        const blocked =
            matchesDomain(url.hostname, BLOCKED_DOMAINS) ??
            matchesDomain(url.hostname, env.blocked_domains);

        if (blocked) {
            add(
                ValidationCode.BLOCKED_LINK,
                "A publicação contém um link que não pode ser compartilhado.",
                blocked
            );
            continue;
        }

        const shortener = matchesDomain(url.hostname, URL_SHORTENERS);
        if (shortener) {
            add(
                ValidationCode.SHORTENED_LINK,
                "Links encurtados não são permitidos. Use o endereço completo.",
                shortener
            );
        }
    }

    return { issues, auditDetails };
};
