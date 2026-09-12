import { Kafka, logLevel } from "kafkajs";
import { env } from "../config/env";

export const INTERACTIONS_RAW_TOPIC = "interactions.raw";

export const kafka = new Kafka({
    clientId: `interaction-service-${env.mode}`,
    brokers: env.kafka_brokers.split(",").map((broker) => broker.trim()),
    logLevel: logLevel.WARN,
    retry: {
        initialRetryTime: 300,
        retries: 10,
    },
});
