import { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "@fastify/type-provider-zod";

export async function registerSwagger(app: FastifyInstance) {
  if (process.env.SWAGGER_ENABLED !== "true" && process.env.NODE_ENV === "test") return;

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Notification Service API",
        description: "Documentação da API do serviço de notificações do Vibester (emails, 2FA e feed de notificações).",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      tags: [
        { name: "Health", description: "Verificação de saúde do serviço" },
        { name: "Notifications", description: "Feed e gerenciamento de notificações in-app" },
        { name: "Email", description: "Envio de e-mails e código 2FA" },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}
