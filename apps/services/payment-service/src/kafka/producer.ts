import { Kafka, Producer } from 'kafkajs';
import { env } from '../config/env';

let _producer: Producer | null = null;

function getProducer(): Producer {
    if (!_producer) {
        const kafka = new Kafka({ clientId: 'payment-service', brokers: env.kafkaBrokers.split(',') });
        _producer = kafka.producer();
    }
    return _producer;
}

export const producer = {
    connect: () => getProducer().connect(),
    disconnect: () => _producer?.disconnect() ?? Promise.resolve(),
    send: (record: Parameters<Producer['send']>[0]) => getProducer().send(record),
};
