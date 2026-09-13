import { FeedRepository } from "../repositories/feed.repository";
import { FeedEntriesByPostRepository } from "../repositories/feed_entries.repository";
import { EventsByIdRepository } from "../repositories/events_by_id.repository";
import { EventAttendeesRepository } from "../repositories/attendees_by_event.repository";
import { FeedTtlService } from "./ttl_service";
import { FeedWriterService } from "./feed-writer.service";
import { eventToFeedItem } from "./feed-item.mapper";

/**
 * Confirmação/cancelamento de presença em evento: mantém attendees_by_event e
 * garante que o evento apareça (ou saia) do feed do próprio usuário que
 * confirmou. Não decide fan-out de evento novo sendo criado (isso é
 * FeedFanoutService) nem lida com follow/unfollow.
 */
export class EventAttendanceService {
    private readonly feedTtlService = new FeedTtlService();
    private readonly feedWriter = new FeedWriterService();
    private eventByIdRepository = new EventsByIdRepository();
    private eventAttendeesRepository = new EventAttendeesRepository();
    private feedRepository = new FeedRepository();
    private feedEntriesRepository = new FeedEntriesByPostRepository();

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

        const feedItem = eventToFeedItem(event, userId);

        await this.feedWriter.addItemToUserFeed(feedItem, ttl);
    }
}
