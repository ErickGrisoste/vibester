import { FeedRepository } from "../repositories/feed.repository";
import { FeedEntriesByPostRepository } from "../repositories/feed_entries.repository";
import { UserFollowerRepository } from "../repositories/followers_by_user.repository";
import { EstablishmentFollowersRepository } from "../repositories/followers_by_establishment.repository";
import { FeedItem, FeedItemType } from "../types/feed.types";
import { FeedItemPayload } from "../schema/events/post-created.schema";
import { PostDeletedEvent } from "../schema/events/post-deleted.schema";
import { FeedTtlService } from "./ttl_service";
import { Post } from "../types/post.types";
import { PostsByUserRepository } from "../repositories/posts_by_user.repository";
import { UpdatePostContentEvent } from "../schema/events/post-content-updated.schema";
import { UpdatePostStatsEvent } from "../schema/events/post-stats-updated.schema";
import { EventsByIdRepository } from "../repositories/events_by_id.repository";
import { Event } from "../types/event.type";
import { EventAttendeesRepository } from "../repositories/attendees_by_event.repository";
import { EventsByUserRepository } from "../repositories/events_by_user.repository";
import { PostLikedEvent } from "../schema/events/post-liked.schema";
import { PostUnlikedEvent } from "../schema/events/post-unliked.schema";
import { MediaItem, toMediaItems } from "../utils/media";

type EventFeedItemPayload = Extract<
    FeedItemPayload,
    {
        itemType:
        | FeedItemType.EVENT
        | FeedItemType.EVENT_USER
        | FeedItemType.EVENT_ESTABLISHMENT;
    }
>;

export class FeedService {
    private readonly feedTtlService = new FeedTtlService();
    private eventByIdRepository = new EventsByIdRepository();
    private eventAttendeesRepository = new EventAttendeesRepository();
    private feedRepository = new FeedRepository();
    private feedEntriesRepository = new FeedEntriesByPostRepository();
    private userFollowerRepository = new UserFollowerRepository();
    private establishmentFollowersRepository = new EstablishmentFollowersRepository();
    private postByUserRepository = new PostsByUserRepository();
    private eventsByUserRepository = new EventsByUserRepository();

    async getFeedByUser(userId: string, limit: number, cursor?: Date) {
        const result = await this.feedRepository.findByUser(userId, limit, cursor);

        // A UDT volta em snake_case do driver; o restante da linha já é
        // snake_case por contrato dessa rota, mas `media` é campo novo e sai
        // camelCase para bater com o formato do post-service.
        const items = result.rows.map((row) => ({
            ...row,
            media: toMediaItems(row.media, row.image_urls) ?? null,
        }));

        return {
            items,
            nextCursor: result.rows.length > 0 ? result.rows[result.rows.length - 1].created_at : null
        };
    }

    async addItemToUserFeed(feedItem: FeedItem, ttl: number) {
        await this.addItemToFeedEntries(feedItem.itemId, feedItem.userId, feedItem.createdAt, ttl);
        return this.feedRepository.create(feedItem, ttl);
    }

    async addItemToFeedEntries(itemId: string, userId: string, createdAt: Date, ttl: number) {
        return this.feedEntriesRepository.create(itemId, userId, createdAt, ttl)
    }

    async handlePostCreated(data: FeedItemPayload) {
        const feedItem = this.toFeedItem(data);
        const post = this.toPost(feedItem);

        await this.savePostByUser(post);
        await this.distributePostToFollowers(feedItem);
    }

    async handleContentPostUpdated(event: UpdatePostContentEvent) {
        const entries = await this.feedEntriesRepository.findByItemId(event.postId);
        await this.postByUserRepository.updateContent(event.authorId, new Date(event.createdAt), event)

        await Promise.all(
            entries.rows.map((entry) =>
                this.feedRepository.updatePostContent(entry.user_id, entry.created_at, event)
            )
        );
    }

    async handlePostLiked(event: PostLikedEvent) {
        const entry = await this.feedEntriesRepository.findByItemIdAndUser(event.postId, event.userId);

        if (!entry) { return; }

        await this.feedRepository.markAsLiked(event.userId, entry.created_at, event.postId);
    }

    async handlePostUnliked(event: PostUnlikedEvent) {
        const entry = await this.feedEntriesRepository.findByItemIdAndUser(event.postId, event.userId);

        if (!entry) { return; }

        await this.feedRepository.markAsUnliked(event.userId, entry.created_at, event.postId);
    }

    async handlePostStatsUpdated(event: UpdatePostStatsEvent) {
        const entries = await this.feedEntriesRepository.findByItemId(event.postId);
        await this.postByUserRepository.updateStats(event.authorId, new Date(event.createdAt), event.postId, event.totalLikes, event.totalComments)

        await Promise.all(
            entries.rows.map((entry) =>
                this.feedRepository.updatePostStats(entry.user_id, entry.created_at, event.postId, event.totalLikes, event.totalComments)
            )
        );
    }

    async handlePostDeleted(postDeleted: PostDeletedEvent) {
        const entries = await this.feedEntriesRepository.findByItemId(postDeleted.postId);
        await this.postByUserRepository.delete(postDeleted.authorId, new Date(postDeleted.createdAt), postDeleted.postId)

        await Promise.all(
            entries.rows.map((entry) =>
                this.feedRepository.delete(entry.user_id, entry.created_at, entry.post_id)
            )
        );

        await this.feedEntriesRepository.deleteByItemId(postDeleted.postId);
    }

    async handleEventCreated(data: FeedItemPayload) {
        const feedItem = this.toFeedItem(data);
        const event = this.toEventItem(feedItem);

        const ttl = this.feedTtlService.getTtl(feedItem);

        await this.eventByIdRepository.create(feedItem, ttl);
        await this.eventsByUserRepository.create(event, ttl);

        await this.distributeEventToFollowers(feedItem);
    }

    private async distributeEventToFollowers(feedItem: Omit<FeedItem, "userId">) {
        if (!feedItem.authorId) {
            return;
        }

        const ttl = this.feedTtlService.getTtl(feedItem);
        let followers: string[];

        switch (feedItem.itemType) {
            case "EVENT_USER":
                followers = await this.userFollowerRepository.findFollowersByUser(feedItem.authorId);
                break;

            case "EVENT_ESTABLISHMENT":
                followers = await this.establishmentFollowersRepository.findFollowersByEstablishment(feedItem.authorId);
                break;

            default:
                throw new Error(`Unsupported author type: ${feedItem.itemType}`);
        }

        await Promise.all(
            followers.map((followerId) =>
                this.addItemToUserFeed(
                    {
                        userId: followerId,

                        createdAt: feedItem.createdAt,

                        itemId: feedItem.itemId,
                        itemType: feedItem.itemType,

                        authorId: feedItem.authorId,
                        authorUsername: feedItem.authorUsername,
                        authorProfilePicture: feedItem.authorProfilePicture,
                        authorVerified: feedItem.authorVerified,

                        establishmentId: feedItem.establishmentId,
                        establishmentName: feedItem.establishmentName,
                        establishmentLogo: feedItem.establishmentLogo,
                        establishmentCategory: feedItem.establishmentCategory,

                        eventId: feedItem.eventId,
                        eventTitle: feedItem.eventTitle,
                        eventBanner: feedItem.eventBanner,
                        eventLineup: feedItem.eventLineup,
                        eventDate: feedItem.eventDate,
                        eventLocation: feedItem.eventLocation,
                        eventOrganizerName: feedItem.eventOrganizerName,
                        eventOrganizerLogo: feedItem.eventOrganizerLogo,
                        totalConfirmed: feedItem.totalConfirmed,

                        title: feedItem.title,
                        content: feedItem.content,
                        imageUrls: feedItem.imageUrls,
                        media: feedItem.media,
                        tags: feedItem.tags,

                        totalLikes: feedItem.totalLikes ?? 0,
                        totalComments: feedItem.totalComments ?? 0,

                        isLiked: feedItem.isLiked,
                        isSponsored: feedItem.isSponsored,
                        isDeleted: feedItem.isDeleted,
                        updatedAt: feedItem.updatedAt,
                    },
                    ttl
                )
            )
        );
    }

    private toFeedItem(payload: FeedItemPayload): Omit<FeedItem, "userId"> {
        switch (payload.itemType) {
            case FeedItemType.USER_POST:
                return this.toUserPost(payload);

            case FeedItemType.ESTABLISHMENT_POST:
                return this.toEstablishmentPost(payload);

            case FeedItemType.SPONSORED_POST:
                return this.toSponsoredPost(payload);

            case FeedItemType.EVENT:
            case FeedItemType.EVENT_ESTABLISHMENT:
            case FeedItemType.EVENT_USER:
                return this.toEvent(payload);

            default:
                throw new Error(`Unsupported feed item type`);
        }
    }

    private toEventItem(feedItem: Omit<FeedItem, "userId">): Event {
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

    private toPost(feedItem: Omit<FeedItem, "userId">): Post {
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

    private toUserPost(payload: Extract<FeedItemPayload, { itemType: FeedItemType.USER_POST }>): Omit<FeedItem, "userId"> {
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
            isSponsored: payload.isSponsored,
            isDeleted: payload.isDeleted,

            createdAt: new Date(payload.createdAt),
            updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
        };
    }

    private toEstablishmentPost(payload: Extract<FeedItemPayload, { itemType: FeedItemType.ESTABLISHMENT_POST }>): Omit<FeedItem, "userId"> {
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
            isSponsored: payload.isSponsored,
            isDeleted: payload.isDeleted,

            createdAt: new Date(payload.createdAt),
            updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
        };
    }

    private toSponsoredPost(payload: Extract<FeedItemPayload, { itemType: FeedItemType.SPONSORED_POST }>): Omit<FeedItem, "userId"> {
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
            isSponsored: true,
            isDeleted: payload.isDeleted,

            createdAt: new Date(payload.createdAt),
            updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
        };
    }

    private toEvent(payload: EventFeedItemPayload): Omit<FeedItem, "userId"> {
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

    private async savePostByUser(post: Post) {
        const ttl = 60 * 60 * 24 * 30; // 30 dias em segundos
        await this.postByUserRepository.create(post, ttl);
    }

    async distributePostToFollowers(feedItem: Omit<FeedItem, "userId">) {
        const ttl = this.feedTtlService.getTtl(feedItem);
        let followers: string[];

        switch (feedItem.itemType) {
            case FeedItemType.USER_POST:
                followers = await this.userFollowerRepository.findFollowersByUser(feedItem.authorId!);
                break;

            case FeedItemType.ESTABLISHMENT_POST:
                followers = await this.establishmentFollowersRepository.findFollowersByEstablishment(feedItem.authorId!);
                break;

            default: throw new Error(`Unsupported feed item type: ${feedItem.itemType}`);
        }

        const feedItems = followers.map((followerId) => ({
            userId: followerId,

            createdAt: feedItem.createdAt,

            itemId: feedItem.itemId,
            itemType: feedItem.itemType,

            authorId: feedItem.authorId,
            authorUsername: feedItem.authorUsername,
            authorProfilePicture: feedItem.authorProfilePicture,
            authorVerified: feedItem.authorVerified,

            establishmentId: feedItem.establishmentId,
            establishmentName: feedItem.establishmentName,
            establishmentLogo: feedItem.establishmentLogo,
            establishmentCategory: feedItem.establishmentCategory,

            eventId: feedItem.eventId,
            eventTitle: feedItem.eventTitle,
            eventBanner: feedItem.eventBanner,
            eventLineup: feedItem.eventLineup,
            eventDate: feedItem.eventDate,
            eventLocation: feedItem.eventLocation,
            eventOrganizerName: feedItem.eventOrganizerName,
            eventOrganizerLogo: feedItem.eventOrganizerLogo,
            totalConfirmed: feedItem.totalConfirmed,

            title: feedItem.title,
            content: feedItem.content,
            imageUrls: feedItem.imageUrls,
            media: feedItem.media,
            tags: feedItem.tags,

            totalLikes: feedItem.totalLikes ?? 0,
            totalComments: feedItem.totalComments ?? 0,

            isLiked: feedItem.isLiked,
            isSponsored: feedItem.isSponsored,
            isDeleted: feedItem.isDeleted,
            updatedAt: feedItem.updatedAt,
        }));

        await Promise.all(
            feedItems.map(async (feedItem) => {
                await this.addItemToUserFeed(feedItem, ttl);
            })
        );
    }

    private async addRecentPostsToFollowerFeed(followedId: string, followerId: string, itemType: FeedItemType) {
        const since = new Date();
        since.setDate(since.getDate() - 15);

        const result = await this.postByUserRepository.findRecentPostsByUser(followedId, since);

        await Promise.all(
            result.rows.map(async (row) => {
                const post = this.rowToPost(row);
                const feedItem = this.postToFeedItem(post, followerId, itemType);

                await this.addItemToUserFeed(feedItem, 604800);
            })
        );
    }

    private rowToPost(row: any): Post {
        return {
            postId: row.post_id,

            userId: row.user_id,
            username: row.user_username,
            userProfilePicture: row.user_profile_picture,
            userVerified: row.user_verified,

            establishmentId: row.establishment_id,
            establishmentName: row.establishment_name,
            establishmentLogo: row.establishment_logo,
            establishmentCategory: row.establishment_category,

            imageUrls: row.image_urls,
            media: toMediaItems(row.media, row.image_urls),
            caption: row.caption,
            tags: row.tags,

            totalLikes: row.total_likes,
            totalComments: row.total_comments,

            isDeleted: row.is_deleted,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private rowToEvent(row: any): Event {
        return {
            eventId: row.event_id,
            createdAt: row.created_at,

            // autor
            authorId: row.author_id,
            authorUsername: row.author_username,
            authorProfilePicture: row.author_profile_picture,
            authorVerified: row.author_verified,

            // estabelecimento
            establishmentId: row.establishment_id,
            establishmentName: row.establishment_name,
            establishmentLogo: row.establishment_logo,
            establishmentCategory: row.establishment_category,

            // evento
            title: row.event_title,
            banner: row.event_banner,
            lineup: row.event_lineup,
            date: row.event_date,
            location: row.event_location,
            organizerName: row.event_organizer_name,
            organizerLogo: row.event_organizer_logo,

            // estatísticas
            totalConfirmed: row.total_confirmed,

            // controle
            isDeleted: row.is_deleted,
            updatedAt: row.updated_at
        };
    }

    private postToFeedItem(post: Post, feedOwnerId: string, itemType: FeedItemType): FeedItem {
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

    async handleUserFollowed(event: {
        followerId: string;
        followedId: string;
    }) {
        await this.userFollowerRepository.create(event.followedId, event.followerId);
        await Promise.all([
            this.addRecentPostsToFollowerFeed(event.followedId, event.followerId, FeedItemType.USER_POST),
            this.addRecentEventsToFollowerFeed(event.followedId, event.followerId)
        ]);
    }

    async handleUserUnfollowed(event: {
        followerId: string;
        followedId: string;
    }) {
        await this.userFollowerRepository.delete(event.followedId, event.followerId);

        await Promise.all([
            this.removeFollowedPostsFromFeed(event.followedId, event.followerId),
            this.removeEventsFromFeedByAuthor(event.followedId, event.followerId)
        ]);
    }

    private async removeFollowedPostsFromFeed(followedId: string, followerId: string) {
        const since = new Date();
        since.setDate(since.getDate() - 15);

        const result = await this.postByUserRepository.findRecentPostsByUser(followedId, since);

        await Promise.all(
            result.rows.flatMap((row) => [
                this.feedRepository.delete(followerId, row.created_at, row.post_id),
                this.feedEntriesRepository.delete(row.post_id, followerId, row.created_at)
            ])
        );
    }

    async handleEstablishmentFollowed(event: {
        followerId: string;
        followedId: string;
    }) {
        await this.establishmentFollowersRepository.create(event.followedId, event.followerId);
        await Promise.all([
            this.addRecentPostsToFollowerFeed(event.followedId, event.followerId, FeedItemType.ESTABLISHMENT_POST),
            this.addRecentEventsToFollowerFeed(event.followedId, event.followerId)
        ]);
    }

    async handleEstablishmentUnfollowed(event: {
        followerId: string;
        followedId: string;
    }) {
        await this.establishmentFollowersRepository.delete(event.followedId, event.followerId);

        await Promise.all([
            this.removeFollowedPostsFromFeed(event.followedId, event.followerId),
            this.removeEventsFromFeedByAuthor(event.followedId, event.followerId)
        ]);
    }

    async handleEventConfirmed(event: {
        eventId: string;
        userId: string;
        eventDate: string;
    }) {
        const ttl = this.feedTtlService.calculateEventTTL(new Date(event.eventDate));

        await this.eventAttendeesRepository.create(event.eventId, event.userId, ttl);
        await this.addEventToUserFeed(event.eventId, event.userId, ttl);
    }

    async handleEventUnconfirmed(event: {
        eventId: string;
        userId: string;
    }) {
        await this.removeEventFromFeed(event.eventId, event.userId);
        await this.eventAttendeesRepository.delete(event.eventId, event.userId);
    }

    private async removeEventFromFeed(eventId: string, userId: string) {
        const entry = await this.feedEntriesRepository.findByItemIdAndUser(eventId, userId);

        if (!entry) { return; }

        await Promise.all([
            this.feedRepository.delete(userId, entry.created_at, eventId),
            this.feedEntriesRepository.delete(eventId, userId, entry.created_at)
        ]);
    }

    private async addEventToUserFeed(eventId: string, userId: string, ttl: number) {
        const event = await this.eventByIdRepository.findById(eventId);

        if (!event) { return; }

        const feedItem = this.eventToFeedItem(event, userId);

        await this.addItemToUserFeed(feedItem, ttl);
    }

    private async addRecentEventsToFollowerFeed(authorId: string, followerId: string) {
        const since = new Date();
        since.setDate(since.getDate() - 15);

        const result = await this.eventsByUserRepository.findRecentEventsByAuthor(authorId, since);

        await Promise.all(
            result.rows.map(async (row) => {
                const event = this.rowToEvent(row);
                const feedItem = this.eventToFeedItem(event, followerId);

                const ttl = this.feedTtlService.calculateEventTTL(event.date);

                await this.addItemToUserFeed(feedItem, ttl);
            })
        );
    }

    private async removeEventsFromFeedByAuthor(authorId: string, followerId: string) {
        const since = new Date();
        since.setDate(since.getDate() - 15);

        const result = await this.eventsByUserRepository.findRecentEventsByAuthor(authorId, since);

        await Promise.all(
            result.rows.map(async (row) => {
                const entry = await this.feedEntriesRepository.findByItemIdAndUser(row.event_id, followerId);

                if (!entry) return;

                await Promise.all([
                    this.feedRepository.delete(followerId, entry.created_at, row.event_id),
                    this.feedEntriesRepository.delete(row.event_id, followerId, entry.created_at)
                ]);
            })
        );
    }

    private eventToFeedItem(event: Event, userId: string): FeedItem {
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


    // ver como vai ficar a distribuição baseada nas preferências do usuário

}