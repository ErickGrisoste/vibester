import { Consumer } from "kafkajs";
import { kafka, INTERACTIONS_RAW_TOPIC } from "./client";
import { InteractionRepository } from "../repository/interaction.repository";
import { NormalizedInteraction } from "../types/interaction.types";
import { mapRawMessage } from "./handlers/raw.handler";
import { DOMAIN_TOPICS, isDomainTopic, mapDomainEvent } from "./handlers/domain.handler";
import { publishNormalizedInteractions } from "./producer";

const TOPICS = [INTERACTIONS_RAW_TOPIC, ...DOMAIN_TOPICS];

type PublishNormalized = (interactions: NormalizedInteraction[]) => Promise<void>;

export class InteractionConsumer {
    private consumer: Consumer | null = null;
    private running = false;

    constructor(
        private readonly repository = new InteractionRepository(),
        private readonly publish: PublishNormalized = publishNormalizedInteractions
    ) { }

    isRunning(): boolean {
        return this.running;
    }

    async start(): Promise<void> {
        this.consumer = kafka.consumer({
            groupId: "interaction-service-worker",
            sessionTimeout: 30000,
            heartbeatInterval: 10000,
        });

        await this.consumer.connect();

        // fromBeginning: false — na primeira subida não interessa reprocessar o
        // histórico de likes de meses atrás; o objetivo é começar a acumular agora.
        await this.consumer.subscribe({ topics: TOPICS, fromBeginning: false });

        await this.consumer.run({
            eachMessage: async ({ topic, message }) => {
                await this.processMessage(
                    topic,
                    message.value?.toString() ?? "",
                    message.timestamp
                );
            },
        });

        this.running = true;
    }

    /**
     * Processa uma mensagem: normaliza, persiste no log e republica no stream canônico.
     *
     * A republicação em `interactions.normalized` não é opcional. Sem ela, curtida,
     * comentário e follow — que chegam pelos tópicos dos serviços de origem, nunca por
     * `interactions.raw` — ficariam presos neste serviço, e o ranking do feed-service
     * rodaria para sempre sem o sinal mais comum que existe.
     *
     * Ordem: persistir ANTES de publicar. Se a publicação falhar, a exceção propaga, o
     * Kafka não recebe ack e reentrega a mensagem de origem. A regravação no log é
     * idempotente (chave primária). A republicação, não: o consumidor downstream pode
     * receber a mesma interação duas vezes. Para contadores de ranking isso é um erro
     * de ±1 que não muda ordem — escolha consciente, documentada lá também.
     *
     * Devolve quantas interações foram processadas; exposto para teste.
     */
    async processMessage(topic: string, rawValue: string, kafkaTimestamp: string): Promise<number> {
        const interactions = this.mapMessage(topic, rawValue, kafkaTimestamp);

        if (interactions.length === 0) {
            // Mensagem inválida ou irrelevante: segue em frente (ack), em vez de travar
            // a partição em retry infinito.
            return 0;
        }

        await this.repository.insertMany(interactions);
        await this.publish(interactions);

        return interactions.length;
    }

    /** Exposto para teste: roteia o tópico para o handler certo. */
    mapMessage(topic: string, rawValue: string, kafkaTimestamp: string): NormalizedInteraction[] {
        if (topic === INTERACTIONS_RAW_TOPIC) {
            return mapRawMessage(rawValue);
        }

        if (!isDomainTopic(topic)) {
            return [];
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(rawValue);
        } catch {
            return [];
        }

        // message.timestamp do kafkajs vem como string de epoch em ms.
        const timestamp = new Date(Number(kafkaTimestamp));
        const fallback = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;

        const interaction = mapDomainEvent(topic, parsed, fallback);

        return interaction ? [interaction] : [];
    }

    async stop(): Promise<void> {
        if (this.consumer) {
            await this.consumer.disconnect();
            this.consumer = null;
        }

        this.running = false;
    }
}
