import prismaClient from "../prisma/index";
import { AppError } from "../errors/app-error";

/**
 * Suspensão de conta por moderação (Guideline 1.2 da App Store: remover quem
 * publica conteúdo abusivo). Conta suspensa não consegue mais fazer login; o
 * token já emitido vence sozinho em até `JWT_EXPIRES_IN`.
 */
export class AccountSuspensionService {
    async suspend(accountId: string): Promise<void> {
        await this.setSuspendedAt(accountId, new Date());
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
