import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatório"),
    ASTRA_KEYSPACE: z.string().min(1, "ASTRA_KEYSPACE é obrigatório"),
    KAFKA_BROKERS: z.string().min(1, "KAFKA_BROKERS é obrigatório"),
    // Em produção o Cassandra é o DataStax Astra (secure connect bundle + token
    // obrigatórios nesse modo). Em CI/local, CASSANDRA_CONTACT_POINTS aponta para um
    // cluster OSS solto (docker-compose.test.yml) e dispensa as credenciais do Astra —
    // a validação condicional de qual combinação é obrigatória fica em src/config/cassandra.ts,
    // não aqui (zod não expressa bem "obrigatório só se outro campo estiver ausente").
    ASTRA_SECURE_CONNECT_BUNDLE: z.string().optional(),
    ASTRA_CLIENT_ID: z.string().optional(),
    ASTRA_CLIENT_SECRET: z.string().optional(),
    ASTRA_TOKEN: z.string().optional(),
    CASSANDRA_CONTACT_POINTS: z.string().optional(),
    CASSANDRA_LOCAL_DATACENTER: z.string().default("datacenter1"),
    // Lista separada por vírgula. Ausente/vazia = fallback para `origin: true`
    // (aceita qualquer origem, com aviso no log) — ver src/plugins.ts.
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    // Limite global do rate limit (req/min) da única rota pública hoje
    // (GET /feed/:userId). 300/min é generoso o suficiente para um client
    // legítimo paginando/scrollando o feed continuamente, mas ainda barra
    // abuso básico. Ver src/plugins.ts para o motivo de não haver store
    // compartilhado (Redis) por trás desse limite neste serviço.
    RATE_LIMIT_MAX: z.coerce.number().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("[ENV] Variáveis de ambiente inválidas:", JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    process.exit(1);
}

const _env = parsed.data;

export const env = {
    secure_connect_bundle: _env.ASTRA_SECURE_CONNECT_BUNDLE,
    // Carregados mas não usados por src/config/cassandra.ts hoje (autenticação real é só
    // secureConnectBundle + astra_token) — mantidos por compatibilidade com o .env.example
    // existente, não remover sem confirmar que nada externo depende deles.
    astra_client_id: _env.ASTRA_CLIENT_ID,
    astra_client_secret: _env.ASTRA_CLIENT_SECRET,
    astra_token: _env.ASTRA_TOKEN,
    keyspace: _env.ASTRA_KEYSPACE,
    kafka_brokers: _env.KAFKA_BROKERS,
    jwt_secret: _env.JWT_SECRET,
    cassandra_contact_points: _env.CASSANDRA_CONTACT_POINTS,
    cassandra_local_datacenter: _env.CASSANDRA_LOCAL_DATACENTER,
    cors_allowed_origins: _env.CORS_ALLOWED_ORIGINS
        ? _env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
        : undefined,
    rate_limit_max: _env.RATE_LIMIT_MAX,
};
