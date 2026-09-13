import { FeedItem, FeedItemType } from "../types/feed.types";
import { FeedItemPayload } from "../schema/events/post-created.schema";
import { Post } from "../types/post.types";
import { Event } from "../types/event.type";
import { MediaItem, MediaItemRow, toMediaItems } from "../utils/media";

type EventFeedItemPayload = Extract<FeedItemPayload, { itemType: FeedItemType.EVENT }>;

type ContentPostPayload = Extract<
    FeedItemPayload,
    {
        itemType:
        | FeedItemType.USER_POST
        | FeedItemType.ESTABLISHMENT_POST
        | FeedItemType.SPONSORED_POST;
    }
>;

/**
 * Linha crua de `posts_by_user`/`feed_by_user` como o driver do Cassandra
 * devolve. Colunas uuid (`user_id`, `post_id`, ...) chegam como instância
 * `Uuid` do driver, não `string` nativa — tipadas aqui como `string` só para
 * casar com `Post`/`FeedItem`, mesma convenção já usada no resto do serviço
 * (o valor sempre foi atribuído direto, sem `.toString()`; funciona porque
 * `Uuid.toString()`/serialização JSON já produzem o formato esperado).
 */
export interface PostRow {
    user_id: string;
    created_at: Date;
    post_id: string;
    user_username: string;
    user_profile_picture: string | null;
    user_verified: boolean;
    establishment_id: string | null;
    establishment_name: string | null;
    establishment_logo: string | null;
    establishment_category: string | null;
    image_urls: string[] | null;
    media: MediaItemRow[] | null;
    caption: string | null;
    tags: string[] | null;
    total_likes: number;
    total_comments: number;
    is_deleted: boolean;
    updated_at: Date | null;
}

/** Linha crua de `events_by_id`/`events_by_user`, mesma convenção de PostRow. */
export interface EventRow {
    event_id: string;
    created_at: Date;
    author_id: string;
    author_username: string;
    author_profile_picture: string | null;
    author_verified: boolean;
    establishment_id: string | null;
    establishment_name: string | null;
    establishment_logo: string | null;
    establishment_category: string | null;
    event_title: string;
    event_banner: string;
    event_lineup: string[] | null;
    event_date: Date;
    event_location: string;
    event_organizer_name: string;
    event_organizer_logo: string | null;
    total_confirmed: number;
    is_deleted: boolean;
    updated_at: Date | null;
}

/**
 * Consolida os três mapeamentos payload → domínio que antes eram métodos
 * privados quase idênticos (`toUserPost`/`toEstablishmentPost`/
 * `toSponsoredPost`, diferindo só em `isSponsored`) — USER_POST e
 * ESTABLISHMENT_POST preservam `payload.isSponsored` como veio, SPONSORED_POST
 * sempre força `true`, exatamente como no código original.
 */
function toContentPost(payload: ContentPostPayload): Omit<FeedItem, "userId"> {
    return {
        itemId: payload.itemId,
        itemType: payload.itemType,

        authorId: payload.authorId,
        authorUsername: payload.authorUsername,
        authorProfilePicture: payload.authorProfilePicture,
        authorVerified: payload.authorVerified,

        establishmentId: payload.establishmentId,
        establishmentName: payload.establishmentName,
        establishmentLogo: payload.establishmentLogo,
        establishmentCategory: payload.establishmentCategory,

        title: payload.title,
        content: payload.content,
        imageUrls: payload.imageUrls,
        media: payload.media as MediaItem[] | undefined,
        tags: payload.tags ? [...payload.tags] : undefined,

        totalLikes: payload.totalLikes ?? 0,
        totalComments: payload.totalComments ?? 0,

        isLiked: payload.isLiked,
        isSponsored: payload.itemType === FeedItemType.SPONSORED_POST ? true : payload.isSponsored,
        isDeleted: payload.isDeleted,

        createdAt: new Date(payload.createdAt),
        updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
    };
}

function toEvent(payload: EventFeedItemPayload): Omit<FeedItem, "userId"> {
    return {
        itemId: payload.itemId,
        itemType: payload.itemType,

        authorId: payload.authorId,
        authorUsername: payload.authorUsername,
        authorProfilePicture: payload.authorProfilePicture,
        authorVerified: payload.authorVerified,

        establishmentId: payload.establishmentId,
        establishmentName: payload.establishmentName,
        establishmentLogo: payload.establishmentLogo,
        establishmentCategory: payload.establishmentCategory,

        eventId: payload.eventId,
        eventTitle: payload.eventTitle,
        eventBanner: payload.eventBanner,
        eventLineup: payload.eventLineup ? [...payload.eventLineup] : undefined,
        eventDate: new Date(payload.eventDate),
        eventLocation: payload.eventLocation,
        eventOrganizerName: payload.eventOrganizerName,
        eventOrganizerLogo: payload.eventOrganizerLogo,
        totalConfirmed: payload.totalConfirmed,

        title: payload.title,
        content: payload.content,
        imageUrls: payload.imageUrls,
        media: payload.media as MediaItem[] | undefined,
        tags: payload.tags ? [...payload.tags] : undefined,

        totalLikes: payload.totalLikes ?? 0,
        totalComments: payload.totalComments ?? 0,

        isLiked: payload.isLiked,
        isSponsored: payload.isSponsored,
        isDeleted: payload.isDeleted,

        createdAt: new Date(payload.createdAt),
        updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
    };
}

/** Payload de evento Kafka (post/evento criado) → item de feed genérico. */
export function toFeedItem(payload: FeedItemPayload): Omit<FeedItem, "userId"> {
    switch (payload.itemType) {
        case FeedItemType.USER_POST:
        case FeedItemType.ESTABLISHMENT_POST:
        case FeedItemType.SPONSORED_POST:
            return toContentPost(payload);

        case FeedItemType.EVENT:
            return toEvent(payload);

        default:
            throw new Error(`Unsupported feed item type`);
    }
}

/** Item de feed (já mapeado de um payload de evento) → linha de `events_by_id`/`events_by_user`. */
export function toEventItem(feedItem: Omit<FeedItem, "userId">): Event {
    return {
        eventId: feedItem.eventId!,
        createdAt: feedItem.createdAt!,

        authorId: feedItem.authorId!,
        authorUsername: feedItem.authorUsername!,
        authorProfilePicture: feedItem.authorProfilePicture,
        authorVerified: feedItem.authorVerified ?? false,

        establishmentId: feedItem.establishmentId,
        establishmentName: feedItem.establishmentName,
        establishmentLogo: feedItem.establishmentLogo,
        establishmentCategory: feedItem.establishmentCategory,

        title: feedItem.eventTitle!,
        banner: feedItem.eventBanner!,
        lineup: feedItem.eventLineup,
        date: feedItem.eventDate!,
        location: feedItem.eventLocation!,
        organizerName: feedItem.eventOrganizerName!,
        organizerLogo: feedItem.eventOrganizerLogo,

        totalConfirmed: feedItem.totalConfirmed ?? 0,

        isDeleted: feedItem.isDeleted,
        updatedAt: feedItem.updatedAt
    };
}

/** Item de feed (já mapeado de um payload de evento) → linha de `posts_by_user`. */
export function toPost(feedItem: Omit<FeedItem, "userId">): Post {
    return {
        postId: feedItem.itemId,

        userId: feedItem.authorId!,
        username: feedItem.authorUsername!,
        userProfilePicture: feedItem.authorProfilePicture!,
        userVerified: feedItem.authorVerified!,

        establishmentId: feedItem.establishmentId,
        establishmentName: feedItem.establishmentName,
        establishmentLogo: feedItem.establishmentLogo,
        establishmentCategory: feedItem.establishmentCategory,

        imageUrls: feedItem.imageUrls ?? [],
        media: feedItem.media,
        caption: feedItem.content,
        tags: feedItem.tags,

        totalLikes: feedItem.totalLikes ?? 0,
        totalComments: feedItem.totalComments ?? 0,

        isDeleted: feedItem.isDeleted,
        createdAt: feedItem.createdAt,
        updatedAt: feedItem.updatedAt,
    };
}

/** Linha de `posts_by_user` (Cassandra) → domínio `Post`. */
export function rowToPost(row: PostRow): Post {
    return {
        postId: row.post_id,

        userId: row.user_id,
        username: row.user_username,
        // Post.userProfilePicture é obrigatório no tipo; mesma suposição (nunca
        // ausente na prática) que o toPost() original já fazia via `!` a partir
        // do payload — não normalizado para `?? undefined` porque não há
        // fallback razoável para uma foto de perfil ausente.
        userProfilePicture: row.user_profile_picture!,
        userVerified: row.user_verified,

        establishmentId: row.establishment_id ?? undefined,
        establishmentName: row.establishment_name ?? undefined,
        establishmentLogo: row.establishment_logo ?? undefined,
        establishmentCategory: row.establishment_category ?? undefined,

        imageUrls: row.image_urls ?? [],
        media: toMediaItems(row.media, row.image_urls),
        caption: row.caption ?? undefined,
        tags: row.tags ?? undefined,

        totalLikes: row.total_likes,
        totalComments: row.total_comments,

        isDeleted: row.is_deleted,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? undefined
    };
}

/** Linha de `events_by_user` (Cassandra) → domínio `Event`. */
export function rowToEvent(row: EventRow): Event {
    return {
        eventId: row.event_id,
        createdAt: row.created_at,

        // autor
        authorId: row.author_id,
        authorUsername: row.author_username,
        authorProfilePicture: row.author_profile_picture ?? undefined,
        authorVerified: row.author_verified,

        // estabelecimento
        establishmentId: row.establishment_id ?? undefined,
        establishmentName: row.establishment_name ?? undefined,
        establishmentLogo: row.establishment_logo ?? undefined,
        establishmentCategory: row.establishment_category ?? undefined,

        // evento
        title: row.event_title,
        banner: row.event_banner,
        lineup: row.event_lineup ?? undefined,
        date: row.event_date,
        location: row.event_location,
        organizerName: row.event_organizer_name,
        organizerLogo: row.event_organizer_logo ?? undefined,

        // estatísticas
        totalConfirmed: row.total_confirmed,

        // controle
        isDeleted: row.is_deleted,
        updatedAt: row.updated_at ?? undefined
    };
}

/** `Post` (cópia canônica do autor) → item de feed de um seguidor específico. */
export function postToFeedItem(post: Post, feedOwnerId: string, itemType: FeedItemType): FeedItem {
    return {
        // dono da timeline
        userId: feedOwnerId,

        // ordenação
        createdAt: post.createdAt,

        // identificação
        itemId: post.postId,
        itemType: itemType,

        // autor
        authorId: post.userId,
        authorUsername: post.username,
        authorProfilePicture: post.userProfilePicture,
        authorVerified: post.userVerified,

        // estabelecimento
        establishmentId: post.establishmentId,
        establishmentName: post.establishmentName,
        establishmentLogo: post.establishmentLogo,
        establishmentCategory: post.establishmentCategory,

        // conteúdo
        content: post.caption,
        imageUrls: post.imageUrls,
        media: post.media,
        tags: post.tags,

        // estatísticas
        totalLikes: post.totalLikes,
        totalComments: post.totalComments,

        // controle
        isLiked: false,
        isSponsored: false,
        isDeleted: post.isDeleted,
        updatedAt: post.updatedAt
    };
}

/** `Event` (cópia canônica do autor) → item de feed de um seguidor específico. */
export function eventToFeedItem(event: Event, userId: string): FeedItem {
    return {
        // dono da timeline
        userId,

        // ordenação no feed
        createdAt: event.date,

        // identificação
        itemId: event.eventId,
        itemType: FeedItemType.EVENT,

        // autor
        authorId: event.authorId,
        authorUsername: event.authorUsername,
        authorProfilePicture: event.authorProfilePicture,
        authorVerified: event.authorVerified,

        // estabelecimento
        establishmentId: event.establishmentId,
        establishmentName: event.establishmentName,
        establishmentLogo: event.establishmentLogo,
        establishmentCategory: event.establishmentCategory,

        // dados do evento
        eventId: event.eventId,
        eventTitle: event.title,
        eventBanner: event.banner,
        eventLineup: event.lineup,
        eventDate: event.date,
        eventLocation: event.location,
        eventOrganizerName: event.organizerName,
        eventOrganizerLogo: event.organizerLogo,

        totalConfirmed: event.totalConfirmed,

        // conteúdo (eventos não utilizam esses campos)
        title: undefined,
        content: undefined,
        imageUrls: undefined,
        media: undefined,
        tags: undefined,

        // estatísticas de posts (não se aplicam a eventos)
        totalLikes: undefined,
        totalComments: undefined,

        // controle
        isLiked: false,
        isSponsored: false,
        isDeleted: event.isDeleted,
        updatedAt: event.updatedAt
    };
}
