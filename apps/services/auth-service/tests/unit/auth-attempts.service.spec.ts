import { vi } from 'vitest';

vi.mock('../../src/config/redis', async () => ({
  redis: (await import('../mocks/redis')).redisMock,
}));

vi.mock('../../src/kafka/producer', async () => ({
  producer: (await import('../mocks/kafka.producer')).producerMock,
}));

import { AuthAttemptsService, EXCESSIVE_ATTEMPTS_TOPIC } from '../../src/services/auth-attempts.service';
import { redisMock } from '../mocks/redis';
import { producerMock } from '../mocks/kafka.producer';
import { env } from '../../src/config/env';

const EMAIL = 'joao@email.com';
const KEY = `auth:fail:login:${EMAIL}`;

describe('AuthAttemptsService', () => {
  let service: AuthAttemptsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthAttemptsService();
  });

  it('should set the window TTL only on the first failure', async () => {
    redisMock.incr.mockResolvedValueOnce(1);

    await service.registerLoginFailure(EMAIL);

    expect(redisMock.incr).toHaveBeenCalledWith(KEY);
    expect(redisMock.expire).toHaveBeenCalledWith(KEY, env.authFailWindowSeconds);
  });

  it('should not reset the window TTL on subsequent failures', async () => {
    redisMock.incr.mockResolvedValueOnce(2);

    await service.registerLoginFailure(EMAIL);

    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('should publish the alert exactly when the threshold is reached', async () => {
    redisMock.incr.mockResolvedValueOnce(env.authFailNotifyThreshold);

    await service.registerLoginFailure(EMAIL, 'João');

    expect(producerMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ topic: EXCESSIVE_ATTEMPTS_TOPIC }),
    );

    const payload = JSON.parse(producerMock.send.mock.calls[0][0].messages[0].value);
    expect(payload.email).toBe(EMAIL);
    expect(payload.attempts).toBe(env.authFailNotifyThreshold);
  });

  // Com `>=` no lugar de `===` o usuário receberia um email a cada tentativa
  // depois do limite, virando spam disparado por quem esta atacando a conta.
  it('should not publish again after the threshold has passed', async () => {
    redisMock.incr.mockResolvedValueOnce(env.authFailNotifyThreshold + 1);

    await service.registerLoginFailure(EMAIL);

    expect(producerMock.send).not.toHaveBeenCalled();
  });

  it('should never throw when Redis is unavailable', async () => {
    redisMock.incr.mockRejectedValueOnce(new Error('Redis fora do ar'));

    await expect(service.registerLoginFailure(EMAIL)).resolves.toBeUndefined();
    expect(producerMock.send).not.toHaveBeenCalled();
  });

  it('should clear the counter on a successful login', async () => {
    await service.clearLoginFailures(EMAIL);

    expect(redisMock.del).toHaveBeenCalledWith(KEY);
  });

  it('should swallow Redis errors when clearing the counter', async () => {
    redisMock.del.mockRejectedValueOnce(new Error('Redis fora do ar'));

    await expect(service.clearLoginFailures(EMAIL)).resolves.toBeUndefined();
  });
});
