import Fastify from "fastify";
import { env } from "./config/env";
import { getCassandraClient, disconnectCassandra } from "./config/cassandra";
import { InteractionConsumer } from "./kafka/consumer";
import { connectProducer, disconnectProducer, isProducerConnected } from "./kafka/producer";

/**
 * Modo `worker`: consome o Kafka, persiste no Cassandra e republica o stream
 * canônico em `interactions.normalized`.
 *
 * Sobe um HTTP mínimo só para os probes do k8s — sem esse endpoint o Deployment
 * não tem como saber se o consumidor está de pé.
 */
export async function startWorker(): Promise<void> {
    const app = Fastify({ logger: { level: "info" } });
    const consumer = new InteractionConsumer();

    app.get("/health", async () => ({ status: "ok", mode: env.mode }));

    app.get("/ready", async (_request, reply) => {
        const consumerReady = consumer.isRunning();
        // Sem produtor o worker não consegue republicar: cada mensagem falharia depois
        // de persistir, e o lag do consumer group cresceria em silêncio.
        const producerReady = isProducerConnected();
        let cassandraReady = false;

        try {
            await getCassandraClient().execute("SELECT release_version FROM system.local");
            cassandraReady = true;
        } catch (err) {
            app.log.warn({ err }, "Cassandra indisponível no readiness");
        }

        const ready = consumerReady && producerReady && cassandraReady;

        return reply.status(ready ? 200 : 503).send({
            status: ready ? "ready" : "not-ready",
            consumer: consumerReady,
            producer: producerReady,
            cassandra: cassandraReady,
        });
    });

    await getCassandraClient().connect();
    // Produtor antes do consumidor: a primeira mensagem consumida já precisa republicar.
    await connectProducer();
    await consumer.start();

    await app.listen({ port: env.port, host: "0.0.0.0" });

    app.log.info({ port: env.port, mode: env.mode }, "Interaction Service (worker) iniciado");

    const gracefulShutdown = async (signal: string) => {
        app.log.info({ signal }, "Iniciando shutdown gracioso");

        try {
            await app.close();
            // Ordem importa: parar de consumir primeiro, para que a mensagem em voo
            // termine de persistir e republicar antes de produtor e Cassandra fecharem.
            await consumer.stop();
            await disconnectProducer();
            await disconnectCassandra();
            app.log.info("Shutdown concluído");
            process.exit(0);
        } catch (err) {
            app.log.error({ err }, "Erro durante shutdown");
            process.exit(1);
        }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
