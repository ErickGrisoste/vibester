/**
 * Decaimento temporal da afinidade — o perfil que esquece.
 *
 * Sem esquecimento o perfil vira museu: guarda quem a pessoa FOI, não quem ela É.
 * Quem passou três meses indo a festa techno e parou há seis continuaria recebendo
 * techno para sempre. Com `e^(−Δt/τ)` e τ = 30 dias, uma interação vale:
 *
 * | depois de | vale |
 * |-----------|------|
 * | hoje      | 1,00 |
 * | 7 dias    | 0,79 |
 * | 30 dias   | 0,37 |
 * | 90 dias   | 0,05 |
 *
 * ## A forma incremental é exata, não aproximação
 *
 *   novo = antigo × e^(−Δt/τ) + incremento
 *
 * dá exatamente o mesmo número que somar cada interação passada decaída pela própria
 * idade. Então basta guardar UM valor e o instante da última atualização por par
 * leitor-autor-sinal, em vez do histórico inteiro.
 *
 * Aqui o valor decaído é uma CONTAGEM por sinal (incremento 1), não um score com o peso
 * embutido. Como o decaimento é linear, aplicar os pesos na leitura dá o mesmo resultado
 * que aplicá-los na escrita — e os pesos continuam recarregáveis sem reprocessar nada.
 */

export interface DecayedValue {
    /** Valor já decaído até `updatedAt`. */
    value: number;
    /** Instante a que `value` se refere. */
    updatedAt: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fração que sobra depois de `elapsedMs`. Nunca maior que 1: o tempo só envelhece. */
export function decayFactor(elapsedMs: number, tauDays: number): number {
    // Sem τ não há esquecimento; tempo negativo (relógio adiantado) não rejuvenesce.
    if (tauDays <= 0 || elapsedMs <= 0) { return 1; }

    return Math.exp(-elapsedMs / (tauDays * MS_PER_DAY));
}

/** Valor visto no instante `at`. */
export function decayTo(current: DecayedValue, at: Date, tauDays: number): number {
    return current.value * decayFactor(at.getTime() - current.updatedAt.getTime(), tauDays);
}

/**
 * Aplica uma interação de peso `increment` ocorrida em `occurredAt`.
 *
 * Evento em ordem: envelhece o acumulado até o evento e soma o incremento cheio.
 *
 * Evento atrasado (ocorreu antes da última atualização — o app manda em lote, e um lote
 * pode chegar depois de outro): mantém a âncora e soma o incremento já envelhecido até
 * ela. Nunca rejuvenesce o acumulado, e o resultado é idêntico ao que seria com as
 * interações chegando em ordem perfeita.
 */
export function applyDecayedIncrement(
    current: DecayedValue | null,
    occurredAt: Date,
    increment: number,
    tauDays: number
): DecayedValue {
    if (!current) {
        return { value: increment, updatedAt: occurredAt };
    }

    const deltaMs = occurredAt.getTime() - current.updatedAt.getTime();

    if (deltaMs >= 0) {
        return {
            value: current.value * decayFactor(deltaMs, tauDays) + increment,
            updatedAt: occurredAt,
        };
    }

    return {
        value: current.value + increment * decayFactor(-deltaMs, tauDays),
        updatedAt: current.updatedAt,
    };
}
