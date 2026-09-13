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
  });
});
