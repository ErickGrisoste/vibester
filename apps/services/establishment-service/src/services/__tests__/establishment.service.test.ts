import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockFindMany,
  mockFindUnique,
  mockUpdate,
  mockCount,
  mockQueryRaw,
  mockTransaction,
  mockImageDeleteMany,
  mockImageCreateMany,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockCount: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockTransaction: vi.fn(),
  mockImageDeleteMany: vi.fn(),
  mockImageCreateMany: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
  default: {
    establishment: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      count: mockCount,
    },
    establishmentImage: {
      deleteMany: mockImageDeleteMany,
      createMany: mockImageCreateMany,
    },
    $queryRaw: mockQueryRaw,
    $transaction: mockTransaction,
  },
}));

import {
  calculateDistance,
  EstablishmentService,
} from "../establishment.service";

function makeEstablishment(overrides: Record<string, unknown> = {}) {
  return {
    id: "est-1",
    googlePlaceId: null,
    name: "Bar do Zé",
    bio: null,
    endereco: null,
    photoUrl: "https://img.test/photo.jpg",
    bannerUrl: "https://img.test/banner.jpg",
    category: "bar",
    priceIndicator: "$$",
    averageRating: 4.5,
    qtdAvaliacoes: 10,
    distribuicao: [0, 0, 1, 4, 5],
    nivelMovimento: 3,
    latitude: -23.5505,
    longitude: -46.6333,
    movementLevel: null,
    openingHours: [],
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

describe("calculateDistance", () => {
  it("returns 0 for the same point", () => {
    expect(calculateDistance(0, 0, 0, 0)).toBe(0);
    expect(calculateDistance(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it("calculates correct approximate distance between two known points", () => {
    const spLat = -23.5505;
    const spLon = -46.6333;
    const rjLat = -22.9068;
    const rjLon = -43.1729;

    const distance = calculateDistance(spLat, spLon, rjLat, rjLon);
    expect(distance).toBeGreaterThan(350);
    expect(distance).toBeLessThan(365);
  });
});

describe("EstablishmentService.listEstablishments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated result with default page and limit", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeEstablishment()]);

    const result = await EstablishmentService.listEstablishments({});

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(result.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it("applies category filter", async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await EstablishmentService.listEstablishments({ category: "bar" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { equals: "bar", mode: "insensitive" },
        }),
      })
    );
  });

  it("applies minRating filter", async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await EstablishmentService.listEstablishments({ minRating: 4 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          averageRating: { gte: 4 },
        }),
      })
    );
  });

  it("applies search filter", async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await EstablishmentService.listEstablishments({ search: "cerveja" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "cerveja", mode: "insensitive" },
        }),
      })
    );
  });

  it("sorts by distance when coordinates are provided (in-memory)", async () => {
    mockFindMany.mockResolvedValue([
      makeEstablishment({ latitude: -22.9068, longitude: -43.1729, name: "Rio" }),
      makeEstablishment({ id: "est-2", latitude: -23.5489, longitude: -46.6388, name: "SP" }),
    ]);

    const result = await EstablishmentService.listEstablishments({
      sortBy: "distance",
      userLat: -23.5505,
      userLon: -46.6333,
    });

    expect(result.data[0].name).toBe("SP");
  });

  it("uses DB-level sort and pagination for rating sort", async () => {
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([
      makeEstablishment({ averageRating: 5.0 }),
      makeEstablishment({ id: "est-2", averageRating: 3.0 }),
    ]);

    const result = await EstablishmentService.listEstablishments({
      sortBy: "rating",
      page: 1,
      limit: 10,
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { averageRating: "desc" },
        take: 10,
        skip: 0,
      })
    );
    expect(result.data[0].averageRating).toBe(5.0);
  });

  it("throws when sortBy=distance without coordinates", async () => {
    await expect(
      EstablishmentService.listEstablishments({ sortBy: "distance" })
    ).rejects.toThrow("Latitude and longitude are required to sort by distance");
  });
});

describe("EstablishmentService.listOpenEstablishments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns establishments filtered by DB raw query (normal hours)", async () => {
    vi.setSystemTime(new Date(2026, 5, 17, 15, 0, 0)); // Wednesday 15:00

    mockQueryRaw.mockResolvedValue([{ id: "est-1" }]);
    mockFindMany.mockResolvedValue([makeEstablishment()]);

    const result = await EstablishmentService.listOpenEstablishments();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("est-1");
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when no open establishments", async () => {
    vi.setSystemTime(new Date(2026, 5, 17, 23, 0, 0));

    mockQueryRaw.mockResolvedValue([]);

    const result = await EstablishmentService.listOpenEstablishments();

    expect(result).toHaveLength(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("EstablishmentService.updateRating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate $transaction executing the callback with the same prisma shape
    mockTransaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ establishment: { findUnique: mockFindUnique, update: mockUpdate } })
    );
  });

  it("throws INVALID_RATING for a negative value", async () => {
    await expect(
      EstablishmentService.updateRating("est-1", -1)
    ).rejects.toThrow("INVALID_RATING");
  });

  it("throws INVALID_RATING for a value greater than 5", async () => {
    await expect(
      EstablishmentService.updateRating("est-1", 5.1)
    ).rejects.toThrow("INVALID_RATING");
  });

  it("throws ESTABLISHMENT_NOT_FOUND when the id does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      EstablishmentService.updateRating("nonexistent", 4)
    ).rejects.toThrow("ESTABLISHMENT_NOT_FOUND");
  });

  it("updates the rating successfully via transaction", async () => {
    const establishment = makeEstablishment();
    mockFindUnique.mockResolvedValue(establishment);
    mockUpdate.mockResolvedValue({ ...establishment, averageRating: 4.8 });

    const result = await EstablishmentService.updateRating("est-1", 4.8);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "est-1" },
      data: {
        averageRating: 4.8,
        qtdAvaliacoes: { increment: 1 },
      },
    });
    expect(result.averageRating).toBe(4.8);
  });
});

describe("EstablishmentService.getEstablishmentProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when the establishment is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      EstablishmentService.getEstablishmentProfile("nonexistent")
    ).rejects.toThrow("Establishment not found");
  });

  it("returns the establishment profile correctly", async () => {
    mockFindUnique.mockResolvedValue(
      makeEstablishment({
        id: "est-99",
        name: "Pub London",
        category: "pub",
        averageRating: 4.2,
      })
    );

    const profile = await EstablishmentService.getEstablishmentProfile("est-99");

    expect(profile).toMatchObject({
      id: "est-99",
      name: "Pub London",
      category: "pub",
      averageRating: 4.2,
    });
  });
});

describe("EstablishmentService.replaceImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : ops
    );
  });

  it("deletes existing images and inserts the new list inside a transaction", async () => {
    mockImageDeleteMany.mockResolvedValue({ count: 2 });
    mockImageCreateMany.mockResolvedValue({ count: 3 });

    await EstablishmentService.replaceImages("est-1", [
      { url: "https://img.test/a.jpg", position: 0 },
      { url: "https://img.test/b.jpg", position: 1, source: "SERPAPI" },
    ]);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockImageDeleteMany).toHaveBeenCalledWith({
      where: { establishmentId: "est-1" },
    });
    expect(mockImageCreateMany).toHaveBeenCalledWith({
      data: [
        { establishmentId: "est-1", url: "https://img.test/a.jpg", position: 0, source: "SERPAPI" },
        { establishmentId: "est-1", url: "https://img.test/b.jpg", position: 1, source: "SERPAPI" },
      ],
    });
  });

  it("defaults source to SERPAPI when not provided", async () => {
    mockImageDeleteMany.mockResolvedValue({ count: 0 });
    mockImageCreateMany.mockResolvedValue({ count: 1 });

    await EstablishmentService.replaceImages("est-2", [
      { url: "https://img.test/c.jpg", position: 0 },
    ]);

    expect(mockImageCreateMany).toHaveBeenCalledWith({
      data: [{ establishmentId: "est-2", url: "https://img.test/c.jpg", position: 0, source: "SERPAPI" }],
    });
  });
});

// ── ListEstablishmentsService (nearby) ──────────────────────────────────────
import { ListEstablishmentsService } from "../listEstablishment.service";

const listEstablishmentsNearbyService = new ListEstablishmentsService();

const BASE_LAT = -23.5505;
const BASE_LON = -46.6333;

describe("ListEstablishmentsService.listEstablishments (nearby)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns establishments within the radius with distanceTo attached", async () => {
    mockFindMany.mockResolvedValueOnce([makeEstablishment()]);

    const result = await listEstablishmentsNearbyService.listEstablishments({
      latitude: BASE_LAT,
      longitude: BASE_LON,
      radiusKm: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0].distanceTo).toBeCloseTo(0, 1);
  });

  it("excludes establishments outside the radius", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeEstablishment({ latitude: -22.9068, longitude: -43.1729 }), // Rio ~357km
    ]);

    const result = await listEstablishmentsNearbyService.listEstablishments({
      latitude: BASE_LAT,
      longitude: BASE_LON,
      radiusKm: 10,
    });

    expect(result).toHaveLength(0);
  });

  it("sorts results by distanceTo ascending", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeEstablishment({ id: "est-far", latitude: BASE_LAT + 0.05, longitude: BASE_LON }),
      makeEstablishment({ id: "est-near", latitude: BASE_LAT + 0.01, longitude: BASE_LON }),
    ]);

    const result = await listEstablishmentsNearbyService.listEstablishments({
      latitude: BASE_LAT,
      longitude: BASE_LON,
      radiusKm: 10,
    });

    expect(result[0].id).toBe("est-near");
    expect(result[1].id).toBe("est-far");
  });

  it("uses default radius of 10km when radiusKm is not provided", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeEstablishment({ latitude: BASE_LAT, longitude: BASE_LON }),
    ]);

    const result = await listEstablishmentsNearbyService.listEstablishments({
      latitude: BASE_LAT,
      longitude: BASE_LON,
    });

    expect(result).toHaveLength(1);
  });

  it("returns empty array when no establishments exist in the bounding box", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await listEstablishmentsNearbyService.listEstablishments({
      latitude: BASE_LAT,
      longitude: BASE_LON,
      radiusKm: 10,
    });

    expect(result).toHaveLength(0);
  });
});
