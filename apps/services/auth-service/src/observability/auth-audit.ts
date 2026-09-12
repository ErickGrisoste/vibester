import { FastifyRequest } from "fastify";

export type AuthEvent = "login" | "verify-email" | "register";

/**
 * Mascara o identificador antes de ir para o log.
 *
 * O log precisa ser suficiente para correlacionar tentativas (mesmo alvo,
 * mesmo IP, mesma janela) sem virar um dump de PII de quem tentou entrar.
 */
export function maskSubject(subject?: string): string {
    if (!subject) return "unknown";

    const at = subject.indexOf("@");
    if (at <= 0) {
        // username: mantem so a primeira letra
        return `${subject[0]}***`;
    }

    const local = subject.slice(0, at);
    const domain = subject.slice(at);
    return `${local[0]}***${domain}`;
}

/**
 * Registra uma tentativa de autenticação que falhou.
 *
 * Usa `warn` de propósito: 401/404/422 são desfechos esperados de cliente, não
 * falha do serviço — logá-los como `error` afogaria o sinal de erro real.
 *
 * Nunca receba senha, hash ou o código de verificação aqui.
 */
export function logAuthFailure(
    request: FastifyRequest,
    event: AuthEvent,
    reason: string,
    subject?: string,
): void {
    request.log.warn(
        {
            event: `auth.${event}.failed`,
            reason,
            subject: maskSubject(subject),
            ip: request.ip,
        },
        "Tentativa de autenticação falhou",
    );
}
