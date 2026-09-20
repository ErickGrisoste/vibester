import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EstablishmentClient } from "../establishment.client";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { establishmentServiceUrl: "http://establishment-service.test" as string | undefined },
}));

vi.mock("../../config/env", () => ({
  env: mockEnv,
}));

function makeFetchResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

/** fetchWithTimeout sempre passa um segundo argumento ({ signal }), então
 * comparar só a URL evita acoplar o teste a esse detalhe de implementação. */
function calledUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function makeEstablishment(overrides: Record<string, unknown> = {}) {
  return {
    id: "est-1",
    googlePlaceId: "place-1",
    name: "Bar do Zé",
    latitude: -23.55,
    longitude: -46.63,
    ...overrides,
  };
}

describe("EstablishmentClient", () => {
  let client: EstablishmentClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEnv.establishmentServiceUrl = "http://establishment-service.test";
    client = new EstablishmentClient();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listOpenEstablishments", () => {
    it("throws when ESTABLISHMENT_SERVICE_URL is not configured", async () => {
      mockEnv.establishmentServiceUrl = undefined;
      const unconfiguredClient = new EstablishmentClient();

      await expect(unconfiguredClient.listOpenEstablishments()).rejects.toThrow(
        "ESTABLISHMENT_SERVICE_URL não configurada"
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when the response is not ok", async () => {
      fetchMock.mockResolvedValue(makeFetchResponse(null, false, 500));

      await expect(client.listOpenEstablishments()).rejects.toThrow(
        "Erro ao buscar estabelecimentos: 500"
      );
    });

    it("returns the parsed JSON list on success", async () => {
      const establishments = [makeEstablishment()];
      fetchMock.mockResolvedValue(makeFetchResponse(establishments));

      const result = await client.listOpenEstablishments();

      expect(result).toEqual(establishments);
      expect(calledUrls(fetchMock)).toEqual([
        "http://establishment-service.test/establishments/open",
      ]);
    });
  });

  describe("listAllEstablishments", () => {
    it("throws when ESTABLISHMENT_SERVICE_URL is not configured", async () => {
      mockEnv.establishmentServiceUrl = undefined;
      const unconfiguredClient = new EstablishmentClient();

      await expect(unconfiguredClient.listAllEstablishments()).rejects.toThrow(
        "ESTABLISHMENT_SERVICE_URL não configurada"
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when a page request is not ok", async () => {
      fetchMock.mockResolvedValue(makeFetchResponse(null, false, 500));

      await expect(client.listAllEstablishments()).rejects.toThrow(
        "Erro ao buscar estabelecimentos: 500"
      );
    });

    it("returns all establishments from a single page when totalPages is 1", async () => {
      const establishments = [makeEstablishment({ id: "est-1" }), makeEstablishment({ id: "est-2" })];
      fetchMock.mockResolvedValue(
        makeFetchResponse({ data: establishments, pagination: { totalPages: 1 } })
      );

      const result = await client.listAllEstablishments();

      expect(result).toEqual(establishments);
      expect(calledUrls(fetchMock)).toEqual([
        "http://establishment-service.test/establishments?page=1&limit=100",
      ]);
    });

    it("paginates across multiple pages and aggregates the results in order", async () => {
      const page1 = [makeEstablishment({ id: "est-1" })];
      const page2 = [makeEstablishment({ id: "est-2" })];
      const page3 = [makeEstablishment({ id: "est-3" })];

      fetchMock
        .mockResolvedValueOnce(makeFetchResponse({ data: page1, pagination: { totalPages: 3 } }))
        .mockResolvedValueOnce(makeFetchResponse({ data: page2, pagination: { totalPages: 3 } }))
        .mockResolvedValueOnce(makeFetchResponse({ data: page3, pagination: { totalPages: 3 } }));

      const result = await client.listAllEstablishments();

      expect(result).toEqual([...page1, ...page2, ...page3]);
      expect(calledUrls(fetchMock)).toEqual([
        "http://establishment-service.test/establishments?page=1&limit=100",
        "http://establishment-service.test/establishments?page=2&limit=100",
        "http://establishment-service.test/establishments?page=3&limit=100",
      ]);
    });

    it("returns an empty array when there are no establishments", async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ data: [], pagination: { totalPages: 1 } }));

      const result = await client.listAllEstablishments();

      expect(result).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("respects a custom pageSize in the query string", async () => {
      fetchMock.mockResolvedValue(
        makeFetchResponse({ data: [makeEstablishment()], pagination: { totalPages: 1 } })
      );

      await client.listAllEstablishments(25);

      expect(calledUrls(fetchMock)).toEqual([
        "http://establishment-service.test/establishments?page=1&limit=25",
      ]);
    });
  });
});
