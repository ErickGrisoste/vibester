import { FastifyReply, FastifyRequest } from "fastify";
import { getAccountId } from "../plugins/auth";
import { validatePostSchema } from "../schema/validation.schema";
import { ValidationService } from "../services/validation.service";

export class ValidationController {

    constructor(private readonly validationService: ValidationService) {}

    /**
     * `POST /validations/post`.
     *
     * **Responde 200 mesmo quando o conteúdo é inválido**, com `valid: false` e
     * a lista de issues. A requisição perguntou "isto pode ser publicado?" e foi
     * respondida com sucesso — o 4xx é reservado para a requisição estar errada
     * (payload malformado, token ausente), não para a resposta ser "não".
     *
     * Essa separação é o que faz o cliente conseguir distinguir "seu texto tem
     * um problema, mostre isto ao usuário" de "a chamada falhou, tente de novo",
     * e é o que permite cachear o veredito — não se cacheia um erro HTTP.
     */
    async validatePost(request: FastifyRequest, reply: FastifyReply) {
        const body = validatePostSchema.parse(request.body ?? {});

        const result = await this.validationService.validate(
            { content: body.content, tags: body.tags, mediaCount: body.mediaCount },
            { userId: getAccountId(request), source: "sync", postId: body.postId }
        );

        return reply.status(200).send(result);
    }
}
