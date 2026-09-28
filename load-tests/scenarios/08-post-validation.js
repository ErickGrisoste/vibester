/**
 * Carga no post-validation-service.
 *
 * Por que este serviço ganhou cenário próprio: ele é o único do monorepo que
 * roda **sem banco nenhum** — só CPU e um Redis opcional. Isso o torna
 * isolável de verdade (diferente de post/feed/establishment, fora dos outros
 * cenários por dependerem de Astra e R2) e, principalmente, faz o número medido
 * aqui ser o custo das regras, não o da rede até um banco externo.
 *
 * O threshold é o requisito não funcional do serviço: **p(95) abaixo de 200ms**.
 * Não é o SLA genérico de 500ms dos outros cenários — este serviço fica no
 * caminho da criação de post, e 500ms ali seria sentido pelo usuário ao
 * publicar.
 *
 * Os textos abaixo misturam de propósito conteúdo aprovado e reprovado: o
 * caminho de rejeição executa MAIS regras (todas rodam, nenhuma interrompe as
 * outras), então medir só conteúdo limpo esconderia o pior caso.
 *
 * Uso:
 *   k6 run load-tests/scenarios/08-post-validation.js \
 *     -e POST_VALIDATION_URL=http://localhost:3008 \
 *     -e PV_JWT="<token assinado com o JWT_SECRET do serviço>"
 *
 * Sem `PV_JWT` o cenário só exercita os probes — a rota exige JWT.
 */
import { sleep } from 'k6';
import { SERVICES } from '../config/base.js';
import { TREND_STATS } from '../config/thresholds.js';
import { get, post, ok } from '../helpers/http.js';
import { handleSummary as makeSummary } from '../summary/index.js';

const TOKEN = __ENV.PV_JWT || '';
const VUS = parseInt(__ENV.PV_VUS) || 50;

export const options = {
  scenarios: {
    load: {
      executor:        'ramping-vus',
      startVUs:        0,
      stages: [
        { duration: '30s', target: VUS },
        { duration: '2m',  target: VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    // O requisito do serviço, não o SLA genérico do monorepo.
    http_req_duration: ['p(95)<200', 'p(99)<400'],
    http_req_waiting:  ['p(95)<200'],
  },
  summaryTrendStats: TREND_STATS,
};

/**
 * Conteúdos de teste. Cada VU sorteia um, e a proporção importa: cerca de
 * metade reprova, para que o caminho caro (todas as regras + montagem das
 * issues) apareça no p95 em vez de ficar escondido atrás de conteúdo limpo.
 *
 * `unique` força um hash de conteúdo diferente a cada iteração, o que impede o
 * cache do Redis de transformar a medição num teste de Redis. O caso sem
 * `unique` fica para medir o caminho de cache hit.
 */
const SAMPLES = [
  { label: 'limpo',      unique: true,  content: 'Hoje tem show no bar da esquina, chega junto' },
  { label: 'limpo-link', unique: true,  content: 'Ingressos em https://www.sympla.com.br/evento' },
  { label: 'cacheavel',  unique: false, content: 'Conteudo estavel para medir o caminho de cache' },
  { label: 'longo',      unique: true,  content: 'a'.repeat(600) },
  { label: 'palavrao',   unique: true,  content: 'que p0rr4 de fila enorme nesse lugar' },
  { label: 'encurtador', unique: true,  content: 'promo relampago em https://bit.ly/promo-x' },
];

export default function () {
  const health = get(`${SERVICES.postValidation}/health`, {
    tags: { endpoint: 'health', service: 'post-validation' },
  });
  ok(health, 'health:post-validation');

  if (!TOKEN) {
    sleep(1);
    return;
  }

  const sample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
  const content = sample.unique
    ? `${sample.content} ${__VU}-${__ITER}`
    : sample.content;

  const res = post(
    `${SERVICES.postValidation}/validations/post`,
    { content, mediaCount: 1 },
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
      tags: { endpoint: 'validate', service: 'post-validation', sample: sample.label },
    },
  );

  // 200 é sucesso tanto para aprovado quanto para reprovado: a validação
  // respondeu. Um 4xx/5xx aqui é falha de verdade, e é o que o threshold de
  // http_req_failed precisa enxergar.
  ok(res, `validate:${sample.label}`);

  sleep(0.5);
}

export function handleSummary(data) {
  return makeSummary(data, '08-post-validation');
}
