import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SerpApiService } from "../serpapi.service";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { serpapiKey: "test-serpapi-key" as string | undefined },
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

function makeGraphEntry(overrides: {
  time?: string;
  busyness_score?: number;
  live_busyness_score?: number | null;
  current?: boolean;
  info?: string;
} = {}) {
  return {
    time: "14:00",
    busyness_score: 50,
    live_busyness_score: null,
    current: false,
    info: "Not too busy",
    ...overrides,
  };
}

describe("SerpApiService", () => {
  let service: SerpApiService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new SerpApiService();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockEnv.serpapiKey = "test-serpapi-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("should throw when fetch response is not ok", async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(null, false, 500));

    await expect(service.getPlacePopularity("place-123")).rejects.toThrow(
      "Erro ao consultar SerpAPI: 500"
    );
  });

  it("should return null when popular_times is missing from place_results", async () => {
    fetchMock.mockResolvedValue(
      makeFetchResponse({ place_results: {} })
    );

    const result = await service.getPlacePopularity("place-123");
    expect(result).toBeNull();
  });

  it("should return null when popular_times is empty", async () => {
    fetchMock.mockResolvedValue(
      makeFetchResponse({ place_results: { popular_times: {} } })
    );

    const result = await service.getPlacePopularity("place-123");
    expect(result).toBeNull();
  });

  it("should return null and log a warning when the response shape doesn't match the expected schema", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    fetchMock.mockResolvedValue(
      makeFetchResponse({
        place_results: {
          popular_times: {
            current_day: "friday",
            graph_results: { friday: "not-an-array" },
          },
        },
      })
    );

    const result = await service.getPlacePopularity("place-malformed");

    expect(result).toBeNull();
    const loggedLines = writeSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(loggedLines).toContain("place-malformed");

    writeSpy.mockRestore();
  });

  it("should parse currentDay and currentDayInt correctly", async () => {
    fetchMock.mockResolvedValue(
      makeFetchResponse({
        place_results: {
          popular_times: {
            current_day: "friday",
            graph_results: { friday: [] },
          },
        },
      })
    );

    const result = await service.getPlacePopularity("place-123");

    expect(result).not.toBeNull();
    expect(result!.currentDay).toBe("friday");
    expect(result!.currentDayInt).toBe(5);
  });

  it("should parse liveStatus and timeSpent from live_hash", async () => {
    fetchMock.mockResolvedValue(
      makeFetchResponse({
        place_results: {
          popular_times: {
            current_day: "saturday",
            graph_results: { saturday: [] },
            live_hash: {
              info: "Usually as busy as it gets",
              time_spent: "30-60 min",
            },
          },
        },
      })
    );

    const result = await service.getPlacePopularity("place-123");

    expect(result!.liveStatus).toBe("Usually as busy as it gets");
    expect(result!.timeSpent).toBe("30-60 min");
  });

  it("should set liveBusynessScore from the entry with current=true", async () => {
    const graphEntries = [
      makeGraphEntry({ time: "13:00", busyness_score: 30 }),
      makeGraphEntry({ time: "14:00", busyness_score: 70, current: true }),
      makeGraphEntry({ time: "15:00", busyness_score: 80 }),
    ];

    fetchMock.mockResolvedValue(
      makeFetchResponse({
        place_results: {
          popular_times: {
            current_day: "friday",
            graph_results: { friday: graphEntries },
          },
        },
      })
    );

    const result = await service.getPlacePopularity("place-123");

    expect(result!.liveBusynessScore).toBe(70);
  });

  it("should prefer live_busyness_score over busyness_score on current entry", async () => {
    const graphEntries = [
      makeGraphEntry({
        time: "14:00",
        busyness_score: 50,
        live_busyness_score: 85,
        current: true,
      }),
    ];

    fetchMock.mockResolvedValue(
      makeFetchResponse({
        place_results: {
          popular_times: {
            current_day: "friday",
            graph_results: { friday: graphEntries },
          },
        },
      })
    );

    const result = await service.getPlacePopularity("place-123");

    expect(result!.liveBusynessScore).toBe(85);
  });

  it("should fall back to busyness_score of current hour when no is_current entry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-03T14:30:00")); // friday at 14:xx

    const graphEntries = [
      makeGraphEntry({ time: "13:00", busyness_score: 20 }),
      makeGraphEntry({ time: "14:00", busyness_score: 65 }),
      makeGraphEntry({ time: "15:00", busyness_score: 90 }),
    ];

    fetchMock.mockResolvedValue(
      makeFetchResponse({
        place_results: {
          popular_times: {
            current_day: "friday",
            graph_results: { friday: graphEntries },
          },
        },
      })
    );

    const result = await service.getPlacePopularity("place-123");

    expect(result!.liveBusynessScore).toBe(65);
  });

  it("should return liveBusynessScore as null when no current entry and no matching hour", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-03T23:00:00"));

    const graphEntries = [
      makeGraphEntry({ time: "10:00", busyness_score: 30 }),
    ];

    fetchMock.mockResolvedValue(
      makeFetchResponse({
        place_results: {
          popular_times: {
            current_day: "friday",
            graph_results: { friday: graphEntries },
          },
        },
      })
    );

    const result = await service.getPlacePopularity("place-123");

    expect(result!.liveBusynessScore).toBeNull();
  });

  it("should correctly map week day names to integers", async () => {
    const days: [string, number][] = [
      ["sunday", 0],
      ["monday", 1],
      ["tuesday", 2],
      ["wednesday", 3],
      ["thursday", 4],
      ["friday", 5],
      ["saturday", 6],
    ];

    for (const [day, expectedInt] of days) {
      fetchMock.mockResolvedValue(
        makeFetchResponse({
          place_results: {
            popular_times: {
              current_day: day,
              graph_results: { [day]: [] },
            },
          },
        })
      );

      const result = await service.getPlacePopularity(`place-id-${day}`);
      expect(result!.currentDayInt).toBe(expectedInt);
    }
  });

  it("should build hoursData from graph entries", async () => {
    const graphEntries = [
      makeGraphEntry({ time: "12:00", busyness_score: 40, info: "Not busy" }),
      makeGraphEntry({ time: "20:00", busyness_score: 90, info: "Very busy" }),
    ];

    fetchMock.mockResolvedValue(
      makeFetchResponse({
        place_results: {
          popular_times: {
            current_day: "saturday",
            graph_results: { saturday: graphEntries },
          },
        },
      })
    );

    const result = await service.getPlacePopularity("place-123");

    expect(result!.hoursData).toHaveLength(2);
    expect(result!.hoursData[0]).toMatchObject({
      hour: 12,
      busyness_score: 40,
      status_text: "Not busy",
      is_current: false,
    });
    expect(result!.hoursData[1]).toMatchObject({
      hour: 20,
      busyness_score: 90,
      status_text: "Very busy",
    });
  });

  describe("cache", () => {
    it("should return cached result on second call without fetching again", async () => {
      fetchMock.mockResolvedValue(
        makeFetchResponse({
          place_results: {
            popular_times: {
              current_day: "friday",
              graph_results: { friday: [] },
            },
          },
        })
      );

      await service.getPlacePopularity("cached-place");
      await service.getPlacePopularity("cached-place");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should make separate requests for different placeIds", async () => {
      fetchMock.mockResolvedValue(
        makeFetchResponse({
          place_results: {
            popular_times: { current_day: "friday", graph_results: { friday: [] } },
          },
        })
      );

      await service.getPlacePopularity("place-a");
      await service.getPlacePopularity("place-b");

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
