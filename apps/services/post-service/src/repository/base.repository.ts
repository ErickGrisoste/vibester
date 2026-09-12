import { getCassandraClient } from "../config/cassandra";
import { cassandraQueryDuration } from "../metrics/registry";

// Extrai a tabela da query pra rotular a métrica sem precisar anotar cada
// método do repository — cobre os quatro verbos usados neste serviço
// (SELECT/INSERT/UPDATE/DELETE). Query fora desse padrão (ex.: `SELECT now()
// FROM system.local` do health check) cai em "unknown", que é aceitável.
function extractTableName(query: string): string {
  const match = query.match(/(?:FROM|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  return match ? match[1] : "unknown";
}

export abstract class BaseRepository {
  protected async execute<T = unknown>(
    query: string,
    params: unknown[] = []
  ) {
    const table = extractTableName(query);
    const end = cassandraQueryDuration.startTimer({ table });

    try {
      const result = await getCassandraClient().execute(
        query,
        params,
        { prepare: true }
      );
      end({ outcome: "success" });
      return result;
    } catch (err) {
      end({ outcome: "error" });
      throw err;
    }
  }

  /**
   * Lê o resultado de uma escrita condicional (`IF NOT EXISTS`/`IF EXISTS`/
   * `IF <coluna> = ...`) — a única forma de fechar uma corrida de
   * check-then-act sem BATCH/LWT cross-tabela (ver CLAUDE.md, Performance #2).
   * O driver do Cassandra sempre devolve uma linha com a coluna `[applied]`
   * para esse tipo de statement; quando a linha não carrega essa coluna
   * (queries não condicionais, ou mocks de teste que só devolvem `{ rows: [] }`
   * por não se importarem com o retorno), trata como aplicada — só um `false`
   * explícito indica que a condição não bateu.
   */
  protected isApplied(result: { rows: Array<Record<string, unknown>> }): boolean {
    const row = result.rows?.[0];
    if (!row || !("[applied]" in row)) { return true; }
    return row["[applied]"] === true;
  }
}
