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
 * Escala de **teto 100**, vinda do catálogo de ações do desenho do produto. O valor
 * é "quanto aquela ação vale" numa régua em que o máximo é 100:
 *
 * | Ação               | Peso | Por quê |
 * |--------------------|------|---------|
 * | `COMMENT`          | 100  | Exige digitar: "quero participar disso" |
 * | `EVENT_CHECKIN`    | 100  | Apareceu no lugar. O único sinal que prova que o app fez alguém sair de casa |
 * | `TICKET_CLICK`     |  80  | Intenção de compra |
 * | `LIKE`             |  60  | Um toque: "ok, gostei" |
 * | `SAVE`             |  50  | "Quero isso depois" — num app de rolê, quase um "vou nesse lugar" |
 * | `TAP_DETAIL`       |  40  | Abriu o item |
 * | `PROFILE_OPEN`     |  40  | "Quem é essa pessoa?" |
 * | `FOLLOW`           |  40  | Mexe no grafo, não só no gosto |
 * | `DWELL`            |  20  | Passou de ~5s no item: atenção sem compromisso |
 * | `DIRECTIONS_CLICK` |  20  | Abriu o mapa — quase um check-in adiantado |
 *
 * ## A exceção ao teto: `NOT_INTERESTED = -200`
 *
 * Negativos são desproporcionais por assimetria de custo: mostrar algo que a pessoa
 * pediu para não ver custa muito mais do que deixar de mostrar algo que ela talvez
 * gostasse. Com o teto aplicado, `NOT_INTERESTED` ficaria em -100 e apenas EMPATARIA
 * com um comentário — a assimetria morreria. Por decisão de produto ele rompe o teto e
 * vale o dobro do positivo mais forte. É o dado mais limpo do sistema: a pessoa
 * literalmente contou.
 *
 * ## Três valores que o catálogo não define, e que foram escolhidos aqui
 *
 * - `IMPRESSION = 0`. O catálogo lista 5, mas impressão é o **denominador** da taxa.
 *   Com peso positivo no numerador, `(5×impressões + ...) / impressões` nunca cai
 *   abaixo de 5 e a taxa perde o sentido. `weightedActions` também a ignora em
 *   código, então o único valor coerente aqui é zero.
 * - `SKIP = -30`. O catálogo descreve `FAST_SKIP` como julgamento, mas não dá número.
 *   Escolhido menos severo que `NOT_INTERESTED` porque é inferido, não declarado.
 * - `UNLIKE = -60`. Não está no catálogo; é o espelho exato de `LIKE`.
 *
 * ## Estágio 2
 *
 * Com ~1 mês de dado: medir retenção por ação e substituir o chute por
 *   peso(ação) = (retenção_da_ação − base) / (retenção_do_like − base) × 60
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

    /** Quanto a qualidade normalizada do item pesa no score. */
    engagementWeight: z.number().nonnegative(),
    /** Quanto o tempo médio de atenção normalizado pesa no score. */
    dwellWeight: z.number().nonnegative(),
    /** Quanto a afinidade leitor-autor pesa no score. */
    affinityWeight: z.number().nonnegative(),

    /** Meia-vida do decaimento por idade do item, em horas. */
    halfLifeHours: z.number().positive(),

    /**
     * τ da afinidade com autor, em dias: a velocidade com que o perfil esquece.
     *
     * Entra como `e^(−Δt/τ)`: depois de τ dias uma interação vale 37% do original.
     * Ver src/ranking/decay.ts. Atenção: τ é aplicado na escrita e na leitura; trocar o
     * valor mistura as duas réguas até o histórico antigo decair (alguns τ).
     */
    affinityTauDays: z.number().positive(),

    /**
     * Suavização da taxa.
     *
     * `priorRate` é a média da plataforma em **pontos ponderados por impressão**, não
     * em fração: na escala de teto 100 ela não cabe mais em [0, 1]. Com 4% de
     * engajamento médio e `LIKE = 60`, são 2,4 pontos por impressão.
     */
    priorRate: z.number().nonnegative(),
    priorWeight: z.number().nonnegative(),

    /**
     * Tempo médio de exibição da plataforma, em ms: o palpite a priori da suavização
     * do dwell. Usa o mesmo `priorWeight` da taxa.
     */
    priorDwellMs: z.number().positive(),

    /** Quantos pontos ponderados valem meia afinidade. Ver src/ranking/affinity.ts. */
    affinitySaturation: z.number().positive(),
});

export type RankingWeights = z.infer<typeof rankingWeightsSchema>;
export type SignalWeights = Record<SignalType, number>;

export const DEFAULT_WEIGHTS: RankingWeights = {
    version: "2026-09-14.teto-100+dwell+assimetria+decaimento",

    signals: {
        // Denominador, não numerador — ver a nota acima.
        IMPRESSION: 0,

        COMMENT: 100,
        EVENT_CHECKIN: 100,
        TICKET_CLICK: 80,
        LIKE: 60,
        SAVE: 50,
        TAP_DETAIL: 40,
        PROFILE_OPEN: 40,
        FOLLOW: 40,
        DWELL: 20,
        DIRECTIONS_CLICK: 20,

        SKIP: -30,
        UNLIKE: -60,
        // Rompe o teto de propósito: o dobro do positivo mais forte. Ver a nota acima.
        NOT_INTERESTED: -200,
    },

    // O termo de engajamento entra NORMALIZADO pela média da plataforma (ver
    // `qualityMultiple`), então 1 significa "um item médio contribui 1". É o que mantém
    // engajamento e afinidade na mesma ordem de grandeza — sem a normalização, trocar a
    // escala dos pesos faria o engajamento crescer 60× e a afinidade virar ruído.
    engagementWeight: 1,
    // Atenção entra ao lado do engajamento com metade do peso: é o sinal mais honesto
    // que existe, mas é passivo, e o catálogo não dá número para ele no score. Chute.
    dwellWeight: 0.5,
    affinityWeight: 0.6,

    // 8h: um post de ontem à noite não concorre com o de hoje.
    halfLifeHours: 8,

    // 30 dias, como no desenho do perfil: amizade não muda em uma semana. Uma curtida
    // de um mês atrás vale 37% de uma de hoje; de três meses, 5%.
    affinityTauDays: 30,

    // 4% de engajamento médio × peso 60 do like = 2,4 pontos por impressão.
    // 30 impressões de crédito a priori, como o catálogo sugere (C ≈ 30).
    // Ambos são chute e devem ser recalibrados com um mês de impressão real.
    priorRate: 2.4,
    priorWeight: 30,

    // 3s de atenção média por impressão. Chute até existir impressão real.
    priorDwellMs: 3000,

    // 800 pontos = meia afinidade, o que na escala de teto 100 equivale a umas 10
    // curtidas mais 2 comentários no mesmo autor. Chute, como o resto.
    affinitySaturation: 800,
};

let current: RankingWeights = DEFAULT_WEIGHTS;

export function getWeights(): RankingWeights {
    return current;
}

/**
 * Substitui os pesos em uso.
 *
 * Config inválida **não** entra em uso nem derruba o serviço: o feed continua
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
