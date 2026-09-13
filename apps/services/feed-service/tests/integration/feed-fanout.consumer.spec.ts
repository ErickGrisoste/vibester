import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../src/config/cassandra', () => ({
  getCassandraClient: () => ({ execute: mockExecute }),
}));

import { FeedFanoutService } from '../../src/services/feed-fanout.service';
import { FeedItemType } from '../../src/types/feed.types';

const AUTHOR_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const POST_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const FOLLOWER_ID = 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const EVENT_ID = 'd1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

const ISO_DATE = '2024-01-15T12:00:00.000Z';

function makeUserPostPayload() {
  return {
    itemId: POST_ID,
    itemType: FeedItemType.USER_POST,
    authorId: AUTHOR_ID,
    authorUsername: 'testuser',
    authorVerified: false,
    content: 'Ótimo lugar!',
    imageUrls: ['https://example.com/img.jpg'],
    totalLikes: 0,
    totalComments: 0,
    isSponsored: false,
    isDeleted: false,
    createdAt: ISO_DATE,
  };
}

function makeEventPayload() {
  return {
    itemId: EVENT_ID,
    itemType: FeedItemType.EVENT,
    authorId: AUTHOR_ID,
    authorUsername: 'organizer',
    authorVerified: false,
    eventId: EVENT_ID,
    eventTitle: 'Festival de Verão',
    eventBanner: 'https://example.com/banner.jpg',
    eventDate: ISO_DATE,
    eventLocation: 'São Paulo',
    eventOrganizerName: 'Promotora XYZ',
    eventOrganizerLogo: 'https://example.com/logo.jpg',
    totalLikes: 0,
    totalComments: 0,
    totalConfirmed: 0,
    isSponsored: false,
    isDeleted: false,
    createdAt: ISO_DATE,
  };
}

describe('FeedFanoutService — Kafka Consumers', () => {
  let feedFanoutService: FeedFanoutService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
    feedFanoutService = new FeedFanoutService();
  });

  describe('handlePostCreated', () => {
    it('salva post do usuário e distribui para seguidores (sem seguidores)', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await feedFanoutService.handlePostCreated(makeUserPostPayload() as any);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('distribui post para seguidores quando existem seguidores', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // savePostByUser → INSERT posts_by_user
        .mockResolvedValueOnce({ rows: [{ follower_id: 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }] }) // findFollowersByUser
        .mockResolvedValue({ rows: [] }); // addItemToUserFeed calls

      await feedFanoutService.handlePostCreated(makeUserPostPayload() as any);

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('handlePostDeleted', () => {
    it('remove post dos feeds sem entries', async () => {
      mockExecute.mockResolvedValue({ rows: [] }); // findByItemId → no entries

      await feedFanoutService.handlePostDeleted({
        authorId: AUTHOR_ID,
        postId: POST_ID,
        createdAt: ISO_DATE,
      });

      expect(mockExecute).toHaveBeenCalled();
    });

    it('remove post de todos os feeds quando há entries', async () => {
      const entryRow = { user_id: 'c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', created_at: new Date(), post_id: POST_ID };
      mockExecute
        .mockResolvedValueOnce({ rows: [entryRow] }) // findByItemId
        .mockResolvedValue({ rows: [] }); // deletes

      await feedFanoutService.handlePostDeleted({
        authorId: AUTHOR_ID,
        postId: POST_ID,
        createdAt: ISO_DATE,
      });

      expect(mockExecute).toHaveBeenCalled();
    });

    it('marca posts_by_user como soft delete (UPDATE is_deleted = true), nunca DELETE físico, enquanto feed_by_user do seguidor continua sendo removido fisicamente', async () => {
      const entryRow = { user_id: FOLLOWER_ID, created_at: new Date(ISO_DATE), post_id: POST_ID };
      mockExecute
        .mockResolvedValueOnce({ rows: [entryRow] }) // findByItemId
        .mockResolvedValue({ rows: [] });

      await feedFanoutService.handlePostDeleted({
        authorId: AUTHOR_ID,
        postId: POST_ID,
        createdAt: ISO_DATE,
      });

      // posts_by_user (cópia canônica do autor): soft delete via UPDATE
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE feed_keyspace.posts_by_user'),
        expect.arrayContaining([AUTHOR_ID, new Date(ISO_DATE), POST_ID]),
        expect.anything()
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = true'),
        expect.arrayContaining([AUTHOR_ID, new Date(ISO_DATE), POST_ID]),
        expect.anything()
      );

      // nunca um DELETE físico de posts_by_user
      const deletedPostsByUserPhysically = mockExecute.mock.calls.some(
        ([query]) =>
          typeof query === 'string' &&
          query.includes('DELETE') &&
          query.includes('FROM feed_keyspace.posts_by_user')
      );
      expect(deletedPostsByUserPhysically).toBe(false);

      // feed_by_user do seguidor: continua removido fisicamente (DELETE), sem mudança de comportamento
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM feed_keyspace.feed_by_user'),
        expect.arrayContaining([entryRow.user_id, entryRow.created_at, entryRow.post_id]),
        expect.anything()
      );
    });
  });

  describe('handleContentPostUpdated', () => {
    it('atualiza conteúdo sem entries no feed', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await feedFanoutService.handleContentPostUpdated({
        authorId: AUTHOR_ID,
        postId: POST_ID,
        createdAt: ISO_DATE,
        caption: 'Novo caption atualizado',
        imageUrls: ['https://example.com/new.jpg'],
      });

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('handlePostStatsUpdated', () => {
    it('atualiza estatísticas sem entries no feed', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await feedFanoutService.handlePostStatsUpdated({
        authorId: AUTHOR_ID,
        postId: POST_ID,
        createdAt: ISO_DATE,
        totalLikes: 10,
        totalComments: 3,
      });

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('handleEventCreated', () => {
    it('salva evento e distribui para seguidores do organizador', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await feedFanoutService.handleEventCreated(makeEventPayload() as any);

      expect(mockExecute).toHaveBeenCalled();
    });
  });
});
