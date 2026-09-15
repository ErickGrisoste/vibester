import prismaClient from "../prisma/index.js";
import { producer } from "../kafka/producer.js";
import { SafetyError, isPrismaError } from "./safetyError.js";
import type { CreateReportInput } from "../types/safety.types.js";

export const CONTENT_REPORTED_TOPIC = "content.reported";

export interface CreateReportResult {
    id: string;
    /** `false` quando a mesma pessoa já tinha denunciado o mesmo alvo. */
    created: boolean;
}

export class ReportService {
    /**
     * Registra a denúncia e avisa a moderação.
     *
     * Se o evento não sair, a denúncia é desfeita e o erro sobe: denúncia
     * gravada sem aviso ficaria invisível para a moderação, e a nova tentativa
     * do usuário cairia no "já denunciado" sem nunca gerar o email.
     */
    async create(reporterId: string, input: CreateReportInput): Promise<CreateReportResult> {
        const targetOwnerId = input.targetType === "USER" ? input.targetId : (input.targetOwnerId ?? null);

        if (targetOwnerId === reporterId) {
            throw new SafetyError("Você não pode denunciar o próprio conteúdo", 400);
        }

        const details = input.details?.trim() || null;

        let report: { id: string; createdAt: Date };
        try {
            report = await prismaClient.contentReport.create({
                data: {
                    reporterId,
                    targetType: input.targetType,
                    targetId: input.targetId,
                    targetOwnerId,
                    reason: input.reason,
                    details,
                },
                select: { id: true, createdAt: true },
            });
        } catch (error) {
            if (!isPrismaError(error, "P2002")) throw error;

            const existing = await prismaClient.contentReport.findUnique({
                where: {
                    reporterId_targetType_targetId: {
                        reporterId,
                        targetType: input.targetType,
                        targetId: input.targetId,
                    },
                },
                select: { id: true },
            });
            return { id: existing?.id ?? "", created: false };
        }

        try {
            await producer.send({
                topic: CONTENT_REPORTED_TOPIC,
                messages: [{
                    key: input.targetId,
                    value: JSON.stringify({
                        reportId: report.id,
                        reporterId,
                        targetType: input.targetType,
                        targetId: input.targetId,
                        targetOwnerId,
                        reason: input.reason,
                        details,
                        createdAt: report.createdAt.toISOString(),
                    }),
                }],
            });
        } catch (error) {
            await prismaClient.contentReport.delete({ where: { id: report.id } }).catch(() => {});
            throw error;
        }

        return { id: report.id, created: true };
    }
}
