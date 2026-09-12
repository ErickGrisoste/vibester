import { renderTemplate } from "../../services/templateRenderer.service";
import { enqueueEmail } from "../../workers/email.worker";

interface EmailVerificationEvent {
  email: string;
  name: string;
  code: string;
}

export async function handleVerificationEvent(value: string): Promise<void> {
  try {
    const event: EmailVerificationEvent = JSON.parse(value);
    const htmlBody = await renderTemplate("two_factor_code.html", {
      name: event.name,
      code: event.code,
    });

    enqueueEmail({
      to: event.email,
      subject: "Aqui está o seu código de verificação",
      message: htmlBody,
    });

    console.log(`[Kafka] Verification code for ${event.email}: ${event.code}`);
  } catch (err) {
    console.error("[Kafka] Error handling auth.email.verification event:", err);
  }
}
