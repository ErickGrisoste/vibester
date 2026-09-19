import cassandra from "cassandra-driver";
import { env } from "./env";
import path from "node:path";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

let _client: cassandra.Client | null = null;

export const getCassandraClient = (): cassandra.Client => {
  if (!_client) {
    // Produção usa DataStax Astra (Cassandra gerenciado, cloud), autenticado por
    // secureConnectBundle + token. Quando CASSANDRA_CONTACT_POINTS está definido
    // (docker-compose.test.yml em CI, ou um Cassandra local de dev), conectamos direto
    // num cluster self-hosted em vez do Astra — usado apenas pelos testes de integração
    // reais (tests/integration-real) e nunca em produção.
    if (env.cassandra_contact_points) {
      _client = new cassandra.Client({
        contactPoints: env.cassandra_contact_points.split(",").map((p) => p.trim()),
        localDataCenter: env.cassandra_local_datacenter,
        keyspace: env.keyspace,
      });
    } else {
      if (!env.secure_connect_bundle || !env.astra_token) {
        throw new Error(
          "Configuração do Cassandra ausente: defina ASTRA_SECURE_CONNECT_BUNDLE e ASTRA_TOKEN (Astra) ou CASSANDRA_CONTACT_POINTS (cluster local)."
        );
      }

      _client = new cassandra.Client({
        cloud: {
          secureConnectBundle: path.resolve(env.secure_connect_bundle),
        },
        credentials: {
          username: "token",
          password: env.astra_token,
        },
        keyspace: env.keyspace,
      });
    }
  }
  return _client;
};
