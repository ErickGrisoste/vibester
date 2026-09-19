import { renderTemplate } from "../../services/templateRenderer.service";
import { enqueueEmail } from "../../workers/email.worker";

interface PasswordResetEvent {
  email: string;
  name?: string;
  code: string;
  expiresInMinutes?: number;
}

export async function handlePasswordResetEvent(value: string): Promise<void> {
  try {
    const event: PasswordResetEvent = JSON.parse(value);
    if (!event.email || !event.code) return;

    const htmlBody = await renderTemplate("password_reset_code.html", {
      name: event.name,
      code: event.code,
      expiresInMinutes: event.expiresInMinutes ?? 10,
    });

    enqueueEmail({
      to: event.email,
      subject: "Seu código para redefinir a senha do Vibester",
      message: htmlBody,
    });

    // Nunca logar o código nem o email: quem lê o log não pode trocar a senha
    // de ninguém.
    console.log("[Kafka] Password reset code email queued");
  } catch (err) {
    console.error("[Kafka] Error handling auth.password.reset event:", err);
  }
}
