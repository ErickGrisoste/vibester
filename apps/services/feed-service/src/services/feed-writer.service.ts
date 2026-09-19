import { FeedRepository } from "../repositories/feed.repository";
import { FeedEntriesByPostRepository } from "../repositories/feed_entries.repository";
import { FeedItem } from "../types/feed.types";

/**
 * Primitiva compartilhada por FeedFanoutService, FollowService e
 * EventAttendanceService: escrever um item de feed já mapeado na partição de
 * um usuário, sempre junto com sua entrada no índice reverso
 * (feed_entries_by_post) — as duas escritas representam "colocar este item no
 * feed de alguém" e nunca deveriam divergir (uma sem a outra deixaria o
 * índice reverso incoerente com o feed de fato).
 */
export class FeedWriterService {
    private feedRepository = new FeedRepository();
    private feedEntriesRepository = new FeedEntriesByPostRepository();

    async addItemToUserFeed(feedItem: FeedItem, ttl: number) {
        await this.feedEntriesRepository.create(feedItem.itemId, feedItem.userId, feedItem.createdAt, ttl);
        return this.feedRepository.create(feedItem, ttl);
    }
}
