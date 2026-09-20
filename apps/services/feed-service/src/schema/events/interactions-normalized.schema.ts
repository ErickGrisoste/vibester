import { z } from "zod";

/**
 * Envelope de `interactions.normalized`, publicado pelo worker do `interaction-service`.
 *
 * É o stream canônico: toda interação que o worker persistiu, venha do app (impressão,
 * dwell, skip) ou dos serviços de domínio (curtida, comentário, follow). Este serviço
 * NÃO deve ler `interactions.raw` — lá só chegam sinais do cliente, porque a API
 * rejeita os tipos derivados. Ler `raw` deixaria o ranking sem curtida nenhuma.
 *
 * Segue a convenção de tópico próprio com payload cru (`directTopicHandlers` em
 * `src/kafka/consumer.ts`), não a do envelope genérico `{eventId, eventType,
 * occurredAt, data}` dos tópicos de domínio.
 *
 * O campo `v` é versão do envelope: mensagem de versão desconhecida é recusada pelo
 * schema em vez de ser interpretada errado. Quando o produtor subir para v2, este
 * schema precisa aceitar as duas por um período — os dois lados não sobem juntos.
 */
const interactionSchema = z.object({
    userId: z.string().min(1),
    eventId: z.string().min(1),
    type: z.string().min(1),
    itemId: z.string().min(1),
    itemType: z.string().min(1),
    occurredAt: z.string().min(1),
    /** Sem autor não há como atribuir afinidade; o item ainda conta para o próprio contador. */
    authorId: z.string().nullable().default(null),
    sessionId: z.string().nullable().default(null),
    position: z.number().nullable().default(null),
    dwellMs: z.number().nullable().default(null),
    source: z.string().nullable().default(null),
});

export const interactionsNormalizedSchema = z.object({
    v: z.literal(1),
    interactions: z.array(interactionSchema).min(1),
});

export type InteractionsNormalizedEvent = z.infer<typeof interactionsNormalizedSchema>;
export type NormalizedInteractionPayload = z.infer<typeof interactionSchema>;
