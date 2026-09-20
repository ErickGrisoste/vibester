import { createHash } from "crypto";

/**
 * Bucketing determinístico de experimentos (decisão D8).
 *
 * A regra que torna tudo o resto possível: o bucket sai de
 * `hash(userId + nomeDoExperimento)`, nunca de `Math.random()` nem de estado em
 * memória. Consequências práticas:
 *
 * - a mesma pessoa cai sempre no mesmo grupo, em qualquer pod e depois de qualquer
 *   redeploy. Sem isso, alguém veria feed rankeado num request e cronológico no
 *   seguinte, o que não é experimento, é bug;
 * - o nome do experimento entra no hash, então dois experimentos simultâneos
 *   distribuem as pessoas de forma independente. Se o hash fosse só do `userId`,
 *   quem caísse no grupo A de um experimento cairia no grupo A de todos, e os
 *   efeitos ficariam impossíveis de separar.
 */

/** Posição estável da pessoa no intervalo [0, 1) para um dado experimento. */
export function bucketFraction(userId: string, experimentName: string): number {
    const digest = createHash("sha256").update(`${userId}:${experimentName}`).digest();

    // 32 bits são resolução mais que suficiente para dividir tráfego e evitam
    // qualquer questão de precisão de ponto flutuante em inteiro grande.
    const value = digest.readUInt32BE(0);

    return value / 2 ** 32;
}

export interface Variant {
    name: string;
    /** Fatia do tráfego, em [0, 1]. A soma de todas deve dar 1. */
    share: number;
}

/**
 * Escolhe a variante da pessoa somando as fatias em ordem.
 *
 * A ordem das variantes importa e é parte do contrato: reordenar a lista remove
 * pessoas de grupos em que já estavam, e invalida o experimento em andamento. Ao
 * mudar um experimento, crie um nome novo em vez de mexer na lista do antigo.
 */
export function assignVariant(
    userId: string,
    experimentName: string,
    variants: readonly Variant[]
): string {
    if (variants.length === 0) {
        throw new Error("assignVariant exige ao menos uma variante");
    }

    const fraction = bucketFraction(userId, experimentName);
    let cumulative = 0;

    for (const variant of variants) {
        cumulative += variant.share;

        if (fraction < cumulative) { return variant.name; }
    }

    // Só chega aqui se as fatias somarem menos de 1 (config incompleta).
    // Cair na última variante é mais seguro que devolver undefined no caminho do feed.
    return variants[variants.length - 1]!.name;
}

/**
 * Nome do holdout cronológico permanente.
 *
 * É uma constante e **nunca deve mudar**: trocar a string reembaralha quem está no
 * holdout e joga fora a série histórica que dá sentido a ele.
 */
export const CHRONOLOGICAL_HOLDOUT = "chronological-holdout-v1";

/** Fatia permanente que continua vendo feed cronológico. */
export const HOLDOUT_SHARE = 0.05;

/**
 * A pessoa está no holdout permanente?
 *
 * 5% do público nunca recebe ranking, para sempre. É o preço de conseguir responder
 * "o ranking melhorou o produto?" em vez de "o engajamento subiu, e vai saber por
 * quê". Sem grupo de controle, sazonalidade, campanha de marketing e mudança de
 * ranking ficam indistinguíveis.
 *
 * Usa um nome de experimento próprio, então esses 5% são independentes de qualquer
 * teste A/B rodando em paralelo.
 */
export function isInChronologicalHoldout(userId: string): boolean {
    return bucketFraction(userId, CHRONOLOGICAL_HOLDOUT) < HOLDOUT_SHARE;
}
