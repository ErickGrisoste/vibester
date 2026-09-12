import { z } from "zod";
import { SignalType } from "./types";

/**
 * Pesos do ranking, em config recarregável (decisão D4).
 *
 * Ficam fora do código compilado de propósito: ajustar ranking é trabalho de
 * produto que acontece em horas, não em ciclos de deploy. O caminho de carga real
 * (ConfigMap ou Redis) é ligado na fase 2 — `loadWeights` já existe e valida, o que
 * falta é a fonte.
 *
 * ## Como estes números foram escolhidos
 *
 * Estágio 1, sem dado: chute ancorado em `LIKE = 1`, com faixa comprimida entre 1 e
 * 5 para os positivos. A faixa é estreita de propósito — errar dentro dela causa
 * pouco estrago, e nenhum dos números aqui é defensável ainda.
 *
 * Os negativos são desproporcionais por assimetria de custo: mostrar algo que a
 * pessoa pediu para não ver custa muito mais do que deixar de mostrar algo que ela
 * talvez gostasse.
 *
 * `EVENT_CHECKIN = 10` rompe a faixa de propósito: é o único sinal que prova que o
 * app fez alguém sair de casa. Nenhum feed genérico tem isso.
 *
 * Estágio 2, com ~1 mês de dado: medir retenção por ação e substituir o chute por
 *   peso(ação) = (retenção_da_ação − base) / (retenção_do_like − base)
 * É correlação, não causalidade — serve para ordenar, não para afirmar causa.
 */
const signalWeightsSchema = z.object({
    IMPRESSION: z.number(),
    DWELL: z.number(),
    SKIP: z.number(),
    TAP_DETAIL: z.number(),
    PROFILE_OPEN: z.number(),
    NOT_INTERESTED: z.number(),
    DIRECTIONS_CLICK: z.number(),
    TICKET_CLICK: z.number(),
    LIKE: z.number(),
    UNLIKE: z.number(),
    COMMENT: z.number(),
    FOLLOW: z.number(),
    SAVE: z.number(),
    EVENT_CHECKIN: z.number(),
});

export const rankingWeightsSchema = z.object({
    /** Versão da config. Sobe junto com qualquer mudança de peso, para aparecer no log. */
    version: z.string().min(1),

    signals: signalWeightsSchema,

    /** Quanto a taxa de engajamento suavizada pesa no score. */
    engagementWeight: z.number().nonnegative(),
    /** Quanto a afinidade leitor-autor pesa no score. */
    affinityWeight: z.number().nonnegative(),

    /** Meia-vida do decaimento por idade, em horas. */
    halfLifeHours: z.number().positive(),

    /** Suavização da taxa: média a priori e seu peso em impressões. */
    priorRate: z.number().min(0).max(1),
    priorWeight: z.number().nonnegative(),

    /** Quantos pontos ponderados valem meia afinidade. Ver src/ranking/affinity.ts. */
    affinitySaturation: z.number().positive(),
});

export type RankingWeights = z.infer<typeof rankingWeightsSchema>;
export type SignalWeights = Record<SignalType, number>;

export const DEFAULT_WEIGHTS: RankingWeights = {
    version: "2026-09-12.chute-inicial",

    signals: {
        // Denominador, não numerador — nunca entra na soma de ações.
        IMPRESSION: 0,

        // Positivos, faixa comprimida 1 a 5, ancorados em LIKE = 1.
        LIKE: 1,
        DWELL: 1,
        TAP_DETAIL: 2,
        PROFILE_OPEN: 2,
        COMMENT: 3,
        FOLLOW: 4,
        SAVE: 4,
        DIRECTIONS_CLICK: 4,
        TICKET_CLICK: 5,

        // Rompe a faixa: prova de comportamento no mundo real.
        EVENT_CHECKIN: 10,

        // Negativos desproporcionais, por assimetria de custo.
        SKIP: -1,
        UNLIKE: -2,
        NOT_INTERESTED: -10,
    },

    engagementWeight: 1,
    affinityWeight: 0.6,

    // 8h: um post de ontem à noite não concorre com o de hoje.
    halfLifeHours: 8,

    // 8% de taxa média e 50 impressões de crédito a priori. Ambos são chute e
    // devem ser recalibrados assim que houver um mês de impressão real.
    priorRate: 0.08,
    priorWeight: 50,

    // 20 pontos = meia afinidade. Uma dezena de curtidas mais um comentário no mesmo
    // autor chega perto disso. Chute, como o resto.
    affinitySaturation: 20,
};

let current: RankingWeights = DEFAULT_WEIGHTS;

export function getWeights(): RankingWeights {
    return current;
}

/**
 * Substitui os pesos em uso.
 *
 * Config inválida **não** derruba o serviço nem entra em uso: o feed continua
 * rankeando com os pesos anteriores e o erro é devolvido para quem chamou logar.
 * Um feed com peso errado é pior que um feed com peso velho.
 */
export function loadWeights(raw: unknown): { ok: true; weights: RankingWeights } | { ok: false; error: string } {
    const parsed = rankingWeightsSchema.safeParse(raw);

    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
        };
    }

    current = parsed.data;

    return { ok: true, weights: parsed.data };
}

/** Volta para o chute inicial. Existe para teste e para desligar um experimento ruim. */
export function resetWeights(): void {
    current = DEFAULT_WEIGHTS;
}
