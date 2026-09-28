import prismaClient from "../prisma/index";
import { AppError } from "../errors/app-error";
import { SessionService } from "./session.service";

/**
 * Suspensão de conta por moderação (Guideline 1.2 da App Store: remover quem
 * publica conteúdo abusivo). Suspender encerra todas as sessões e bloqueia
 * login e refresh; o access token já emitido vence sozinho em até
 * `ACCESS_TOKEN_TTL_SECONDS`.
 */
export class AccountSuspensionService {
    private readonly sessions = new SessionService();

    async suspend(accountId: string): Promise<void> {
        await this.setSuspendedAt(accountId, new Date());
        await this.sessions.revokeAll(accountId);
    }

    async unsuspend(accountId: string): Promise<void> {
        await this.setSuspendedAt(accountId, null);
    }

    private async setSuspendedAt(accountId: string, suspendedAt: Date | null): Promise<void> {
        try {
            await prismaClient.access.update({ where: { accountId }, data: { suspendedAt } });
        } catch (err: any) {
            if (err?.code === "P2025") {
                throw new AppError("Conta não encontrada", 404, "account_not_found");
            }
            throw err;
        }
    }
}
