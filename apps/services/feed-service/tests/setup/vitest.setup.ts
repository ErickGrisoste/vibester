import { vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  env: {
    secure_connect_bundle: '/tmp/fake-bundle.zip',
    astra_client_id: 'test-client-id',
    astra_client_secret: 'test-client-secret',
    astra_token: 'test-token',
    keyspace: 'test_keyspace',
    kafka_brokers: 'localhost:9092',
    cassandra_contact_points: undefined,
    cassandra_local_datacenter: undefined,
  },
}));
