import { Consumer } from "kafkajs";
import { kafka, INTERACTIONS_RAW_TOPIC } from "./client";
import { InteractionRepository } from "../repository/interaction.repository";
import { NormalizedInteraction } from "../types/interaction.types";
import { mapRawMessage } from "./handlers/raw.handler";
import { DOMAIN_TOPICS, isDomainTopic, mapDomainEvent } from "./handlers/domain.handler";

const TOPICS = [INTERACTIONS_RAW_TOPIC, ...DOMAIN_TOPICS];

export class InteractionConsumer {
    private consumer: Consumer | null = null;
    private running = false;

    constructor(private readonly repository = new InteractionRepository()) { }

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
                const interactions = this.mapMessage(
                    topic,
                    message.value?.toString() ?? "",
                    message.timestamp
                );

                if (interactions.length === 0) {
                    // Mensagem inválida ou irrelevante: segue em frente (ack), em vez de
                    // travar a partição em retry infinito.
                    return;
                }

                // Uma falha aqui propaga: sem ack, o Kafka reentrega. A idempotência
                // da chave primária é o que torna a reentrega segura.
                await this.repository.insertMany(interactions);
            },
        });

        this.running = true;
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
