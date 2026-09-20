import { describe, expect, it } from "vitest";
import { toDayBucket } from "../bucket";

describe("toDayBucket", () => {
    it("formata como YYYY-MM-DD", () => {
        expect(toDayBucket("2026-09-11T23:04:12.512Z")).toBe("2026-09-11");
    });

    it("aceita Date e string com o mesmo resultado", () => {
        const iso = "2026-09-11T23:04:12.512Z";

        expect(toDayBucket(new Date(iso))).toBe(toDayBucket(iso));
    });

    it("usa UTC, não o fuso local: 20h em São Paulo cai no dia seguinte", () => {
        // -03:00 às 20h04 = 23h04 UTC do mesmo dia
        expect(toDayBucket("2026-09-11T20:04:12.512-03:00")).toBe("2026-09-11");
        // -03:00 às 22h04 = 01h04 UTC do dia SEGUINTE — é o caso da festa de madrugada
        expect(toDayBucket("2026-09-11T22:04:12.512-03:00")).toBe("2026-09-12");
    });

    it("separa partições na virada do dia UTC", () => {
        expect(toDayBucket("2026-09-11T23:59:59.999Z")).toBe("2026-09-11");
        expect(toDayBucket("2026-09-12T00:00:00.000Z")).toBe("2026-09-12");
    });

    it("lança para data inválida em vez de gravar bucket corrompido", () => {
        expect(() => toDayBucket("nao-e-data")).toThrow(/Data inválida/);
        expect(() => toDayBucket(new Date("invalido"))).toThrow(/Data inválida/);
    });
});
