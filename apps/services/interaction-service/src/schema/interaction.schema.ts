import { z } from "zod";
import { env } from "../config/env";
import {
    CLIENT_INTERACTION_TYPES,
    INTERACTION_SOURCES,
    INTERACTION_TYPES,
    ITEM_TYPES,
} from "../types/interaction.types";

/** Tolerância para relógio de cliente adiantado. Acima disso o evento é rejeitado. */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/** Teto de dwell por evento: 1h olhando o mesmo post é defeito de cliente, não comportamento. */
const MAX_DWELL_MS = 60 * 60 * 1000;

/**
 * `itemId` é string curta em vez de `uuid()` de propósito: post usa UUID hoje, mas
 * evento e estabelecimento não têm formato garantido, e rejeitar o id errado aqui
 * significaria perder silenciosamente todas as interações daquele tipo de item.
 * O limite de 64 caracteres é o que impede payload abusivo.
 */
const itemIdSchema = z.string().min(1, "itemId é obrigatório").max(64, "itemId muito longo");

const occurredAtSchema = z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "occurredAt deve ser uma data ISO 8601 válida",
    })
    .refine((value) => Date.parse(value) <= Date.now() + CLOCK_SKEW_TOLERANCE_MS, {
        message: "occurredAt está no futuro",
    })
    .refine(
        (value) =>
            Date.parse(value) >= Date.now() - env.max_event_age_hours * 60 * 60 * 1000,
        {
            message: `occurredAt mais antigo que ${env.max_event_age_hours}h`,
        }
    );

export const clientInteractionEventSchema = z.object({
    // Gerado pelo cliente. Entra na chave primária do Cassandra, então reenviar
    // o mesmo evento sobrescreve a mesma linha em vez de duplicar.
    eventId: z.uuid("eventId deve ser um UUID"),
    type: z.enum(CLIENT_INTERACTION_TYPES),
    itemId: itemIdSchema,
    itemType: z.enum(ITEM_TYPES),
    occurredAt: occurredAtSchema,
    position: z.coerce.number().int().min(0).max(10_000).optional(),
    dwellMs: z.coerce.number().int().min(0).max(MAX_DWELL_MS).optional(),
    source: z.enum(INTERACTION_SOURCES).optional(),
});

export const interactionBatchSchema = z.object({
    sessionId: z.uuid("sessionId deve ser um UUID"),
    events: z
        .array(clientInteractionEventSchema)
        .min(1, "events não pode ser vazio")
        .max(env.max_batch_size, `events excede o limite de ${env.max_batch_size} por requisição`),
});

export type InteractionBatchInput = z.infer<typeof interactionBatchSchema>;

/**
 * Validação do que chega pelo Kafka, já no formato canônico.
 *
 * Propositalmente **sem** a regra de idade de `occurredAt` que a API aplica: uma
 * mensagem pode ficar retida no tópico durante uma indisponibilidade do worker e
 * ser processada horas depois. Reaplicar a janela de frescor aqui descartaria
 * justamente o backlog que se quer recuperar.
 */
export const normalizedInteractionSchema = z.object({
    userId: z.string().min(1).max(64),
    eventId: z.uuid(),
    type: z.enum(INTERACTION_TYPES),
    itemId: itemIdSchema,
    itemType: z.enum(ITEM_TYPES),
    occurredAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "occurredAt inválido",
    }),
    sessionId: z.string().max(64).nullable().default(null),
    position: z.number().int().nullable().default(null),
    dwellMs: z.number().int().nullable().default(null),
    source: z.enum(INTERACTION_SOURCES).nullable().default(null),
});

export const interactionsRawMessageSchema = z.object({
    v: z.literal(1),
    interactions: z.array(normalizedInteractionSchema).min(1),
});
