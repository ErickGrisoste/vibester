// URLs de cada serviço — sobrescreva via variáveis de ambiente
// post-service e feed-service (Cassandra) e establishment-service (bucket R2)
// ficam de fora: dependem de bancos/storages externos não isoláveis localmente.
export const SERVICES = {
  auth:  __ENV.AUTH_URL  || 'http://localhost:3001',
  user:  __ENV.USER_URL  || 'http://localhost:3003',
  event: __ENV.EVENT_URL || 'http://localhost:3334',
  // post-validation-service e isolavel porque nao tem banco: so CPU e um Redis
  // opcional. Roda sozinho com SERVICE_MODE=api e um JWT_SECRET qualquer.
  postValidation: __ENV.POST_VALIDATION_URL || 'http://localhost:3008',
};

// Alvos de VUs por tipo de cenário
export const VUS = {
  smoke:      2,
  load:       parseInt(__ENV.LOAD_VUS)   || 50,
  stress:     parseInt(__ENV.STRESS_VUS) || 200,
  spike:      parseInt(__ENV.SPIKE_VUS)  || 400,
  soak:       parseInt(__ENV.SOAK_VUS)   || 50,
  breakpoint: parseInt(__ENV.BREAK_VUS)  || 1000,
};

// Taxas de chegada (req/s) para o cenário de proporção escrita/leitura
export const ARRIVAL_RATE = {
  writes: parseInt(__ENV.WRITE_RATE) || 30,   // req/s de escrita
  reads:  parseInt(__ENV.READ_RATE)  || 60,   // req/s de leitura (2× escrita)
  duration: __ENV.RATIO_DURATION    || '30m',
};

// SLA — base para relatório executivo
export const SLA = {
  p95_ms:     parseInt(__ENV.SLA_P95_MS)  || 500,
  p99_ms:     parseInt(__ENV.SLA_P99_MS)  || 1000,
  error_rate: parseFloat(__ENV.SLA_ERROR) || 0.01,  // 1%
  ttfb_ms:    parseInt(__ENV.SLA_TTFB_MS) || 200,
};
