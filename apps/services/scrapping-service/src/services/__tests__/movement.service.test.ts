import { describe, it, expect, vi, beforeEach } from "vitest";
import { MovementService } from "../movement.service";
import type { EstablishmentResponse } from "../../clients/establishment.client";
import type { PlacePopularityResult } from "../serpapi.service";

const { mockPrisma, mockKafkaProducer } = vi.hoisted(() => ({
  mockPrisma: {
    currentPopularity: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    popularTimesDaily: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockKafkaProducer: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../prisma/index", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../kafka/producer", () => ({
  kafkaProducer: mockKafkaProducer,
}));

function makeEstablishment(overrides: Partial<EstablishmentResponse> = {}): EstablishmentResponse {
  return {
    id: "estab-1",
    googlePlaceId: "gplace-1",
    name: "Test Bar",
    latitude: -23.55,
    longitude: -46.63,
    ...overrides,
  };
}

function makePopularityResult(overrides: Partial<PlacePopularityResult> = {}): PlacePopularityResult {
  return {
    currentDay: "friday",
    currentDayInt: 5,
    liveStatus: "Busy right now",
    liveBusynessScore: 75,
    timeSpent: "30-60 min",
    hoursData: [],
    category: null,
    ...overrides,
  };
}

describe("MovementService", () => {
  let mockEstablishmentClient: { listOpenEstablishments: ReturnType<typeof vi.fn> };
  let mockSerpApiService: { getPlacePopularity: ReturnType<typeof vi.fn> };
  let service: MovementService;

  beforeEach(() => {
    mockEstablishmentClient = { listOpenEstablishments: vi.fn() };
    mockSerpApiService = { getPlacePopularity: vi.fn() };
    service = new MovementService(
      mockEstablishmentClient as any,
      mockSerpApiService as any
    );
    vi.clearAllMocks();

    mockPrisma.popularTimesDaily.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.currentPopularity.upsert.mockResolvedValue({});
    mockPrisma.$transaction.mockResolvedValue([]);
    mockPrisma.popularTimesDaily.findMany.mockResolvedValue([]);
    mockPrisma.currentPopularity.findUnique.mockResolvedValue(null);
  });

  describe("getMovementByEstablishmentId", () => {
    it("should call prisma.currentPopularity.findUnique with the correct where clause", async () => {
      const popularity = {
        establishmentId: "estab-1",
        level: "HIGH",
        score: 75,
        updatedAt: new Date(),
      };
      mockPrisma.currentPopularity.findUnique.mockResolvedValue(popularity);

      const result = await service.getMovementByEstablishmentId("estab-1");

      expect(mockPrisma.currentPopularity.findUnique).toHaveBeenCalledWith({
        where: { establishmentId: "estab-1" },
      });
      expect(result).toEqual({ ...popularity, freshness: "FRESH" });
    });

    it("should return null when no record exists", async () => {
      mockPrisma.currentPopularity.findUnique.mockResolvedValue(null);

      const result = await service.getMovementByEstablishmentId("nonexistent");

      expect(result).toBeNull();
    });

    it("should mark the record as STALE when updated between 75min and 6h ago", async () => {
      const updatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
      mockPrisma.currentPopularity.findUnique.mockResolvedValue({
        establishmentId: "estab-1",
        level: "HIGH",
        score: 75,
        updatedAt,
      });

      const result = await service.getMovementByEstablishmentId("estab-1");

      expect((result as { freshness: string }).freshness).toBe("STALE");
    });

    it("should mark the record as EXPIRED when updated more than 6h ago", async () => {
      const updatedAt = new Date(Date.now() - 7 * 60 * 60 * 1000); // 7h ago
      mockPrisma.currentPopularity.findUnique.mockResolvedValue({
        establishmentId: "estab-1",
        level: "HIGH",
        score: 75,
        updatedAt,
      });

      const result = await service.getMovementByEstablishmentId("estab-1");

      expect((result as { freshness: string }).freshness).toBe("EXPIRED");
    });
  });

  describe("updateMovementLevelsFromSavedEstablishments", () => {
    it("should skip establishments without googlePlaceId", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ googlePlaceId: null }),
      ]);

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockSerpApiService.getPlacePopularity).not.toHaveBeenCalled();
      expect(mockPrisma.currentPopularity.upsert).not.toHaveBeenCalled();
    });

    it("should save live data with correct level when liveBusynessScore is present", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: 75, currentDayInt: 5, hoursData: [] })
      );

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { establishmentId: "estab-1" },
          update: expect.objectContaining({
            googlePlaceId: "gplace-1",
            level: "HIGH",
            score: 75,
            isEstimated: false,
            source: "SERPAPI",
          }),
          create: expect.objectContaining({
            level: "HIGH",
            score: 75,
          }),
        })
      );
    });

    it("should smooth the live score against the previously stored score and confidence 1", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: 80, currentDayInt: 5, hoursData: [] })
      );
      mockPrisma.currentPopularity.findUnique.mockResolvedValue({ score: 40, level: "LOW" });

      await service.updateMovementLevelsFromSavedEstablishments();

      // EMA: round(0.6*80 + 0.4*40) = 64; jump LOW -> HIGH spans more than one
      // band, so hysteresis doesn't hold it back.
      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            score: 64,
            level: "HIGH",
            confidence: 1,
          }),
        })
      );
    });

    it("should hold the previous level via hysteresis when the smoothed score is a small dip past the boundary", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: 59, currentDayInt: 5, hoursData: [] })
      );
      mockPrisma.currentPopularity.findUnique.mockResolvedValue({ score: 59, level: "HIGH" });

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ score: 59, level: "HIGH" }),
        })
      );
    });

    it("should save UNAVAILABLE when serpapi returns null", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(null);

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ level: "UNAVAILABLE", score: null }),
        })
      );
    });

    it("should save popular times daily when hoursData is available", async () => {
      const hoursData = [
        { hour: 20, busyness_score: 80, live_busyness_score: null, is_current: false, status_text: "Busy" },
      ];
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: 80, currentDayInt: 5, hoursData })
      );

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.popularTimesDaily.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              establishmentId: "estab-1",
              hour: 20,
              busynessScore: 80,
            }),
          ]),
        })
      );
    });

    it("should use fallback score when liveBusynessScore is null but hoursData is available", async () => {
      const hoursData = [
        { hour: 14, busyness_score: 55, live_busyness_score: null, is_current: false, status_text: "" },
      ];
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: null, currentDayInt: 5, hoursData })
      );
      mockPrisma.popularTimesDaily.findMany.mockResolvedValue([
        { busynessScore: 55 },
        { busynessScore: 55 },
        { busynessScore: 55 },
      ]);

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            level: "MEDIUM",
            score: 55,
            isEstimated: true,
            source: "ESTIMATED",
          }),
        })
      );
    });

    it("should save UNAVAILABLE when liveBusynessScore is null and no fallback score", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: null, currentDayInt: null, hoursData: [] })
      );
      mockPrisma.popularTimesDaily.findMany.mockResolvedValue([]);

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ level: "UNAVAILABLE", score: null }),
        })
      );
    });

    it("should continue processing other establishments when one throws", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1", name: "Bar A" }),
        makeEstablishment({ id: "estab-2", googlePlaceId: "gplace-2", name: "Bar B" }),
      ]);
      mockSerpApiService.getPlacePopularity
        .mockRejectedValueOnce(new Error("SerpAPI timeout"))
        .mockResolvedValueOnce(makePopularityResult({ liveBusynessScore: 50 }));

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { establishmentId: "estab-2" },
        })
      );
    });
  });

  describe("kafka category event", () => {
    function getKafkaPayload(): Record<string, unknown> {
      const call = mockKafkaProducer.send.mock.calls[0][0];
      return JSON.parse(call.messages[0].value);
    }

    it("should include category in kafka message when serpapi returns a known type", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: 75, category: "bar" })
      );

      await service.updateMovementLevelsFromSavedEstablishments();

      const payload = getKafkaPayload();
      expect(payload.data).toMatchObject({ category: "bar" });
    });

    it("should not include category in kafka message when serpapi returns null category", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: 60, category: null })
      );

      await service.updateMovementLevelsFromSavedEstablishments();

      const payload = getKafkaPayload();
      expect((payload.data as Record<string, unknown>).category).toBeUndefined();
    });

    it("should include category when using fallback (estimated) path", async () => {
      const hoursData = [
        { hour: 14, busyness_score: 40, live_busyness_score: null, is_current: false, status_text: "" },
      ];
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: null, currentDayInt: 5, hoursData, category: "restaurant" })
      );
      mockPrisma.popularTimesDaily.findMany.mockResolvedValue([
        { busynessScore: 40 },
        { busynessScore: 40 },
        { busynessScore: 40 },
      ]);

      await service.updateMovementLevelsFromSavedEstablishments();

      const payload = getKafkaPayload();
      expect(payload.data).toMatchObject({ category: "restaurant", source: "ESTIMATED" });
    });

    it("should include category when level is UNAVAILABLE", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: null, currentDayInt: null, hoursData: [], category: "night_club" })
      );
      mockPrisma.popularTimesDaily.findMany.mockResolvedValue([]);

      await service.updateMovementLevelsFromSavedEstablishments();

      const payload = getKafkaPayload();
      expect(payload.data).toMatchObject({ level: "UNAVAILABLE", category: "night_club" });
    });

    it("should send correct kafka event structure with category", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: 50, category: "cafe" })
      );

      await service.updateMovementLevelsFromSavedEstablishments();

      const payload = getKafkaPayload();
      expect(payload.eventType).toBe("establishment.movement.updated");
      expect(payload.data).toMatchObject({
        establishmentId: "estab-1",
        level: "MEDIUM",
        source: "SERPAPI",
        category: "cafe",
      });
    });
  });

  describe("listEstablishmentsWithFallback", () => {
    it("should reuse the last successful establishments list when the fetch fails", async () => {
      const establishments = [makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" })];
      mockEstablishmentClient.listOpenEstablishments
        .mockResolvedValueOnce(establishments)
        .mockRejectedValueOnce(new Error("establishment-service unavailable"));
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: 50 })
      );

      await service.updateMovementLevelsFromSavedEstablishments();
      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledTimes(2);
    });

    it("should propagate the error when the fetch fails and there is no previous list", async () => {
      mockEstablishmentClient.listOpenEstablishments.mockRejectedValue(
        new Error("establishment-service unavailable")
      );

      await expect(service.updateMovementLevelsFromSavedEstablishments()).rejects.toThrow(
        "establishment-service unavailable"
      );
      expect(mockPrisma.currentPopularity.upsert).not.toHaveBeenCalled();
    });
  });

  describe("mapScoreToMovementLevel (via updateMovementLevelsFromSavedEstablishments)", () => {
    const cases: [number, string][] = [
      [0, "VERY_LOW"],
      [20, "VERY_LOW"],
      [21, "LOW"],
      [40, "LOW"],
      [41, "MEDIUM"],
      [60, "MEDIUM"],
      [61, "HIGH"],
      [80, "HIGH"],
      [81, "VERY_HIGH"],
      [100, "VERY_HIGH"],
    ];

    it.each(cases)("score %i should map to %s", async (score, expectedLevel) => {
      mockEstablishmentClient.listOpenEstablishments.mockResolvedValue([
        makeEstablishment({ id: "estab-1", googlePlaceId: "gplace-1" }),
      ]);
      mockSerpApiService.getPlacePopularity.mockResolvedValue(
        makePopularityResult({ liveBusynessScore: score })
      );

      await service.updateMovementLevelsFromSavedEstablishments();

      expect(mockPrisma.currentPopularity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ level: expectedLevel }),
        })
      );
    });
  });
});
