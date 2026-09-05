import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// R2 (Cloudflare) é uma API de terceiros — nunca deve ser chamada de verdade nos testes.
// Mockamos no mesmo limite usado pelo teste unitário de UploadService: o client S3 (r2Client)
// e a lib de upload (@aws-sdk/lib-storage), mantendo o restante do fluxo (Prisma real) intacto.
const { mockUploadDone, mockUploadCtor } = vi.hoisted(() => ({
  mockUploadDone: vi.fn().mockResolvedValue(undefined),
  mockUploadCtor: vi.fn(),
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    constructor(params: unknown) {
      mockUploadCtor(params);
    }
    done() {
      return mockUploadDone();
    }
  },
}));

vi.mock("../../src/config/r2", () => ({ r2Client: {} }));

// Nota: este serviço não possui producer Kafka (apenas um consumer que só é iniciado fora
// de NODE_ENV=test, em src/server.ts) — o helper de teste (tests/helpers/fastify.test.helper.ts)
// nem registra o consumer, então não há efeito colateral de Kafka a mockar aqui.

import prismaClient from "../../src/prisma/index";
import { redis } from "../../src/config/redis";
import { buildServer } from "../helpers/fastify.test.helper";

const ESTAB_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const OTHER_ID = "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

function establishmentData(overrides: Record<string, unknown> = {}) {
  return {
    id: ESTAB_ID,
    googlePlaceId: "ChIJ123",
    name: "Bar do Zé",
    endereco: "Rua Test, 123",
    photoUrl: "https://example.com/photo.jpg",
    bannerUrl: "https://example.com/banner.jpg",
    category: "bar",
    priceIndicator: "$$",
    averageRating: 4.5,
    qtdAvaliacoes: 10,
    distribuicao: [0, 0, 1, 4, 5],
    nivelMovimento: 3,
    latitude: -23.5,
    longitude: -46.6,
    ...overrides,
  };
}

describe("establishment-service — HTTP Integration (Postgres + Redis reais)", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let authToken: string;

  beforeAll(async () => {
    await redis.connect().catch(() => {});
    app = await buildServer();
    authToken = app.jwt.sign({ sub: "integration-test-service" });
  });

  afterAll(async () => {
    await app.close();
    await prismaClient.$disconnect();
    redis.disconnect();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUploadDone.mockResolvedValue(undefined);
    // FK-safe order: opening hours referenciam establishment.
    await prismaClient.establishmentOpeningHour.deleteMany();
    await prismaClient.establishment.deleteMany();
    await redis.flushall();
  });

  describe("GET /health", () => {
    it("retorna 200 ok (liveness)", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ status: "ok" });
    });
  });

  describe("GET /establishments", () => {
    it("retorna lista paginada persistida no banco", async () => {
      await prismaClient.establishment.create({ data: establishmentData() });

      const res = await app.inject({ method: "GET", url: "/establishments" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ id: ESTAB_ID, name: "Bar do Zé" });
      expect(body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
    });

    it("filtra por categoria consultando o banco real", async () => {
      await prismaClient.establishment.create({ data: establishmentData() });
      await prismaClient.establishment.create(
        { data: establishmentData({ id: OTHER_ID, googlePlaceId: "ChIJ456", name: "Balada X", category: "night_club" }) }
      );

      const res = await app.inject({ method: "GET", url: "/establishments?category=bar" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(ESTAB_ID);
    });

    it("filtra por minRating", async () => {
      await prismaClient.establishment.create({ data: establishmentData({ averageRating: 3.0 }) });

      const res = await app.inject({ method: "GET", url: "/establishments?minRating=4.0" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).data).toHaveLength(0);
    });

    it("ordena por distância usando bounding box quando coordenadas são fornecidas", async () => {
      await prismaClient.establishment.create({
        data: establishmentData({ latitude: -23.5, longitude: -46.6, name: "Perto" }),
      });
      await prismaClient.establishment.create({
        data: establishmentData({
          id: OTHER_ID,
          googlePlaceId: "ChIJ456",
          latitude: -23.9,
          longitude: -46.9,
          name: "Longe",
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/establishments?latitude=-23.5&longitude=-46.6",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data[0].name).toBe("Perto");
    });

    it("aplica paginação corretamente contra o banco real", async () => {
      for (let i = 0; i < 3; i++) {
        await prismaClient.establishment.create({
          data: establishmentData({
            id: `c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d${i}`,
            googlePlaceId: `ChIJpage${i}`,
            name: `Estabelecimento ${i}`,
          }),
        });
      }

      const res = await app.inject({ method: "GET", url: "/establishments?page=2&limit=2" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
      expect(body.data).toHaveLength(1);
    });

    it("retorna 400 se apenas latitude fornecida sem longitude", async () => {
      const res = await app.inject({ method: "GET", url: "/establishments?latitude=-23.5" });
      expect(res.statusCode).toBe(400);
    });

    it("retorna 400 para limit inválido", async () => {
      const res = await app.inject({ method: "GET", url: "/establishments?limit=200" });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /establishments/open — Redis cache real", () => {
    it("cache miss chama DB; cache hit não bate no banco novamente", async () => {
      await prismaClient.establishment.create({
        data: {
          ...establishmentData(),
          openingHours: { create: [{ dayOfWeek: 0, openTime: "00:00", closeTime: "23:59" }] },
        },
      });

      const first = await app.inject({ method: "GET", url: "/establishments/open" });
      expect(first.statusCode).toBe(200);
      const firstBody = JSON.parse(first.payload);

      // Muda o horário direto no banco sem invalidar o cache — a segunda leitura deve
      // continuar batendo no valor cacheado (prova que a 2ª chamada não foi ao banco).
      await prismaClient.establishmentOpeningHour.updateMany({
        where: {},
        data: { openTime: "10:00", closeTime: "11:00" },
      });

      const second = await app.inject({ method: "GET", url: "/establishments/open" });
      expect(second.statusCode).toBe(200);
      expect(JSON.parse(second.payload)).toEqual(firstBody);
    });

    it("retorna vazio quando não há estabelecimento aberto no banco", async () => {
      const res = await app.inject({ method: "GET", url: "/establishments/open" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual([]);
    });
  });

  describe("GET /establishments/:id — Redis cache real", () => {
    it("cache miss lê do Postgres; cache hit retorna o valor cacheado mesmo após alteração no banco", async () => {
      await prismaClient.establishment.create({ data: establishmentData() });

      const first = await app.inject({ method: "GET", url: `/establishments/${ESTAB_ID}` });
      expect(first.statusCode).toBe(200);
      expect(JSON.parse(first.payload).name).toBe("Bar do Zé");

      await prismaClient.establishment.update({
        where: { id: ESTAB_ID },
        data: { name: "Nome alterado direto no banco" },
      });

      const second = await app.inject({ method: "GET", url: `/establishments/${ESTAB_ID}` });
      expect(second.statusCode).toBe(200);
      expect(JSON.parse(second.payload).name).toBe("Bar do Zé");
    });

    it("retorna 404 quando estabelecimento não existe no banco", async () => {
      const res = await app.inject({ method: "GET", url: `/establishments/${ESTAB_ID}` });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /establishments/:id/rating", () => {
    it("requer autenticação JWT — retorna 401 sem token", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/establishments/${ESTAB_ID}/rating`,
        payload: { rating: 4.0 },
      });
      expect(res.statusCode).toBe(401);
    });

    it("atualiza rating no banco e invalida o cache Redis", async () => {
      await prismaClient.establishment.create({ data: establishmentData() });

      // Prime cache
      await app.inject({ method: "GET", url: `/establishments/${ESTAB_ID}` });

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/establishments/${ESTAB_ID}/rating`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { rating: 3.0 },
      });
      expect(patchRes.statusCode).toBe(200);
      expect(JSON.parse(patchRes.payload).averageRating).toBe(3.0);

      const row = await prismaClient.establishment.findUnique({ where: { id: ESTAB_ID } });
      expect(row?.averageRating).toBe(3.0);
      expect(row?.qtdAvaliacoes).toBe(11);

      // Cache foi invalidado — próximo GET deve refletir o novo rating direto do banco.
      const getRes = await app.inject({ method: "GET", url: `/establishments/${ESTAB_ID}` });
      expect(JSON.parse(getRes.payload).averageRating).toBe(3.0);
    });

    it("retorna 400 quando rating inválido", async () => {
      await prismaClient.establishment.create({ data: establishmentData() });

      const res = await app.inject({
        method: "PATCH",
        url: `/establishments/${ESTAB_ID}/rating`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { rating: 6 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("retorna 404 quando estabelecimento não existe no banco", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/establishments/${ESTAB_ID}/rating`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { rating: 4.0 },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /establishments/:id/movement", () => {
    it("atualiza nivelMovimento no banco e invalida o cache do perfil", async () => {
      await prismaClient.establishment.create({ data: establishmentData({ nivelMovimento: 0 }) });

      await app.inject({ method: "GET", url: `/establishments/${ESTAB_ID}` });

      const res = await app.inject({
        method: "PATCH",
        url: `/establishments/${ESTAB_ID}/movement`,
        payload: { level: "HIGH", source: "SERPAPI" },
      });
      expect(res.statusCode).toBe(204);

      const row = await prismaClient.establishment.findUnique({ where: { id: ESTAB_ID } });
      expect(row?.nivelMovimento).toBe(4);

      const getRes = await app.inject({ method: "GET", url: `/establishments/${ESTAB_ID}` });
      expect(JSON.parse(getRes.payload).nivelMovimento).toBe(4);
    });

    it("retorna 404 quando estabelecimento não existe", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/establishments/${ESTAB_ID}/movement`,
        payload: { level: "HIGH" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /establishments/:id/photo — Prisma real, R2 mockado", () => {
    it("faz upload (R2 mockado) e persiste photoUrl no Postgres real", async () => {
      await prismaClient.establishment.create({ data: establishmentData({ photoUrl: null }) });

      const form = new FormData();
      form.append(
        "file",
        new File([Buffer.from("fake-image-bytes")], "photo.png", { type: "image/png" })
      );

      const res = await app.inject({ method: "POST", url: `/establishments/${ESTAB_ID}/photo`, payload: form });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.photoUrl).toMatch(/^https:\/\/test\.r2\.dev\/establishments\//);
      expect(mockUploadCtor).toHaveBeenCalledTimes(1);
      expect(mockUploadDone).toHaveBeenCalledTimes(1);

      const row = await prismaClient.establishment.findUnique({ where: { id: ESTAB_ID } });
      expect(row?.photoUrl).toBe(body.photoUrl);
    });

    it("retorna 400 para mimetype não permitido, sem chamar o R2", async () => {
      await prismaClient.establishment.create({ data: establishmentData() });

      const form = new FormData();
      form.append(
        "file",
        new File([Buffer.from("not-an-image")], "file.txt", { type: "text/plain" })
      );

      const res = await app.inject({ method: "POST", url: `/establishments/${ESTAB_ID}/photo`, payload: form });

      expect(res.statusCode).toBe(400);
      expect(mockUploadCtor).not.toHaveBeenCalled();
    });
  });
});
