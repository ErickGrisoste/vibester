import prismaClient from "../prisma";
import { redis } from "../config/redis";
import { Prisma } from "../generated/prisma/client";

export class CheckInService {
    async checkIn(eventId: string, userId: string) {
        try {
            await prismaClient.$transaction([
                prismaClient.eventCheckIn.create({
                    data: { eventId, userId },
                }),
                prismaClient.event.update({
                    where: { id: eventId },
                    data: { totalConfirmed: { increment: 1 } },
                }),
            ]);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    throw new Error("Usuário já fez check-in neste evento");
                }
                if (error.code === "P2025" || error.code === "P2003") {
                    throw new Error("Evento não encontrado");
                }
            }
            throw error;
        }

        //await redis.del(`event:id:${eventId}`);
        return { checkedIn: true };
    }

    async checkOut(eventId: string, userId: string) {
        const existing = await prismaClient.eventCheckIn.findUnique({
            where: { eventId_userId: { eventId, userId } },
        });

        if (!existing) {
            throw new Error("Check-in não encontrado");
        }

        await prismaClient.$transaction([
            prismaClient.eventCheckIn.delete({
                where: { id: existing.id },
            }),
            prismaClient.event.update({
                where: { id: eventId },
                data: { totalConfirmed: { decrement: 1 } },
            }),
        ]);

        //await redis.del(`event:id:${eventId}`);
        return { checkedIn: false };
    }
}