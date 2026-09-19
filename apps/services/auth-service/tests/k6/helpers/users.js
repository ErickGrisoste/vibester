import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config.js';

const HEADERS = { 'Content-Type': 'application/json' };

export function generateUser() {
  const uid = `${Date.now()}_vu${__VU}_it${__ITER}`;
  return {
    username: `testuser_${uid}`,
    name: `Test User ${__VU}`,
    email: `testuser_${uid}@k6test.com`,
    password: 'K6testPass123!',
    bornAt: '1995-06-15T00:00:00.000Z',
  };
}

export function register(user) {
  const res = http.post(
    `${BASE_URL}/register`,
    JSON.stringify(user),
    { headers: HEADERS, tags: { endpoint: 'register' } },
  );

  // 202, não 201: o /register apenas guarda a pendência no Redis e dispara o
  // email — a conta só passa a existir depois do /verify-email.
  check(res, {
    'register: status 202': (r) => r.status === 202,
    'register: retornou message': (r) => {
      try { return !!JSON.parse(r.body).message; } catch { return false; }
    },
  });

  return res;
}

export function login(credentials) {
  const res = http.post(
    `${BASE_URL}/login`,
    JSON.stringify(credentials),
    { headers: HEADERS, tags: { endpoint: 'login' } },
  );

  check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: retornou token': (r) => {
      try { return !!JSON.parse(r.body).token; } catch { return false; }
    },
  });

  return res;
}

/**
 * Exercita a validação do código de verificação.
 *
 * O código real chega por email, então a carga é medida no caminho de
 * rejeição — que é justamente o que um atacante percorreria e o que precisa
 * responder rápido: Redis GET + comparação HMAC + gravação do contador de
 * tentativas.
 */
export function verifyEmailWithWrongCode(email, code = '000000') {
  const res = http.post(
    `${BASE_URL}/verify-email`,
    JSON.stringify({ email, code }),
    { headers: HEADERS, tags: { endpoint: 'verify-email' } },
  );

  check(res, {
    'verify-email: rejeitou o código (422) ou barrou por excesso (429)': (r) =>
      r.status === 422 || r.status === 429,
  });

  return res;
}
