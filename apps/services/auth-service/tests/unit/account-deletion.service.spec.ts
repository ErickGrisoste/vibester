import { vi } from 'vitest';

vi.mock('../../src/prisma/index', async () => ({
  default: (await import('../mocks/prisma.client')).default,
}));

vi.mock('../../src/config/redis', async () => ({
  redis: (await import('../mocks/redis')).redisMock,
}));

vi.mock('../../src/kafka/producer', async () => ({
  producer: (await import('../mocks/kafka.producer')).producerMock,
}));

vi.mock('bcryptjs', () => {
  const compare = vi.fn();
  return { default: { compare }, compare };
});

import { compare } from 'bcryptjs';
import { AccountDeletionService, USER_DELETED_TOPIC } from '../../src/services/account-deletion.service';
import { mockAccess } from '../mocks/prisma.client';
import { producerMock } from '../mocks/kafka.producer';
import { makeUser } from '../factories/user.factory';

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountDeletionService();
  });

  it('404 quando a conta não existe', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(null);

    const err: any = await service.deleteAccount('acc', 'senha').catch(e => e);

    expect(err.statusCode).toBe(404);
    expect(producerMock.send).not.toHaveBeenCalled();
  });

  it('401 com senha errada, sem publicar nem apagar nada', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(makeUser());
    vi.mocked(compare).mockResolvedValueOnce(false as never);

    const err: any = await service.deleteAccount('acc', 'errada').catch(e => e);

    expect(err.statusCode).toBe(401);
    expect(producerMock.send).not.toHaveBeenCalled();
    expect(mockAccess.delete).not.toHaveBeenCalled();
  });

  it('publica user.deleted antes de apagar a credencial', async () => {
    const user = makeUser();
    mockAccess.findUnique.mockResolvedValueOnce(user);
    vi.mocked(compare).mockResolvedValueOnce(true as never);
    mockAccess.delete.mockResolvedValueOnce(user);

    await service.deleteAccount(user.accountId, 'certa');

    const record = producerMock.send.mock.calls[0][0];
    expect(record.topic).toBe(USER_DELETED_TOPIC);
    expect(record.messages[0].key).toBe(user.accountId);
    expect(JSON.parse(record.messages[0].value)).toMatchObject({ userId: user.accountId, accountId: user.accountId });

    expect(mockAccess.delete).toHaveBeenCalledWith({ where: { accountId: user.accountId } });
    expect(producerMock.send.mock.invocationCallOrder[0]).toBeLessThan(mockAccess.delete.mock.invocationCallOrder[0]);
  });

  it('não apaga a credencial quando a publicação falha', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(makeUser());
    vi.mocked(compare).mockResolvedValueOnce(true as never);
    producerMock.send.mockRejectedValueOnce(new Error('kafka down'));

    await expect(service.deleteAccount('acc', 'certa')).rejects.toThrow('kafka down');
    expect(mockAccess.delete).not.toHaveBeenCalled();
  });

  it('trata conta já apagada por requisição concorrente como sucesso', async () => {
    mockAccess.findUnique.mockResolvedValueOnce(makeUser());
    vi.mocked(compare).mockResolvedValueOnce(true as never);
    mockAccess.delete.mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 'P2025' }));

    await expect(service.deleteAccount('acc', 'certa')).resolves.toBeUndefined();
  });
});
