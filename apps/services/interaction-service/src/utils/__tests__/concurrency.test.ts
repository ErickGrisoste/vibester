import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "../concurrency";

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

describe("runWithConcurrency", () => {
    it("devolve os resultados na ordem dos itens, não na ordem de conclusão", async () => {
        const items = [30, 5, 20, 1];

        const results = await runWithConcurrency(items, 4, async (ms) => {
            await tick(ms);
            return ms;
        });

        expect(results).toEqual([30, 5, 20, 1]);
    });

    it("processa todos os itens quando o lote é maior que o limite", async () => {
        const items = Array.from({ length: 50 }, (_, index) => index);

        const results = await runWithConcurrency(items, 16, async (item) => {
            await tick(1);
            return item * 2;
        });

        expect(results).toHaveLength(50);
        expect(results[49]).toBe(98);
    });

    it("nunca excede o limite de execuções simultâneas", async () => {
        const items = Array.from({ length: 40 }, (_, index) => index);
        let running = 0;
        let peak = 0;

        await runWithConcurrency(items, 8, async () => {
            running += 1;
            peak = Math.max(peak, running);
            await tick(2);
            running -= 1;
        });

        expect(peak).toBeLessThanOrEqual(8);
        // Prova que houve paralelismo de fato, e não execução serial disfarçada.
        expect(peak).toBeGreaterThan(1);
    });

    it("não executa nada para lista vazia", async () => {
        let calls = 0;

        const results = await runWithConcurrency([], 16, async () => {
            calls += 1;
        });

        expect(results).toEqual([]);
        expect(calls).toBe(0);
    });

    it("trata limite maior que o número de itens", async () => {
        const results = await runWithConcurrency([1, 2], 100, async (item) => item * 10);

        expect(results).toEqual([10, 20]);
    });

    it("trata limite inválido como no mínimo 1 em vez de travar", async () => {
        const results = await runWithConcurrency([1, 2, 3], 0, async (item) => item);

        expect(results).toEqual([1, 2, 3]);
    });

    it("propaga a rejeição, para que o worker não faça ack da mensagem Kafka", async () => {
        await expect(
            runWithConcurrency([1, 2, 3], 2, async (item) => {
                if (item === 2) {
                    throw new Error("falha de escrita no Cassandra");
                }
                return item;
            })
        ).rejects.toThrow("falha de escrita no Cassandra");
    });
});
