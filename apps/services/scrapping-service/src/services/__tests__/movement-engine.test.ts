import { describe, it, expect } from "vitest";
import { mapScoreToMovementLevel, computeMovement, computeFreshness } from "../movement-engine";

describe("mapScoreToMovementLevel", () => {
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

  it.each(cases)("score %i should map to %s", (score, expectedLevel) => {
    expect(mapScoreToMovementLevel(score)).toBe(expectedLevel);
  });
});

describe("computeMovement", () => {
  describe("live score", () => {
    it("should use the raw live score as-is with no previous state", () => {
      const result = computeMovement({
        liveScore: 75,
        historicalSamples: [],
        previousScore: null,
        previousLevel: null,
      });

      expect(result).toEqual({
        score: 75,
        level: "HIGH",
        confidence: 1,
        isEstimated: false,
      });
    });

    it("should smooth the score toward the previous score (EMA, alpha=0.6)", () => {
      const result = computeMovement({
        liveScore: 80,
        historicalSamples: [],
        previousScore: 40,
        previousLevel: "LOW",
      });

      // 0.6*80 + 0.4*40 = 64
      expect(result.score).toBe(64);
      expect(result.isEstimated).toBe(false);
      expect(result.confidence).toBe(1);
    });

    it("should always have confidence 1 for a live score regardless of history", () => {
      const result = computeMovement({
        liveScore: 50,
        historicalSamples: [1, 2, 3],
        previousScore: null,
        previousLevel: null,
      });

      expect(result.confidence).toBe(1);
    });
  });

  describe("hysteresis", () => {
    it("should hold the previous level when the new score is within the margin of the crossed threshold", () => {
      // previous level HIGH (61-80), new smoothed score 61 (barely into HIGH from MEDIUM's
      // perspective is irrelevant here — the crossing that matters is MEDIUM<->HIGH at 60/61).
      // Simulate score dropping from HIGH territory to 59 (2 points into MEDIUM) — within margin (3).
      const result = computeMovement({
        liveScore: 59,
        historicalSamples: [],
        previousScore: 59, // avoids smoothing pulling it further away
        previousLevel: "HIGH",
      });

      expect(result.level).toBe("HIGH");
      expect(result.score).toBe(59);
    });

    it("should apply the new level immediately when the score is beyond the hysteresis margin", () => {
      const result = computeMovement({
        liveScore: 50,
        historicalSamples: [],
        previousScore: 50,
        previousLevel: "HIGH",
      });

      expect(result.level).toBe("MEDIUM");
    });

    it("should apply the new level immediately on a large jump spanning more than one band", () => {
      const result = computeMovement({
        liveScore: 90,
        historicalSamples: [],
        previousScore: 90,
        previousLevel: "VERY_LOW",
      });

      expect(result.level).toBe("VERY_HIGH");
    });

    it("should not apply hysteresis when there is no previous level", () => {
      const result = computeMovement({
        liveScore: 59,
        historicalSamples: [],
        previousScore: null,
        previousLevel: null,
      });

      expect(result.level).toBe("MEDIUM");
    });

    it("should not apply hysteresis when the previous level was UNAVAILABLE", () => {
      const result = computeMovement({
        liveScore: 59,
        historicalSamples: [],
        previousScore: null,
        previousLevel: "UNAVAILABLE",
      });

      expect(result.level).toBe("MEDIUM");
    });
  });

  describe("fallback (estimated) path", () => {
    it("should return UNAVAILABLE when there is no live score and fewer than 3 historical samples", () => {
      const result = computeMovement({
        liveScore: null,
        historicalSamples: [50, 60],
        previousScore: null,
        previousLevel: null,
      });

      expect(result).toEqual({
        score: null,
        level: "UNAVAILABLE",
        confidence: 0,
        isEstimated: false,
      });
    });

    it("should use the median of historical samples when there are enough of them", () => {
      const result = computeMovement({
        liveScore: null,
        historicalSamples: [10, 90, 50, 55, 52],
        previousScore: null,
        previousLevel: null,
      });

      expect(result.score).toBe(52);
      expect(result.isEstimated).toBe(true);
    });

    it("should not smooth the estimated score against the previous score", () => {
      const result = computeMovement({
        liveScore: null,
        historicalSamples: [50, 50, 50],
        previousScore: 10,
        previousLevel: "VERY_LOW",
      });

      expect(result.score).toBe(50);
    });

    it("should scale confidence with sample count (capped at 7 samples)", () => {
      const threeSamples = computeMovement({
        liveScore: null,
        historicalSamples: [50, 50, 50],
        previousScore: null,
        previousLevel: null,
      });
      const sevenSamples = computeMovement({
        liveScore: null,
        historicalSamples: [50, 50, 50, 50, 50, 50, 50],
        previousScore: null,
        previousLevel: null,
      });
      const tenSamples = computeMovement({
        liveScore: null,
        historicalSamples: new Array(10).fill(50),
        previousScore: null,
        previousLevel: null,
      });

      expect(threeSamples.confidence).toBe(0.21);
      expect(sevenSamples.confidence).toBe(0.5);
      expect(tenSamples.confidence).toBe(0.5);
    });
  });
});

describe("computeFreshness", () => {
  it("should be FRESH up to 75 minutes", () => {
    expect(computeFreshness(0)).toBe("FRESH");
    expect(computeFreshness(75)).toBe("FRESH");
  });

  it("should be STALE between 75 minutes and 6 hours", () => {
    expect(computeFreshness(76)).toBe("STALE");
    expect(computeFreshness(360)).toBe("STALE");
  });

  it("should be EXPIRED beyond 6 hours", () => {
    expect(computeFreshness(361)).toBe("EXPIRED");
    expect(computeFreshness(10_000)).toBe("EXPIRED");
  });
});
