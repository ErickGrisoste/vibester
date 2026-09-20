import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GooglePlacesService } from "../google-places.service";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { googleKey: "test-google-key" as string | undefined },
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

function makeGooglePlace(overrides: {
  place_id?: string;
  name?: string;
  types?: string[];
  rating?: number;
  lat?: number;
  lng?: number;
} = {}) {
  return {
    place_id: "place-id-1",
    name: "Test Bar",
    types: ["bar", "point_of_interest"],
    rating: 4.2,
    geometry: {
      location: {
        lat: overrides.lat ?? -23.55,
        lng: overrides.lng ?? -46.63,
      },
    },
    ...overrides,
  };
}

function makeGooglePlacesResponse(overrides: {
  status?: string;
  error_message?: string;
  results?: ReturnType<typeof makeGooglePlace>[];
  next_page_token?: string;
} = {}) {
  return {
    status: "OK",
    results: [],
    ...overrides,
  };
}

describe("GooglePlacesService", () => {
  let service: GooglePlacesService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new GooglePlacesService();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockEnv.googleKey = "test-google-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("searchNearbyPlaces", () => {
    it("should return combined results from all types", async () => {
      const barPlace = makeGooglePlace({ place_id: "bar-1", name: "Bar A", types: ["bar"] });
      const restaurantPlace = makeGooglePlace({ place_id: "rest-1", name: "Restaurant B", types: ["restaurant"] });

      fetchMock
        .mockResolvedValueOnce(makeFetchResponse(makeGooglePlacesResponse({ results: [barPlace] })))
        .mockResolvedValueOnce(makeFetchResponse(makeGooglePlacesResponse({ results: [restaurantPlace] })));

      const result = await service.searchNearbyPlaces(["bar", "restaurant"], -23.55, -46.63, 1000);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.placeId)).toEqual(["bar-1", "rest-1"]);
    });

    it("should deduplicate places with the same placeId across types", async () => {
      const place = makeGooglePlace({ place_id: "dup-1", types: ["bar", "restaurant"] });

      fetchMock
        .mockResolvedValueOnce(makeFetchResponse(makeGooglePlacesResponse({ results: [place] })))
        .mockResolvedValueOnce(makeFetchResponse(makeGooglePlacesResponse({ results: [place] })));

      const result = await service.searchNearbyPlaces(["bar", "restaurant"], -23.55, -46.63, 1000);

      expect(result).toHaveLength(1);
      expect(result[0].placeId).toBe("dup-1");
    });

    it("should return empty array when all types return ZERO_RESULTS", async () => {
      fetchMock.mockResolvedValue(
        makeFetchResponse(makeGooglePlacesResponse({ status: "ZERO_RESULTS" }))
      );

      const result = await service.searchNearbyPlaces(["bar"], -23.55, -46.63, 1000);

      expect(result).toEqual([]);
    });
  });

  describe("searchNearbyPlacesByType", () => {
    it("should throw when GOOGLE_API_KEY is not configured", async () => {
      mockEnv.googleKey = undefined;

      await expect(
        service.searchNearbyPlaces(["bar"], -23.55, -46.63, 1000)
      ).rejects.toThrow("GOOGLE_API_KEY não configurada");
    });

    it("should throw when fetch returns a non-ok response", async () => {
      fetchMock.mockResolvedValue(makeFetchResponse(null, false, 403));

      await expect(
        service.searchNearbyPlaces(["bar"], -23.55, -46.63, 1000)
      ).rejects.toThrow("Erro HTTP Google Places: 403");
    });

    it("should return empty array when status is ZERO_RESULTS", async () => {
      fetchMock.mockResolvedValue(
        makeFetchResponse(makeGooglePlacesResponse({ status: "ZERO_RESULTS" }))
      );

      const result = await service.searchNearbyPlaces(["bar"], -23.55, -46.63, 1000);

      expect(result).toEqual([]);
    });

    it("should throw when status is not OK or ZERO_RESULTS (e.g. REQUEST_DENIED, INVALID_REQUEST)", async () => {
      fetchMock.mockResolvedValue(
        makeFetchResponse(
          makeGooglePlacesResponse({
            status: "REQUEST_DENIED",
            error_message: "You must enable Billing on the Google Cloud Project",
          })
        )
      );

      await expect(
        service.searchNearbyPlaces(["bar"], -23.55, -46.63, 1000)
      ).rejects.toThrow(
        "Erro Google Places API: REQUEST_DENIED - You must enable Billing on the Google Cloud Project"
      );
    });

    it("should include places with valid types", async () => {
      const validTypes = ["bar", "night_club", "restaurant", "cafe"];

      for (const type of validTypes) {
        const place = makeGooglePlace({ place_id: type, types: [type, "point_of_interest"] });
        fetchMock.mockResolvedValueOnce(
          makeFetchResponse(makeGooglePlacesResponse({ results: [place] }))
        );

        const result = await service.searchNearbyPlaces([type], -23.55, -46.63, 1000);
        expect(result).toHaveLength(1);
      }
    });

    it("should exclude places with no valid types", async () => {
      const place = makeGooglePlace({ place_id: "gym-1", types: ["gym", "point_of_interest"] });
      fetchMock.mockResolvedValue(
        makeFetchResponse(makeGooglePlacesResponse({ results: [place] }))
      );

      const result = await service.searchNearbyPlaces(["bar"], -23.55, -46.63, 1000);

      expect(result).toEqual([]);
    });

    it("should exclude places that have both valid and invalid types", async () => {
      const place = makeGooglePlace({
        place_id: "spa-bar-1",
        types: ["bar", "spa"],
      });
      fetchMock.mockResolvedValue(
        makeFetchResponse(makeGooglePlacesResponse({ results: [place] }))
      );

      const result = await service.searchNearbyPlaces(["bar"], -23.55, -46.63, 1000);

      expect(result).toEqual([]);
    });

    it("should exclude places with only invalid types", async () => {
      const invalidTypes = ["hair_care", "beauty_salon", "spa", "doctor", "health", "car_wash", "lodging", "barber_shop"];

      for (const type of invalidTypes) {
        const place = makeGooglePlace({ place_id: type, types: [type] });
        fetchMock.mockResolvedValueOnce(
          makeFetchResponse(makeGooglePlacesResponse({ results: [place] }))
        );

        const result = await service.searchNearbyPlaces(["bar"], -23.55, -46.63, 1000);
        expect(result).toEqual([]);
      }
    });

    it("should map place fields correctly", async () => {
      const place = makeGooglePlace({
        place_id: "map-test-1",
        name: "Cool Bar",
        types: ["bar"],
        rating: 4.7,
        lat: -23.0,
        lng: -46.0,
      });
      fetchMock.mockResolvedValue(
        makeFetchResponse(makeGooglePlacesResponse({ results: [place] }))
      );

      const result = await service.searchNearbyPlaces(["bar"], -23.0, -46.0, 500);

      expect(result[0]).toEqual({
        placeId: "map-test-1",
        name: "Cool Bar",
        lat: -23.0,
        lng: -46.0,
        rating: 4.7,
      });
    });
  });
});
