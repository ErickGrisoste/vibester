import type {
  GooglePlacesResponse,
  GooglePlaceResult,
} from "../types/google-places.type";
import type { PlaceResult } from "../types/place.type";
import { env } from "../config/env";
import { fetchWithTimeout } from "../utils/retry";

const VALID_TYPES = new Set(["bar", "night_club", "restaurant", "cafe"]);

const INVALID_TYPES = new Set([
  "hair_care",
  "beauty_salon",
  "spa",
  "doctor",
  "health",
  "car_wash",
  "lodging",
  "barber_shop",
]);

export class GooglePlacesService {
  async searchNearbyPlaces(
    types: string[],
    lat: number,
    lng: number,
    radius: number
  ): Promise<PlaceResult[]> {
    const allPlaces: PlaceResult[] = [];
    const seenPlaceIds = new Set<string>();

    for (const type of types) {
      const places = await this.searchNearbyPlacesByType(type, lat, lng, radius);

      for (const place of places) {
        if (seenPlaceIds.has(place.placeId)) continue;
        seenPlaceIds.add(place.placeId);
        allPlaces.push(place);
      }
    }

    return allPlaces;
  }

  private async searchNearbyPlacesByType(
    type: string,
    lat: number,
    lng: number,
    radius: number
  ): Promise<PlaceResult[]> {
    const apiKey = env.googleKey;

    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY não configurada");
    }

    const places: PlaceResult[] = [];

    let url = this.buildNearbyUrl({ apiKey, type, lat, lng, radius });

    while (true) {
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`Erro HTTP Google Places: ${response.status}`);
      }

      const data = (await response.json()) as GooglePlacesResponse;

      if (data.status === "ZERO_RESULTS") return places;
      if (data.status !== "OK") {
        throw new Error(
          `Erro Google Places API: ${data.status}${data.error_message ? ` - ${data.error_message}` : ""}`
        );
      }

      for (const item of data.results ?? []) {
        if (!this.isValidPlace(item)) continue;

        places.push({
          placeId: item.place_id,
          name: item.name,
          lat: item.geometry.location.lat,
          lng: item.geometry.location.lng,
          rating: item.rating,
        });
      }

      if (!data.next_page_token) break;

      await this.sleep(2000);
      url = this.buildNextPageUrl({ apiKey, nextPageToken: data.next_page_token });
    }

    return places;
  }

  private buildNearbyUrl(params: {
    apiKey: string;
    type: string;
    lat: number;
    lng: number;
    radius: number;
  }): URL {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${params.lat},${params.lng}`);
    url.searchParams.set("radius", String(params.radius));
    url.searchParams.set("type", params.type);
    url.searchParams.set("key", params.apiKey);
    return url;
  }

  private buildNextPageUrl(params: { apiKey: string; nextPageToken: string }): URL {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("pagetoken", params.nextPageToken);
    url.searchParams.set("key", params.apiKey);
    return url;
  }

  private isValidPlace(place: GooglePlaceResult): boolean {
    const placeTypes = new Set(place.types ?? []);
    const hasValidType = [...placeTypes].some((type) => VALID_TYPES.has(type));
    const hasInvalidType = [...placeTypes].some((type) => INVALID_TYPES.has(type));
    return hasValidType && !hasInvalidType;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
