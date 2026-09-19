import { vi } from 'vitest';

const mockPayment = {
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
};

const prisma = {
  payment: mockPayment,
};

export default prisma;
export { mockPayment };
