import { BaseRepository } from "./base.repository";
import { FollowersPage } from "./followers_by_user.repository";

export class EstablishmentFollowersRepository extends BaseRepository {
  async create(establishmentId: string, followerId: string) {
    return this.execute(
      `
        INSERT INTO feed_keyspace.followers_by_establishment (
          establishment_id,
          follower_id,
          followed_at
        )
        VALUES (?, ?, ?);
      `,
      [establishmentId, followerId, new Date()]
    );
  }

  /**
   * Mesmo padrão de paginação por cursor de `UserFollowerRepository.findFollowersByUser`
   * (ver comentário lá) — `follower_id` também é a clustering key aqui, sem
   * `CLUSTERING ORDER BY` explícito.
   */
  async findFollowersByEstablishment(establishmentId: string, limit: number, cursor?: string): Promise<FollowersPage> {
    const result = cursor
      ? await this.execute(
          `
            SELECT follower_id
            FROM feed_keyspace.followers_by_establishment
            WHERE establishment_id = ?
              AND follower_id > ?
            LIMIT ?;
          `,
          [establishmentId, cursor, limit]
        )
      : await this.execute(
          `
            SELECT follower_id
            FROM feed_keyspace.followers_by_establishment
            WHERE establishment_id = ?
            LIMIT ?;
          `,
          [establishmentId, limit]
        );

    const followerIds = result.rows.map((row) => row.follower_id.toString());
    const nextCursor = followerIds.length === limit ? followerIds[followerIds.length - 1] : null;

    return { followerIds, nextCursor };
  }

  async delete(establishmentId: string, followerId: string) {
    return this.execute(
      `
        DELETE FROM feed_keyspace.followers_by_establishment
        WHERE establishment_id = ?
          AND follower_id = ?;
      `,
      [establishmentId, followerId]
    );
  }
}