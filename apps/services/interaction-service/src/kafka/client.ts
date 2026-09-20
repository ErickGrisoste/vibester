import { Kafka, logLevel } from "kafkajs";
import { env } from "../config/env";

/** Sinais que só o cliente conhece, publicados pela API. Consumido só pelo worker. */
export const INTERACTIONS_RAW_TOPIC = "interactions.raw";

/**
 * Stream canônico: TODA interação persistida pelo worker, venha do cliente ou de um
 * serviço de domínio (post.liked, post.commented, user.followed...), já normalizada.
 *
 * É o tópico que consumidores downstream (o ranking do feed-service) devem ler. Ler
 * `interactions.raw` perderia curtida, comentário e follow — a API rejeita esses tipos
 * lá, porque eles chegam pelos tópicos dos serviços de origem.
 */
export const INTERACTIONS_NORMALIZED_TOPIC = "interactions.normalized";

export const kafka = new Kafka({
    clientId: `interaction-service-${env.mode}`,
    brokers: env.kafka_brokers.split(",").map((broker) => broker.trim()),
    logLevel: logLevel.WARN,
    retry: {
        initialRetryTime: 300,
        retries: 10,
    },
});
