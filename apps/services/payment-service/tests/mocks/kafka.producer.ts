import { vi } from 'vitest';

export const producerMock = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue([]),
};

export default producerMock;
