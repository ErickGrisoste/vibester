import client from "prom-client";

export const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry });

// ---------------------------------------------------------------------------
// HTTP — sinais dourados (latência, tráfego, erro) por rota. Label `route` usa
// o padrão da rota (`/feed/:userId`), nunca a URL crua, para não explodir
// cardinalidade com UUIDs reais. Mesmo padrão do post-service (src/plugins.ts).
// ---------------------------------------------------------------------------
export const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duração das requisições HTTP em segundos",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total de requisições HTTP",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [registry],
});

// ---------------------------------------------------------------------------
// Cassandra — latência por tabela (extraída da query em BaseRepository.execute,
// sem precisar anotar cada método do repository) e falha parcial de fan-out
// entre linhas/tabelas denormalizadas do feed (o risco central documentado em
// CLAUDE.md, Performance #4/#5: sem BATCH/LWT, um fan-out pode deixar algumas
// cópias do feed atualizadas e outras não).
// ---------------------------------------------------------------------------
export const cassandraQueryDuration = new client.Histogram({
    name: "cassandra_query_duration_seconds",
    help: "Duração das queries ao Cassandra em segundos",
    labelNames: ["table", "outcome"] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
});

export const cassandraFanoutPartialFailureTotal = new client.Counter({
    name: "cassandra_fanout_partial_failure_total",
    help: "Fan-out entre linhas/tabelas denormalizadas do feed onde só parte das escritas teve sucesso",
    labelNames: ["operation"] as const,
    registers: [registry],
});

// ---------------------------------------------------------------------------
// Kafka — este serviço só consome (sem producer, ver CLAUDE.md), então a
// métrica que importa aqui é o erro de processamento: hoje `handleMessage`
// (src/kafka/consumer.ts) só faz `console.error` no catch, o que torna uma
// mensagem malformada indistinguível de qualquer outra falha em produção sem
// vasculhar logs. `eventType` fica vazio quando o payload nem chegou a ser
// parseado (JSON inválido, ou falha antes do envelope ser lido).
// ---------------------------------------------------------------------------
export const kafkaHandlerErrorTotal = new client.Counter({
    name: "kafka_handler_error_total",
    help: "Total de erros ao processar mensagens Kafka",
    labelNames: ["topic", "eventType"] as const,
    registers: [registry],
});

// ---------------------------------------------------------------------------
// Rate limit (em memória do processo, ver src/plugins.ts) — mostra se o limite
// configurado (RATE_LIMIT_MAX) está calibrado certo para a única rota pública
// deste serviço (GET /feed/:userId). Mesmo padrão do post-service.
// ---------------------------------------------------------------------------
export const rateLimitExceededTotal = new client.Counter({
    name: "rate_limit_exceeded_total",
    help: "Total de requisições rejeitadas por rate limit",
    labelNames: ["route"] as const,
    registers: [registry],
});
