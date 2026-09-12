import { SignalCounts, SignalType } from "./types";

/**
 * Taxa de engajamento SUAVIZADA.
 *
 * O problema que isso resolve: um post com 1 curtida em 2 impressões tem taxa de
 * 50%, igual a um post com 5.000 curtidas em 10.000 impressões. A primeira taxa é
 * ruído, a segunda é evidência — e a média crua não distingue as duas.
 *
 * A suavização puxa a taxa para uma média a priori da plataforma, com força
 * proporcional à falta de evidência. Com `priorRate = 0.08` e `priorWeight = 50`,
 * a MESMA taxa crua de 50% vira:
 *
 * | ações / impressões | taxa crua | suavizada |
 * |--------------------|-----------|-----------|
 * | 1 / 2              | 50%       | ~9,6%     |
 * | 10 / 20            | 50%       | ~20%      |
 * | 50 / 100           | 50%       | ~36%      |
 * | 500 / 1.000        | 50%       | ~48%      |
 * | 5.000 / 10.000     | 50%       | ~49,8%    |
 *
 * Ou seja: só quem tem volume consegue reivindicar uma taxa alta. `priorWeight` é
 * literalmente "quantas impressões de crédito a priori" — 50 significa que um item
 * precisa de dezenas de impressões antes de a taxa dele dominar o palpite.
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
