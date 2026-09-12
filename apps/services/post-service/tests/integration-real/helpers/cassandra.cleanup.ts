import { getCassandraClient } from "../../../src/config/cassandra";

// Todas as tabelas denormalizadas que os testes reais podem escrever.
// TRUNCATE é seguro aqui pois roda contra um keyspace isolado de teste
// (ASTRA_KEYSPACE apontando pro cluster Cassandra do docker-compose.test.yml).
const TABLES = [
  "posts_by_id",
  "posts_by_user",
  "posts_by_establishment",
  "likes_by_post",
  "likes_by_user",
  "comments_by_id",
  "comments_by_post",
  "comments_by_user",
];

export async function truncateAllTables(): Promise<void> {
  const client = getCassandraClient();
  await Promise.all(TABLES.map((table) => client.execute(`TRUNCATE ${table};`)));
}
