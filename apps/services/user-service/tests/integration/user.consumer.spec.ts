import { vi, describe, it, expect, beforeEach } from 'vitest';
import { profileSelect } from '../../src/prisma/profile.select';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('../../src/prisma/index', () => ({
  default: { userProfile: { create: mockCreate } },
}));

import { CreateProfileService } from '../../src/services/createProfile.service';

const makeCreatedProfile = (userID: string) => ({
  id: '22222222-2222-2222-2222-222222222222',
  userID,
  name: null,
  username: null,
  avatarUrl: null,
  bio: null,
  followers: 0,
  following: 0,
  totalPosts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('user-service — Kafka Consumer: user.registered', () => {
  let service: CreateProfileService;

  beforeEach(() => {
    service = new CreateProfileService();
    vi.clearAllMocks();
  });

  it('cria perfil no banco quando mensagem user.registered chega', async () => {
    const userID = '11111111-1111-1111-1111-111111111111';
    mockCreate.mockResolvedValue(makeCreatedProfile(userID));

    // Simula a lógica do handler em consumer.ts:
    // const payload = JSON.parse(message.value.toString());
    // await createProfileService.createProfile({ userID: payload.accountId });
    const kafkaPayload = { accountId: userID };
    await service.createProfile({ accountId: kafkaPayload.accountId });

    expect(mockCreate).toHaveBeenCalledWith({ data: { userID }, select: profileSelect });
  });

  it('processa múltiplos eventos user.registered em sequência', async () => {
    const ids = [
      '11111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ];
    mockCreate.mockImplementation(({ data }) => Promise.resolve(makeCreatedProfile(data.userID)));

    for (const userID of ids) {
      await service.createProfile({ accountId: userID });
    }

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenNthCalledWith(1, { data: { userID: ids[0] }, select: profileSelect });
    expect(mockCreate).toHaveBeenNthCalledWith(2, { data: { userID: ids[1] }, select: profileSelect });
  });

  it('propaga erro quando o banco falha', async () => {
    mockCreate.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      service.createProfile({ accountId: '11111111-1111-1111-1111-111111111111' })
    ).rejects.toThrow('DB connection lost');
  });
});
