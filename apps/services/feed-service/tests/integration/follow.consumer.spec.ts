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

    it('não migra post soft-deletado (is_deleted = true) para o feed do novo seguidor, mas migra os demais', async () => {
      const activePostId = 'aaaa1111-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
      const deletedPostId = 'bbbb2222-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

      const basePostRow = {
        user_id: AUTHOR_ID,
        created_at: new Date(ISO_DATE),
        user_username: 'autor',
        user_profile_picture: null,
        user_verified: false,
        establishment_id: null,
        establishment_name: null,
        establishment_logo: null,
        establishment_category: null,
        image_urls: [],
        media: null,
        tags: null,
        total_likes: 0,
        total_comments: 0,
        updated_at: null,
      };
      const activePostRow = { ...basePostRow, post_id: activePostId, caption: 'post ativo', is_deleted: false };
      const deletedPostRow = { ...basePostRow, post_id: deletedPostId, caption: 'post excluído (soft delete)', is_deleted: true };

      mockExecute.mockImplementation(async (query: string) => {
        if (typeof query === 'string' && query.includes('posts_by_user') && query.trim().startsWith('SELECT')) {
          return { rows: [activePostRow, deletedPostRow] };
        }
        return { rows: [] };
      });

      await followService.handleUserFollowed({
        followerId: FOLLOWER_ID,
        followedId: AUTHOR_ID,
      });

      // migra o post ativo para o feed_by_user do novo seguidor
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO feed_keyspace.feed_by_user'),
        expect.arrayContaining([activePostId]),
        expect.anything()
      );

      // nunca escreve nada referenciando o post soft-deletado
      const touchedDeletedPost = mockExecute.mock.calls.some(([, params]) =>
        Array.isArray(params) && params.includes(deletedPostId)
      );
      expect(touchedDeletedPost).toBe(false);
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

    // Mesma profundidade do teste equivalente em handleUserFollowed acima:
    // addRecentPostsToFollowerFeed é o mesmo método privado compartilhado entre
    // follow de usuário e de estabelecimento (só muda o FeedItemType passado),
    // incluindo o filtro de soft delete em código de aplicação — mas isso não
    // estava exercitado explicitamente pelo lado de estabelecimento.
    it('não migra post soft-deletado (is_deleted = true) para o feed do novo seguidor do estabelecimento, mas migra os demais', async () => {
      const activePostId = 'cccc3333-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
      const deletedPostId = 'dddd4444-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

      const basePostRow = {
        user_id: ESTAB_ID,
        created_at: new Date(ISO_DATE),
        user_username: 'estab_do_bar',
        user_profile_picture: null,
        user_verified: false,
        establishment_id: ESTAB_ID,
        establishment_name: 'Bar do Zé',
        establishment_logo: null,
        establishment_category: null,
        image_urls: [],
        media: null,
        tags: null,
        total_likes: 0,
        total_comments: 0,
        updated_at: null,
      };
      const activePostRow = { ...basePostRow, post_id: activePostId, caption: 'promoção ativa', is_deleted: false };
      const deletedPostRow = { ...basePostRow, post_id: deletedPostId, caption: 'promoção excluída (soft delete)', is_deleted: true };

      mockExecute.mockImplementation(async (query: string) => {
        if (typeof query === 'string' && query.includes('posts_by_user') && query.trim().startsWith('SELECT')) {
          return { rows: [activePostRow, deletedPostRow] };
        }
        return { rows: [] };
      });

      await followService.handleEstablishmentFollowed({
        followerId: FOLLOWER_ID,
        followedId: ESTAB_ID,
      });

      // migra o post ativo do estabelecimento para o feed_by_user do novo seguidor
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO feed_keyspace.feed_by_user'),
        expect.arrayContaining([activePostId]),
        expect.anything()
      );

      // nunca escreve nada referenciando o post soft-deletado do estabelecimento
      const touchedDeletedPost = mockExecute.mock.calls.some(([, params]) =>
        Array.isArray(params) && params.includes(deletedPostId)
      );
      expect(touchedDeletedPost).toBe(false);
    });

    it('migra eventos recentes do estabelecimento para o feed do seguidor', async () => {
      const recentEventRow = {
        event_id: EVENT_ID,
        created_at: new Date(ISO_DATE),
        author_id: ESTAB_ID,
        author_username: 'estab_do_bar',
        author_verified: false,
        event_title: 'Noite de Samba',
        event_date: new Date(ISO_DATE),
      };
      mockExecute.mockResolvedValue({ rows: [recentEventRow] });

      await followService.handleEstablishmentFollowed({
        followerId: FOLLOWER_ID,
        followedId: ESTAB_ID,
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO feed_keyspace.feed_by_user'),
        expect.arrayContaining([FOLLOWER_ID, EVENT_ID]),
        expect.anything()
      );
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

    // Mesma profundidade do teste equivalente em handleUserUnfollowed acima:
    // removeEventsFromFeedByAuthor é o método privado compartilhado entre
    // unfollow de usuário e de estabelecimento.
    it('remove eventos recentes do estabelecimento do feed do seguidor quando há entries', async () => {
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

      await followService.handleEstablishmentUnfollowed({
        followerId: FOLLOWER_ID,
        followedId: ESTAB_ID,
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM feed_keyspace.feed_by_user'),
        expect.arrayContaining([FOLLOWER_ID, feedEntryRow.created_at, EVENT_ID]),
        expect.anything()
      );
    });
  });
});
