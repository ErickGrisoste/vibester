import { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Auth Service API",
        description:
          "Documentação da API do serviço de autenticação do Vibester (registro, login e sessões).",
        version: "1.0.0",
      },
      // Referenciado por `security: [{ bearerAuth: [] }]` nas rotas: sem a
      // declaração, `app.swagger()` lança e a geração da doc quebra.
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      tags: [
        { name: "Health", description: "Verificação de saúde do serviço" },
        { name: "Auth", description: "Registro e autenticação de contas" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}
