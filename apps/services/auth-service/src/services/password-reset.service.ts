import { hash } from "bcryptjs";
import { redis } from "../config/redis";
import { producer } from "../kafka/producer";
import prismaClient from "../prisma/index";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import { PendingPasswordReset } from "../types/password-reset.types";
import { AuthAttemptsService } from "./auth-attempts.service";
import { codeMatches, generateCode, hashCode } from "./verification-code";

export const PASSWORD_RESET_TOPIC = "auth.password.reset";

const RESET_KEY = (email: string) => `pwreset:${email}`;

/** Intervalo mínimo entre dois emails de código para o mesmo endereço. */
const RESEND_COOLDOWN_SECONDS = 60;

export class PasswordResetService {
    private readonly attempts = new AuthAttemptsService();

    /**
     * Envia um código de redefinição para o email, se houver conta.
     *
     * Nunca revela se o email existe: a rota responde igual nos dois casos, e
     * o caminho "sem conta" termina aqui em silêncio. O cooldown impede que o
     * endpoint vire ferramenta de spam contra a caixa de alguém.
     */
    async request(rawEmail: string): Promise<void> {
        const email = rawEmail.trim();

        const access = await prismaClient.access.findUnique({
            where: { email },
            select: { accountId: true, email: true, username: true },
        });

        if (!access) return;

        const remainingTtl = await redis.ttl(RESET_KEY(access.email));
        if (remainingTtl > env.passwordResetTtlSeconds - RESEND_COOLDOWN_SECONDS) return;

        const code = generateCode();
        const pending: PendingPasswordReset = {
            accountId: access.accountId,
            codeHash: hashCode(code),
        };

        await redis.set(RESET_KEY(access.email), JSON.stringify(pending), env.passwordResetTtlSeconds);

        await producer.send({
            topic: PASSWORD_RESET_TOPIC,
            messages: [{
                key: access.accountId,
                value: JSON.stringify({
                    email: access.email,
                    name: access.username.replace(/^@/, ""),
                    code,
                    expiresInMinutes: Math.max(1, Math.round(env.passwordResetTtlSeconds / 60)),
                }),
            }],
        });
    }

    /**
     * Troca a senha se o código bater. O código é de uso único e expira junto
     * com a chave; errar `maxCodeAttempts` vezes descarta a pendência.
     */
    async reset(rawEmail: string, code: string, newPassword: string): Promise<void> {
        const email = rawEmail.trim();
        const key = RESET_KEY(email);
        const raw = await redis.get(key);

        if (!raw) {
            throw new AppError("Código expirado ou inválido. Peça um novo código.", 404, "no_pending_reset");
        }

        const pending: PendingPasswordReset = JSON.parse(raw);

        if (!codeMatches(code, pending.codeHash)) {
            await this.registerFailedAttempt(key, pending);
            throw new AppError("Código de verificação inválido", 422, "code_mismatch");
        }

        const passwordHash = await hash(newPassword, 10);

        try {
            await prismaClient.access.update({
                where: { accountId: pending.accountId },
                data: { passwordHash },
            });
        } catch (err: any) {
            // Conta excluída entre o pedido e a redefinição.
            if (err?.code === "P2025") {
                await redis.del(key);
                throw new AppError("Código expirado ou inválido. Peça um novo código.", 404, "account_not_found");
            }
            throw err;
        }

        await redis.del(key);
        await this.attempts.clearLoginFailures(email);
    }

    private async registerFailedAttempt(key: string, pending: PendingPasswordReset): Promise<void> {
        const attempts = (pending.attempts ?? 0) + 1;

        if (attempts >= env.maxCodeAttempts) {
            await redis.del(key);
            throw new AppError(
                "Muitas tentativas inválidas. Solicite um novo código.",
                429,
                "too_many_code_attempts",
            );
        }

        // Reescrever renova o TTL; reaplica o que restava para errar o código
        // não esticar a validade dele.
        const remainingTtl = await redis.ttl(key);
        const ttl = remainingTtl > 0 ? remainingTtl : env.passwordResetTtlSeconds;

        await redis.set(key, JSON.stringify({ ...pending, attempts }), ttl);
    }
}
