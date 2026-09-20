import { describe, expect, it } from "vitest";
import { encodeLegacyCursor, encodeSessionCursor, parseFeedCursor } from "../../src/utils/feed_cursor";

const SESSAO = "7e1f0c8a-1111-4111-8111-aaaaaaaaaaaa";

function token(payload: unknown): string {
    return "s1." + Buffer.from(JSON.stringify(payload)).toString("base64url");
}

describe("parseFeedCursor", () => {
    it("sem cursor é a primeira página", () => {
        expect(parseFeedCursor(undefined)).toEqual({ kind: "none" });
        expect(parseFeedCursor("")).toEqual({ kind: "none" });
    });

    it("aceita a data ISO do formato antigo, para quem já está rolando o feed", () => {
        const cursor = parseFeedCursor("2026-09-12T02:00:00.000Z");

        expect(cursor).toEqual({ kind: "legacy", before: new Date("2026-09-12T02:00:00.000Z") });
    });

    it("faz ida e volta de um cursor de sessão, com e sem tail", () => {
        const semTail = parseFeedCursor(encodeSessionCursor(SESSAO, 20));
        const comTail = parseFeedCursor(encodeSessionCursor(SESSAO, 40, new Date("2026-09-01T00:00:00.000Z")));

        expect(semTail).toEqual({ kind: "session", sessionId: SESSAO, offset: 20, tail: null });
        expect(comTail).toEqual({
            kind: "session",
            sessionId: SESSAO,
            offset: 40,
            tail: new Date("2026-09-01T00:00:00.000Z"),
        });
    });

    it("o cursor de sessão não pode ser confundido com uma data", () => {
        expect(encodeSessionCursor(SESSAO, 0).startsWith("s1.")).toBe(true);
        expect(Number.isNaN(Date.parse(encodeSessionCursor(SESSAO, 0)))).toBe(true);
    });

    it("o cursor legado é a própria data ISO", () => {
        expect(encodeLegacyCursor(new Date("2026-09-12T02:00:00.000Z"))).toBe("2026-09-12T02:00:00.000Z");
    });

    it("recusa texto que não é data nem sessão", () => {
        expect(parseFeedCursor("not-a-date")).toEqual({ kind: "invalid" });
    });

    it("recusa sessão com base64 corrompido", () => {
        expect(parseFeedCursor("s1.%%%nao-e-base64%%%")).toEqual({ kind: "invalid" });
    });

    it("recusa sessão cujo id não é uuid, antes de chegar a um bind do Cassandra", () => {
        expect(parseFeedCursor(token({ s: "nao-sou-uuid", o: 0 }))).toEqual({ kind: "invalid" });
    });

    it("recusa offset negativo, fracionário ou absurdo", () => {
        expect(parseFeedCursor(token({ s: SESSAO, o: -1 }))).toEqual({ kind: "invalid" });
        expect(parseFeedCursor(token({ s: SESSAO, o: 1.5 }))).toEqual({ kind: "invalid" });
        expect(parseFeedCursor(token({ s: SESSAO, o: 1_000_000 }))).toEqual({ kind: "invalid" });
    });

    it("recusa tail que não é data", () => {
        expect(parseFeedCursor(token({ s: SESSAO, o: 20, t: "ontem" }))).toEqual({ kind: "invalid" });
    });

    it("recusa payload sem campos", () => {
        expect(parseFeedCursor(token({}))).toEqual({ kind: "invalid" });
        expect(parseFeedCursor(token(null))).toEqual({ kind: "invalid" });
    });
});
