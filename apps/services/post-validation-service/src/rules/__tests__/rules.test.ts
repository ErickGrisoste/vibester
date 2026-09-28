import { describe, it, expect } from "vitest";
import { runRules } from "../index";
import { ValidationCode } from "../../types/validation.types";

function codes(content: string, options: { tags?: string[]; mediaCount?: number } = {}) {
    return runRules({
        content,
        tags: options.tags ?? [],
        mediaCount: options.mediaCount ?? 1,
    }).issues.map((issue) => issue.code);
}

/**
 * Este bloco é o mais importante do serviço.
 *
 * Falso positivo aqui silencia usuário legítimo — e o público do Vibester
 * escreve em caixa alta, com vogal repetida e gíria. Um filtro que derruba
 * "VAMOOOO" é pior para o produto do que um que deixa passar um palavrão.
 */
describe("conteudo legitimo nao pode ser rejeitado", () => {
    it.each([
        ["giria com caixa alta curta", "HOJE TEM FESTA NO BAR!!!"],
        ["vogal esticada", "VAMOOOOO que hoje tem show"],
        ["substring de termo proibido: cuidado", "Muito cuidado na saida, pessoal"],
        ["substring de termo proibido: reputacao", "A reputacao desse bar e otima"],
        ["substring de termo proibido: porrada", "Levou uma porrada de gente ontem"],
        ["link unico legitimo", "Ingressos em https://www.sympla.com.br/evento-x"],
        ["dois links (no limite)", "Mapa https://maps.exemplo.com e ingresso https://sympla.com.br/x"],
        // Texto variado de exatamente 500 caracteres. Não use `"a".repeat(500)`
        // aqui: 500 caracteres iguais são spam de verdade, e o teste estaria
        // exigindo que a regra de spam errasse.
        [
            "texto no limite exato de caracteres",
            Array.from({ length: 120 }, (_, index) => "palavra" + index).join(" ").slice(0, 500),
        ],
    ])("%s", (_label, content) => {
        expect(codes(content)).toEqual([]);
    });

    it("post so de midia, sem legenda, e valido", () => {
        expect(codes("", { mediaCount: 3 })).toEqual([]);
    });
});

describe("regra de vazio", () => {
    it("rejeita post sem texto e sem midia", () => {
        expect(codes("", { mediaCount: 0 })).toContain(ValidationCode.CONTENT_EMPTY);
    });

    it("rejeita post so com espaco em branco e sem midia", () => {
        expect(codes("   \n\t  ", { mediaCount: 0 })).toContain(ValidationCode.CONTENT_EMPTY);
    });

    it("nao rejeita legenda vazia quando ha midia", () => {
        expect(codes("", { mediaCount: 1 })).not.toContain(ValidationCode.CONTENT_EMPTY);
    });
});

describe("regra de tamanho", () => {
    it("rejeita acima do limite configurado", () => {
        expect(codes("a".repeat(501))).toContain(ValidationCode.CONTENT_TOO_LONG);
    });

    it("conta grafema, nao unidade utf-16", () => {
        // 300 emojis = 600 unidades UTF-16, mas 300 caracteres para o usuario.
        expect(codes("\u{1F389}".repeat(300))).not.toContain(ValidationCode.CONTENT_TOO_LONG);
        expect(codes("\u{1F389}".repeat(501))).toContain(ValidationCode.CONTENT_TOO_LONG);
    });

    it("rejeita excesso de tags", () => {
        const tags = Array.from({ length: 31 }, (_, index) => "tag" + index);
        expect(codes("festa", { tags })).toContain(ValidationCode.TOO_MANY_TAGS);
    });
});

describe("regra de linguagem proibida", () => {
    it.each([
        ["forma direta", "que porra e essa"],
        ["leet", "que p0rr4 e essa"],
        ["acento", "que pôrra e essa"],
        ["repeticao de letra", "que porrrra e essa"],
        ["caixa alta", "QUE PORRA E ESSA"],
        ["fullwidth unicode", "ｐｏｒｒａ"],
        ["seguido de pontuacao", "que porra!"],
    ])("pega palavrao em %s", (_label, content) => {
        expect(codes(content)).toContain(ValidationCode.FORBIDDEN_LANGUAGE);
    });

    it("pega termo separado letra a letra na passada sem separador", () => {
        expect(codes("c-a-r-a-l-h-o que festa")).toContain(ValidationCode.FORBIDDEN_LANGUAGE);
    });

    it("classifica discurso de odio com codigo proprio", () => {
        expect(codes("sai daqui seu viado")).toContain(ValidationCode.HATE_SPEECH);
    });

    it("tambem filtra as tags, nao so a legenda", () => {
        expect(codes("festa hoje", { tags: ["caralho"] }))
            .toContain(ValidationCode.FORBIDDEN_LANGUAGE);
    });

    /**
     * O requisito de segurança: a resposta não pode contar como o filtro
     * funciona. O termo casado existe, mas só em `auditDetails`.
     */
    it("nao revela o termo casado na mensagem devolvida ao cliente", () => {
        const result = runRules({ content: "que porra e essa", tags: [], mediaCount: 1 });

        expect(result.auditDetails.map((detail) => detail.matched)).toContain("pora");

        for (const issue of result.issues) {
            expect(issue.message.toLowerCase()).not.toContain("porra");
            expect(issue.message.toLowerCase()).not.toContain("pora");
        }
    });
});

describe("regra de links", () => {
    it("rejeita esquema que nao seja http(s)", () => {
        expect(codes("clique javascript:alert(1)")).toContain(ValidationCode.MALFORMED_LINK);
    });

    it("rejeita encurtador, porque o destino e indecidivel aqui", () => {
        expect(codes("ingressos em https://bit.ly/abc")).toContain(ValidationCode.SHORTENED_LINK);
    });

    it("rejeita dominio bloqueado embutido", () => {
        expect(codes("acesse https://free-money.example/x"))
            .toContain(ValidationCode.BLOCKED_LINK);
    });

    it("rejeita subdominio de dominio bloqueado", () => {
        expect(codes("acesse https://promo.free-money.example/x"))
            .toContain(ValidationCode.BLOCKED_LINK);
    });

    it("rejeita dominio vindo da env", () => {
        expect(codes("acesse https://dominio-da-env.example/x"))
            .toContain(ValidationCode.BLOCKED_LINK);
    });

    /**
     * `https://sympla.com.br@phishing.example` tem host `phishing.example`.
     * Quase todo regex caseiro de URL lê `sympla.com.br` — é por isso que a
     * regra usa o parser do WHATWG.
     */
    it("rejeita credencial embutida usada para disfarcar o host", () => {
        expect(codes("veja https://sympla.com.br@phishing.example/x"))
            .toContain(ValidationCode.BLOCKED_LINK);
    });

    it("rejeita host que e ip cru", () => {
        expect(codes("acesse http://192.168.1.1/promo")).toContain(ValidationCode.BLOCKED_LINK);
    });

    it("rejeita punycode (ataque homografico)", () => {
        expect(codes("acesse https://xn--pple-43d.com/promo"))
            .toContain(ValidationCode.BLOCKED_LINK);
    });

    it("rejeita acima do limite de links", () => {
        expect(codes("a https://a.com b https://b.com c https://c.com"))
            .toContain(ValidationCode.TOO_MANY_LINKS);
    });

    it("nao confunde ponto final da frase com parte da url", () => {
        expect(codes("ingressos em https://sympla.com.br/x.")).toEqual([]);
    });

    it("emite cada codigo uma vez so, mesmo com varios links ruins", () => {
        const result = codes("https://bit.ly/a e https://tinyurl.com/b");
        const shorteners = result.filter((code) => code === ValidationCode.SHORTENED_LINK);
        expect(shorteners).toHaveLength(1);
    });
});

describe("regra de spam", () => {
    it("rejeita sequencia extrema do mesmo caractere", () => {
        expect(codes("a".repeat(30))).toContain(ValidationCode.SPAM_SUSPECTED);
    });

    it("rejeita repeticao extrema da mesma palavra", () => {
        expect(codes(Array(10).fill("ingresso").join(" ")))
            .toContain(ValidationCode.SPAM_SUSPECTED);
    });

    it("nao rejeita entusiasmo: caixa alta em texto curto", () => {
        expect(codes("HOJE TEM FESTA NO BAR")).not.toContain(ValidationCode.SPAM_SUSPECTED);
    });

    it("nao rejeita vogal esticada sozinha", () => {
        expect(codes("vamooooooo hoje tem show no bar da esquina"))
            .not.toContain(ValidationCode.SPAM_SUSPECTED);
    });

    it("registra os sinais que dispararam, para recalibragem", () => {
        const result = runRules({ content: "a".repeat(30), tags: [], mediaCount: 1 });
        const spam = result.auditDetails.find(
            (detail) => detail.code === ValidationCode.SPAM_SUSPECTED
        );
        expect(spam?.matched).toContain("extreme_char_run");
    });
});

describe("orquestracao", () => {
    it("devolve todos os problemas de uma vez, nao um por tentativa", () => {
        const result = codes("a".repeat(600) + " que porra https://bit.ly/x");

        expect(result).toContain(ValidationCode.CONTENT_TOO_LONG);
        expect(result).toContain(ValidationCode.FORBIDDEN_LANGUAGE);
        expect(result).toContain(ValidationCode.SHORTENED_LINK);
    });

    it("nao repete o mesmo codigo", () => {
        const result = codes("porra que caralho");
        expect(new Set(result).size).toBe(result.length);
    });
});
