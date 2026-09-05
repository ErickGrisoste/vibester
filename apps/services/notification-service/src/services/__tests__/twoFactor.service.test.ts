import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    generateTwoFactorCode,
    saveTwoFactorCode,
    validateTwoFactorCode,
    markTwoFactorCodeAsUsed,
} from "../twoFactor.service";

const { mockCreate, mockFindFirst, mockUpdateMany } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockFindFirst: vi.fn(),
    mockUpdateMany: vi.fn(),
}));

vi.mock("../../prisma", () => ({
    default: {
        twoFactorCode: {
            create: mockCreate,
            findFirst: mockFindFirst,
            updateMany: mockUpdateMany,
        },
    },
}));

describe("generateTwoFactorCode", () => {
    it("generates a 6-digit numeric string", () => {
        const code = generateTwoFactorCode();
        expect(code).toMatch(/^\d{6}$/);
    });

    it("generates values within the 100000-999999 range across multiple calls", () => {
        for (let i = 0; i < 20; i++) {
            const code = Number(generateTwoFactorCode());
            expect(code).toBeGreaterThanOrEqual(100000);
            expect(code).toBeLessThan(999999);
        }
    });
});

describe("saveTwoFactorCode", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("calls twoFactorCode.create with email/code and expiresAt ~5min in the future", async () => {
        mockCreate.mockResolvedValue(undefined);

        await saveTwoFactorCode("user@example.com", "123456");

        expect(mockCreate).toHaveBeenCalledWith({
            data: {
                email: "user@example.com",
                code: "123456",
                expiresAt: new Date("2026-01-01T00:05:00.000Z"),
            },
        });
    });
});

describe("validateTwoFactorCode", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns true when a valid, unused, non-expired code is found", async () => {
        mockFindFirst.mockResolvedValue({ id: "code-1" });

        const result = await validateTwoFactorCode("user@example.com", "123456");

        expect(result).toBe(true);
    });

    it("returns false when findFirst finds nothing (wrong/used/expired code)", async () => {
        mockFindFirst.mockResolvedValue(null);

        const result = await validateTwoFactorCode("user@example.com", "000000");

        expect(result).toBe(false);
    });

    it("calls findFirst with where {email, code, used:false, expiresAt:{gt: now}}", async () => {
        mockFindFirst.mockResolvedValue(null);

        await validateTwoFactorCode("user@example.com", "123456");

        const callArg = mockFindFirst.mock.calls[0][0];
        expect(callArg.where.email).toBe("user@example.com");
        expect(callArg.where.code).toBe("123456");
        expect(callArg.where.used).toBe(false);
        expect(callArg.where.expiresAt.gt).toBeInstanceOf(Date);
    });
});

describe("markTwoFactorCodeAsUsed", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls updateMany with where {email, code, used:false} and data {used:true}", async () => {
        mockUpdateMany.mockResolvedValue({ count: 1 });

        await markTwoFactorCodeAsUsed("user@example.com", "123456");

        expect(mockUpdateMany).toHaveBeenCalledWith({
            where: { email: "user@example.com", code: "123456", used: false },
            data: { used: true },
        });
    });
});
