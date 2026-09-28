import { createHash } from "crypto";
import { env } from "../config/env";
import { BLOCKLIST_VERSION } from "../rules/data/blocklist";
import type { ValidationInput } from "../types/validation.types";

/**
 * Versão do formato da chave. Suba ao mudar o que entra no hash — é o que
 * garante que uma chave velha nunca seja lida como se fosse do formato novo.
 */
const KEY_FORMAT_VERSION = 1;

/**
 * Chave de cache do veredito.
 *
 * O hash inclui, além do conteúdo, **tudo que muda o veredito para o mesmo
 * conteúdo**: a versão da blocklist, os limites configurados e a flag de
 * palavrão. Sem isso, a moderação desligaria `PROFANITY_BLOCKS` e continuaria
 * rejeitando post por até um TTL inteiro, porque o veredito antigo seguiria no
 * Redis — o tipo de bug que só aparece em produção e some quando se vai
 * investigar.
 *
 * `mediaCount` entra normalizado como "tem mídia ou não": é só isso que a regra
 * de vazio olha, e guardar o número exato fragmentaria o cache sem motivo.
 *
 * SHA-256 e não uma hash rápida: a chave é derivada de texto do usuário, e uma
 * hash não criptográfica permitiria forjar colisão para receber o veredito de
 * outro texto.
 */
export function contentHash(input: ValidationInput): string {
    const payload = JSON.stringify({
        v: KEY_FORMAT_VERSION,
        b: BLOCKLIST_VERSION,
        content: input.content,
        // Ordenado: a mesma legenda com as tags em outra ordem é o mesmo veredito.
        tags: [...input.tags].sort(),
        hasMedia: input.mediaCount > 0,
        limits: {
            length: env.max_content_length,
            tags: env.max_tags,
            links: env.max_links,
            profanity: env.profanity_blocks,
            domains: [...env.blocked_domains].sort().join(","),
        },
    });

    return createHash("sha256").update(payload).digest("hex");
}

/** Namespace do Redis. `pv` = post-validation. */
export function cacheKey(hash: string): string {
    return `pv:verdict:${hash}`;
}
