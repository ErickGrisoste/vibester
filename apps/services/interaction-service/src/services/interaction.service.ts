import { InteractionBatchInput } from "../schema/interaction.schema";
import { NormalizedInteraction } from "../types/interaction.types";
import { publishInteractions } from "../kafka/producer";

export interface IngestResult {
    accepted: number;
    duplicatesInBatch: number;
}

export class InteractionService {
    /**
     * Caminho quente da ingestão: normaliza e publica no Kafka. **Não escreve no
     * banco.** Quem persiste é o worker.
     *
     * O motivo é volumetria: no volume projetado são ~1,2M impressões/dia. Se a
     * API escrevesse no Cassandra de forma síncrona, cada request carregaria a
     * latência do banco e uma oscilação do Astra derrubaria a coleta inteira.
     * Publicando no Kafka, o pior caso é atraso na persistência — não perda.
     */
    constructor(
        private readonly publish: typeof publishInteractions = publishInteractions
    ) { }

    async ingest(accountId: string, batch: InteractionBatchInput): Promise<IngestResult> {
        const normalized = this.normalize(accountId, batch);

        if (normalized.length > 0) {
            await this.publish(accountId, normalized);
        }

        return {
            accepted: normalized.length,
            duplicatesInBatch: batch.events.length - normalized.length,
        };
    }

    /**
     * Converte o payload do cliente no formato canônico.
     *
     * `userId` sai SEMPRE do token (`accountId`), nunca do body — é o que impede
     * alguém de registrar interação em nome de outra pessoa.
     *
     * Duplicata de `eventId` dentro do mesmo lote é descartada aqui em vez de no
     * banco: retry de rede no cliente é comum e reenviar o lote inteiro não deve
     * custar escritas repetidas. Duplicata entre lotes diferentes é resolvida pela
     * chave primária do Cassandra.
     */
    private normalize(accountId: string, batch: InteractionBatchInput): NormalizedInteraction[] {
        const seen = new Set<string>();
        const normalized: NormalizedInteraction[] = [];

        for (const event of batch.events) {
            if (seen.has(event.eventId)) {
                continue;
            }

            seen.add(event.eventId);

            normalized.push({
                userId: accountId,
                eventId: event.eventId,
                type: event.type,
                itemId: event.itemId,
                itemType: event.itemType,
                occurredAt: new Date(event.occurredAt).toISOString(),
                authorId: event.authorId ?? null,
                sessionId: batch.sessionId,
                position: event.position ?? null,
                dwellMs: event.dwellMs ?? null,
                source: event.source ?? null,
            });
        }

        return normalized;
    }
}
