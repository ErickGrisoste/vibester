import { FeedRepository } from "../repositories/feed.repository";
import { FeedEntriesByPostRepository } from "../repositories/feed_entries.repository";
import { UserFollowerRepository } from "../repositories/followers_by_user.repository";
import { EstablishmentFollowersRepository } from "../repositories/followers_by_establishment.repository";
import { PostsByUserRepository } from "../repositories/posts_by_user.repository";
import { EventsByIdRepository } from "../repositories/events_by_id.repository";
import { EventsByUserRepository } from "../repositories/events_by_user.repository";
import { FeedItem, FeedItemType } from "../types/feed.types";
import { Post } from "../types/post.types";
import { FeedItemPayload } from "../schema/events/post-created.schema";
import { PostDeletedEvent } from "../schema/events/post-deleted.schema";
import { UpdatePostContentEvent } from "../schema/events/post-content-updated.schema";
import { UpdatePostStatsEvent } from "../schema/events/post-stats-updated.schema";
import { PostLikedEvent } from "../schema/events/post-liked.schema";
import { PostUnlikedEvent } from "../schema/events/post-unliked.schema";
import { FeedTtlService } from "./ttl_service";
import { FeedWriterService } from "./feed-writer.service";
import { runFanout } from "../utils/fanout";
import { toEventItem, toFeedItem, toPost } from "./feed-item.mapper";

/**
 * Fan-out on write: consome eventos de criação/atualização/exclusão de posts e
 * eventos, e propaga (distribui) o item já desnormalizado para a partição de
 * feed de cada seguidor. Não decide "quem é seguidor de quem" (isso é
 * FollowService) nem confirma presença em evento (EventAttendanceService) —
 * só reage ao conteúdo em si (post/evento) sendo criado, editado, curtido ou
 * removido.
 */
export class FeedFanoutService {
    private readonly feedTtlService = new FeedTtlService();
    private readonly feedWriter = new FeedWriterService();
    private eventByIdRepository = new EventsByIdRepository();
    private feedRepository = new FeedRepository();
    private feedEntriesRepository = new FeedEntriesByPostRepository();
    private userFollowerRepository = new UserFollowerRepository();
    private establishmentFollowersRepository = new EstablishmentFollowersRepository();
    private postByUserRepository = new PostsByUserRepository();
    private eventsByUserRepository = new EventsByUserRepository();

    async handlePostCreated(data: FeedItemPayload) {
        const feedItem = toFeedItem(data);
        const post = toPost(feedItem);

        await this.savePostByUser(post);
        await this.distributePostToFollowers(feedItem);
    }

    async handleContentPostUpdated(event: UpdatePostContentEvent) {
        const entries = await this.feedEntriesRepository.findByItemId(event.postId);
        await this.postByUserRepository.updateContent(event.authorId, new Date(event.createdAt), event)

        await runFanout(
            "handleContentPostUpdated",
            entries.rows.map((entry) => () =>
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

        await runFanout(
            "handlePostStatsUpdated",
            entries.rows.map((entry) => () =>
                this.feedRepository.updatePostStats(entry.user_id, entry.created_at, event.postId, event.totalLikes, event.totalComments)
            )
        );
    }

    async handlePostDeleted(postDeleted: PostDeletedEvent) {
        const entries = await this.feedEntriesRepository.findByItemId(postDeleted.postId);
        await this.postByUserRepository.delete(postDeleted.authorId, new Date(postDeleted.createdAt), postDeleted.postId)

        await runFanout(
            "handlePostDeleted",
            entries.rows.map((entry) => () =>
                this.feedRepository.delete(entry.user_id, entry.created_at, entry.post_id)
            )
        );

        await this.feedEntriesRepository.deleteByItemId(postDeleted.postId);
    }

    async handleEventCreated(data: FeedItemPayload) {
        const feedItem = toFeedItem(data);
        const event = toEventItem(feedItem);

        const ttl = this.feedTtlService.getTtl(feedItem);

        await this.eventByIdRepository.create(feedItem, ttl);
        await this.eventsByUserRepository.create(event, ttl);

        await this.distributeEventToFollowers(feedItem);
    }

    // Só estabelecimentos criam eventos (regra de produto) — não há distinção de
    // tipo de autor para distribuir, sempre followers_by_establishment.
    private async distributeEventToFollowers(feedItem: Omit<FeedItem, "userId">) {
        if (!feedItem.authorId) {
            return;
        }

        const ttl = this.feedTtlService.getTtl(feedItem);
        const followers = await this.establishmentFollowersRepository.findFollowersByEstablishment(feedItem.authorId);

        await runFanout(
            "distributeEventToFollowers",
            followers.map((followerId) => () =>
                this.feedWriter.addItemToUserFeed(
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

        await runFanout(
            "distributePostToFollowers",
            feedItems.map((feedItem) => () => this.feedWriter.addItemToUserFeed(feedItem, ttl))
        );
    }
}
