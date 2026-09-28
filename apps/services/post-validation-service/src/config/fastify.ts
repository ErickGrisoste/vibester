import type { FastifyServerOptions } from "fastify";

/**
 * Opções do AJV compartilhadas entre o servidor real (`src/api.ts`) e o helper
 * de teste — se as duas divergirem, o teste de rota valida um comportamento que
 * não é o de produção.
 *
 * As duas opções abaixo **desligam padrões do Fastify**, de propósito:
 *
 * - `removeAdditional: false`. O padrão do Fastify é remover em silêncio o
 *   campo que não está no schema. Aqui isso é perigoso pelo motivo específico
 *   deste serviço: um cliente que mandasse `userId` no body teria o campo
 *   descartado sem aviso e continuaria achando que definiu a identidade da
 *   validação — quando a identidade sai do token. Falhar com 400 torna o erro
 *   visível na integração, e não meses depois num log de auditoria com o dono
 *   errado.
 *
 * - `coerceTypes: false`. O padrão converte `42` em `"42"` para um campo
 *   string. Um serviço cujo trabalho é dizer "este conteúdo está correto?" não
 *   deveria consertar o payload de quem pergunta em silêncio: `content: 42` é
 *   bug de cliente, e devolver 400 é o que faz alguém consertá-lo.
 */
export const FASTIFY_AJV_OPTIONS: FastifyServerOptions["ajv"] = {
    customOptions: {
        removeAdditional: false,
        coerceTypes: false,
        useDefaults: true,
        allErrors: false,
    },
};
