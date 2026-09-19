import { compare } from "bcryptjs";
import { redis } from "../config/redis";
import { producer } from "../kafka/producer";
import prismaClient from "../prisma/index";
import { AppError } from "../errors/app-error";
import { UserDeletedEvent } from "../types/account.types";
import { AuthAttemptsService } from "./auth-attempts.service";

export const USER_DELETED_TOPIC = "user.deleted";

export class AccountDeletionService {
    private readonly attempts = new AuthAttemptsService();

    /**
     * Exclui a conta de `accountId` (sempre vindo do JWT, nunca do corpo).
     *
     * A senha é pedida de novo: um token esquecido num aparelho destravado não
     * pode bastar para apagar a conta de alguém.
     *
     * Ordem: publica `user.deleted` **antes** de apagar a credencial. Se a
     * publicação falhar, nada foi apagado e o usuário tenta de novo. Se a
     * publicação passar e o delete falhar, os consumidores já limparam os dados
     * e a nova tentativa (a senha ainda confere) publica de novo e conclui —
     * os consumidores são idempotentes. O inverso deixaria dados órfãos sem
     * nenhuma credencial capaz de pedir a exclusão outra vez.
     */
    async deleteAccount(accountId: string, password: string): Promise<void> {
        const access = await prismaClient.access.findUnique({ where: { accountId } });

        if (!access) {
            throw new AppError("Conta não encontrada", 404, "account_not_found");
        }

        const passwordMatch = await compare(password, access.passwordHash);

        if (!passwordMatch) {
            throw new AppError("Senha incorreta", 401, "invalid_password");
        }

        const event: UserDeletedEvent = {
            userId: access.accountId,
            accountId: access.accountId,
            occurredAt: new Date().toISOString(),
        };

        await producer.send({
            topic: USER_DELETED_TOPIC,
            messages: [{ key: access.accountId, value: JSON.stringify(event) }],
        });

        try {
            await prismaClient.access.delete({ where: { accountId } });
        } catch (err: any) {
            // Já apagada por uma requisição concorrente: o objetivo foi atingido.
            if (err?.code !== "P2025") throw err;
        }

        await Promise.all([
            redis.del(`pwreset:${access.email}`).catch(() => {}),
            this.attempts.clearLoginFailures(access.email),
        ]);
    }
}
