import { Kafka } from "kafkajs";
import { env } from "../config/env";

export const kafka = new Kafka({
    clientId: "feed-service",
    brokers: env.kafka_brokers.split(",").map((broker) => broker.trim())
});