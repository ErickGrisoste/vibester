import { getCassandraClient } from "../config/cassandra";

export abstract class BaseRepository {
  protected async execute<T = unknown>(
    query: string,
    params: unknown[] = []
  ) {
    return getCassandraClient().execute(
      query,
      params,
      { prepare: true }
    );
  }
}
