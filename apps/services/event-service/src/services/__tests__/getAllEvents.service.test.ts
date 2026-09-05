import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetAllEventsService } from "../getAllEvents.service";

vi.mock("../../config/redis", () => ({
    redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue("OK") },
    cacheAside: async <T>(_k: string, _t: number, fn: () => Promise<T>): Promise<T> => fn(),
}));

const { mockFindMany } = vi.hoisted(() => ({
    mockFindMany: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
    default: {
        event: {
            findMany: mockFindMany,
        },
    },
}));

function makeDbEvent(overrides: Partial<{
    id: string;
    name: string;
    organizer: string;
    location: string;
    isFeatured: boolean;
    startDate: Date;
    totalConfirmed: number;
    ticketLink: string | null;
}> = {}) {
    return {
        id: "event-id-1",
        name: "Festival de Verão",
        organizer: "Organizer LTDA",
        location: "São Paulo, SP",
        isFeatured: false,
        startDate: new Date("2026-07-01T18:00:00Z"),
        totalConfirmed: 10,
        ticketLink: "https://example.com/tickets",
        ...overrides,
    };
}

describe("GetAllEventsService", () => {
    let service: GetAllEventsService;

    beforeEach(() => {
        service = new GetAllEventsService();
        vi.clearAllMocks();
    });

    it("should return all events regardless of featured status", async () => {
        const events = [
            makeDbEvent({ name: "Evento A", isFeatured: true }),
            makeDbEvent({ id: "event-id-2", name: "Evento B", isFeatured: false }),
        ];
        mockFindMany.mockResolvedValue(events);

        const result = await service.get();

        expect(mockFindMany).toHaveBeenCalledWith({
            orderBy: { startDate: "asc" },
        });
        expect(result).toHaveLength(2);
    });

    it("should return empty array when no events exist", async () => {
        mockFindMany.mockResolvedValue([]);

        const result = await service.get();

        expect(result).toEqual([]);
    });

    it("should return events ordered by startDate asc", async () => {
        const events = [
            makeDbEvent({ name: "Evento Futuro", startDate: new Date("2026-09-01T18:00:00Z") }),
            makeDbEvent({ name: "Evento Próximo", startDate: new Date("2026-07-01T18:00:00Z") }),
        ];
        mockFindMany.mockResolvedValue(events);

        const result = await service.get();

        expect(result[0].name).toBe("Evento Futuro");
        expect(result[1].name).toBe("Evento Próximo");
    });

    it("should throw when prisma fails", async () => {
        mockFindMany.mockRejectedValue(new Error("Database error"));

        await expect(service.get()).rejects.toThrow("Database error");
    });
});
