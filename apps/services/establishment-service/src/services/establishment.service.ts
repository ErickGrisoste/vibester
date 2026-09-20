import prismaClient from "../prisma/index";
import {
  EstablishmentInterface,
  EstablishmentProfileResponse,
  ListEstablishmentsFilters,
  OpeningHour,
  PaginatedResponse,
  ReplaceEstablishmentImagesInput,
} from "../types/establishment.types";
import { redis, cacheAside } from "../config/redis";

const BOUNDING_BOX_DEG = 0.5;

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
    Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function buildWhere(filters: ListEstablishmentsFilters) {
  return {
    category: filters.category
      ? { equals: filters.category, mode: "insensitive" as const }
      : undefined,

    averageRating:
      filters.minRating !== undefined
        ? { gte: filters.minRating }
        : undefined,

    name: filters.search
      ? { contains: filters.search, mode: "insensitive" as const }
      : undefined,
  };
}

function hasLocation(filters: ListEstablishmentsFilters): boolean {
  return filters.userLat !== undefined && filters.userLon !== undefined;
}

function addDistanceIfNeeded(
  establishments: EstablishmentInterface[],
  filters: ListEstablishmentsFilters
): EstablishmentInterface[] {
  if (!hasLocation(filters)) return establishments;

  return establishments.map((establishment) => ({
    ...establishment,
    distanceTo: calculateDistance(
      filters.userLat!,
      filters.userLon!,
      establishment.latitude,
      establishment.longitude
    ),
  }));
}

function sortEstablishments(
  establishments: EstablishmentInterface[],
  filters: ListEstablishmentsFilters
): EstablishmentInterface[] {
  const canSortByDistance = hasLocation(filters);

  if (filters.sortBy === "distance" && !canSortByDistance) {
    throw new Error("Latitude and longitude are required to sort by distance");
  }

  if (filters.sortBy === "name") {
    return establishments.slice().sort((a, b) => a.name.localeCompare(b.name));
  }
  if (filters.sortBy === "rating") {
    return establishments.slice().sort((a, b) => b.averageRating - a.averageRating);
  }
  if (filters.sortBy === "distance" || canSortByDistance) {
    return establishments.slice().sort((a, b) => (a.distanceTo ?? 0) - (b.distanceTo ?? 0));
  }

  return establishments;
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export class EstablishmentService {
  static async listEstablishments(
    filters: ListEstablishmentsFilters
  ): Promise<PaginatedResponse<EstablishmentInterface>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const cacheKey = `establishment:list:${JSON.stringify({ ...filters, page, limit })}`;

    return cacheAside(cacheKey, 30, async () => {
      const where = buildWhere(filters);
      const needsInMemorySort = hasLocation(filters) || filters.sortBy === "distance";

      if (needsInMemorySort) {
        const whereWithBbox = {
          ...where,
          latitude: {
            gte: filters.userLat! - BOUNDING_BOX_DEG,
            lte: filters.userLat! + BOUNDING_BOX_DEG,
          },
          longitude: {
            gte: filters.userLon! - BOUNDING_BOX_DEG,
            lte: filters.userLon! + BOUNDING_BOX_DEG,
          },
        };

        const all = await prismaClient.establishment.findMany({ where: whereWithBbox });
        const withDistance = addDistanceIfNeeded(all as EstablishmentInterface[], filters);
        const sorted = sortEstablishments(withDistance, filters);
        const total = sorted.length;

        return {
          data: sorted.slice(skip, skip + limit),
          pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
      }

      const orderBy =
        filters.sortBy === "rating" ? { averageRating: "desc" as const }
        : filters.sortBy === "name" ? { name: "asc" as const }
        : undefined;

      const [total, data] = await Promise.all([
        prismaClient.establishment.count({ where }),
        prismaClient.establishment.findMany({ where, orderBy, take: limit, skip }),
      ]);

      return {
        data: data as EstablishmentInterface[],
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  static async updateRating(id: string, newRating: number, newQtdAvaliacoes?: number) {
    if (newRating < 0 || newRating > 5) {
      throw new Error("INVALID_RATING");
    }

    const updated = await prismaClient.$transaction(async (tx) => {
      const establishment = await tx.establishment.findUnique({ where: { id } });

      if (!establishment) {
        throw new Error("ESTABLISHMENT_NOT_FOUND");
      }

      return tx.establishment.update({
        where: { id },
        data: {
          averageRating: newRating,
          qtdAvaliacoes: newQtdAvaliacoes ?? { increment: 1 },
        },
      });
    });

    await Promise.all([
      redis.del(`establishment:profile:${id}`).catch(() => {}),
      redis.del("establishment:open").catch(() => {}),
    ]);

    return updated;
  }

  static async getEstablishmentProfile(
    id: string
  ): Promise<EstablishmentProfileResponse> {
    return cacheAside(`establishment:profile:${id}`, 300, async () => {
      const establishment = await prismaClient.establishment.findUnique({
        where: { id },
        include: {
          openingHours: true,
          images: { orderBy: { position: "asc" } },
        },
      });

      if (!establishment) {
        throw new Error("Establishment not found");
      }

      return establishment as EstablishmentProfileResponse;
    });
  }

  /** Substitui a galeria de imagens do estabelecimento por uma lista nova
   * (delete+insert atômico) — reflete o estado mais recente vindo do
   * evento establishment.images.updated, não faz merge incremental. */
  static async replaceImages(
    id: string,
    images: ReplaceEstablishmentImagesInput[]
  ): Promise<void> {
    await prismaClient.$transaction([
      prismaClient.establishmentImage.deleteMany({ where: { establishmentId: id } }),
      prismaClient.establishmentImage.createMany({
        data: images.map((image) => ({
          establishmentId: id,
          url: image.url,
          position: image.position,
          source: image.source ?? "SERPAPI",
        })),
      }),
    ]);

    await redis.del(`establishment:profile:${id}`).catch(() => {});
  }

  static async updateMovementLevel(
    id: string,
    level: "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "UNAVAILABLE"
  ): Promise<void> {
    const LEVEL_TO_INT: Record<string, number> = {
      UNAVAILABLE: 0,
      VERY_LOW: 1,
      LOW: 2,
      MEDIUM: 3,
      HIGH: 4,
      VERY_HIGH: 5,
    };

    const nivelMovimento = LEVEL_TO_INT[level] ?? 0;

    await prismaClient.establishment.update({
      where: { id },
      data: { nivelMovimento },
    });

    await redis.del(`establishment:profile:${id}`).catch(() => {});
  }

  static async updateCategory(id: string, category: string): Promise<void> {
    await prismaClient.establishment.update({
      where: { id },
      data: { category },
    });

    await redis.del(`establishment:profile:${id}`).catch(() => {});
  }

  static async listOpenEstablishments(): Promise<EstablishmentInterface[]> {
    return cacheAside("establishment:open", 60, async () => {
      const now = new Date();
      const currentDay = now.getDay();
      const previousDay = currentDay === 0 ? 6 : currentDay - 1;
      const currentTime = formatTime(now);

      const openIds = await prismaClient.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT e.id
        FROM establishments e
        JOIN establishment_opening_hours h ON h."establishmentId" = e.id
        WHERE (
          (h."dayOfWeek" = ${currentDay}
           AND h."closeTime" >= h."openTime"
           AND ${currentTime} >= h."openTime"
           AND ${currentTime} <= h."closeTime")
          OR
          (h."dayOfWeek" = ${currentDay}
           AND h."closeTime" < h."openTime"
           AND ${currentTime} >= h."openTime")
          OR
          (h."dayOfWeek" = ${previousDay}
           AND h."closeTime" < h."openTime"
           AND ${currentTime} <= h."closeTime")
        )
      `;

      if (openIds.length === 0) return [];

      const ids = openIds.map((r) => r.id);

      const data = await prismaClient.establishment.findMany({
        where: { id: { in: ids } },
        include: { openingHours: true },
      });

      return data as EstablishmentInterface[];
    });
  }
}
