import { MediaItem } from "../utils/media";

export enum FeedItemType {
    USER_POST = "USER_POST",
    ESTABLISHMENT_POST = "ESTABLISHMENT_POST",
    EVENT = "EVENT",
    EVENT_USER = "EVENT_USER",
    EVENT_ESTABLISHMENT = "EVENT_ESTABLISHMENT",
    SPONSORED_POST = "SPONSORED_POST"
}

export interface FeedItem {
    // usuário dono do feed
    userId: string;

    // ordenação do feed
    createdAt: Date;

    // identificação do item
    itemId: string;
    itemType: FeedItemType;

    // autor do conteúdo
    authorId?: string;
    authorUsername?: string;
    authorProfilePicture?: string;
    authorVerified?: boolean;

    // estabelecimento marcado
    establishmentId?: string;
    establishmentName?: string;
    establishmentLogo?: string;
    establishmentCategory?: string;

    // evento relacionado
    eventId?: string;
    eventTitle?: string;
    eventBanner?: string;
    eventLineup?: string[];
    eventDate?: Date;
    eventLocation?: string;
    eventOrganizerName?: string;
    eventOrganizerLogo?: string;
    totalConfirmed?: number;

    // conteúdo
    title?: string;
    content?: string;
    imageUrls?: string[];
    media?: MediaItem[];
    tags?: string[];

    // estatísticas
    totalLikes?: number;
    totalComments?: number;

    // controle
    isLiked: boolean;
    isSponsored: boolean;
    isDeleted: boolean;
    updatedAt?: Date;
}

export interface PostCreatedEvent {
    postId: string;
    sourceId: string;
    itemType: FeedItemType;
    caption: string;
    imageUrls: string[];
    createdAt: string;
    eventDate?: string;
    eventLocation?: string;
    totalLikes?: number;
    totalComments?: number;
    isSponsored?: boolean;
}

export interface PostFeedDistributionInput {
    postId: string;
    sourceId: string;
    caption: string;
    imageUrls: string[];
    eventDate?: Date;
    eventLocation?: string;
    isSponsored: boolean;
    totalLikes?: number;
    totalComments?: number;
    createdAt: Date;
}

export interface UpdatePostContentEvent {
    authorId: string,
    postId: string;
    createdAt: string;
    caption?: string;
    imageUrls?: string[];
    media?: MediaItem[];
    tags?: string[];
}

export interface UpdatePostStatsEvent{
    authorId: string,
    postId: string;
    createdAt: string;
    totalLikes: number;
    totalComments: number;
}

export interface PostDeletedEvent {
    authorId: string,
    postId: string;
    createdAt: string;
}

export interface FollowUserEvent {
    followerId: string;
    followingId: string;
}

export interface FollowEstablishmentEvent {
    followerId: string;
    establishmentId: string;
}