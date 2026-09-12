import nodemailer from "nodemailer";
import { env } from "../config/env";
import { EmailNotification } from "../types/email.types";

const hasSmtpAuth = Boolean(env.smtpEmail && env.smtpPassword);

const transporter = hasSmtpAuth
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpEmail,
        pass: env.smtpPassword,
      },
    })
  : null;

export async function sendEmail(notification: EmailNotification): Promise<void> {
  if (!transporter) {
    console.log(`[SMTP] Mode Dev: Sem credenciais SMTP configuradas. E-mail simulado para ${notification.to}`);
    return;
  }

  console.log(`[SMTP] Sending email to ${notification.to}`);

  await transporter.sendMail({
    from: `"${env.smtpFromName}" <${env.smtpEmail || "noreply@vibester.com.br"}>`,
    to: notification.to,
    subject: notification.subject,
    html: notification.message,
  });

  console.log(`[SMTP] Email sent successfully to ${notification.to}`);
}

export async function sendEmailWithRetry(notification: EmailNotification, maxRetries = 3): Promise<void> {
  if (!transporter) {
    await sendEmail(notification);
    return;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendEmail(notification);
      return;
    } catch (err) {
      console.error(`[SMTP] Error sending email (attempt ${attempt}/${maxRetries}):`, err);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  console.error(`[SMTP] Failed to send email to ${notification.to} after ${maxRetries} attempts`);
}
