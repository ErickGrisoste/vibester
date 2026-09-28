import { z } from "zod";

/**
 * Payload da rota de validação.
 *
 * Duas camadas, como no post-service: o JSON Schema do Fastify em `routes.ts`
 * confere forma e tipo, e o Zod aqui confere o que o JSON Schema não expressa.
 * Ao mexer num, confira o outro — o Fastify roda antes, e um `required`
 * desatualizado rejeita o payload antes do Zod ver.
 *
 * **`userId` não existe neste schema, de propósito.** A identidade vem do token
 * (`getAccountId`). Aceitar do body permitiria atribuir a tentativa de publicar
 * conteúdo proibido a outra pessoa no log de auditoria.
 *
 * O teto de tamanho aqui (`MAX_ACCEPTED_CONTENT`) é do *transporte*, não da
 * regra de negócio: um texto acima disso é rejeitado como payload inválido
 * (400), enquanto um texto acima de `MAX_CONTENT_LENGTH` é rejeitado como
 * conteúdo inválido (200 + issue). Separar os dois é o que deixa a mensagem
 * "excede o limite de N caracteres" chegar ao usuário em vez de um 400 seco.
 */
const MAX_ACCEPTED_CONTENT = 10_000;

export const validatePostSchema = z.object({
    content: z.string().max(MAX_ACCEPTED_CONTENT).optional().default(""),
    tags: z.array(z.string()).max(200).optional().default([]),
    /**
     * Quantas mídias o post tem. Só distingue "post só de foto" de "post vazio";
     * o limite real de mídias é do post-service.
     */
    mediaCount: z.number().int().nonnegative().max(100).optional().default(0),
    /**
     * Só para correlacionar a validação com o post no log, quando já existir.
     * Não muda o veredito.
     */
    postId: z.uuid().optional(),
});

export type ValidatePostBody = z.infer<typeof validatePostSchema>;
