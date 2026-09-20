import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    // Uma imagem, dois modos: "api" sobe o Fastify de ingestão, "worker" sobe o
    // consumidor Kafka que persiste no Cassandra. São dois Deployments no k8s.
    //
    // NÃO renomeie para `MODE`: o Vitest injeta `process.env.MODE=test` no processo
    // de teste, o que quebraria o boot em qualquer contexto com ferramental Vite.
    SERVICE_MODE: z.enum(["api", "worker"]).default("api"),
    PORT: z.coerce.number().default(3007),

    // Token emitido pelo auth-service (HS256, jsonwebtoken). O payload traz
    // { userId, accountId }; só o accountId é identidade pública — ver auth.plugin.ts.
    JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatório"),

    // Em produção o Cassandra é o DataStax Astra (secure connect bundle obrigatório).
    // Em CI/local, CASSANDRA_CONTACT_POINTS aponta para um cluster OSS solto (docker-compose)
    // e dispensa as credenciais do Astra — ver src/config/cassandra.ts.
    ASTRA_SECURE_CONNECT_BUNDLE: z.string().optional(),
    ASTRA_CLIENT_ID: z.string().optional(),
    ASTRA_CLIENT_SECRET: z.string().optional(),
    ASTRA_KEYSPACE: z.string().min(1, "ASTRA_KEYSPACE é obrigatório"),
    CASSANDRA_CONTACT_POINTS: z.string().optional(),
    CASSANDRA_LOCAL_DATA_CENTER: z.string().default("datacenter1"),

    KAFKA_BROKERS: z.string().min(1, "KAFKA_BROKERS é obrigatório"),

    // Log bruto é matéria-prima para treino e afinidade, não arquivo histórico:
    // expira sozinho via TTL nativo do Cassandra, sem job de limpeza.
    INTERACTION_TTL_DAYS: z.coerce.number().int().positive().default(90),

    // Teto de eventos por request. O cliente acumula em memória e envia em lote;
    // sem teto, um cliente defeituoso mandaria um array ilimitado.
    MAX_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(50),

    // Um evento mais velho que isso é descartado: relógio de cliente muito fora
    // de sincronia contamina qualquer cálculo de recência.
    MAX_EVENT_AGE_HOURS: z.coerce.number().int().positive().default(24),

    // Escritas simultâneas por lote no Cassandra. Limite explícito porque
    // Promise.all sem chunking é exatamente a dívida do feed-service.
    CASSANDRA_WRITE_CONCURRENCY: z.coerce.number().int().positive().default(16),

    RATE_LIMIT_MAX: z.coerce.number().default(240),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error(
        "[ENV] Variáveis de ambiente inválidas:",
        JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
    );
    process.exit(1);
}

const _env = parsed.data;

export const env = {
    mode: _env.SERVICE_MODE,
    port: _env.PORT,
    jwt_secret: _env.JWT_SECRET,
    secure_connect_bundle: _env.ASTRA_SECURE_CONNECT_BUNDLE,
    astra_client_id: _env.ASTRA_CLIENT_ID,
    astra_client_secret: _env.ASTRA_CLIENT_SECRET,
    keyspace: _env.ASTRA_KEYSPACE,
    cassandra_contact_points: _env.CASSANDRA_CONTACT_POINTS,
    cassandra_local_data_center: _env.CASSANDRA_LOCAL_DATA_CENTER,
    kafka_brokers: _env.KAFKA_BROKERS,
    interaction_ttl_days: _env.INTERACTION_TTL_DAYS,
    interaction_ttl_seconds: _env.INTERACTION_TTL_DAYS * 24 * 60 * 60,
    max_batch_size: _env.MAX_BATCH_SIZE,
    max_event_age_hours: _env.MAX_EVENT_AGE_HOURS,
    cassandra_write_concurrency: _env.CASSANDRA_WRITE_CONCURRENCY,
    rate_limit_max: _env.RATE_LIMIT_MAX,
};
