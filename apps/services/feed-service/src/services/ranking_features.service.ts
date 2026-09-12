import {
    CounterIncrement,
    RankingCountersRepository,
} from "../repositories/ranking_counters.repository";
import { InteractionsRawEvent } from "../schema/events/interactions-raw.schema";
import { affinityFromCounts } from "../ranking/affinity";
import { ItemFeatures, SignalCounts, SignalType, isSignalType } from "../ranking/types";
import { RankingWeights, getWeights } from "../ranking/weights";

/** Um candidato do feed, com o mínimo que o ranking precisa saber sobre ele. */
export interface FeedCandidate {
    itemId: string;
    authorId: string | null;
    createdAt: Date;
}

const MS_PER_HOUR = 60 * 60 * 1000;

// Separador da chave composta (leitor + autor). Byte nulo não aparece em id vindo de
// JSON, então não há risco de duas chaves diferentes colidirem numa só.
const KEY_SEPARATOR = "\u0000";

/**
 * Agregação de sinais para o ranking, mantida por este serviço.
 *
 * Este serviço consome `interactions.raw` e mantém os próprios contadores, em vez de
 * consultar o `interaction-service`. O motivo é o caminho de leitura: a ordem do feed
 * nasce no request (decisão D2), e uma chamada síncrona a outro serviço ali colocaria
 * latência de rede no ponto mais quente do produto. Duplicar incremento de contador é
 * barato; acoplar a leitura do feed à disponibilidade de outro serviço não é.
 *
 * O armazenamento é Cassandra, não Redis, porque o modelo de contador nativo resolve
 * o caso de uso: incremento atômico, partição minúscula por item e uma query de
 * partição para toda a afinidade de um leitor. Este serviço não usa Redis em nenhum
 * lugar do `src`, e reintroduzi-lo exigiria justificar por que o Cassandra não serve.
 * A contrapartida é que contador não aceita TTL — está documentado no repository.
 */
export class RankingFeaturesService {
    constructor(
        private readonly countersRepository: RankingCountersRepository = new RankingCountersRepository()
    ) { }

    /**
     * Aplica um lote de interações aos contadores.
     *
     * Agrega em memória antes de escrever: um lote de 50 impressões do mesmo item
     * vira UM incremento de +50, não 50 incrementos de +1. No volume projetado essa
     * diferença é a maior economia de escrita do fluxo.
     */
    async handleInteractions(event: InteractionsRawEvent): Promise<void> {
        const byItem = new Map<string, Map<string, number>>();
        const byUserAuthor = new Map<string, Map<string, number>>();

        for (const interaction of event.interactions) {
            addDelta(byItem, interaction.itemId, interaction.type);

            // Sem autor conhecido, o sinal ainda conta para o item, mas não há a quem
            // atribuir afinidade. Inventar um autor aqui corromperia o dado.
            if (interaction.authorId) {
                addDelta(
                    byUserAuthor,
                    `${interaction.userId}${KEY_SEPARATOR}${interaction.authorId}`,
                    interaction.type
                );
            }
        }

        for (const [itemId, signals] of byItem) {
            await this.countersRepository.incrementItem(itemId, toIncrements(signals));
        }

        for (const [key, signals] of byUserAuthor) {
            const [userId, authorId] = key.split(KEY_SEPARATOR);
            await this.countersRepository.incrementUserAuthor(
                userId!,
                authorId!,
                toIncrements(signals)
            );
        }
    }

    /**
     * Monta as features dos candidatos de uma página de feed.
     *
     * Duas queries no total, independentemente da quantidade de candidatos: uma para
     * os contadores dos itens e uma para toda a afinidade do leitor. É o que mantém o
     * custo do ranking constante por request em vez de proporcional ao número de itens.
     *
     * Os pesos são lidos uma vez por chamada, para que a página inteira seja avaliada
     * com a mesma régua.
     */
    async buildItemFeatures(
        userId: string,
        candidates: readonly FeedCandidate[],
        now: Date,
        weights: RankingWeights = getWeights()
    ): Promise<ItemFeatures[]> {
        if (candidates.length === 0) { return []; }

        const [countsByItem, countsByAuthor] = await Promise.all([
            this.countersRepository.findCountsByItems(candidates.map((c) => c.itemId)),
            this.countersRepository.findCountsByUser(userId),
        ]);

        return candidates.map((candidate) => {
            const signals = toSignalCounts(countsByItem[candidate.itemId] ?? {});
            const authorCounts = candidate.authorId
                ? toSignalCounts(countsByAuthor[candidate.authorId] ?? {})
                : {};

            return {
                itemId: candidate.itemId,
                ageHours: (now.getTime() - candidate.createdAt.getTime()) / MS_PER_HOUR,
                impressions: signals.IMPRESSION ?? 0,
                signals,
                affinity: affinityFromCounts(
                    authorCounts,
                    weights.signals,
                    weights.affinitySaturation
                ),
            };
        });
    }
}

function addDelta(target: Map<string, Map<string, number>>, key: string, signalType: string): void {
    const signals = target.get(key) ?? new Map<string, number>();

    signals.set(signalType, (signals.get(signalType) ?? 0) + 1);
    target.set(key, signals);
}

function toIncrements(signals: Map<string, number>): CounterIncrement[] {
    return [...signals].map(([signalType, delta]) => ({ signalType, delta }));
}

/**
 * Filtra o que veio do banco para os sinais que o ranking conhece.
 *
 * Sinal desconhecido é descartado em vez de virar chave solta: um tipo novo no
 * produtor não deve alterar score antes de alguém definir o peso dele aqui.
 */
function toSignalCounts(raw: Record<string, number>): SignalCounts {
    const counts: SignalCounts = {};

    for (const [signal, count] of Object.entries(raw)) {
        if (!isSignalType(signal)) { continue; }

        counts[signal] = count;
    }

    return counts;
}
