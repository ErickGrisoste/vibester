import type { Client } from "cassandra-driver";

const KEYSPACE = "feed_keyspace";

const TABLES = [
  "feed_by_user",
  "feed_entries_by_post",
  "posts_by_user",
  "followers_by_user",
  "followers_by_establishment",
  "attendees_by_event",
  "events_by_id",
  "events_by_user",
] as const;

/**
 * Limpa todas as tabelas de domínio do feed-service entre testes de integração reais
 * (tests/integration-real). Não trunca `schema_migrations` — a migration é aplicada uma
 * única vez (via `npm run migrate`) antes da suíte rodar, não a cada teste.
 */
export async function truncateFeedTables(client: Client): Promise<void> {
  for (const table of TABLES) {
    await client.execute(`TRUNCATE TABLE ${KEYSPACE}.${table};`);
  }
}
