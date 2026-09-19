import { getCassandraClient } from "../config/cassandra";
import { cassandraQueryDuration } from "../metrics/registry";

// Extrai a tabela da query pra rotular a métrica sem precisar anotar cada
// método do repository — cobre os quatro verbos usados neste serviço
// (SELECT/INSERT/UPDATE/DELETE). Query fora desse padrão (ex.: `SELECT now()
// FROM system.local` do /ready) cai em "unknown", que é aceitável. Mesmo
// padrão do post-service (src/repository/base.repository.ts).
function extractTableName(query: string): string {
  const match = query.match(/(?:FROM|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  return match ? match[1] : "unknown";
}

export abstract class BaseRepository {
  protected async execute(query: string, params: unknown[] = []) {
    const table = extractTableName(query);
    const end = cassandraQueryDuration.startTimer({ table });

    try {
      const result = await getCassandraClient().execute(query, params, { prepare: true });
      end({ outcome: "success" });
      return result;
    } catch (err) {
      end({ outcome: "error" });
      throw err;
    }
  }

  /**
   * Lote sem log (`logged: false`): só use com todas as queries na MESMA partição.
   * Lote espalhado por partições sobrecarrega o coordenador e é antipadrão no Cassandra.
   */
  protected async executeBatch(queries: { query: string; params: unknown[] }[]) {
    return getCassandraClient().batch(queries, { prepare: true, logged: false });
  }
}
