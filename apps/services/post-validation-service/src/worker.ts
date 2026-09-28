import Fastify from "fastify";
import { env } from "./config/env";
import { ValidationService } from "./services/validation.service";
import { startConsumer, stopConsumer, isConsumerRunning } from "./kafka/consumer";
import { connectProducer, disconnectProducer, isProducerConnected } from "./kafka/producer";
import { connectRedis, disconnectRedis, isRedisReady } from "./config/redis";
import { registry } from "./metrics/registry";

/**
 * Modo `worker`: revalida o que já foi publicado e avisa o autor quando reprova.
 *
 * Separado da API porque os gargalos são diferentes — a API escala por
 * requisições por segundo, o worker por lag de partição. Juntos, um obrigaria o
 * outro a escalar sem necessidade (mesma decisão do interaction-service).
 *
 * O servidor HTTP mínimo aqui existe só para probe e `/metrics`; não há Service
 * do k8s apontando para ele, e nada o chama.
 */
export async function startWorker(): Promise<void> {
    const app = Fastify({ logger: { level: "info" } });

    app.get("/health", async () => ({ status: "ok", mode: env.mode }));

    app.get("/ready", async (_request, reply) => {
        const consumerReady = isConsumerRunning();
        const producerReady = isProducerConnected();

        // Aqui, diferente da API, o Kafka É crítico: um worker sem consumidor
        // não faz absolutamente nada, e mantê-lo "pronto" esconderia a falha.
        // O Redis segue opcional — sem cache o worker só gasta mais CPU.
        return reply.status(consumerReady && producerReady ? 200 : 503).send({
            status: consumerReady && producerReady ? "ready" : "not-ready",
            consumer: consumerReady,
            producer: producerReady,
            redis: isRedisReady(),
        });
    });

    app.get("/metrics", async (_request, reply) => {
        reply.header("Content-Type", registry.contentType);
        return registry.metrics();
    });

    await connectRedis();
    // Produtor antes do consumidor: o handler publica a rejeição, e um
    // consumidor que começasse a puxar mensagem antes teria a primeira falhando
    // com "produtor não conectado".
    await connectProducer();

    await startConsumer(new ValidationService());

    await app.listen({ port: env.port, host: "0.0.0.0" });

    app.log.info({ port: env.port, mode: env.mode }, "Post Validation Service (worker) iniciado");

    const gracefulShutdown = async (signal: string) => {
        app.log.info({ signal }, "Iniciando shutdown gracioso");

        try {
            // Consumidor primeiro: para de aceitar mensagem nova antes de
            // derrubar o produtor de que o handler depende.
            await stopConsumer();
            await app.close();
            await disconnectProducer();
            await disconnectRedis();
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
