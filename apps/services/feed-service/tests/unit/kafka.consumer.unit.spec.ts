import { describe, it, expect, vi, beforeEach } from "vitest";
import { KafkaConsumer } from "../../src/kafka/consumer";
import { kafkaHandlerErrorTotal } from "../../src/metrics/registry";

/**
 * Cobre só a instrumentação nova (kafka_handler_error_total) do catch de
 * `handleMessage` (src/kafka/consumer.ts) — não tenta cobrir o
 * parsing/roteamento completo do consumer (JSON.parse, directTopicHandlers vs.
 * envelope genérico), que já é um gap documentado (ver
 * tests/integration-real/feed.consumer.real.spec.ts) fora do escopo desta
 * tarefa de observabilidade. `handleMessage` é privado; chamado aqui via cast
 * para exercitar só o branch do catch, sem precisar subir um broker Kafka
 * real nem mockar `kafkajs` inteiro.
 */
describe("KafkaConsumer — kafka_handler_error_total", () => {
    let consumer: KafkaConsumer;
    let incSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Services nunca são de fato chamados nos dois cenários abaixo: no (a) o
        // JSON.parse falha antes de qualquer handler existir; no (b) o
        // feedItemSchema.parse(data) dentro do handler "post.created" lança antes
        // de handlePostCreated ser invocado (argumento é avaliado antes da
        // chamada) — então um objeto vazio é suficiente.
        consumer = new KafkaConsumer({} as any, {} as any, {} as any);
        incSpy = vi.spyOn(kafkaHandlerErrorTotal, "inc").mockImplementation(() => undefined as any);
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("incrementa a métrica com eventType vazio quando a mensagem não é um JSON válido", async () => {
        await (consumer as any).handleMessage({
            topic: "posts",
            message: { value: Buffer.from("not-json{") },
        });

        expect(incSpy).toHaveBeenCalledWith({ topic: "posts", eventType: "" });
    });

    it("incrementa a métrica com o eventType do envelope quando o handler lança (payload inválido para o schema do evento)", async () => {
        const rawEvent = {
            eventId: "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
            eventType: "post.created",
            occurredAt: new Date().toISOString(),
            data: {}, // não satisfaz feedItemSchema — dispara ZodError dentro do handler
        };

        await (consumer as any).handleMessage({
            topic: "posts",
            message: { value: Buffer.from(JSON.stringify(rawEvent)) },
        });

        expect(incSpy).toHaveBeenCalledWith({ topic: "posts", eventType: "post.created" });
    });
});
