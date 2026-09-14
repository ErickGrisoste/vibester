import { Producer } from "kafkajs";
import { kafka, INTERACTIONS_NORMALIZED_TOPIC, INTERACTIONS_RAW_TOPIC } from "./client";
import { NormalizedInteraction } from "../types/interaction.types";

/**
 * Envelope do que trafega em `interactions.raw`.
 *
 * Versionado (`v`) porque este tópico vai ser consumido também pela fase 1
 * (contadores) — mudar o formato sem versão quebraria consumidores em produção.
 */
export interface InteractionsRawMessage {
    v: 1;
    interactions: NormalizedInteraction[];
}

let producer: Producer | null = null;
let connected = false;

export async function connectProducer(): Promise<void> {
    if (producer) {
        return;
    }

    producer = kafka.producer({ allowAutoTopicCreation: true });

    // Alimenta o /ready: a API não depende do Cassandra (só publica no Kafka),
    // então a única dependência que importa para readiness é o broker.
    producer.on("producer.connect", () => { connected = true; });
    producer.on("producer.disconnect", () => { connected = false; });

    await producer.connect();
}

export function isProducerConnected(): boolean {
    return connected;
}

export async function disconnectProducer(): Promise<void> {
    if (producer) {
        await producer.disconnect();
        producer = null;
        connected = false;
    }
}

/**
 * Publica um lote inteiro como UMA mensagem.
 *
 * Uma mensagem por evento seria 1,2M mensagens/dia no volume projetado; em lotes
 * de ~20, são 60 mil. A chave de partição é o `userId`, o que mantém os eventos
 * de uma mesma pessoa ordenados e espalha a carga entre partições.
 */
export async function publishInteractions(
    userId: string,
    interactions: NormalizedInteraction[]
): Promise<void> {
    if (!producer) {
        throw new Error("Produtor Kafka não conectado");
    }

    const message: InteractionsRawMessage = { v: 1, interactions };

    await producer.send({
        topic: INTERACTIONS_RAW_TOPIC,
        messages: [
            {
                key: userId,
                value: JSON.stringify(message),
            },
        ],
    });
}

/**
 * Republica interações já persistidas no stream canônico `interactions.normalized`.
 *
 * Chamado pelo worker, não pela API. Agrupa por `userId` e manda uma mensagem por
 * pessoa, sempre com `key = userId`: é o que garante que tudo de uma mesma pessoa caia
 * na mesma partição e seja consumido em ordem downstream. Um lote vindo de
 * `interactions.raw` já é de uma pessoa só; o agrupamento existe para não depender
 * dessa suposição.
 */
export async function publishNormalizedInteractions(
    interactions: NormalizedInteraction[]
): Promise<void> {
    if (interactions.length === 0) { return; }

    if (!producer) {
        throw new Error("Produtor Kafka não conectado");
    }

    const byUser = new Map<string, NormalizedInteraction[]>();

    for (const interaction of interactions) {
        const list = byUser.get(interaction.userId) ?? [];
        list.push(interaction);
        byUser.set(interaction.userId, list);
    }

    await producer.send({
        topic: INTERACTIONS_NORMALIZED_TOPIC,
        messages: [...byUser].map(([userId, list]) => {
            const message: InteractionsRawMessage = { v: 1, interactions: list };

            return { key: userId, value: JSON.stringify(message) };
        }),
    });
}
