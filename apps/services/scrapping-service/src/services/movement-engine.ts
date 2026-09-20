export type MovementLevelValue =
  | "VERY_LOW"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH"
  | "UNAVAILABLE";

export type Freshness = "FRESH" | "STALE" | "EXPIRED";

const LEVEL_ORDER: MovementLevelValue[] = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"];

const LEVEL_UPPER_BOUND: Record<Exclude<MovementLevelValue, "UNAVAILABLE">, number> = {
  VERY_LOW: 20,
  LOW: 40,
  MEDIUM: 60,
  HIGH: 80,
  VERY_HIGH: 100,
};

const MIN_HISTORICAL_SAMPLES = 3;
/** Retenção de popular_times_daily é 28 dias (ver movement.service.ts) — no máximo
 * 4 ocorrências do mesmo dia da semana cabem nessa janela, então o confidence do
 * caminho estimado satura em 4 amostras, não em 7. */
const MAX_EXPECTED_HISTORICAL_SAMPLES = 4;
const SMOOTHING_ALPHA = 0.6;
const HYSTERESIS_MARGIN = 3;
const FRESH_MAX_MINUTES = 75;
const STALE_MAX_MINUTES = 360;

export function mapScoreToMovementLevel(score: number): MovementLevelValue {
  if (score <= 20) return "VERY_LOW";
  if (score <= 40) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 80) return "HIGH";
  return "VERY_HIGH";
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Evita que o nível fique oscilando entre ciclos por uma variação pequena de
 * score em torno de um limiar (ex.: 60 -> 61 -> 60). Só segura a troca quando
 * a nova faixa é vizinha imediata da anterior E o score está a menos de
 * HYSTERESIS_MARGIN pontos do limiar cruzado; uma mudança grande (mais de uma
 * faixa de distância) é sempre aplicada na hora.
 */
function applyHysteresis(
  score: number,
  previousLevel: MovementLevelValue | null
): MovementLevelValue {
  const newLevel = mapScoreToMovementLevel(score);

  if (previousLevel === null || previousLevel === "UNAVAILABLE" || newLevel === previousLevel) {
    return newLevel;
  }

  const prevIdx = LEVEL_ORDER.indexOf(previousLevel);
  const newIdx = LEVEL_ORDER.indexOf(newLevel);

  if (prevIdx === -1 || Math.abs(newIdx - prevIdx) > 1) {
    return newLevel;
  }

  const boundary =
    newIdx > prevIdx
      ? LEVEL_UPPER_BOUND[previousLevel as Exclude<MovementLevelValue, "UNAVAILABLE">]
      : LEVEL_UPPER_BOUND[newLevel as Exclude<MovementLevelValue, "UNAVAILABLE">];

  if (Math.abs(score - boundary) < HYSTERESIS_MARGIN) {
    return previousLevel;
  }

  return newLevel;
}

export interface MovementEngineInput {
  /** Score ao vivo (0-100) vindo da fonte externa, ou null se indisponível neste ciclo. */
  liveScore: number | null;
  /**
   * Amostras históricas (mesmo dia da semana + hora) usadas para estimar o
   * score quando não há dado ao vivo. Ignorado quando liveScore !== null.
   */
  historicalSamples: number[];
  /** Score já suavizado do ciclo anterior para este estabelecimento (para EMA). */
  previousScore: number | null;
  /** Nível já publicado no ciclo anterior para este estabelecimento (para histerese). */
  previousLevel: MovementLevelValue | null;
}

export interface MovementEngineOutput {
  score: number | null;
  level: MovementLevelValue;
  /** 0-1: quanto confiar nesta medição (fonte, amostragem). */
  confidence: number;
  isEstimated: boolean;
}

export function computeMovement(input: MovementEngineInput): MovementEngineOutput {
  const isLive = input.liveScore !== null;

  let rawScore: number | null = null;
  let sampleWeight = 1;

  if (isLive) {
    rawScore = input.liveScore;
  } else if (input.historicalSamples.length >= MIN_HISTORICAL_SAMPLES) {
    rawScore = median(input.historicalSamples);
    sampleWeight = Math.min(
      input.historicalSamples.length / MAX_EXPECTED_HISTORICAL_SAMPLES,
      1
    );
  }

  if (rawScore === null) {
    return { score: null, level: "UNAVAILABLE", confidence: 0, isEstimated: false };
  }

  const smoothedScore =
    isLive && input.previousScore !== null
      ? Math.round(SMOOTHING_ALPHA * rawScore + (1 - SMOOTHING_ALPHA) * input.previousScore)
      : Math.round(rawScore);

  const level = applyHysteresis(smoothedScore, input.previousLevel);

  const confidence = Math.round((isLive ? 1.0 : 0.5) * sampleWeight * 100) / 100;

  return { score: smoothedScore, level, confidence, isEstimated: !isLive };
}

/** Freshness é calculada em tempo de leitura a partir da idade do dado (minutos desde a última atualização bem-sucedida), não é persistida. */
export function computeFreshness(minutesSinceUpdate: number): Freshness {
  if (minutesSinceUpdate <= FRESH_MAX_MINUTES) return "FRESH";
  if (minutesSinceUpdate <= STALE_MAX_MINUTES) return "STALE";
  return "EXPIRED";
}
