import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

/** Código numérico de 6 dígitos enviado por email. */
export function generateCode(): string {
    return String(randomInt(100_000, 1_000_000));
}

/**
 * HMAC do código de verificação.
 *
 * Um SHA simples não serviria: só existem 900 mil códigos possíveis, então
 * quem lesse o Redis reverteria o digest por enumeração em segundos. Com HMAC
 * a chave do servidor é necessária para gerar qualquer digest.
 *
 * bcrypt também resolveria, mas custa ~100ms por tentativa em cima do hot path
 * de verificação — HMAC é da ordem de microssegundos.
 *
 * Compartilhado entre a verificação de cadastro e a redefinição de senha.
 */
export function hashCode(code: string): string {
    return createHmac("sha256", env.verificationCodeSecret).update(code).digest("hex");
}

/** Comparação em tempo constante entre o código recebido e o digest guardado. */
export function codeMatches(code: string, expectedHash: string): boolean {
    const actual = Buffer.from(hashCode(code), "hex");
    const expected = Buffer.from(expectedHash, "hex");

    if (actual.length !== expected.length) return false;

    return timingSafeEqual(actual, expected);
}
