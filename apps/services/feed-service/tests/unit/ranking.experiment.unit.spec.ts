import { describe, expect, it } from "vitest";
import {
    CHRONOLOGICAL_HOLDOUT,
    HOLDOUT_SHARE,
    assignVariant,
    bucketFraction,
    isInChronologicalHoldout,
} from "../../src/ranking/experiment";

function synthId(index: number): string {
    return `user-${index}`;
}

const AB = [
    { name: "control", share: 0.5 },
    { name: "ranked", share: 0.5 },
];

describe("bucketFraction", () => {
    it("é determinístico: mesma pessoa e mesmo experimento dão sempre o mesmo valor", () => {
        const primeiro = bucketFraction("joao", "exp-feed");
        const segundo = bucketFraction("joao", "exp-feed");

        expect(primeiro).toBe(segundo);
    });

    it("fica dentro de [0, 1)", () => {
        for (let i = 0; i < 500; i += 1) {
            const fraction = bucketFraction(synthId(i), "exp-feed");

            expect(fraction).toBeGreaterThanOrEqual(0);
            expect(fraction).toBeLessThan(1);
        }
    });

    it("distribui de forma aproximadamente uniforme", () => {
        const total = 20_000;
        const baldes = [0, 0, 0, 0];

        for (let i = 0; i < total; i += 1) {
            const fraction = bucketFraction(synthId(i), "exp-feed");
            baldes[Math.floor(fraction * 4)]! += 1;
        }

        for (const balde of baldes) {
            // 25% esperado; folga generosa para não virar teste instável.
            expect(balde / total).toBeGreaterThan(0.23);
            expect(balde / total).toBeLessThan(0.27);
        }
    });

    it("o nome do experimento muda o balde, então experimentos são independentes", () => {
        // Sem isso, quem caísse no grupo A de um experimento cairia no A de todos, e
        // os efeitos ficariam impossíveis de separar.
        let divergiu = 0;

        for (let i = 0; i < 200; i += 1) {
            const a = assignVariant(synthId(i), "exp-um", AB);
            const b = assignVariant(synthId(i), "exp-dois", AB);

            if (a !== b) { divergiu += 1; }
        }

        // Se fossem correlacionados, divergência seria ~0. Independentes, ~50%.
        expect(divergiu).toBeGreaterThan(60);
        expect(divergiu).toBeLessThan(140);
    });
});

describe("assignVariant", () => {
    it("mantém a pessoa na mesma variante entre chamadas", () => {
        const primeira = assignVariant("joao", "exp-feed", AB);

        for (let i = 0; i < 20; i += 1) {
            expect(assignVariant("joao", "exp-feed", AB)).toBe(primeira);
        }
    });

    it("respeita as fatias declaradas", () => {
        const total = 20_000;
        let ranked = 0;

        for (let i = 0; i < total; i += 1) {
            if (assignVariant(synthId(i), "exp-feed", AB) === "ranked") { ranked += 1; }
        }

        expect(ranked / total).toBeGreaterThan(0.48);
        expect(ranked / total).toBeLessThan(0.52);
    });

    it("respeita fatia desigual", () => {
        const variantes = [
            { name: "control", share: 0.9 },
            { name: "ranked", share: 0.1 },
        ];

        const total = 20_000;
        let ranked = 0;

        for (let i = 0; i < total; i += 1) {
            if (assignVariant(synthId(i), "exp-desigual", variantes) === "ranked") { ranked += 1; }
        }

        expect(ranked / total).toBeGreaterThan(0.085);
        expect(ranked / total).toBeLessThan(0.115);
    });

    it("cai na última variante quando as fatias somam menos de 1, em vez de devolver vazio", () => {
        const incompleta = [
            { name: "a", share: 0.1 },
            { name: "b", share: 0.1 },
        ];

        for (let i = 0; i < 100; i += 1) {
            expect(["a", "b"]).toContain(assignVariant(synthId(i), "exp-incompleto", incompleta));
        }
    });

    it("exige ao menos uma variante", () => {
        expect(() => assignVariant("joao", "exp-vazio", [])).toThrow(/ao menos uma variante/);
    });
});

describe("isInChronologicalHoldout", () => {
    it("mantém ~5% do público fora do ranking", () => {
        const total = 20_000;
        let dentro = 0;

        for (let i = 0; i < total; i += 1) {
            if (isInChronologicalHoldout(synthId(i))) { dentro += 1; }
        }

        const proporcao = dentro / total;

        expect(proporcao).toBeGreaterThan(0.043);
        expect(proporcao).toBeLessThan(0.057);
    });

    it("é estável para a mesma pessoa — ninguém entra e sai do holdout entre requests", () => {
        for (let i = 0; i < 200; i += 1) {
            const id = synthId(i);
            const primeira = isInChronologicalHoldout(id);

            expect(isInChronologicalHoldout(id)).toBe(primeira);
        }
    });

    it("é independente dos experimentos A/B em paralelo", () => {
        // Pessoas no holdout têm que aparecer nas duas variantes de um A/B qualquer,
        // senão o holdout estaria enviesando o experimento.
        const noHoldout = Array.from({ length: 20_000 }, (_, i) => synthId(i))
            .filter(isInChronologicalHoldout);

        const variantes = new Set(noHoldout.map((id) => assignVariant(id, "exp-feed", AB)));

        expect(noHoldout.length).toBeGreaterThan(100);
        expect(variantes.size).toBe(2);
    });

    it("a constante do holdout não pode mudar sem jogar a série histórica fora", () => {
        // Teste-cadeado: se alguém renomear a constante, o reembaralhamento silencioso
        // do holdout aparece aqui em vez de aparecer num gráfico três meses depois.
        expect(CHRONOLOGICAL_HOLDOUT).toBe("chronological-holdout-v1");
        expect(HOLDOUT_SHARE).toBe(0.05);
    });
});
