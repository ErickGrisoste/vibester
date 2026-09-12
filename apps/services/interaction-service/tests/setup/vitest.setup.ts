import { vi } from "vitest";

/**
 * Mocka `src/config/env` inteiro para os testes unitários e de integração
 * mockados — evita exigir as variáveis reais de Astra/Kafka só para rodar teste.
 *
 * `tests/integration-real` NÃO usa este setup: lá o env real é necessário, porque
 * os testes falam com um Cassandra de verdade.
 */
vi.mock("../../src/config/env", () => ({
    env: {
        mode: "api",
        port: 3007,
        jwt_secret: "test-jwt-secret",
        secure_connect_bundle: "/fake/bundle.zip",
        astra_client_id: "test-client-id",
        astra_client_secret: "test-client-secret",
        keyspace: "test_keyspace",
        cassandra_contact_points: "127.0.0.1",
        cassandra_local_data_center: "datacenter1",
        kafka_brokers: "localhost:9092",
        interaction_ttl_days: 90,
        interaction_ttl_seconds: 90 * 24 * 60 * 60,
        max_batch_size: 50,
        max_event_age_hours: 24,
        cassandra_write_concurrency: 16,
        rate_limit_max: 240,
    },
}));
