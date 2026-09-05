import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Os testes de integração reais rodam contra o Postgres de verdade — apenas os
// pontos de saída (scraping externo e Kafka) permanecem mockados, do mesmo jeito
// que o user-service mocka o producer Kafka em profile.real.spec.ts.
const {
  mockGetPopularity,
  mockSearchNearby,
  mockListOpenEstablishments,
  mockKafkaSend,
  mockKafkaConnect,
  mockKafkaDisconnect,
} = vi.hoisted(() => ({
  mockGetPopularity: vi.fn(),
  mockSearchNearby: vi.fn(),
  mockListOpenEstablishments: vi.fn(),
  mockKafkaSend: vi.fn(),
  mockKafkaConnect: vi.fn(),
  mockKafkaDisconnect: vi.fn(),
}));

// SerpAPI e Google Places são as chamadas de scraping/HTTP externo — nunca devem
// bater na rede real durante os testes, mesmo os "reais" (que só validam Postgres).
vi.mock("../../src/services/serpapi.service", () => ({
  SerpApiService: vi.fn(function (this: any) {
    this.getPlacePopularity = mockGetPopularity;
  }),
}));

vi.mock("../../src/services/google-places.service", () => ({
  GooglePlacesService: vi.fn(function (this: any) {
    this.searchNearbyPlaces = mockSearchNearby;
  }),
}));

// Cliente HTTP para o establishment-service — também é uma chamada externa.
vi.mock("../../src/clients/establishment.client", () => ({
  EstablishmentClient: vi.fn(function (this: any) {
    this.listOpenEstablishments = mockListOpenEstablishments;
  }),
}));

// Kafka é um efeito colateral de saída — mantemos mockado nos testes de integração,
// igual ao padrão do user-service.
vi.mock("../../src/kafka/producer", () => ({
  kafkaProducer: {
    connect: mockKafkaConnect,
    disconnect: mockKafkaDisconnect,
    send: mockKafkaSend,
  },
}));

import { prisma } from "../../src/prisma/index";
import { MovementService } from "../../src/services/movement.service";
import { buildServer, signTestToken } from "../helpers/fastify.test.helper";

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

const ESTAB_ID_1 = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ESTAB_ID_2 = "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const ESTAB_ID_3 = "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

describe("scrapping-service — Integração real (Postgres)", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let token: string;

  beforeAll(async () => {
    app = await buildServer();
    token = signTestToken(app);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.popularTimesDaily.deleteMany();
    await prisma.currentPopularity.deleteMany();

    vi.resetAllMocks();
    mockGetPopularity.mockResolvedValue(null);
    mockSearchNearby.mockResolvedValue([]);
    mockListOpenEstablishments.mockResolvedValue([]);
    mockKafkaSend.mockResolvedValue({});
    mockKafkaConnect.mockResolvedValue(undefined);
    mockKafkaDisconnect.mockResolvedValue(undefined);
  });

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  describe("GET /health", () => {
    it("retorna 200 ok consultando o Postgres real", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveProperty("status", "ok");
    });
  });

  describe("GET /places/:placeId/popularity", () => {
    it("retorna 401 sem token", async () => {
      const res = await app.inject({ method: "GET", url: "/places/ChIJplace123/popularity" });
      expect(res.statusCode).toBe(401);
    });

    it("retorna popularidade quando a SerpAPI (mockada) responde com dados", async () => {
      const popularityData = {
        currentDay: "friday",
        currentDayInt: 5,
        liveStatus: "Cheio agora",
        liveBusynessScore: 85,
        timeSpent: "2 horas",
        hoursData: [
          { hour: 22, busyness_score: 80, live_busyness_score: 85, is_current: true, status_text: "Cheio" },
        ],
        category: "bar",
      };
      mockGetPopularity.mockResolvedValue(popularityData);

      const res = await app.inject({
        method: "GET",
        url: "/places/ChIJplace123/popularity",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty("currentDay", "friday");
      expect(body).toHaveProperty("liveBusynessScore", 85);
    });

    it("retorna 404 quando a popularidade não está disponível", async () => {
      mockGetPopularity.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/places/ChIJplace123/popularity",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });

    it("retorna 500 quando a SerpAPI lança exceção", async () => {
      mockGetPopularity.mockRejectedValue(new Error("SerpAPI unavailable"));

      const res = await app.inject({
        method: "GET",
        url: "/places/ChIJplace123/popularity",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe("GET /movements/:establishmentId", () => {
    it("retorna 401 sem token", async () => {
      const res = await app.inject({ method: "GET", url: `/movements/${ESTAB_ID_1}` });
      expect(res.statusCode).toBe(401);
    });

    it("retorna 404 quando não há registro de movimento no banco", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/movements/${ESTAB_ID_1}`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });

    it("retorna 200 com dados persistidos de verdade no Postgres", async () => {
      await prisma.currentPopularity.create({
        data: {
          establishmentId: ESTAB_ID_2,
          googlePlaceId: "ChIJplace123",
          level: "HIGH",
          source: "SERPAPI",
          score: 75,
          statusText: "Muito movimentado",
          timeSpent: "1h30m",
          isEstimated: false,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/movements/${ESTAB_ID_2}`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty("establishmentId", ESTAB_ID_2);
      expect(body).toHaveProperty("level", "HIGH");
      expect(body).toHaveProperty("score", 75);
    });
  });

  describe("GET /places/nearby", () => {
    it("retorna 401 sem token", async () => {
      const res = await app.inject({ method: "GET", url: "/places/nearby" });
      expect(res.statusCode).toBe(401);
    });

    it("retorna lista de lugares próximos vinda do Google Places (mockado)", async () => {
      const places = [
        { placeId: "ChIJplace1", name: "Bar do João", lat: -23.42, lng: -51.93, rating: 4.5 },
        { placeId: "ChIJplace2", name: "Clube Night XYZ", lat: -23.43, lng: -51.94, rating: 4.2 },
      ];
      mockSearchNearby.mockResolvedValue(places);

      const res = await app.inject({
        method: "GET",
        url: "/places/nearby?lat=-23.4205&lng=-51.9333&radius=1000&types=bar",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty("name", "Bar do João");
    });

    it("retorna 500 quando a API do Google Places falha", async () => {
      mockSearchNearby.mockRejectedValue(new Error("Google API error"));

      const res = await app.inject({
        method: "GET",
        url: "/places/nearby",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe("MovementService — persistência real (Postgres) + Kafka mockado", () => {
    it("salva CurrentPopularity e PopularTimesDaily reais e publica evento no Kafka", async () => {
      mockListOpenEstablishments.mockResolvedValue([
        {
          id: ESTAB_ID_1,
          googlePlaceId: "ChIJplace123",
          name: "Bar do João",
          latitude: -23.42,
          longitude: -51.93,
        },
      ]);
      mockGetPopularity.mockResolvedValue({
        currentDay: "friday",
        currentDayInt: 5,
        liveStatus: "Cheio agora",
        liveBusynessScore: 85,
        timeSpent: "2 horas",
        hoursData: [
          { hour: 20, busyness_score: 60, live_busyness_score: null, is_current: false, status_text: "Moderado" },
          { hour: 22, busyness_score: 80, live_busyness_score: 85, is_current: true, status_text: "Cheio" },
        ],
        category: "bar",
      });

      const service = new MovementService(undefined, undefined, silentLogger);
      await service.updateMovementLevelsFromSavedEstablishments();

      const currentPopularity = await prisma.currentPopularity.findUnique({
        where: { establishmentId: ESTAB_ID_1 },
      });
      expect(currentPopularity).not.toBeNull();
      expect(currentPopularity?.level).toBe("VERY_HIGH");
      expect(currentPopularity?.score).toBe(85);
      expect(currentPopularity?.source).toBe("SERPAPI");
      expect(currentPopularity?.isEstimated).toBe(false);

      const popularTimes = await prisma.popularTimesDaily.findMany({
        where: { establishmentId: ESTAB_ID_1 },
        orderBy: { hour: "asc" },
      });
      expect(popularTimes).toHaveLength(2);
      expect(popularTimes[0]).toMatchObject({ hour: 20, busynessScore: 60, isCurrent: false });
      expect(popularTimes[1]).toMatchObject({ hour: 22, busynessScore: 80, isCurrent: true });

      expect(mockKafkaSend).toHaveBeenCalledTimes(1);
      const sentRecord = mockKafkaSend.mock.calls[0][0];
      expect(sentRecord.topic).toBe("establishments");
      const message = JSON.parse(sentRecord.messages[0].value);
      expect(message.eventType).toBe("establishment.movement.updated");
      expect(message.data.establishmentId).toBe(ESTAB_ID_1);
      expect(message.data.level).toBe("VERY_HIGH");
    });

    it("marca como UNAVAILABLE e mantém isEstimated=false quando não há dados ao vivo nem histórico", async () => {
      mockListOpenEstablishments.mockResolvedValue([
        {
          id: ESTAB_ID_2,
          googlePlaceId: "ChIJplace456",
          name: "Restaurante Fechado",
          latitude: -23.42,
          longitude: -51.93,
        },
      ]);
      mockGetPopularity.mockResolvedValue({
        currentDay: null,
        currentDayInt: null,
        liveStatus: "Fechado agora",
        liveBusynessScore: null,
        timeSpent: null,
        hoursData: [],
        category: null,
      });

      const service = new MovementService(undefined, undefined, silentLogger);
      await service.updateMovementLevelsFromSavedEstablishments();

      const currentPopularity = await prisma.currentPopularity.findUnique({
        where: { establishmentId: ESTAB_ID_2 },
      });
      expect(currentPopularity).not.toBeNull();
      expect(currentPopularity?.level).toBe("UNAVAILABLE");
      expect(currentPopularity?.score).toBeNull();
      expect(currentPopularity?.isEstimated).toBe(false);
      expect(currentPopularity?.statusText).toBe("Fechado agora");

      const popularTimes = await prisma.popularTimesDaily.findMany({
        where: { establishmentId: ESTAB_ID_2 },
      });
      expect(popularTimes).toHaveLength(0);
      expect(mockKafkaSend).toHaveBeenCalledTimes(1);
    });

    it("pula estabelecimentos sem googlePlaceId sem persistir nem publicar no Kafka", async () => {
      mockListOpenEstablishments.mockResolvedValue([
        {
          id: ESTAB_ID_3,
          googlePlaceId: null,
          name: "Sem Place ID",
          latitude: -23.42,
          longitude: -51.93,
        },
      ]);

      const service = new MovementService(undefined, undefined, silentLogger);
      await service.updateMovementLevelsFromSavedEstablishments();

      const currentPopularity = await prisma.currentPopularity.findUnique({
        where: { establishmentId: ESTAB_ID_3 },
      });
      expect(currentPopularity).toBeNull();
      expect(mockGetPopularity).not.toHaveBeenCalled();
      expect(mockKafkaSend).not.toHaveBeenCalled();
    });

    it("remove registros de PopularTimesDaily com mais de 7 dias ao iniciar a atualização", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      oldDate.setHours(0, 0, 0, 0);

      const recentDate = new Date();
      recentDate.setHours(0, 0, 0, 0);

      await prisma.popularTimesDaily.createMany({
        data: [
          {
            establishmentId: ESTAB_ID_1,
            googlePlaceId: "ChIJplace123",
            capturedDate: oldDate,
            dayOfWeek: 1,
            hour: 10,
            busynessScore: 50,
          },
          {
            establishmentId: ESTAB_ID_1,
            googlePlaceId: "ChIJplace123",
            capturedDate: recentDate,
            dayOfWeek: 1,
            hour: 10,
            busynessScore: 60,
          },
        ],
      });

      mockListOpenEstablishments.mockResolvedValue([]);

      const service = new MovementService(undefined, undefined, silentLogger);
      await service.updateMovementLevelsFromSavedEstablishments();

      const remaining = await prisma.popularTimesDaily.findMany({
        where: { establishmentId: ESTAB_ID_1 },
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].capturedDate.getTime()).toBe(recentDate.getTime());
    });
  });
});
