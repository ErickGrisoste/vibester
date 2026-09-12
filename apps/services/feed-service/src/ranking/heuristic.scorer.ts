import { ItemFeatures, RankingContext, ScoredItem, Scorer } from "./types";
import { qualityMultiple, recencyDecay, smoothedEngagementRate, weightedActions } from "./engagement";
import { RankingWeights, getWeights } from "./weights";

/**
 * Scorer heurístico — o ranking do estágio 1.
 *
 * Forma do score:
 *
 *   base  = engagementWeight × qualidadeNormalizada + affinityWeight × afinidade
 *   score = base × decaimentoPorIdade
 *
 * O decaimento multiplica em vez de somar porque num app de vida noturna a
 * recência é validade, não preferência: um post excelente de anteontem deve
 * mesmo ir para perto de zero, não ficar competindo com o de hoje.
 *
 * A penalidade negativa já está embutida na taxa suavizada, porque os sinais
 * negativos entram com peso negativo na ação ponderada — um item com muitos
 * `NOT_INTERESTED` tem numerador negativo e afunda sozinho.
 *
 * Função pura sobre features: nenhum I/O, nada de relógio global (o instante vem
 * no contexto). É o que permite testar com fixtures e comparar duas versões de
 * peso sobre exatamente o mesmo input.
 */
export class HeuristicScorer implements Scorer {
    readonly name: string;

    /**
     * Os pesos são lidos UMA vez na construção, não a cada item.
     *
     * Isso garante que um request inteiro seja rankeado com a mesma config: se os
     * pesos recarregassem no meio, dois itens da mesma página seriam comparados com
     * réguas diferentes, e a ordem resultante não corresponderia a nenhuma das duas.
     */
    constructor(private readonly weights: RankingWeights = getWeights()) {
        this.name = `heuristic@${weights.version}`;
    }

    score(item: ItemFeatures, _context: RankingContext): ScoredItem {
        const actions = weightedActions(item.signals, this.weights.signals);

        const rate = smoothedEngagementRate(actions, item.impressions, {
            priorRate: this.weights.priorRate,
            priorWeight: this.weights.priorWeight,
        });

        // Normalizado pela média da plataforma: 1 = item médio. Ver qualityMultiple.
        const quality = qualityMultiple(rate, this.weights.priorRate);
        const engagement = this.weights.engagementWeight * quality;
        const affinity = this.weights.affinityWeight * item.affinity;
        const decay = recencyDecay(item.ageHours, this.weights.halfLifeHours);

        const score = (engagement + affinity) * decay;

        return {
            itemId: item.itemId,
            score,
            // Guardar as parcelas é o que diferencia "ranking ruim" de "bug no
            // ranking" quando alguém reclamar de um item na posição errada.
            breakdown: {
                weightedActions: actions,
                smoothedRate: rate,
                qualityMultiple: quality,
                engagement,
                affinity,
                decay,
            },
        };
    }
}

/**
 * Scorer cronológico — a régua de comparação.
 *
 * É o que o holdout permanente de 5% recebe (decisão D8) e o que o feed serve hoje.
 * Sem ele não existe forma de afirmar que o ranking melhorou algo: "engajamento
 * subiu" sem grupo de controle pode ser só sazonalidade.
 *
 * Score = recência pura, então a ordem é a mesma de `ORDER BY created_at DESC`.
 */
export class ChronologicalScorer implements Scorer {
    readonly name = "chronological";

    score(item: ItemFeatures, _context: RankingContext): ScoredItem {
        const score = -item.ageHours;

        return {
            itemId: item.itemId,
            score,
            breakdown: { ageHours: item.ageHours },
        };
    }
}
