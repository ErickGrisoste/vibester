import { renderTemplate } from "../../services/templateRenderer.service";
import { enqueueEmail } from "../../workers/email.worker";

interface UserRegisteredEvent {
  email: string;
  name: string;
}

export async function handleRegistrationEvent(value: string): Promise<void> {
  try {
    const event: UserRegisteredEvent = JSON.parse(value);
    const htmlBody = await renderTemplate("welcome.html", {
      name: event.name,
      platformLink: "https://vibester.com.br",
    });

    enqueueEmail({
      to: event.email,
      subject: "Seja bem vindo ao Vibester!",
      message: htmlBody,
    });

    console.log(`[Kafka] Welcome email queued for ${event.email}`);
  } catch (err) {
    console.error("[Kafka] Error handling user.registered event:", err);
  }
}
