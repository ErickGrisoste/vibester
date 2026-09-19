import { env } from "../../config/env";
import { renderTemplate } from "../../services/templateRenderer.service";
import { enqueueEmail } from "../../workers/email.worker";

interface ContentReportedEvent {
  reportId: string;
  reporterId: string;
  targetType: "USER" | "POST";
  targetId: string;
  targetOwnerId?: string | null;
  reason: string;
  details?: string | null;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam ou golpe",
  NUDITY: "Nudez ou conteúdo sexual",
  VIOLENCE: "Violência ou ameaça",
  HARASSMENT: "Assédio ou bullying",
  HATE: "Discurso de ódio",
  ILLEGAL: "Atividade ilegal",
  IMPERSONATION: "Perfil falso",
  UNDERAGE: "Menor de idade",
  OTHER: "Outro",
};

/**
 * Leva cada denúncia à caixa da moderação. É o gatilho do compromisso de
 * análise em até 24h (App Store Guideline 1.2); a denúncia em si já está
 * persistida no user-service antes do evento sair.
 */
export async function handleContentReportedEvent(value: string): Promise<void> {
  try {
    const event: ContentReportedEvent = JSON.parse(value);
    if (!event.reportId || !event.targetId) return;

    const targetLabel = event.targetType === "POST" ? "Publicação" : "Perfil";
    const reasonLabel = REASON_LABELS[event.reason] ?? event.reason;

    const htmlBody = await renderTemplate("content_report.html", {
      reportId: event.reportId,
      reporterId: event.reporterId,
      targetLabel,
      targetType: event.targetType,
      targetId: event.targetId,
      targetOwnerId: event.targetOwnerId,
      isPost: event.targetType === "POST",
      reason: reasonLabel,
      details: event.details,
      createdAt: event.createdAt,
    });

    enqueueEmail({
      to: env.moderationEmail,
      subject: `[Denúncia] ${targetLabel} — ${reasonLabel}`,
      message: htmlBody,
    });

    console.log(`[Kafka] Content report ${event.reportId} queued to moderation`);
  } catch (err) {
    console.error("[Kafka] Error handling content.reported event:", err);
  }
}
