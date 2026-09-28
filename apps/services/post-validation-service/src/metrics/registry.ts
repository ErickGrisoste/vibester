import client from "prom-client";

/**
 * Única fonte de métrica do serviço — mesmo padrão do post-service. Não crie
 * `new client.Counter(...)` solto em outro arquivo: métrica registrada em dois
 * lugares quebra o `/metrics` inteiro com "already registered".
 */
export const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duração das requisições HTTP",
    // Buckets apertados em volta do orçamento de 200ms: é o requisito não
    // funcional do serviço, e sem bucket perto dele não dá para ver o p99 cruzar.
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1],
    labelNames: ["method", "route", "status_code"] as const,
    registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total de requisições HTTP",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [registry],
});

/** Veredito por origem: `sync` é a rota HTTP, `async` é o worker do Kafka. */
export const validationsTotal = new client.Counter({
    name: "validations_total",
    help: "Validações realizadas, por veredito e origem",
    labelNames: ["result", "source"] as const,
    registers: [registry],
});

/**
 * Motivo da rejeição. É a métrica que diz se uma regra está calibrada: uma
 * `SPAM_SUSPECTED` que dispara em 30% dos posts é falso positivo, não spam.
 */
export const validationIssuesTotal = new client.Counter({
    name: "validation_issues_total",
    help: "Issues emitidas, por código",
    labelNames: ["code", "source"] as const,
    registers: [registry],
});

/** Só o tempo das regras, sem HTTP nem Redis — separa CPU de latência de rede. */
export const validationRulesDuration = new client.Histogram({
    name: "validation_rules_duration_seconds",
    help: "Tempo de execução das regras de validação",
    buckets: [0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
    registers: [registry],
});

export const cacheResultTotal = new client.Counter({
    name: "cache_result_total",
    help: "Resultado do cache de veredito",
    labelNames: ["result"] as const,
    registers: [registry],
});

export const kafkaPublishTotal = new client.Counter({
    name: "kafka_publish_total",
    help: "Publicações no Kafka",
    labelNames: ["topic", "result"] as const,
    registers: [registry],
});

export const kafkaConsumedTotal = new client.Counter({
    name: "kafka_consumed_total",
    help: "Mensagens consumidas pelo worker",
    labelNames: ["topic", "result"] as const,
    registers: [registry],
});

export const rateLimitExceededTotal = new client.Counter({
    name: "rate_limit_exceeded_total",
    help: "Requisições barradas pelo rate limit",
    labelNames: ["route"] as const,
    registers: [registry],
});
