import { randomUUID } from "node:crypto";
import { EstablishmentClient, EstablishmentResponse } from "../clients/establishment.client";
import { prisma } from "../prisma/index";
import { SerpApiService, PopularityHourData } from "./serpapi.service";
import { TTLCache } from "../utils/cache";
import { type AppLogger, consoleLogger } from "../utils/logger";
import { kafkaProducer } from "../kafka/producer";
import { type MovementLevelValue, computeMovement, computeFreshness } from "./movement-engine";

const MOVEMENT_CACHE_TTL_MS = 5 * 60 * 1000;

export class MovementService {
  private movementCache = new TTLCache<string, object | null>();
  private lastKnownEstablishments: EstablishmentResponse[] = [];

  constructor(
    private establishmentClient = new EstablishmentClient(),
    private serpApiService = new SerpApiService(),
    private logger: AppLogger = consoleLogger
  ) {}

  async updateMovementLevelsFromSavedEstablishments() {
    await this.cleanOldPopularTimesDaily();

    const establishments = await this.listEstablishmentsWithFallback();

    this.logger.info(`Estabelecimentos encontrados: ${establishments.length}`);

    for (const establishment of establishments) {
      if (!establishment.googlePlaceId) {
        this.logger.info(`[SKIP] ${establishment.name} sem googlePlaceId`);
        continue;
      }

      try {
        this.logger.info(`[SERPAPI] Consultando ${establishment.name}`);

        const data = await this.serpApiService.getPlacePopularity(
          establishment.googlePlaceId
        );

        if (data && data.currentDayInt !== null && data.hoursData.length > 0) {
          await this.savePopularTimesDaily({
            establishmentId: establishment.id,
            googlePlaceId: establishment.googlePlaceId,
            currentDayInt: data.currentDayInt,
            hoursData: data.hoursData,
          });
        }

        const liveScore = data?.liveBusynessScore ?? null;

        if (liveScore === null) {
          this.logger.info(`[SEM MOVIMENTO AO VIVO] ${establishment.name}`);
        }

        const previous = await prisma.currentPopularity.findUnique({
          where: { establishmentId: establishment.id },
          select: { score: true, level: true },
        });

        const historicalSamples =
          liveScore === null
            ? await this.getFallbackSamples(
                establishment.id,
                data?.currentDayInt ?? new Date().getDay()
              )
            : [];

        const movement = computeMovement({
          liveScore,
          historicalSamples,
          previousScore: previous?.score ?? null,
          previousLevel: (previous?.level as MovementLevelValue | undefined) ?? null,
        });

        const isEstimatedWithScore = movement.isEstimated && movement.score !== null;

        await this.saveCurrentPopularity({
          establishmentId: establishment.id,
          googlePlaceId: establishment.googlePlaceId,
          level: movement.level,
          score: movement.score,
          confidence: movement.confidence,
          statusText: isEstimatedWithScore
            ? "Estimativa baseada em histórico"
            : data?.liveStatus ?? null,
          timeSpent: isEstimatedWithScore ? null : data?.timeSpent ?? null,
          isEstimated: movement.isEstimated,
          category: data?.category ?? null,
        });

        const tag =
          movement.score === null ? "INDISPONIVEL" : movement.isEstimated ? "FALLBACK" : "OK";
        this.logger.info(
          `[${tag}] ${establishment.name}: ${movement.score ?? "—"}% → ${movement.level} (confidence=${movement.confidence})`
        );
      } catch (error) {
        this.logger.error(`[ERRO] Falha ao atualizar ${establishment.name}`, error);
      }
    }

    this.logger.info("Atualização de movement levels finalizada.");
  }

  async getMovementByEstablishmentId(establishmentId: string) {
    const cached = this.movementCache.get(establishmentId);
    if (cached !== null) return cached;

    const result = await prisma.currentPopularity.findUnique({
      where: { establishmentId },
    });

    if (result === null) {
      this.movementCache.set(establishmentId, null, MOVEMENT_CACHE_TTL_MS);
      return null;
    }

    const minutesSinceUpdate = (Date.now() - result.updatedAt.getTime()) / 60_000;
    const withFreshness = { ...result, freshness: computeFreshness(minutesSinceUpdate) };

    this.movementCache.set(establishmentId, withFreshness, MOVEMENT_CACHE_TTL_MS);
    return withFreshness;
  }

  private async saveCurrentPopularity(data: {
    establishmentId: string;
    googlePlaceId: string;
    level: MovementLevelValue;
    score: number | null;
    confidence: number;
    statusText: string | null;
    timeSpent: string | null;
    isEstimated: boolean;
    category: string | null;
  }) {
    const source = data.isEstimated ? "ESTIMATED" : "SERPAPI";

    this.movementCache.delete(data.establishmentId);

    await prisma.currentPopularity.upsert({
      where: { establishmentId: data.establishmentId },
      update: {
        googlePlaceId: data.googlePlaceId,
        level: data.level,
        source,
        score: data.score,
        confidence: data.confidence,
        statusText: data.statusText,
        timeSpent: data.timeSpent,
        isEstimated: data.isEstimated,
      },
      create: {
        establishmentId: data.establishmentId,
        googlePlaceId: data.googlePlaceId,
        level: data.level,
        source,
        score: data.score,
        confidence: data.confidence,
        statusText: data.statusText,
        timeSpent: data.timeSpent,
        isEstimated: data.isEstimated,
      },
    });

    await kafkaProducer.send({
      topic: "establishments",
      messages: [
        {
          key: data.establishmentId,
          value: JSON.stringify({
            eventId: randomUUID(),
            eventType: "establishment.movement.updated",
            occurredAt: new Date().toISOString(),
            data: {
              establishmentId: data.establishmentId,
              level: data.level,
              source,
              confidence: data.confidence,
              ...(data.category ? { category: data.category } : {}),
            },
          }),
        },
      ],
    });
  }

  private async savePopularTimesDaily(data: {
    establishmentId: string;
    googlePlaceId: string;
    currentDayInt: number;
    hoursData: PopularityHourData[];
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.$transaction([
      prisma.popularTimesDaily.deleteMany({
        where: { establishmentId: data.establishmentId, capturedDate: today },
      }),
      prisma.popularTimesDaily.createMany({
        data: data.hoursData.map((hour) => ({
          establishmentId: data.establishmentId,
          googlePlaceId: data.googlePlaceId,
          capturedDate: today,
          dayOfWeek: data.currentDayInt,
          hour: hour.hour,
          busynessScore: hour.busyness_score,
          isCurrent: hour.is_current,
          statusText: hour.status_text,
        })),
      }),
    ]);
  }

  private async getFallbackSamples(
    establishmentId: string,
    dayOfWeek: number
  ): Promise<number[]> {
    const currentHour = new Date().getHours();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    cutoffDate.setHours(0, 0, 0, 0);

    const rows = await prisma.popularTimesDaily.findMany({
      where: {
        establishmentId,
        dayOfWeek,
        hour: currentHour,
        capturedDate: { gte: cutoffDate },
      },
      select: { busynessScore: true },
    });

    return rows.map((row) => row.busynessScore);
  }

  private async listEstablishmentsWithFallback(): Promise<EstablishmentResponse[]> {
    try {
      const establishments = await this.establishmentClient.listOpenEstablishments();
      this.lastKnownEstablishments = establishments;
      return establishments;
    } catch (error) {
      if (this.lastKnownEstablishments.length > 0) {
        this.logger.error(
          "[FALLBACK] Falha ao buscar estabelecimentos abertos — usando última lista conhecida",
          error
        );
        return this.lastKnownEstablishments;
      }

      this.logger.error(
        "[ERRO] Falha ao buscar estabelecimentos abertos e nenhuma lista anterior disponível",
        error
      );
      throw error;
    }
  }

  private async cleanOldPopularTimesDaily(daysToKeep = 7) {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - daysToKeep);
    limitDate.setHours(0, 0, 0, 0);

    const result = await prisma.popularTimesDaily.deleteMany({
      where: { capturedDate: { lt: limitDate } },
    });

    this.logger.info(
      `[CLEANUP] ${result.count} registros antigos removidos de popularTimesDaily`
    );
  }
}
