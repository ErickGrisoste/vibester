import { SignalCounts, SignalType } from "./types";

/**
 * Taxa de engajamento SUAVIZADA.
 *
 * O problema que isso resolve: um post com 1 curtida em 2 impressões tem taxa de
 * 50%, igual a um post com 5.000 curtidas em 10.000 impressões. A primeira taxa é
 * ruído, a segunda é evidência — e a média crua não distingue as duas.
 *
 * A suavização puxa a taxa para uma média a priori da plataforma, com força
 * proporcional à falta de evidência. A taxa é medida em **pontos ponderados por
 * impressão** (escala de teto 100, onde `LIKE = 60`), não em fração.
 *
 * Com `priorRate = 2,4` (4% de engajamento médio × 60) e `priorWeight = 30`, a MESMA
 * proporção crua de "metade de quem viu curtiu" vira:
 *
 * | curtidas / impressões | pontos/impressão cru | suavizado | vezes a média |
 * |-----------------------|----------------------|-----------|---------------|
 * | 1 / 2                 | 30                   | 4,1       | **1,7×**      |
 * | 10 / 20               | 30                   | 13,4      | 5,6×          |
 * | 50 / 100              | 30                   | 23,6      | 9,9×          |
 * | 500 / 1.000           | 30                   | 29,2      | 12,2×         |
 * | 5.000 / 10.000        | 30                   | 29,9      | **12,5×**     |
 *
 * Ou seja: só quem tem volume consegue reivindicar qualidade alta. `priorWeight` é
 * literalmente "quantas impressões de crédito a priori" — 30 significa que aos 30
 * impressões o item passa a ser acreditado meio a meio com a média da plataforma.
 *
 * A suavização se desliga sozinha: com 10 mil impressões, as 30 fantasmas são 0,3%
 * do total e desaparecem. Nunca é preciso desativá-la.
 */
export interface SmoothingConfig {
    /** Taxa média da plataforma, usada como palpite inicial. */
    priorRate: number;
    /** Peso da média a priori, em unidades de impressão. */
    priorWeight: number;
}

export function smoothedEngagementRate(
    weightedActions: number,
    impressions: number,
    config: SmoothingConfig
): number {
    const { priorRate, priorWeight } = config;

    // Impressão negativa ou denominador zero: devolve a priori em vez de dividir
    // por zero. Item sem impressão não é item ruim, é item não medido.
    if (impressions <= 0) { return priorRate; }

    return (weightedActions + priorWeight * priorRate) / (impressions + priorWeight);
}

/**
 * Converte contagem de sinais em uma única "ação ponderada".
 *
 * Aqui está o produto, não a matemática: **os pesos definem que conteúdo vai
 * existir na plataforma em dois anos.** Peso alto em comentário ensina criadores a
 * produzir treta; peso alto em check-in ensina a organizar rolê que as pessoas
 * realmente frequentam.
 *
 * `IMPRESSION` não entra na soma de propósito — ela é o denominador, não o
 * numerador. Somá-la aqui seria contar a exibição como se fosse engajamento.
 */
export function weightedActions(
    signals: SignalCounts,
    signalWeights: Record<SignalType, number>
): number {
    let total = 0;

    for (const [signal, count] of Object.entries(signals) as [SignalType, number][]) {
        if (signal === "IMPRESSION") { continue; }
        if (!count) { continue; }

        total += count * (signalWeights[signal] ?? 0);
    }

    return total;
}

/**
 * Decaimento exponencial por idade, com meia-vida configurável.
 *
 * Num app de vida noturna a recência não é preferência, é validade: um post da
 * festa de ontem não concorre com o de hoje. Com meia-vida de 8h, um item de 24h
 * vale 12,5% do que valia ao nascer.
 */
export function recencyDecay(ageHours: number, halfLifeHours: number): number {
    if (halfLifeHours <= 0) { return 1; }

    // Idade negativa (relógio fora de sincronia) é tratada como recém-criado, em
    // vez de virar um bônus por estar "no futuro".
    const age = Math.max(0, ageHours);

    return Math.pow(0.5, age / halfLifeHours);
}

/**
 * Qualidade do item em **múltiplos da média da plataforma**.
 *
 * Existe para tornar o score independente da escala dos pesos. Sem isso, trocar a
 * régua dos sinais (de "âncora em 1" para "teto 100", por exemplo) multiplicaria o
 * termo de engajamento por 60 e a afinidade — que vive em [0, 1] — viraria ruído
 * irrelevante no score. Normalizando, um item médio vale 1 em qualquer escala.
 *
 * Leitura direta: 1 é média, 2 é o dobro da média, 0,5 é metade.
 */
export function qualityMultiple(smoothedRate: number, priorRate: number): number {
    // Sem média a priori não há como normalizar; devolve a taxa crua em vez de dividir
    // por zero, e quem configurou assim vai ver números fora de escala no breakdown.
    if (priorRate <= 0) { return smoothedRate; }

    return smoothedRate / priorRate;
}
