import { z } from "zod";
import { env } from "../config/env";
import { fetchWithTimeout } from "../utils/retry";
import { TTLCache } from "../utils/cache";
import { consoleLogger } from "../utils/logger";

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

  async getPlacePopularity(placeId: string): Promise<PlacePopularityResult | null> {
    const cached = this.cache.get(placeId);
    if (cached !== null) return cached;

    const result = await this.fetchPopularity(placeId);
    this.cache.set(placeId, result, CACHE_TTL_MS);
    return result;
  }

  private async fetchPopularity(placeId: string): Promise<PlacePopularityResult | null> {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("type", "place");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("api_key", env.serpapiKey ?? "");
    url.searchParams.set("hl", "pt-BR");
    url.searchParams.set("gl", "br");

    const response = await fetchWithTimeout(url);

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
}
