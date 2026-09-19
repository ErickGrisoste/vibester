import { z } from "zod";
import { FeedItemType } from "../../types/feed.types";
import { MediaType } from "../../utils/media";

export const mediaItemSchema = z.object({
    url: z.string(),
    type: z.nativeEnum(MediaType),
    thumbnailUrl: z.string().optional(),
});

const baseSchema = z.object({
    itemId: z.string().uuid(),
    itemType: z.nativeEnum(FeedItemType),

    authorId: z.string().uuid().optional(),
    authorUsername: z.string().optional(),
    authorProfilePicture: z.string().optional(),
    authorVerified: z.boolean().optional(),

    establishmentId: z.string().uuid().optional(),
    establishmentName: z.string().optional(),
    establishmentLogo: z.string().optional(),
    establishmentCategory: z.string().optional(),

    title: z.string().optional(),
    content: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),
    media: z.array(mediaItemSchema).optional(),
    tags: z.array(z.string()).optional(),

    totalLikes: z.number().default(0),
    totalComments: z.number().default(0),

    isLiked: z.boolean().default(false),
    isSponsored: z.boolean().default(false),
    isDeleted: z.boolean().default(false),

    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime().optional(),
});

const eventSchema = baseSchema.extend({
    eventId: z.string().uuid(),
    eventTitle: z.string(),
    eventBanner: z.string(),
    eventLineup: z.array(z.string()).optional(),
    eventDate: z.iso.datetime(),
    eventLocation: z.string(),
    eventOrganizerName: z.string(),
    eventOrganizerLogo: z.string(),
    totalConfirmed: z.number().default(0),
});

/**
 * Só estabelecimentos criam eventos (regra de produto) — não existe distinção
 * de tipo de autor para eventos, então `EVENT` é o único `itemType` de evento
 * aceito aqui. `distributeEventToFollowers` (`src/services/feed.service.ts`)
 * sempre busca seguidores em `followers_by_establishment` para este tipo, sem
 * precisar de um switch. Se um dia usuários comuns puderem criar eventos,
 * volte a introduzir uma distinção explícita (ex. `authorType`) em vez de
 * assumir de novo que `authorId` sempre aponta pra um estabelecimento.
 */
export const feedItemSchema = z.discriminatedUnion("itemType", [

    baseSchema.extend({
        itemType: z.literal(FeedItemType.USER_POST)
    }),

    baseSchema.extend({
        itemType: z.literal(FeedItemType.ESTABLISHMENT_POST)
    }),

    baseSchema.extend({
        itemType: z.literal(FeedItemType.SPONSORED_POST)
    }),

    eventSchema.extend({
        itemType: z.literal(FeedItemType.EVENT),
    }),

]);

export type FeedItemPayload = z.infer<typeof feedItemSchema>;