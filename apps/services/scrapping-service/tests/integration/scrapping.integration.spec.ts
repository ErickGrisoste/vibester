import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const { mockGetPopularity, mockGetMovement, mockSearchNearby, mockSearchNearbySerpApi } = vi.hoisted(() => ({
  mockGetPopularity: vi.fn(),
  mockGetMovement: vi.fn(),
  mockSearchNearby: vi.fn(),
  mockSearchNearbySerpApi: vi.fn(),
}));

vi.mock('../../src/services/serpapi.service', () => ({
  SerpApiService: vi.fn(function(this: any) {
    this.getPlacePopularity = mockGetPopularity;
    this.searchNearbyPlaces = mockSearchNearbySerpApi;
  }),
}));

vi.mock('../../src/services/movement.service', () => ({
  MovementService: vi.fn(function(this: any) {
    this.getMovementByEstablishmentId = mockGetMovement;
    this.updateMovementLevelsFromSavedEstablishments = vi.fn();
  }),
}));

vi.mock('../../src/services/google-places.service', () => ({
  GooglePlacesService: vi.fn(function(this: any) {
    this.searchNearbyPlaces = mockSearchNearby;
  }),
}));

vi.mock('../../src/prisma/index', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([]),
    currentPopularity: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { buildServer, signTestToken } from '../helpers/fastify.test.helper';

const ESTAB_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

describe('scrapping-service — HTTP Integration', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let token: string;

  beforeAll(async () => {
    app = await buildServer();
    token = signTestToken(app);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPopularity.mockResolvedValue(undefined);
    mockGetMovement.mockResolvedValue(null);
    mockSearchNearby.mockResolvedValue([]);
    mockSearchNearbySerpApi.mockResolvedValue([]);
  });

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  describe('GET /health', () => {
    it('retorna 200 ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveProperty('status', 'ok');
    });

    it('retorna 503 quando banco está inacessível', async () => {
      const { prisma } = await import('../../src/prisma/index');
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('connection refused'));

      const res = await app.inject({ method: 'GET', url: '/health' });

      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toHaveProperty('status', 'error');
    });
  });

  describe('GET /places/:placeId/popularity', () => {
    it('retorna 401 sem token', async () => {
      const res = await app.inject({ method: 'GET', url: '/places/ChIJplace123/popularity' });
      expect(res.statusCode).toBe(401);
    });

    it('retorna popularidade quando SerpAPI responde com dados', async () => {
      const popularityData = {
        currentDay: 'friday',
        currentDayInt: 5,
        liveStatus: 'Cheio agora',
        liveBusynessScore: 85,
        timeSpent: '2 horas',
        hoursData: [{ hour: 22, busyness_score: 80, live_busyness_score: 85, is_current: true, status_text: 'Cheio' }],
      };
      mockGetPopularity.mockResolvedValue(popularityData);

      const res = await app.inject({
        method: 'GET',
        url: '/places/ChIJplace123/popularity',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('currentDay', 'friday');
      expect(body).toHaveProperty('liveBusynessScore', 85);
    });

    it('retorna 404 quando popularidade não está disponível', async () => {
      mockGetPopularity.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/places/ChIJplace123/popularity',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });

    it('retorna 500 quando SerpAPI lança exceção', async () => {
      mockGetPopularity.mockRejectedValue(new Error('SerpAPI unavailable'));

      const res = await app.inject({
        method: 'GET',
        url: '/places/ChIJplace123/popularity',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(500);
    });
  });

  describe('GET /movements/:establishmentId', () => {
    it('retorna 401 sem token', async () => {
      const res = await app.inject({ method: 'GET', url: `/movements/${ESTAB_ID}` });
      expect(res.statusCode).toBe(401);
    });

    it('retorna nível de movimento do estabelecimento', async () => {
      const movementData = {
        id: 1,
        establishmentId: ESTAB_ID,
        googlePlaceId: 'ChIJplace123',
        level: 'HIGH',
        score: 75,
        statusText: 'Muito movimentado',
        timeSpent: '1h30m',
        source: 'SERPAPI',
        isEstimated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetMovement.mockResolvedValue(movementData);

      const res = await app.inject({
        method: 'GET',
        url: `/movements/${ESTAB_ID}`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('level', 'HIGH');
      expect(mockGetMovement).toHaveBeenCalledWith(ESTAB_ID);
    });

    it('retorna 404 quando estabelecimento não tem dados de movimento', async () => {
      mockGetMovement.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/movements/${ESTAB_ID}`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /places/nearby', () => {
    it('retorna 401 sem token', async () => {
      const res = await app.inject({ method: 'GET', url: '/places/nearby' });
      expect(res.statusCode).toBe(401);
    });

    it('retorna lista de lugares próximos via SerpAPI (fonte principal)', async () => {
      const places = [
        { placeId: 'ChIJplace1', name: 'Bar do João', lat: -23.42, lng: -51.93, rating: 4.5 },
        { placeId: 'ChIJplace2', name: 'Clube Night XYZ', lat: -23.43, lng: -51.94, rating: 4.2 },
      ];
      mockSearchNearbySerpApi.mockResolvedValue(places);

      const res = await app.inject({
        method: 'GET',
        url: '/places/nearby?lat=-23.4205&lng=-51.9333&radius=1000&types=bar',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty('name', 'Bar do João');
      expect(mockSearchNearby).not.toHaveBeenCalled();
    });

    it('retorna lista vazia quando não há lugares no raio', async () => {
      mockSearchNearbySerpApi.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/places/nearby',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(0);
    });

    it('cai para o Google Places quando a SerpAPI falha (fallback)', async () => {
      const places = [
        { placeId: 'ChIJplace1', name: 'Bar do João', lat: -23.42, lng: -51.93, rating: 4.5 },
      ];
      mockSearchNearbySerpApi.mockRejectedValue(new Error('SerpAPI indisponível'));
      mockSearchNearby.mockResolvedValue(places);

      const res = await app.inject({
        method: 'GET',
        url: '/places/nearby',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveLength(1);
      expect(body[0]).toHaveProperty('name', 'Bar do João');
      expect(mockSearchNearby).toHaveBeenCalledTimes(1);
    });

    it('retorna 500 quando SerpAPI e Google Places falham', async () => {
      mockSearchNearbySerpApi.mockRejectedValue(new Error('SerpAPI indisponível'));
      mockSearchNearby.mockRejectedValue(new Error('Google API error'));

      const res = await app.inject({
        method: 'GET',
        url: '/places/nearby',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(500);
    });
  });
});
