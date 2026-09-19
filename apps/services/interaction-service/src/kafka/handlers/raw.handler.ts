import { interactionsRawMessageSchema } from "../../schema/interaction.schema";
import { NormalizedInteraction } from "../../types/interaction.types";

/**
 * Traduz uma mensagem de `interactions.raw` na lista de interações a persistir.
 *
 * Revalida mesmo tendo sido validada na API: o worker não pode confiar que só a
 * nossa API escreve no tópico, e uma linha malformada que chegasse ao driver do
 * Cassandra derrubaria o lote inteiro.
 *
 * Devolve lista vazia quando a mensagem é inválida — sem lançar, para não travar
 * a partição em retry infinito por causa de uma mensagem envenenada.
 */
export function mapRawMessage(rawValue: string): NormalizedInteraction[] {
    let parsed: unknown;

    try {
        parsed = JSON.parse(rawValue);
    } catch {
        return [];
    }

    const result = interactionsRawMessageSchema.safeParse(parsed);

    if (!result.success) {
        return [];
    }

    return result.data.interactions;
}
