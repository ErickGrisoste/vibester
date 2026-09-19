import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../src/config/cassandra', () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { EventAttendanceService } from '../../src/services/event-attendance.service';

const FOLLOWER_ID = 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const EVENT_ID = 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

const ISO_DATE = '2024-01-15T12:00:00.000Z';

describe('EventAttendanceService — Kafka Consumers', () => {
  let eventAttendanceService: EventAttendanceService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
    eventAttendanceService = new EventAttendanceService();
  });

  describe('handleEventConfirmed', () => {
    it('processa confirmação de presença no evento', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await eventAttendanceService.handleEventConfirmed({
        eventId: EVENT_ID,
        userId: FOLLOWER_ID,
        eventDate: ISO_DATE,
      });

      expect(mockExecute).toHaveBeenCalled();
    });

    it('recomputa total_confirmed via attendees_by_event e propaga para events_by_id e para cada cópia já distribuída em feed_by_user', async () => {
      const attendee1 = 'f1111111-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
      const attendee2 = 'f2222222-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
      const distributedEntry = { post_id: EVENT_ID, user_id: FOLLOWER_ID, created_at: new Date(ISO_DATE) };

      mockExecute.mockImplementation(async (query: string) => {
        if (typeof query === 'string' && query.includes('SELECT user_id') && query.includes('attendees_by_event')) {
          return { rows: [{ user_id: attendee1 }, { user_id: attendee2 }] };
        }
        if (
          typeof query === 'string' &&
          query.includes('feed_entries_by_post') &&
          query.includes('WHERE post_id = ?') &&
          !query.includes('user_id')
        ) {
          return { rows: [distributedEntry] };
        }
        return { rows: [] };
      });

      await eventAttendanceService.handleEventConfirmed({
        eventId: EVENT_ID,
        userId: FOLLOWER_ID,
        eventDate: ISO_DATE,
      });

      // events_by_id: total_confirmed recomputado (2 attendees)
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE feed_keyspace.events_by_id'),
        expect.arrayContaining([2, EVENT_ID]),
        expect.anything()
      );

      // feed_by_user: cada entrada já distribuída também recebe o total_confirmed atualizado
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE feed_keyspace.feed_by_user'),
        expect.arrayContaining([2, FOLLOWER_ID, distributedEntry.created_at, EVENT_ID]),
        expect.anything()
      );
    });
  });

  describe('handleEventUnconfirmed', () => {
    it('processa remoção de confirmação do evento', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await eventAttendanceService.handleEventUnconfirmed({
        eventId: EVENT_ID,
        userId: FOLLOWER_ID,
      });

      expect(mockExecute).toHaveBeenCalled();
    });

    it('recomputa total_confirmed após cancelamento e propaga para events_by_id e feed_by_user dos seguidores restantes', async () => {
      const remainingAttendee = 'f3333333-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
      const otherFollowerId = 'f4444444-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
      const remainingDistributedEntry = { post_id: EVENT_ID, user_id: otherFollowerId, created_at: new Date(ISO_DATE) };

      mockExecute.mockImplementation(async (query: string) => {
        if (typeof query === 'string' && query.includes('SELECT user_id') && query.includes('attendees_by_event')) {
          return { rows: [{ user_id: remainingAttendee }] };
        }
        if (
          typeof query === 'string' &&
          query.includes('feed_entries_by_post') &&
          query.includes('WHERE post_id = ?') &&
          query.includes('user_id')
        ) {
          // findByItemIdAndUser (remoção do feed do próprio usuário que cancelou)
          return { rows: [] };
        }
        if (
          typeof query === 'string' &&
          query.includes('feed_entries_by_post') &&
          query.includes('WHERE post_id = ?')
        ) {
          // findByItemId (fanout de propagação em syncTotalConfirmed)
          return { rows: [remainingDistributedEntry] };
        }
        return { rows: [] };
      });

      await eventAttendanceService.handleEventUnconfirmed({
        eventId: EVENT_ID,
        userId: FOLLOWER_ID,
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE feed_keyspace.events_by_id'),
        expect.arrayContaining([1, EVENT_ID]),
        expect.anything()
      );

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE feed_keyspace.feed_by_user'),
        expect.arrayContaining([1, otherFollowerId, remainingDistributedEntry.created_at, EVENT_ID]),
        expect.anything()
      );
    });
  });
});
