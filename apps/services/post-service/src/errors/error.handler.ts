import { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { HttpError } from "./http.error";

/**
 * Handler de erro compartilhado entre o servidor real e os testes de
 * integração — montar o Fastify sem ele fazia um ZodError (400) chegar
 * ao cliente como 500.
 */
export function registerErrorHandler(app: FastifyInstance) {
    app.setErrorHandler((error, _request, reply) => {
        if (error instanceof ZodError) {
            return reply.status(400).send({
                message: "Validation error",
                errors: error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }

        if (error instanceof HttpError) {
            return reply.status(error.statusCode).send({ message: error.message });
        }

        const fastifyError = error as { statusCode?: number; message?: string };
        if (typeof fastifyError.statusCode === "number" && fastifyError.statusCode < 500) {
            return reply.status(fastifyError.statusCode).send({ message: fastifyError.message });
        }

        app.log.error({ err: error }, "Unhandled error");
        return reply.status(500).send({
            message: "Internal server error",
        });
    });
}
