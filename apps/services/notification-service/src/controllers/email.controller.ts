import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import { enqueueEmail } from "../workers/email.worker";
import { renderTemplate } from "../services/templateRenderer.service";
import {
  generateTwoFactorCode,
  saveTwoFactorCode,
  validateTwoFactorCode,
  markTwoFactorCodeAsUsed,
} from "../services/twoFactor.service";

const errorSchema = z.object({ message: z.string(), error: z.string().optional() });
const successResponseSchema = z.object({ message: z.string() });

const emailBodySchema = z.object({
  name: z.string().optional(),
  to: z.string().email(),
  subject: z.string().optional(),
  message: z.string().optional(),
  resetLink: z.string().optional(),
});

const validateTwoFactorBodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

export async function emailRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // Send generic email
  router.post("/email", {
    schema: {
      tags: ["Email"],
      summary: "Enviar e-mail genérico",
      body: emailBodySchema,
      response: {
        200: successResponseSchema,
        400: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const { to, subject = "Notificação Vibester", message = "" } = request.body;
      enqueueEmail({ to, subject, message });
      return reply.status(200).send({ message: "Email enviado para processamento" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao enfileirar email" });
    }
  });

  // Send reset password email
  router.post("/reset-password", {
    schema: {
      tags: ["Email"],
      summary: "Enviar e-mail de recuperação de senha",
      body: emailBodySchema,
      response: {
        202: successResponseSchema,
        400: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const { name = "Usuário", to, resetLink = "" } = request.body;
      const htmlBody = await renderTemplate("reset_password.html", { name, resetLink });

      enqueueEmail({
        to,
        subject: "Recuperação de Senha",
        message: htmlBody,
      });

      return reply.status(202).send({ message: "Email de recuperação enviado para fila" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao enviar e-mail de recuperação" });
    }
  });

  // Send welcome email
  router.post("/welcome", {
    schema: {
      tags: ["Email"],
      summary: "Enviar e-mail de boas-vindas",
      body: emailBodySchema,
      response: {
        202: successResponseSchema,
        400: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const { name = "Usuário", to } = request.body;
      const htmlBody = await renderTemplate("welcome.html", {
        name,
        platformLink: "https://vibester.com.br",
      });

      enqueueEmail({
        to,
        subject: "Seja bem vindo ao Vibester!",
        message: htmlBody,
      });

      return reply.status(202).send({ message: "Email de boas-vindas enviado" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao enviar e-mail de boas-vindas" });
    }
  });

  // Send 2FA code email
  router.post("/2fa", {
    schema: {
      tags: ["Email"],
      summary: "Enviar código 2FA por e-mail",
      body: emailBodySchema,
      response: {
        202: successResponseSchema,
        400: errorSchema,
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const { name = "Usuário", to } = request.body;
      const code = generateTwoFactorCode();

      await saveTwoFactorCode(to, code);

      const htmlBody = await renderTemplate("two_factor_code.html", { name, code });

      enqueueEmail({
        to,
        subject: "Aqui está o seu código de autenticação",
        message: htmlBody,
      });

      return reply.status(202).send({ message: "Código 2FA enviado" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao enviar código 2FA" });
    }
  });

  // Validate 2FA code
  router.post("/2fa/validate", {
    schema: {
      tags: ["Email"],
      summary: "Validar código 2FA",
      body: validateTwoFactorBodySchema,
      response: {
        200: z.object({ valid: z.boolean() }),
        401: z.object({ valid: z.boolean() }),
        500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const { email, code } = request.body;

      const valid = await validateTwoFactorCode(email, code);
      if (!valid) {
        return reply.status(401).send({ valid: false });
      }

      await markTwoFactorCodeAsUsed(email, code);
      return reply.status(200).send({ valid: true });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Erro ao validar código 2FA" });
    }
  });
}
