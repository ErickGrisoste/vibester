import { describe, expect, it } from "vitest";
import { affinityFromCounts } from "../../src/ranking/affinity";
import { DEFAULT_WEIGHTS } from "../../src/ranking/weights";

const PESOS = DEFAULT_WEIGHTS.signals;
const SATURACAO = 20;

describe("affinityFromCounts", () => {
    it("satura suavemente conforme os pontos crescem", () => {
        // Com saturação 20, 20 pontos ponderados valem exatamente meia afinidade.
        const casos = [
            { pontos: 0, esperado: 0 },
            { pontos: 5, esperado: 0.2 },
            { pontos: 20, esperado: 0.5 },
            { pontos: 60, esperado: 0.75 },
            { pontos: 500, esperado: 0.9615 },
        ];

        for (const { pontos, esperado } of casos) {
            // LIKE tem peso 1, então N curtidas = N pontos.
            expect(affinityFromCounts({ LIKE: pontos }, PESOS, SATURACAO)).toBeCloseTo(esperado, 3);
        }
    });

    it("nunca chega a 1, por mais interação que exista", () => {
        expect(affinityFromCounts({ LIKE: 1_000_000 }, PESOS, SATURACAO)).toBeLessThan(1);
    });

    it("é monotônica: mais interação nunca reduz afinidade", () => {
        let anterior = -1;

        for (const likes of [0, 1, 5, 10, 50, 200]) {
            const atual = affinityFromCounts({ LIKE: likes }, PESOS, SATURACAO);

            expect(atual).toBeGreaterThan(anterior);
            anterior = atual;
        }
    });

    it("sem interação nenhuma, a afinidade é 0 e não 0.5", () => {
        // Valor honesto para quem nunca interagiu: ausência de sinal não é sinal médio.
        expect(affinityFromCounts({}, PESOS, SATURACAO)).toBe(0);
    });

    it("check-in em evento constrói afinidade dez vezes mais rápido que curtida", () => {
        const comCheckin = affinityFromCounts({ EVENT_CHECKIN: 1 }, PESOS, SATURACAO);
        const comUmaCurtida = affinityFromCounts({ LIKE: 1 }, PESOS, SATURACAO);
        const comDezCurtidas = affinityFromCounts({ LIKE: 10 }, PESOS, SATURACAO);

        expect(comCheckin).toBeGreaterThan(comUmaCurtida);
        expect(comCheckin).toBeCloseTo(comDezCurtidas, 10);
    });

    it("saldo negativo devolve 0 em vez de afinidade negativa", () => {
        // A rejeição já entra no score pelos contadores do item; deixar afinidade
        // negativa puniria duas vezes o mesmo sinal.
        const resultado = affinityFromCounts({ LIKE: 1, NOT_INTERESTED: 3 }, PESOS, SATURACAO);

        expect(resultado).toBe(0);
    });

    it("ignora IMPRESSION, que é denominador e não construção de vínculo", () => {
        expect(affinityFromCounts({ IMPRESSION: 500 }, PESOS, SATURACAO)).toBe(0);
    });

    it("saturação menor faz a afinidade subir mais rápido", () => {
        const rapida = affinityFromCounts({ LIKE: 10 }, PESOS, 5);
        const lenta = affinityFromCounts({ LIKE: 10 }, PESOS, 100);

        expect(rapida).toBeGreaterThan(lenta);
    });

    it("saturação inválida devolve afinidade máxima em vez de dividir por zero", () => {
        expect(affinityFromCounts({ LIKE: 1 }, PESOS, 0)).toBe(1);
    });
});
