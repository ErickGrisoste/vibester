import { FeedRepository } from "../repositories/feed.repository";
import { FeedEntriesByPostRepository } from "../repositories/feed_entries.repository";
import { UserFollowerRepository } from "../repositories/followers_by_user.repository";
import { EstablishmentFollowersRepository } from "../repositories/followers_by_establishment.repository";
import { PostsByUserRepository } from "../repositories/posts_by_user.repository";
import { EventsByUserRepository } from "../repositories/events_by_user.repository";
import { FeedItemType } from "../types/feed.types";
import { FeedTtlService } from "./ttl_service";
import { FeedWriterService } from "./feed-writer.service";
import { EventRow, PostRow, eventToFeedItem, postToFeedItem, rowToEvent, rowToPost } from "./feed-item.mapper";

const RECENT_WINDOW_DAYS = 15;

/**
 * Follow/unfollow de usuários e estabelecimentos: mantém o espelho local de
 * relacionamento (followers_by_user/followers_by_establishment) e migra
 * (ou remove) o histórico recente de posts/eventos do autor seguido/deixado
 * de seguir no feed do seguidor. Não decide fan-out de conteúdo novo sendo
 * criado agora — isso é FeedFanoutService.
 */
export class FollowService {
    private readonly feedTtlService = new FeedTtlService();
    private readonly feedWriter = new FeedWriterService();
    private feedRepository = new FeedRepository();
    private feedEntriesRepository = new FeedEntriesByPostRepository();
    private userFollowerRepository = new UserFollowerRepository();
    private establishmentFollowersRepository = new EstablishmentFollowersRepository();
    private postByUserRepository = new PostsByUserRepository();
    private eventsByUserRepository = new EventsByUserRepository();

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

    private async addRecentPostsToFollowerFeed(followedId: string, followerId: string, itemType: FeedItemType) {
        const since = new Date();
        since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

        const result = await this.postByUserRepository.findRecentPostsByUser(followedId, since);

        // findRecentPostsByUser não filtra is_deleted (Cassandra não permite
        // filtrar por coluna não-indexada sem ALLOW FILTERING, que não deve
        // ser usado aqui) — desde que posts_by_user passou a soft delete
        // (handlePostDeleted em FeedFanoutService), um post excluído pode
        // continuar aparecendo nessa leitura. Filtramos em código de
        // aplicação, mesmo padrão já usado pelo post-service
        // (PostRepository.findByUser/findByEstablishment,
        // `.filter((post) => !post.isDeleted)`).
        const posts = result.rows
            .map((row) => rowToPost(row as unknown as PostRow))
            .filter((post) => !post.isDeleted);

        await Promise.all(
            posts.map(async (post) => {
                const feedItem = postToFeedItem(post, followerId, itemType);

                await this.feedWriter.addItemToUserFeed(feedItem, 604800);
            })
        );
    }

    private async removeFollowedPostsFromFeed(followedId: string, followerId: string) {
        const since = new Date();
        since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

        const result = await this.postByUserRepository.findRecentPostsByUser(followedId, since);

        await Promise.all(
            result.rows.flatMap((row) => [
                this.feedRepository.delete(followerId, row.created_at, row.post_id),
                this.feedEntriesRepository.delete(row.post_id, followerId, row.created_at)
            ])
        );
    }

    private async addRecentEventsToFollowerFeed(authorId: string, followerId: string) {
        const since = new Date();
        since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

        const result = await this.eventsByUserRepository.findRecentEventsByAuthor(authorId, since);

        await Promise.all(
            result.rows.map(async (row) => {
                const event = rowToEvent(row as unknown as EventRow);
                const feedItem = eventToFeedItem(event, followerId);

                const ttl = this.feedTtlService.calculateEventTTL(event.date);

                await this.feedWriter.addItemToUserFeed(feedItem, ttl);
            })
        );
    }

    private async removeEventsFromFeedByAuthor(authorId: string, followerId: string) {
        const since = new Date();
        since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

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
}
