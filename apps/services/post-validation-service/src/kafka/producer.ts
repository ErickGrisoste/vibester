import { randomUUID } from "crypto";
import { Producer } from "kafkajs";
import { kafka, POST_VALIDATION_REJECTED_TOPIC } from "./client";
import { kafkaPublishTotal } from "../metrics/registry";
import type { ValidationIssue } from "../types/validation.types";

let producer: Producer | null = null;
let connected = false;

export async function connectProducer(): Promise<void> {
    if (producer) { return; }

    producer = kafka.producer({ allowAutoTopicCreation: true });

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

export interface PostValidationRejectedData {
    postId: string;
    authorId: string;
    /** Só `code` e `field`: o consumidor monta a mensagem que mostra ao usuário. */
    issues: Pick<ValidationIssue, "code" | "field">[];
    validatedAt: string;
}

/**
 * Publica no mesmo envelope `{ eventId, eventType, occurredAt, data }` que o
 * post-service usa (`publishEvent` em `post-service/src/kafka/events.ts`).
 *
 * Isso não é estética: o notification-service desembrulha eventos com
 * `unwrapEventData`, que procura exatamente `eventType` + `data`. Publicar o
 * payload solto faria o handler não achar `postId` e descartar a notificação em
 * silêncio — foi o bug que o `envelope.ts` de lá existe para consertar.
 *
 * `key = postId` mantém a ordem por post e espalha a carga entre partições.
 */
export async function publishValidationRejected(data: PostValidationRejectedData): Promise<void> {
    if (!producer) {
        throw new Error("Produtor Kafka não conectado");
    }

    try {
        await producer.send({
            topic: POST_VALIDATION_REJECTED_TOPIC,
            messages: [{
                key: data.postId,
                value: JSON.stringify({
                    eventId: randomUUID(),
                    eventType: "post.validation.rejected",
                    occurredAt: new Date().toISOString(),
                    data,
                }),
            }],
        });
        kafkaPublishTotal.inc({ topic: POST_VALIDATION_REJECTED_TOPIC, result: "success" });
    } catch (err) {
        kafkaPublishTotal.inc({ topic: POST_VALIDATION_REJECTED_TOPIC, result: "failure" });
        throw err;
    }
}
