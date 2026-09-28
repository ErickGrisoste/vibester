import { vi } from 'vitest';

const mockAccess = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockSession = {
  findFirst: vi.fn(),
  create: vi.fn().mockResolvedValue({ id: 'session-id' }),
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
};

const prisma = {
  access: mockAccess,
  session: mockSession,
};

export default prisma;
export { mockAccess, mockSession };
