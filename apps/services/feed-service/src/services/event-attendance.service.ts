import { FeedRepository } from "../repositories/feed.repository";
import { FeedEntriesByPostRepository } from "../repositories/feed_entries.repository";
import { EventsByIdRepository } from "../repositories/events_by_id.repository";
import { EventAttendeesRepository } from "../repositories/attendees_by_event.repository";
import { FeedTtlService } from "./ttl_service";
import { FeedWriterService } from "./feed-writer.service";
import { eventToFeedItem } from "./feed-item.mapper";
import { runFanout } from "../utils/fanout";

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
        await this.syncTotalConfirmed(event.eventId);
    }

    async handleEventUnconfirmed(event: {
        eventId: string;
        userId: string;
    }) {
        await this.removeEventFromFeed(event.eventId, event.userId);
        await this.eventAttendeesRepository.delete(event.eventId, event.userId);
        await this.syncTotalConfirmed(event.eventId);
    }

    /**
     * Recomputa `total_confirmed` do zero (via leitura de attendees_by_event)
     * e propaga o valor para events_by_id e para toda cópia já distribuída em
     * feed_by_user (mesmo padrão de FeedFanoutService.handlePostStatsUpdated
     * para total_likes/total_comments: buscar entradas no índice reverso
     * feed_entries_by_post e aplicar via runFanout).
     *
     * Limitação de concorrência aceita conscientemente: a contagem não vem de
     * um contador atômico dedicado, e sim de uma releitura de
     * attendees_by_event (equivalente a um COUNT) a cada confirmação/
     * cancelamento. Duas confirmações concorrentes para o mesmo evento têm
     * uma janela de corrida em que a segunda leitura pode não enxergar ainda
     * a escrita da primeira (ou vice-versa), e o UPDATE final gravado em
     * events_by_id/feed_by_user reflete só uma delas (last-write-wins) até a
     * próxima confirmação/cancelamento reconciliar o valor. Isso é aceitável
     * dado o volume esperado — confirmação de presença em evento não deve se
     * aproximar da concorrência de curtidas em um post viral —, mas fica
     * documentado aqui de propósito: se o volume crescer a ponto de a janela
     * de corrida importar, a correção correta é um contador atômico
     * (ex.: Cassandra counter table ou LWT), não mais releituras.
     */
    private async syncTotalConfirmed(eventId: string) {
        const attendees = await this.eventAttendeesRepository.findAttendeesByEvent(eventId);
        const totalConfirmed = attendees.length;

        await this.eventByIdRepository.updateTotalConfirmed(eventId, totalConfirmed);

        const entries = await this.feedEntriesRepository.findByItemId(eventId);

        await runFanout(
            "syncTotalConfirmed",
            entries.rows.map((entry) => () =>
                this.feedRepository.updateEventConfirmedCount(entry.user_id, entry.created_at, eventId, totalConfirmed)
            )
        );
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
