import { renderTemplate } from "../../services/templateRenderer.service";
import { enqueueEmail } from "../../workers/email.worker";

interface ExcessiveAttemptsEvent {
  email: string;
  name?: string;
  attempts: number;
  windowSeconds: number;
  occurredAt: string;
}

export async function handleExcessiveAttemptsEvent(value: string): Promise<void> {
  try {
    const event: ExcessiveAttemptsEvent = JSON.parse(value);

    const htmlBody = await renderTemplate("excessive_login_attempts.html", {
      name: event.name,
      attempts: event.attempts,
      windowMinutes: Math.max(1, Math.round(event.windowSeconds / 60)),
    });

    enqueueEmail({
      to: event.email,
      subject: "Tentativas de acesso à sua conta Vibester",
      message: htmlBody,
    });

    // O log nao inclui o email: o auth-service ja audita a tentativa com o
    // identificador mascarado, e aqui basta saber que o aviso foi enfileirado.
    console.log(`[Kafka] Excessive login attempts alert queued (${event.attempts} tentativas)`);
  } catch (err) {
    console.error("[Kafka] Error handling auth.attempts.exceeded event:", err);
  }
}
