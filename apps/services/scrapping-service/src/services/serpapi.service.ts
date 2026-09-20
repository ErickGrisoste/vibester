import { z } from "zod";
import { env } from "../config/env";
import { fetchWithTimeout } from "../utils/retry";
import { TTLCache } from "../utils/cache";
import { consoleLogger } from "../utils/logger";
import type { PlaceResult } from "../types/place.type";
import {
  scrapingExternalApiLatencySeconds,
  cacheHitTotal,
  cacheMissTotal,
} from "../config/metrics";

const WEEK_DAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const CACHE_TTL_MS = 30 * 60 * 1000;

export type PopularityHourData = {
  hour: number;
  busyness_score: number;
  live_busyness_score: number | null;
  is_current: boolean;
  status_text: string;
};

export type PlacePopularityResult = {
  currentDay: string | null;
  currentDayInt: number | null;
  liveStatus: string | null;
  liveBusynessScore: number | null;
  timeSpent: string | null;
  hoursData: PopularityHourData[];
  category: string | null;
};

const SERPAPI_TYPE_TO_CATEGORY: Record<string, string> = {
  bar: "bar",
  "bar e grill": "bar",
  "bar e restaurante": "bar",
  pub: "bar",
  "pub irlandês": "bar",
  "bar esportivo": "bar",
  "night club": "night_club",
  "clube noturno": "night_club",
  "casa noturna": "night_club",
  boate: "night_club",
  balada: "night_club",
  restaurante: "restaurant",
  restaurant: "restaurant",
  petiscaria: "restaurant",
  café: "cafe",
  cafe: "cafe",
  cafeteria: "cafe",
  "coffee shop": "cafe",
  "espresso bar": "cafe",
  lanchonete: "cafe",
};

const serpApiGraphItemSchema = z.object({
  time: z.string().optional(),
  busyness_score: z.number().optional(),
  live_busyness_score: z.number().nullable().optional(),
  current: z.boolean().optional(),
  info: z.string().optional(),
});

const serpApiResponseSchema = z.object({
  place_results: z
    .object({
      type: z.union([z.string(), z.array(z.string())]).optional(),
      data_id: z.string().optional(),
      popular_times: z
        .object({
          current_day: z.string().optional(),
          live_hash: z
            .object({
              info: z.string().optional(),
              time_spent: z.string().optional(),
            })
            .optional(),
          graph_results: z.record(z.string(), z.array(serpApiGraphItemSchema)).optional(),
        })
        .optional(),
    })
    .optional(),
});

/** Id fixo da categoria "Ambiente" na taxonomia de fotos do Google Maps
 * (engine=google_maps_photos) — validado manualmente contra a SerpAPI em
 * dois estabelecimentos reais e distintos, com o mesmo id nos dois. Não é
 * específico por lugar, então não precisa ser descoberto dinamicamente via
 * `categories` a cada chamada. */
const AMBIENCE_CATEGORY_ID = "CgIYIg";

const serpApiPhotoSchema = z.object({
  thumbnail: z.string().optional(),
  image: z.string(),
});

const serpApiPhotosResponseSchema = z.object({
  photos: z.array(serpApiPhotoSchema).optional(),
});

const SEARCH_QUERY_BY_TYPE: Record<string, string> = {
  bar: "bar",
  night_club: "balada",
  restaurant: "restaurante",
  cafe: "café",
};

/** No máximo 3 páginas (~60 lugares) por tipo buscado — teto de custo/tempo para
 * uma busca de descoberta manual, não o job horário. */
const MAX_SEARCH_PAGES = 3;

const serpApiSearchResultSchema = z.object({
  place_id: z.string(),
  title: z.string(),
  gps_coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  rating: z.number().optional(),
});

const serpApiSearchResponseSchema = z.object({
  local_results: z.array(serpApiSearchResultSchema).optional(),
  serpapi_pagination: z
    .object({
      next: z.string().optional(),
    })
    .optional(),
});

/**
 * O `ll` da SerpAPI é um zoom de mapa (área visível), não um raio exato em
 * metros — essa conversão é uma aproximação deliberada, não uma equivalência
 * matemática ao "radius" do Google Places Nearby Search.
 */
function radiusToZoom(radiusMeters: number): number {
  if (radiusMeters <= 500) return 17;
  if (radiusMeters <= 1000) return 16;
  if (radiusMeters <= 2000) return 15;
  if (radiusMeters <= 5000) return 14;
  if (radiusMeters <= 10000) return 13;
  return 12;
}

function mapSerpApiTypeToCategory(type: string | string[] | undefined): string | null {
  if (!type) return null;
  const types = Array.isArray(type) ? type : [type];
  for (const t of types) {
    const mapped = SERPAPI_TYPE_TO_CATEGORY[t.toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}

export class SerpApiService {
  private cache = new TTLCache<string, PlacePopularityResult | null>();

  /**
   * Busca lugares próximos via SerpAPI (engine google_maps, modo "search"),
   * devolvendo o Google Place ID de cada resultado — usada como alternativa a
   * GooglePlacesService.searchNearbyPlaces (que exige billing do Google Cloud).
   */
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
    const query = SEARCH_QUERY_BY_TYPE[type];
    if (!query) return [];

    const zoom = radiusToZoom(radius);
    const places: PlaceResult[] = [];
    let url: URL | null = this.buildSearchUrl({ query, lat, lng, zoom });
    let page = 0;

    while (url && page < MAX_SEARCH_PAGES) {
      const stopTimer = scrapingExternalApiLatencySeconds.startTimer({ api: "serpapi" });
      const response = await fetchWithTimeout(url);
      stopTimer();

      if (!response.ok) {
        throw new Error(`Erro ao consultar SerpAPI (busca de lugares): ${response.status}`);
      }

      const rawJson = await response.json();
      const parsed = serpApiSearchResponseSchema.safeParse(rawJson);

      if (!parsed.success) {
        consoleLogger.warn(
          `[SerpAPI] Resposta de busca em formato inesperado para query="${query}": ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`
        );
        break;
      }

      for (const item of parsed.data.local_results ?? []) {
        places.push({
          placeId: item.place_id,
          name: item.title,
          lat: item.gps_coordinates.latitude,
          lng: item.gps_coordinates.longitude,
          rating: item.rating,
        });
      }

      const next = parsed.data.serpapi_pagination?.next;
      url = next ? this.withApiKey(new URL(next)) : null;
      page += 1;
    }

    return places;
  }

  private buildSearchUrl(params: {
    query: string;
    lat: number;
    lng: number;
    zoom: number;
  }): URL {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("type", "search");
    url.searchParams.set("q", params.query);
    url.searchParams.set("ll", `@${params.lat},${params.lng},${params.zoom}z`);
    url.searchParams.set("hl", "pt-BR");
    return this.withApiKey(url);
  }

  private withApiKey(url: URL): URL {
    url.searchParams.set("api_key", env.serpapiKey ?? "");
    return url;
  }

  async getPlacePopularity(placeId: string): Promise<PlacePopularityResult | null> {
    const cached = this.cache.get(placeId);
    if (cached !== null) {
      cacheHitTotal.inc({ cache: "serpapi" });
      return cached;
    }
    cacheMissTotal.inc({ cache: "serpapi" });

    const result = await this.fetchPopularity(placeId);
    this.cache.set(placeId, result, CACHE_TTL_MS);
    return result;
  }

  private async fetchPopularity(placeId: string): Promise<PlacePopularityResult | null> {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("api_key", env.serpapiKey ?? "");
    url.searchParams.set("hl", "pt-BR");

    const stopTimer = scrapingExternalApiLatencySeconds.startTimer({ api: "serpapi" });
    const response = await fetchWithTimeout(url);
    stopTimer();

    if (!response.ok) {
      throw new Error(`Erro ao consultar SerpAPI: ${response.status}`);
    }

    const rawJson = await response.json();
    const parsed = serpApiResponseSchema.safeParse(rawJson);

    if (!parsed.success) {
      consoleLogger.warn(
        `[SerpAPI] Resposta em formato inesperado para placeId=${placeId} — tratando como indisponível: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`
      );
      return null;
    }

    const result = parsed.data;

    const place = result.place_results ?? {};
    const popular = place.popular_times ?? {};
    const category = mapSerpApiTypeToCategory(place.type);

    if (!popular || Object.keys(popular).length === 0) return null;

    const currentDay = popular.current_day ?? null;
    const currentDayInt = currentDay ? WEEK_DAYS[currentDay] ?? null : null;
    const live = popular.live_hash ?? {};
    const graph = popular.graph_results ?? {};

    const hoursData: PopularityHourData[] = [];
    let liveBusynessScore: number | null = null;

    const todayGraph = currentDay ? graph[currentDay] : null;

    if (currentDay && Array.isArray(todayGraph)) {
      const currentHour = new Date().getHours();

      for (const hourData of todayGraph) {
        const time = hourData.time ?? "";
        const hour = Number(time.split(":")[0]) || 0;
        const isCurrent = Boolean(hourData.current);
        const score = hourData.live_busyness_score ?? hourData.busyness_score ?? null;

        if (isCurrent && typeof score === "number") {
          liveBusynessScore = score;
        }

        hoursData.push({
          hour,
          busyness_score: hourData.busyness_score ?? 0,
          live_busyness_score: hourData.live_busyness_score ?? null,
          is_current: isCurrent,
          status_text: hourData.info ?? "",
        });
      }

      if (liveBusynessScore === null) {
        const currentHourData = hoursData.find((item) => item.hour === currentHour);
        if (currentHourData) {
          liveBusynessScore =
            currentHourData.live_busyness_score ?? currentHourData.busyness_score ?? null;
        }
      }
    }

    return {
      currentDay,
      currentDayInt,
      liveStatus: live.info ?? null,
      liveBusynessScore,
      timeSpent: live.time_spent ?? null,
      hoursData,
      category,
    };
  }

  /** Busca algumas fotos do "Ambiente" do estabelecimento (engine
   * google_maps_photos). Duas chamadas pagas por placeId: uma pra descobrir
   * o data_id (não é o mesmo id que place_id) e outra pra pegar as fotos já
   * filtradas pela categoria — sem paginar além da primeira página. */
  async getPlaceImages(placeId: string, limit = 20): Promise<string[]> {
    const dataId = await this.fetchDataId(placeId);
    if (!dataId) return [];

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps_photos");
    url.searchParams.set("data_id", dataId);
    url.searchParams.set("category_id", AMBIENCE_CATEGORY_ID);
    url.searchParams.set("hl", "pt-BR");
    url.searchParams.set("api_key", env.serpapiKey ?? "");

    const stopTimer = scrapingExternalApiLatencySeconds.startTimer({ api: "serpapi" });
    const response = await fetchWithTimeout(url);
    stopTimer();

    if (!response.ok) {
      throw new Error(`Erro ao consultar SerpAPI (fotos): ${response.status}`);
    }

    const rawJson = await response.json();
    const parsed = serpApiPhotosResponseSchema.safeParse(rawJson);

    if (!parsed.success) {
      consoleLogger.warn(
        `[SerpAPI] Resposta de fotos em formato inesperado para placeId=${placeId}: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`
      );
      return [];
    }

    return (parsed.data.photos ?? []).slice(0, limit).map((photo) => photo.image);
  }

  private async fetchDataId(placeId: string): Promise<string | null> {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("hl", "pt-BR");
    url.searchParams.set("api_key", env.serpapiKey ?? "");

    const stopTimer = scrapingExternalApiLatencySeconds.startTimer({ api: "serpapi" });
    const response = await fetchWithTimeout(url);
    stopTimer();

    if (!response.ok) {
      throw new Error(`Erro ao consultar SerpAPI (data_id): ${response.status}`);
    }

    const rawJson = await response.json();
    const parsed = serpApiResponseSchema.safeParse(rawJson);

    if (!parsed.success) {
      consoleLogger.warn(
        `[SerpAPI] Resposta em formato inesperado ao buscar data_id para placeId=${placeId}`
      );
      return null;
    }

    return parsed.data.place_results?.data_id ?? null;
  }
}
