import { BaseRepository } from "./base.repository";

export interface FollowersPage {
  followerIds: string[];
  nextCursor: string | null;
}

export class UserFollowerRepository extends BaseRepository {
  async create(userId: string, followerId: string) {
    return this.execute(
      `
        INSERT INTO feed_keyspace.followers_by_user (
          user_id,
          follower_id,
          followed_at
        )
        VALUES (?, ?, ?);
      `,
      [userId, followerId, new Date()]
    );
  }

  /**
   * Pagina por `follower_id` (clustering key de `followers_by_user`) em vez de
   * trazer todos os seguidores de uma vez — uma conta com centenas de milhares
   * de seguidores não pode virar uma única leitura sem `LIMIT` (fan-out em
   * lote, ver CLAUDE.md deste serviço, seção Performance, item 3). `cursor` é
   * o `follower_id` do último seguidor já visto; a tabela não declara
   * `CLUSTERING ORDER BY` (ordem ascendente padrão), então `follower_id > ?`
   * sempre avança para a fatia seguinte sem repetir nem pular linhas.
   * Mesmo critério de "tem mais página?" usado em `FeedRepository.findByUser`:
   * se vieram exatamente `limit` linhas, pode haver mais.
   */
  async findFollowersByUser(userId: string, limit: number, cursor?: string): Promise<FollowersPage> {
    const result = cursor
      ? await this.execute(
          `
            SELECT follower_id
            FROM feed_keyspace.followers_by_user
            WHERE user_id = ?
              AND follower_id > ?
            LIMIT ?;
          `,
          [userId, cursor, limit]
        )
      : await this.execute(
          `
            SELECT follower_id
            FROM feed_keyspace.followers_by_user
            WHERE user_id = ?
            LIMIT ?;
          `,
          [userId, limit]
        );

    const followerIds = result.rows.map((row) => row.follower_id.toString());
    const nextCursor = followerIds.length === limit ? followerIds[followerIds.length - 1] : null;

    return { followerIds, nextCursor };
  }

  async delete(userId: string, followerId: string) {
    return this.execute(
      `
        DELETE FROM feed_keyspace.followers_by_user
        WHERE user_id = ?
        AND follower_id = ?;
      `,
      [userId, followerId]
    );
  }
}