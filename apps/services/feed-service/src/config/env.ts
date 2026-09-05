import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
    console.error("[ENV] JWT_SECRET é obrigatório");
    process.exit(1);
}

export const env = {
    secure_connect_bundle: process.env.ASTRA_SECURE_CONNECT_BUNDLE!,
    astra_client_id: process.env.ASTRA_CLIENT_ID!,
    astra_client_secret: process.env.ASTRA_CLIENT_SECRET!,
    astra_token: process.env.ASTRA_TOKEN!,
    keyspace: process.env.ASTRA_KEYSPACE!,
    kafka_brokers: process.env.KAFKA_BROKERS!,
    jwt_secret: process.env.JWT_SECRET!,
    // Opcionais: usados só para apontar o driver para um Cassandra local (docker-compose.test.yml
    // em CI, ou um Cassandra de dev local) em vez do Astra Cloud. Quando ausentes, o client
    // (src/config/cassandra.ts) usa o caminho padrão de produção (secureConnectBundle + astra_token).
    cassandra_contact_points: process.env.CASSANDRA_CONTACT_POINTS,
    cassandra_local_datacenter: process.env.CASSANDRA_LOCAL_DATACENTER,
}