import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../src/config/cassandra', () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { FollowService } from '../../src/services/follow.service';

const AUTHOR_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const FOLLOWER_ID = 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const EVENT_ID = 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const ESTAB_ID = 'e1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

const ISO_DATE = '2024-01-15T12:00:00.000Z';

describe('FollowService — Kafka Consumers', () => {
  let followService: FollowService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
    followService = new FollowService();
  });

  describe('handleUserFollowed', () => {
    it('cria relacionamento de seguidor e adiciona posts recentes ao feed', async () => {
      mockExecute.mockResolvedValue({ rows: [] }); // no recent posts/events to migrate

      await followService.handleUserFollowed({
        followerId: FOLLOWER_ID,
        followedId: AUTHOR_ID,
      });

      expect(mockExecute).toHaveBeenCalled();
    });

    it('migra eventos recentes do autor para o feed do seguidor', async () => {
      const recentEventRow = {
        event_id: EVENT_ID,
        created_at: new Date(ISO_DATE),
        author_id: AUTHOR_ID,
        author_username: 'organizer',
        author_verified: false,
        event_title: 'Festival de Verão',
        event_date: new Date(ISO_DATE),
      };
      mockExecute.mockResolvedValue({ rows: [recentEventRow] });

      await followService.handleUserFollowed({
        followerId: FOLLOWER_ID,
        followedId: AUTHOR_ID,
      });

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('handleUserUnfollowed', () => {
    it('remove relacionamento e limpa posts do feed', async () => {
      mockExecute.mockResolvedValue({ rows: [] }); // no recent posts/events to remove

      await followService.handleUserUnfollowed({
        followerId: FOLLOWER_ID,
        followedId: AUTHOR_ID,
      });

      expect(mockExecute).toHaveBeenCalled();
    });

    it('remove eventos recentes do autor do feed do seguidor quando há entries', async () => {
      const recentEventRow = { event_id: EVENT_ID, created_at: new Date(ISO_DATE) };
      const feedEntryRow = { item_id: EVENT_ID, user_id: FOLLOWER_ID, created_at: new Date(ISO_DATE) };
      mockExecute.mockImplementation(async (query: string) => {
        if (typeof query === 'string' && query.includes('events_by_user')) {
          return { rows: [recentEventRow] };
        }
        if (typeof query === 'string' && query.includes('feed_entries')) {
          return { rows: [feedEntryRow] };
        }
        return { rows: [] };
      });

      await followService.handleUserUnfollowed({
        followerId: FOLLOWER_ID,
        followedId: AUTHOR_ID,
      });

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('handleEstablishmentFollowed', () => {
    it('cria relacionamento com estabelecimento e migra posts recentes', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await followService.handleEstablishmentFollowed({
        followerId: FOLLOWER_ID,
        followedId: ESTAB_ID,
      });

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('handleEstablishmentUnfollowed', () => {
    it('remove relacionamento e limpa posts do estabelecimento do feed', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await followService.handleEstablishmentUnfollowed({
        followerId: FOLLOWER_ID,
        followedId: ESTAB_ID,
      });

      expect(mockExecute).toHaveBeenCalled();
    });
  });
});
