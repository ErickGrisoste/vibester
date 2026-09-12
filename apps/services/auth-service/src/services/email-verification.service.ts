import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { hash } from "bcryptjs";
import { redis } from "../config/redis";
import { producer } from "../kafka/producer";
import prismaClient from "../prisma/index";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import { RegisterInputInterface, RegisterOutputInterface } from "../types/register.types";
import { PendingRegistration } from "../types/email-verification.types";

const PENDING_KEY = (email: string) => `pending:reg:${email}`;

/**
 * HMAC do código de verificação.
 *
 * Um SHA simples não serviria: só existem 900 mil códigos possíveis, então
 * quem lesse o Redis reverteria o digest por enumeração em segundos. Com HMAC
 * a chave do servidor é necessária para gerar qualquer digest.
 *
 * bcrypt também resolveria, mas custa ~100ms por tentativa em cima do hot path
 * de verificação — HMAC é da ordem de microssegundos.
 */
function hashCode(code: string): string {
    return createHmac("sha256", env.verificationCodeSecret).update(code).digest("hex");
}

/** Comparação em tempo constante entre dois digests hexadecimais. */
function codeMatches(code: string, expectedHash: string): boolean {
    const actual = Buffer.from(hashCode(code), "hex");
    const expected = Buffer.from(expectedHash, "hex");

    if (actual.length !== expected.length) return false;

    return timingSafeEqual(actual, expected);
}

export class EmailVerificationService {
    async initiate(input: RegisterInputInterface): Promise<void> {
        const passwordHash = await hash(input.password, 10);
        const code = String(randomInt(100_000, 999_999));

        const pending: PendingRegistration = {
            username: input.username,
            name: input.name,
            email: input.email,
            passwordHash,
            bornAt: input.bornAt instanceof Date ? input.bornAt.toISOString() : String(input.bornAt),
            codeHash: hashCode(code),
        };

        await redis.set(PENDING_KEY(input.email), JSON.stringify(pending), env.emailVerificationTtlSeconds);

        await producer.send({
            topic: "auth.email.verification",
            messages: [{ value: JSON.stringify({ email: input.email, name: input.name, code }) }],
        });
    }

    async verify(email: string, code: string): Promise<RegisterOutputInterface> {
        const raw = await redis.get(PENDING_KEY(email));

        if (!raw) {
            throw new AppError("Nenhuma verificação pendente para este email ou código expirado", 404, "no_pending_registration");
        }

        const pending: PendingRegistration = JSON.parse(raw);

        // pending.code (texto puro) só aparece em pendências gravadas antes do
        // deploy do HMAC — elas expiram junto com o TTL.
        const valido = pending.codeHash
            ? codeMatches(code, pending.codeHash)
            : pending.code === code;

        if (!valido) {
            await this.registerFailedAttempt(email, pending);
            throw new AppError("Código de verificação inválido", 422, "code_mismatch");
        }

        let account: Awaited<ReturnType<typeof prismaClient.access.create>>;

        try {
            account = await prismaClient.access.create({
                data: {
                    accountId: randomUUID(),
                    username: pending.username,
                    email: pending.email,
                    passwordHash: pending.passwordHash,
                },
            });
        } catch (err: any) {
            if (err?.code === "P2002") {
                // Conta ja existe: a pendencia perdeu o proposito, entao pode sair.
                await redis.del(PENDING_KEY(email));
                throw new AppError("Email ou username já está em uso", 409, "account_already_exists");
            }
            throw err;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), env.fetchTimeoutMs);

        try {
            const profileResponse = await fetch(`${env.profileServiceUrl}/users/profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId: account.accountId, name: pending.name, username: pending.username }),
                signal: controller.signal,
            });

            if (!profileResponse.ok) {
                throw new AppError("Serviço de perfil indisponível", 502, "profile_service_unavailable");
            }

            const profile = await profileResponse.json() as { accountId: string };

            // Só agora o cadastro esta completo. Consumir o codigo antes disso
            // deixaria o usuario sem conta E sem como reenviar o mesmo codigo,
            // obrigando-o a refazer o cadastro do zero.
            await redis.del(PENDING_KEY(email));

            return {
                authId: account.id,
                accountId: profile.accountId,
                username: account.username,
                name: pending.name,
                email: account.email,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
                bornAt: new Date(pending.bornAt),
            };
        } catch (err) {
            await prismaClient.access.delete({ where: { id: account.id } });
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Contabiliza um código errado e descarta a pendência quando o limite é
     * atingido, forçando o usuário a pedir um código novo.
     *
     * Sem isso o código de 6 dígitos teria os 10 minutos inteiros de TTL como
     * janela de tentativa — o rate limit por IP sozinho não fecha isso, porque
     * ele é por instância e o serviço escala para várias réplicas.
     */
    private async registerFailedAttempt(email: string, pending: PendingRegistration): Promise<void> {
        const attempts = (pending.attempts ?? 0) + 1;

        if (attempts >= env.maxCodeAttempts) {
            await redis.del(PENDING_KEY(email));
            throw new AppError(
                "Muitas tentativas inválidas. Solicite um novo código.",
                429,
                "too_many_code_attempts",
            );
        }

        // Reescrever a chave renova o TTL, então reaplicamos o tempo que ainda
        // restava: errar o código não pode esticar a validade dele.
        const remainingTtl = await redis.ttl(PENDING_KEY(email));
        const ttl = remainingTtl > 0 ? remainingTtl : env.emailVerificationTtlSeconds;

        await redis.set(PENDING_KEY(email), JSON.stringify({ ...pending, attempts }), ttl);
    }
}
