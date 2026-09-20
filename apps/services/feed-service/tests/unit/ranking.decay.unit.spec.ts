import { describe, expect, it } from "vitest";
import { applyDecayedIncrement, decayFactor, decayTo } from "../../src/ranking/decay";
import { weightedActions } from "../../src/ranking/engagement";

const DIA = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-09-01T00:00:00.000Z");

function dia(n: number): Date {
    return new Date(T0.getTime() + n * DIA);
}

describe("decayFactor", () => {
    it("reproduz a tabela de τ = 30 dias do desenho do perfil", () => {
        expect(decayFactor(0, 30)).toBe(1);
        expect(decayFactor(7 * DIA, 30)).toBeCloseTo(0.79, 2);
        expect(decayFactor(30 * DIA, 30)).toBeCloseTo(0.37, 2);
        expect(decayFactor(90 * DIA, 30)).toBeCloseTo(0.05, 2);
    });

    it("reproduz a tabela de τ = 7 dias do desenho do perfil", () => {
        expect(decayFactor(7 * DIA, 7)).toBeCloseTo(0.37, 2);
        expect(decayFactor(14 * DIA, 7)).toBeCloseTo(0.14, 2);
        expect(decayFactor(30 * DIA, 7)).toBeCloseTo(0.01, 2);
    });

    it("tempo negativo não rejuvenesce", () => {
        expect(decayFactor(-5 * DIA, 30)).toBe(1);
    });

    it("sem τ não há esquecimento", () => {
        expect(decayFactor(90 * DIA, 0)).toBe(1);
    });
});

describe("applyDecayedIncrement", () => {
    it("a primeira interação vale o incremento, no instante em que ocorreu", () => {
        expect(applyDecayedIncrement(null, dia(0), 1, 30)).toEqual({ value: 1, updatedAt: dia(0) });
    });

    it("reproduz o exemplo do desenho do perfil guardando contagem por sinal", () => {
        // perfil.md: dia 0 curtida (+1), dia 7 comentário (+3), leitura no dia 37 → 1,39.
        // Aqui guardamos CONTAGEM por sinal e aplicamos o peso só na leitura. Como o
        // decaimento é linear, o resultado tem que ser o mesmo — é o que permite pesos
        // recarregáveis sem reprocessar histórico.
        const like = applyDecayedIncrement(null, dia(0), 1, 30);
        const comment = applyDecayedIncrement(null, dia(7), 1, 30);

        const pesosDoPerfil = { LIKE: 1, COMMENT: 3 } as Record<string, number>;
        const contagensNoDia37 = {
            LIKE: decayTo(like, dia(37), 30),
            COMMENT: decayTo(comment, dia(37), 30),
        };

        expect(weightedActions(contagensNoDia37, pesosDoPerfil as never)).toBeCloseTo(1.39, 2);
    });

    it("é idêntico somar em ordem ou fora de ordem", () => {
        const emOrdem = applyDecayedIncrement(applyDecayedIncrement(null, dia(0), 1, 30), dia(7), 1, 30);
        const foraDeOrdem = applyDecayedIncrement(applyDecayedIncrement(null, dia(7), 1, 30), dia(0), 1, 30);

        expect(decayTo(foraDeOrdem, dia(40), 30)).toBeCloseTo(decayTo(emOrdem, dia(40), 30), 10);
    });

    it("evento atrasado mantém a âncora e soma o incremento envelhecido", () => {
        const atual = { value: 10, updatedAt: dia(30) };

        const resultado = applyDecayedIncrement(atual, dia(0), 1, 30);

        expect(resultado.updatedAt).toEqual(dia(30));
        expect(resultado.value).toBeCloseTo(10 + Math.exp(-1), 10);
    });

    it("guardar um único valor equivale a guardar o histórico inteiro", () => {
        const instantes = [0, 3, 3, 10, 25, 26, 60];
        let acumulado: ReturnType<typeof applyDecayedIncrement> | null = null;

        for (const d of instantes) {
            acumulado = applyDecayedIncrement(acumulado, dia(d), 1, 30);
        }

        const leitura = dia(90);
        const somaDoHistorico = instantes.reduce(
            (total, d) => total + decayFactor(leitura.getTime() - dia(d).getTime(), 30),
            0
        );

        expect(decayTo(acumulado!, leitura, 30)).toBeCloseTo(somaDoHistorico, 10);
    });
});

describe("decayTo", () => {
    it("envelhece até o instante pedido", () => {
        expect(decayTo({ value: 8, updatedAt: dia(0) }, dia(30), 30)).toBeCloseTo(8 * Math.exp(-1), 10);
    });

    it("leitura anterior à última atualização não infla o valor", () => {
        expect(decayTo({ value: 8, updatedAt: dia(30) }, dia(0), 30)).toBe(8);
    });
});
