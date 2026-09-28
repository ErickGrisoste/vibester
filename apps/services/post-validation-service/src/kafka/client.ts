import { Kafka, logLevel } from "kafkajs";
import { env } from "../config/env";

/**
 * Tópico do post-service (`POSTS_TOPIC` lá). Carrega `post.created` e
 * `post.content.updated`, entre outros — o worker filtra por `eventType`.
 */
export const POSTS_TOPIC = "posts";

/**
 * Publicado quando a revalidação assíncrona reprova um post **que já está no
 * ar**. Consumido pelo notification-service, que avisa o autor.
 *
 * Note o que este evento NÃO faz: ele não remove o post. Este serviço julga
 * conteúdo, não administra o ciclo de vida de post — remover é do post-service,
 * e ligar as duas pontas é uma decisão de produto (remover sozinho? esconder?
 * mandar para fila humana?) que não cabe a quem escreve o filtro. Ver
 * "Enforcement" no CLAUDE.md.
 */
export const POST_VALIDATION_REJECTED_TOPIC = "post.validation.rejected";

export const kafka = new Kafka({
    clientId: `post-validation-service-${env.mode}`,
    brokers: env.kafka_brokers.split(",").map((broker) => broker.trim()),
    logLevel: logLevel.WARN,
    retry: {
        initialRetryTime: 300,
        retries: 10,
    },
});
