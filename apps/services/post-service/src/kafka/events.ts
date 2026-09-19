import { randomUUID } from "crypto";
import { producer } from "./producer";
import { kafkaPublishTotal } from "../metrics/registry";

export const POSTS_TOPIC = "posts";

/**
 * Único ponto de montagem do envelope de evento do serviço — todo publish deve
 * passar por aqui, nunca montar `{ eventId, eventType, occurredAt, data }` (ou
 * um payload plano, sem envelope) na mão dentro de um service.
 */
export async function publishEvent(topic: string, key: string, eventType: string, data: unknown) {
    try {
        const result = await producer.send({
            topic,
            messages: [{
                key,
                value: JSON.stringify({
                    eventId: randomUUID(),
                    eventType,
                    occurredAt: new Date().toISOString(),
                    data,
                }),
            }],
        });
        kafkaPublishTotal.inc({ topic, result: "success" });
        return result;
    } catch (err) {
        kafkaPublishTotal.inc({ topic, result: "failure" });
        throw err;
    }
}
