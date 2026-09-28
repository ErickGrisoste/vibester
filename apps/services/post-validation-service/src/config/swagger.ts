import { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export async function registerSwagger(app: FastifyInstance) {
    await app.register(swagger, {
        openapi: {
            info: {
                title: "Post Validation Service API",
                description:
                    "Valida o conteúdo de postagens contra as diretrizes da comunidade do Vibester. " +
                    "Conteúdo reprovado responde 200 com `valid: false` — o 4xx é reservado para a " +
                    "requisição estar errada, não para o veredito ser negativo. O userId nunca vem " +
                    "no payload: é o accountId do token JWT.",
                version: "1.0.0",
            },
            components: {
                securitySchemes: {
                    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
                },
            },
            tags: [
                { name: "validations", description: "Validação de conteúdo de postagem" },
                { name: "health", description: "Liveness e readiness" },
            ],
        },
    });

    await app.register(swaggerUi, {
        routePrefix: "/docs",
        uiConfig: { docExpansion: "list", deepLinking: true },
    });
}
