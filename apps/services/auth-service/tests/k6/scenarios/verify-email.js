/**
 * Teste de Carga — Validação do Código de Verificação
 *
 * Mede especificamente o custo da validação do código sob carga, que é o
 * requisito não funcional do card: a validação deve responder em menos de
 * 200ms em condições normais.
 *
 * Como o código real chega por email, o cenário mede o caminho de rejeição —
 * que é o percorrido por quem tenta força bruta e o que precisa se manter
 * barato: Redis GET + comparação HMAC + gravação do contador de tentativas.
 *
 * Cada iteração registra um usuário novo (cria a pendência) e erra o código
 * algumas vezes, sempre abaixo de MAX_CODE_ATTEMPTS para continuar exercitando
 * o 422 em vez de cair no 429 e descartar a pendência.
 *
 * Thresholds:
 *   - p95 da validação < 200ms  (requisito do card)
 *   - p99 da validação < 400ms
 *   - error rate < 1%
 *
 * ATENÇÃO: rodar contra staging. O /register dispara email de verificação
 * real para cada usuário gerado.
 *
 * Variáveis de ambiente:
 *   BASE_URL   - URL base do serviço
 *   PERF_VUS   - pico de VUs (default: 50)
 */
import { sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { VUS } from '../config.js';
import { generateUser, register, verifyEmailWithWrongCode } from '../helpers/users.js';

const TARGET_VUS = VUS.PERFORMANCE;

// Métrica própria: http_req_duration agregado incluiria o /register (que faz
// bcrypt e publica no Kafka) e mascararia o custo real da validação.
const validationDuration = new Trend('verify_email_validation_duration', true);

// Abaixo do MAX_CODE_ATTEMPTS padrão (5), para medir o 422 e não o 429.
const WRONG_ATTEMPTS_PER_ITERATION = 3;

export const options = {
  stages: [
    { duration: '1m', target: Math.ceil(TARGET_VUS * 0.3) },
    { duration: '3m', target: TARGET_VUS },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    verify_email_validation_duration: ['p(95)<200', 'p(99)<400'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const user = generateUser();

  const regRes = register(user);

  if (regRes.status === 202) {
    for (let i = 0; i < WRONG_ATTEMPTS_PER_ITERATION; i++) {
      const res = verifyEmailWithWrongCode(user.email);
      validationDuration.add(res.timings.duration);

      // 429 significa que a pendência foi descartada: insistir só mediria o
      // caminho de "sem pendência", que é outro cenário.
      if (res.status === 429) break;

      sleep(0.2);
    }
  }

  sleep(1);
}
