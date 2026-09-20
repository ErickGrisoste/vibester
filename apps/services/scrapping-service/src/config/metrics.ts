import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";

export const register = new Registry();

collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total de requisições HTTP recebidas",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duração das requisições HTTP em segundos",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const scrapingCycleDurationSeconds = new Histogram({
  name: "scraping_cycle_duration_seconds",
  help: "Duração de um ciclo completo do job de atualização de movimento",
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

export const scrapingEstablishmentsTotal = new Gauge({
  name: "scraping_establishments_total",
  help: "Quantidade de estabelecimentos abertos encontrados no último ciclo",
  registers: [register],
});

export const scrapingSuccessTotal = new Counter({
  name: "scraping_success_total",
  help: "Estabelecimentos processados com sucesso (sem exceção) por ciclo",
  registers: [register],
});

export const scrapingFailureTotal = new Counter({
  name: "scraping_failure_total",
  help: "Estabelecimentos cuja atualização falhou com exceção",
  registers: [register],
});

export const scrapingExternalApiLatencySeconds = new Histogram({
  name: "scraping_external_api_latency_seconds",
  help: "Latência de chamadas a APIs externas (SerpAPI, Google Places)",
  labelNames: ["api"],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const movementCalculationTotal = new Counter({
  name: "movement_calculation_total",
  help: "Resultados do cálculo de movimento, por nível e origem",
  labelNames: ["level", "source"],
  registers: [register],
});

export const movementConfidence = new Histogram({
  name: "movement_confidence",
  help: "Distribuição do confidence (0-1) calculado por atualização de movimento",
  labelNames: ["source"],
  buckets: [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1],
  registers: [register],
});

export const cacheHitTotal = new Counter({
  name: "cache_hit_total",
  help: "Total de acertos de cache em memória",
  labelNames: ["cache"],
  registers: [register],
});

export const cacheMissTotal = new Counter({
  name: "cache_miss_total",
  help: "Total de falhas de cache em memória",
  labelNames: ["cache"],
  registers: [register],
});
