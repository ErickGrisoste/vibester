import { Client } from "cassandra-driver";
import { env } from "./env";

let _client: Client | null = null;

export const getCassandraClient = (): Client => {
    if (!_client) {
        // CASSANDRA_CONTACT_POINTS presente => cluster OSS "solto" (docker-compose local/CI),
        // sem o secure connect bundle do DataStax Astra usado em produção.
        if (env.cassandra_contact_points) {
            _client = new Client({
                contactPoints: env.cassandra_contact_points.split(",").map((cp) => cp.trim()),
                localDataCenter: env.cassandra_local_data_center,
                keyspace: env.keyspace,
            });
        } else {
            if (!env.secure_connect_bundle || !env.astra_client_id || !env.astra_client_secret) {
                throw new Error(
                    "Configuração do Cassandra ausente: defina ASTRA_SECURE_CONNECT_BUNDLE/ASTRA_CLIENT_ID/ASTRA_CLIENT_SECRET (Astra) ou CASSANDRA_CONTACT_POINTS (cluster local)."
                );
            }

            _client = new Client({
                cloud: {
                    secureConnectBundle: env.secure_connect_bundle,
                },
                credentials: {
                    username: env.astra_client_id,
                    password: env.astra_client_secret,
                },
                keyspace: env.keyspace,
            });
        }
    }
    return _client;
};
