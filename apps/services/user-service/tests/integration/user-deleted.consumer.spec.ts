import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/kafka/producer', () => ({ producer: { send: vi.fn() } }));

import { handleUserDeletedEvent } from '../../src/kafka/consumer';

describe('user-service — Kafka Consumer: user.deleted', () => {
  const service = { handleUserDeleted: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => vi.clearAllMocks());

  it('usa o accountId do evento publicado pelo auth-service', async () => {
    await handleUserDeletedEvent(
      JSON.stringify({ userId: 'acc-1', accountId: 'acc-1', occurredAt: '2026-09-14T00:00:00Z' }),
      service as never,
    );
    expect(service.handleUserDeleted).toHaveBeenCalledWith('acc-1');
  });

  it('aceita evento só com userId', async () => {
    await handleUserDeletedEvent(JSON.stringify({ userId: 'acc-2' }), service as never);
    expect(service.handleUserDeleted).toHaveBeenCalledWith('acc-2');
  });

  it('descarta mensagem malformada sem travar a partição', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(handleUserDeletedEvent('not-json', service as never)).resolves.toBeUndefined();
    await expect(handleUserDeletedEvent(JSON.stringify({}), service as never)).resolves.toBeUndefined();

    expect(service.handleUserDeleted).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('propaga erro do serviço para o Kafka reentregar', async () => {
    service.handleUserDeleted.mockRejectedValueOnce(new Error('db down'));
    await expect(handleUserDeletedEvent(JSON.stringify({ accountId: 'acc-3' }), service as never)).rejects.toThrow('db down');
  });
});
