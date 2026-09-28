import { vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

vi.mock('jsonwebtoken');

describe('Token generation/validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should sign token with env secret', () => {
    vi.mocked(jwt.sign).mockReturnValue('signed' as any);

    const token = jwt.sign({ userId: 'u' }, env.jwtSecret, { expiresIn: env.accessTokenTtlSeconds });

    expect(jwt.sign).toHaveBeenCalledWith({ userId: 'u' }, env.jwtSecret, { expiresIn: env.accessTokenTtlSeconds });
    expect(token).toBe('signed');
  });

  it('should verify token', () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 'u' } as any);

    const payload = jwt.verify('token', env.jwtSecret);

    expect(jwt.verify).toHaveBeenCalledWith('token', env.jwtSecret);
    expect(payload).toHaveProperty('userId', 'u');
  });
});
