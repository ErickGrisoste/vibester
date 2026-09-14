import { getCassandraClient } from "../config/cassandra";

export abstract class BaseRepository {
  protected async execute(query: string, params: unknown[] = []) {
    return getCassandraClient().execute(query, params, { prepare: true });
  }

  /**
   * Lote sem log (`logged: false`): só use com todas as queries na MESMA partição.
   * Lote espalhado por partições sobrecarrega o coordenador e é antipadrão no Cassandra.
   */
  protected async executeBatch(queries: { query: string; params: unknown[] }[]) {
    return getCassandraClient().batch(queries, { prepare: true, logged: false });
  }
}
