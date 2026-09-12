import { describe, it, expect, vi, beforeEach } from "vitest";
import { CheckInService } from "../checkIn.service";
import { Prisma } from "../../generated/prisma/client";

vi.mock("../../config/redis", () => ({
    redis: { del: vi.fn().mockResolvedValue(1) },
}));

const { mockTransaction, mockFindUnique } = vi.hoisted(() => ({
    mockTransaction: vi.fn(),
    mockFindUnique: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
    default: {
        $transaction: mockTransaction,
        eventCheckIn: {
            create: vi.fn().mockResolvedValue({}),
            findUnique: mockFindUnique,
            delete: vi.fn().mockResolvedValue({}),
        },
        event: { update: vi.fn().mockResolvedValue({}) },
    },
}));

describe("CheckInService", () => {
    let service: CheckInService;

    beforeEach(() => {
        service = new CheckInService();
        vi.clearAllMocks();
    });

    describe("checkIn", () => {
        it("deve realizar check-in e retornar { checkedIn: true }", async () => {
            mockTransaction.mockResolvedValue([]);
            const result = await service.checkIn("event-1", "user-1");
            expect(mockTransaction).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ checkedIn: true });
        });

        it("deve lançar erro quando usuário já fez check-in (P2002)", async () => {
            mockTransaction.mockRejectedValue(
                Object.assign(
                    new Prisma.PrismaClientKnownRequestError("Unique constraint", {
                        code: "P2002",
                        clientVersion: "7.0.0",
                    }),
                ),
            );
            await expect(service.checkIn("event-1", "user-1")).rejects.toThrow(
                "Usuário já fez check-in neste evento",
            );
        });

        it("deve lançar erro quando evento não encontrado (P2025)", async () => {
            mockTransaction.mockRejectedValue(
                Object.assign(
                    new Prisma.PrismaClientKnownRequestError("Not found", {
                        code: "P2025",
                        clientVersion: "7.0.0",
                    }),
                ),
            );
            await expect(service.checkIn("event-1", "user-1")).rejects.toThrow(
                "Evento não encontrado",
            );
        });

        it("deve lançar erro quando evento não encontrado (P2003 — violação de FK no create do check-in)", async () => {
            // eventCheckIn.create falha por FK inválida antes de chegar no event.update,
            // então o Prisma reporta P2003 (não P2025) para um eventId inexistente.
            mockTransaction.mockRejectedValue(
                Object.assign(
                    new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
                        code: "P2003",
                        clientVersion: "7.0.0",
                    }),
                ),
            );
            await expect(service.checkIn("event-1", "user-1")).rejects.toThrow(
                "Evento não encontrado",
            );
        });

        it("deve repassar erros desconhecidos", async () => {
            mockTransaction.mockRejectedValue(new Error("DB crashed"));
            await expect(service.checkIn("event-1", "user-1")).rejects.toThrow("DB crashed");
        });
    });

    describe("checkOut", () => {
        it("deve realizar check-out e retornar { checkedIn: false }", async () => {
            mockFindUnique.mockResolvedValue({ id: "checkin-id" });
            mockTransaction.mockResolvedValue([]);
            const result = await service.checkOut("event-1", "user-1");
            expect(result).toEqual({ checkedIn: false });
            expect(mockTransaction).toHaveBeenCalledTimes(1);
        });

        it("deve lançar erro quando check-in não encontrado", async () => {
            mockFindUnique.mockResolvedValue(null);
            await expect(service.checkOut("event-1", "user-1")).rejects.toThrow(
                "Check-in não encontrado",
            );
            expect(mockTransaction).not.toHaveBeenCalled();
        });
    });
});
