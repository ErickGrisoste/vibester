import { FastifyReply, FastifyRequest } from "fastify";
import { AccountDeletionService } from "../services/account-deletion.service";
import { AccountSuspensionService } from "../services/account-suspension.service";
import { AccountIdParamsInterface, DeleteAccountInputInterface } from "../types/account.types";
import { AppError } from "../errors/app-error";
import { logAuthFailure } from "../observability/auth-audit";
import { accountIdFromRequest, assertAdminKey } from "../utils/request-auth";

export class AccountController {
    private readonly accountDeletionService = new AccountDeletionService();
    private readonly accountSuspensionService = new AccountSuspensionService();

    async delete(
        request: FastifyRequest<{ Body: DeleteAccountInputInterface }>,
        reply: FastifyReply
    ) {
        let accountId: string | undefined;

        try {
            accountId = accountIdFromRequest(request);
            await this.accountDeletionService.deleteAccount(accountId, request.body.password);
            request.log.info({ event: "auth.account.deleted", accountId }, "Conta excluída pelo titular");
            return reply.status(204).send();
        } catch (error: any) {
            if (error instanceof AppError) {
                logAuthFailure(request, "account-delete", error.reason ?? "app_error", accountId);
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }

    async suspend(
        request: FastifyRequest<{ Params: AccountIdParamsInterface }>,
        reply: FastifyReply
    ) {
        return this.changeSuspension(request, reply, true);
    }

    async unsuspend(
        request: FastifyRequest<{ Params: AccountIdParamsInterface }>,
        reply: FastifyReply
    ) {
        return this.changeSuspension(request, reply, false);
    }

    private async changeSuspension(
        request: FastifyRequest<{ Params: AccountIdParamsInterface }>,
        reply: FastifyReply,
        suspended: boolean,
    ) {
        const { accountId } = request.params;

        try {
            assertAdminKey(request);

            if (suspended) {
                await this.accountSuspensionService.suspend(accountId);
            } else {
                await this.accountSuspensionService.unsuspend(accountId);
            }

            request.log.warn(
                { event: suspended ? "auth.account.suspended" : "auth.account.unsuspended", accountId },
                "Suspensão de conta alterada pela moderação",
            );
            return reply.status(204).send();
        } catch (error: any) {
            if (error instanceof AppError) {
                logAuthFailure(request, "admin", error.reason ?? "app_error", accountId);
                return reply.status(error.statusCode).send({ error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ error: "Erro interno do servidor" });
        }
    }
}
