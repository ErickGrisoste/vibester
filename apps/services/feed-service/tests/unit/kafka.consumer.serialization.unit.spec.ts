import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumerMock } = vi.hoisted(() => ({
    consumerMock: {
        connect: vi.fn(),
        subscribe: vi.fn(),
        run: vi.fn(),
        disconnect: vi.fn(),
    },
}));

vi.mock("../../src/kafka/client", () => ({
    kafka: { consumer: () => consumerMock },
}));

import { KafkaConsumer } from "../../src/kafka/consumer";

/**
 * Testes-cadeado do consumidor.
 *
 * A afinidade decaída é gravada por ler-calcular-gravar. Isso só é seguro enquanto duas
 * coisas forem verdade: tudo de uma pessoa chega na mesma partição (garantido no
 * produtor do interaction-service, que tem o próprio teste-cadeado) e este consumidor
 * processa as mensagens uma de cada vez. Se alguém trocar `eachMessage` por `eachBatch`
 * ou ligar `partitionsConsumedConcurrently`, estes testes falham — em vez de a afinidade
 * começar a perder atualização em silêncio.
 */
describe("KafkaConsumer do feed-service", () => {
    beforeEach(async () => {
        for (const fn of Object.values(consumerMock)) {
            fn.mockReset().mockResolvedValue(undefined);
        }

        const consumer = new KafkaConsumer({} as never, {} as never);
        await consumer.start();
    });

    it("assina interactions.normalized e não interactions.raw", () => {
        // raw só tem sinais do app: a API rejeita LIKE, COMMENT e FOLLOW lá. Ler raw
        // deixaria o ranking sem curtida nenhuma — e ler os dois contaria o app em dobro.
        const topicos = consumerMock.subscribe.mock.calls.map(([arg]) => arg.topic);

        expect(topicos).toContain("interactions.normalized");
        expect(topicos).not.toContain("interactions.raw");
    });

    it("processa mensagem a mensagem, sem concorrência entre partições", () => {
        const [config] = consumerMock.run.mock.calls[0]!;

        expect(typeof config.eachMessage).toBe("function");
        expect(config.eachBatch).toBeUndefined();
        expect(config.partitionsConsumedConcurrently ?? 1).toBe(1);
    });
});
