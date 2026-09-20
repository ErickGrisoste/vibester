import { weightedActions } from "./engagement";
import { SignalCounts } from "./types";
import { SignalWeights } from "./weights";

/**
 * Afinidade de um leitor com um autor, em [0, 1).
 *
 * A entrada é **contagem de sinais**, não um score pronto. Isso é deliberado: um
 * score gravado tem os pesos embutidos nele, e no dia em que os pesos forem
 * recalibrados — que é o estágio 2 previsto do método — todo score gravado viraria
 * lixo silencioso. Guardando contagem, a afinidade é derivada com os pesos vigentes
 * a cada leitura, e recalibrar peso é trocar config, não reprocessar histórico.
 *
 * A saturação resolve o problema de escala: a soma ponderada é ilimitada (alguém
 * com 500 curtidas num autor teria afinidade 500), mas o scorer espera [0, 1].
 * `pontos / (pontos + saturação)` satura suavemente, sem precisar de corte:
 *
 * | pontos ponderados | afinidade (saturação 20) |
 * |-------------------|--------------------------|
 * | 0                 | 0                        |
 * | 5                 | 0,20                     |
 * | 20                | 0,50                     |
 * | 60                | 0,75                     |
 * | 500               | 0,96                     |
 *
 * `saturação` é literalmente "quantos pontos valem meia afinidade", e por isso mora
 * na config junto dos pesos.
 *
 * Pontuação negativa (leitor que só deu `NOT_INTERESTED` naquele autor) devolve 0,
 * não valor negativo: afinidade é o quanto alguém gosta, e a rejeição já entra no
 * score por outro caminho — pelos contadores do item. Deixar afinidade negativa
 * puniria duas vezes o mesmo sinal.
 */
export function affinityFromCounts(
    counts: SignalCounts,
    signalWeights: SignalWeights,
    saturation: number
): number {
    const points = weightedActions(counts, signalWeights);

    if (points <= 0) { return 0; }
    if (saturation <= 0) { return 1; }

    return points / (points + saturation);
}
