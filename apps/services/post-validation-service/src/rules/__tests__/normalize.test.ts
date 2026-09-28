import { describe, it, expect } from "vitest";
import { normalizeForMatching, countCharacters, escapeRegex } from "../normalize";

describe("normalizeForMatching", () => {
    it("remove acento e caixa", () => {
        expect(normalizeForMatching("PÔRRA").collapsed).toBe("pora");
    });

    it("traduz leet para letra", () => {
        expect(normalizeForMatching("p0rr4").collapsed).toBe("pora");
    });

    it("traduz homoglifo cirilico", () => {
        // "оi" com o cirilico (U+043E) tem que virar o mesmo "oi" do latino.
        expect(normalizeForMatching("\u043Ei").collapsed).toBe("oi");
    });

    it("colapsa repeticao do mesmo caractere", () => {
        expect(normalizeForMatching("caraaaalho").collapsed).toBe("caralho");
        expect(normalizeForMatching("carrralho").collapsed).toBe("caralho");
    });

    it("normaliza variante tipografica unicode via NFKD", () => {
        // Fullwidth: mesma palavra, outro bloco Unicode.
        expect(normalizeForMatching("ｐｏｒｒａ").collapsed).toBe("pora");
    });

    it("troca pontuacao por espaco unico e preserva fronteira de palavra", () => {
        expect(normalizeForMatching("festa, hoje!! no bar").collapsed).toBe("festa hoje no bar");
    });

    it("produz versao sem separador para pegar letra-a-letra", () => {
        expect(normalizeForMatching("c-a-r-a-l-h-o").stripped).toBe("caralho");
        expect(normalizeForMatching("c.a.r.a.l.h.o").stripped).toBe("caralho");
    });

    it("nao explode com string vazia", () => {
        expect(normalizeForMatching("")).toEqual({ collapsed: "", stripped: "" });
    });
});

describe("countCharacters", () => {
    it("conta emoji composto como um caractere", () => {
        const familia = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
        // O ponto do metodo: `.length` conta 8 unidades UTF-16 aqui.
        expect(familia.length).toBeGreaterThan(1);
        expect(countCharacters(familia)).toBe(1);
    });

    it("conta texto simples normalmente", () => {
        expect(countCharacters("festa")).toBe(5);
    });

    it("conta letra acentuada como uma so", () => {
        expect(countCharacters("ação")).toBe(4);
    });
});

describe("escapeRegex", () => {
    it("neutraliza metacaractere para que o termo case literalmente", () => {
        const escaped = escapeRegex("a.b");
        expect(new RegExp(escaped).test("a.b")).toBe(true);
        // Sem escape, o ponto casaria "axb" — que e o bug que a funcao evita.
        expect(new RegExp(escaped).test("axb")).toBe(false);
    });
});

describe("leet de pontuacao — regressao", () => {
    /**
     * `!` no fim de palavra é pontuação, não substituto de letra. Quando era
     * sempre traduzido para "i", `porra!` virava `porrai` e escapava do
     * casamento por palavra inteira — evasão criada pela própria normalização.
     */
    it("mantem a palavra intacta quando a pontuacao e terminal", () => {
        expect(normalizeForMatching("hoje!! tem festa").collapsed).toBe("hoje tem festa");
        expect(normalizeForMatching("porra!").collapsed).toBe("pora");
    });

    it("ainda traduz a pontuacao quando ela esta no meio da palavra", () => {
        expect(normalizeForMatching("p!ranha").collapsed).toBe("piranha");
        expect(normalizeForMatching("c@ralho").collapsed).toBe("caralho");
    });
});
