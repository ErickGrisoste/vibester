import prismaClient from "../prisma";
import { cacheAside } from "../config/redis";
import { Prisma } from "../generated/prisma/client";

type EventResult = Prisma.EventGetPayload<Record<string, never>>;

export class GetAllEventsService {
    async get() {
        return cacheAside<EventResult[]>("event:all", 60, () =>
            prismaClient.event.findMany({
                orderBy: { startDate: "asc" },
            })
        );
    }
}
