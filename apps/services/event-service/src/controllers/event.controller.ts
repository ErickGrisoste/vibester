import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import { CreateEventService } from "../services/createEvent.service.js";
import { GetAllEventsService } from "../services/getAllEvents.service.js";
import { ListEventsService } from "../services/listEvents.service.js";
import { GetEventDetailsService } from "../services/getEventDetails.service.js";
import { ToggleFeaturedService } from "../services/toggleFeatured.service.js";
import { GetEventsByEstablishmentService } from "../services/getEventsByEstablishment.service.js";
import { cacheAside, nearbyKey } from "../config/redis.js";
import { GetFeaturedEventsService } from "../services/getFeaturedEvents.service.js";
import { GetEventsByWeekService } from "../services/getEventsByWeek.service.js";
import { CheckInService } from "../services/checkIn.service.js";
import { ListUserCheckInsService } from "../services/listUserCheckIns.service.js";
import { CheckUserCheckInService } from "../services/checkUserCheckIn.service.js";

const toggleFeaturedService = new ToggleFeaturedService();
const eventService = new CreateEventService();
const allEventsService = new GetAllEventsService();
const listEventsService = new ListEventsService();
const detailsService = new GetEventDetailsService();
const byEstablishmentService = new GetEventsByEstablishmentService();
const featuredEventsService = new GetFeaturedEventsService();
const eventsByWeekService = new GetEventsByWeekService();
const checkInService = new CheckInService();
const listUserCheckInsService = new ListUserCheckInsService();
const checkUserCheckInService = new CheckUserCheckInService();

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
        await request.jwtVerify();
    } catch (error) {
        request.log.error(error);
        return reply.status(401).send({ message: "Token de autenticação inválido ou ausente" });
    }
}

const createEventSchema = z.object({
    name: z.string().min(1).max(200),
    photoUrl: z.string().url(),
    category: z.string().min(1).max(100),
    organizer: z.string().min(1).max(200),
    location: z.string().min(1).max(500),
    informacoes: z.string().max(2000).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    ticketLink: z.string().url().optional(),
    latitude: z.number(),
    longitude: z.number(),
    establishmentId: z.string().uuid(),
});

const nearbyQuerySchema = z.object({
    latitude: z.string(),
    longitude: z.string(),
    radiusKm: z.string().optional(),
});

const eventIdParamsSchema = z.object({
    eventId: z.string().uuid(),
});

const establishmentIdParamsSchema = z.object({
    establishmentId: z.string().uuid(),
});

const errorSchema = z.object({ message: z.string() });

const eventDetailsSchema = z.object({
    id: z.string(),
    name: z.string(),
    photoUrl: z.string(),
    category: z.string(),
    organizer: z.string(),
    location: z.string(),
    informacoes: z.string().nullish(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    ticketLink: z.string().nullable(),
    totalConfirmed: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    isFeatured: z.boolean(),
    establishmentId: z.string(),
});

const nearbyEventSchema = z.object({
    id: z.string(),
    name: z.string(),
    informacoes: z.string().nullish(),
    photoUrl: z.string(),
    category: z.string(),
    organizer: z.string(),
    location: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    ticketLink: z.string().nullable(),
    totalConfirmed: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    establishmentId: z.string(),
    isFeatured: z.boolean(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    distanceKm: z.number(),
});

const toggleFeaturedBodySchema = z.object({
    isFeatured: z.boolean(),
});

const weekQuerySchema = z.object({
    date: z.string().date().optional(), // formato YYYY-MM-DD; omitido = hoje
});

const checkInBodySchema = z.object({
    userId: z.string().uuid(),
});

const checkInResponseSchema = z.object({ checkedIn: z.boolean() });

const userIdParamsSchema = z.object({
    userId: z.string().uuid(),
});

const eventIdAndUserIdParamsSchema = z.object({
    eventId: z.string().uuid(),
    userId: z.string().uuid(),
});

export async function eventRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.post("/", {
        schema: {
            tags: ["Events"],
            summary: "Criar evento",
            security: [{ bearerAuth: [] }],
            body: createEventSchema,
            response: {
                201: eventDetailsSchema,
                401: errorSchema,
                500: errorSchema,
            },
        },
        preHandler: [authenticate],
    }, async (request, reply) => {
        try {
            const event = await eventService.createEvent(request.body);
            return reply.status(201).send(event);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: "Error creating event" });
        }
    });

    router.get("/", {
        schema: {
            tags: ["Events"],
            summary: "Listar todos os eventos",
            description: "Retorna todos os eventos cadastrados, ordenados por data de início.",
            response: {
                200: z.array(eventDetailsSchema),
                500: errorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const events = await allEventsService.get();
            return reply.status(200).send(events);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: "Error listing events" });
        }
    });

    router.get("/nearby", {
        schema: {
            tags: ["Events"],
            summary: "Listar eventos próximos",
            description: "Lista eventos dentro de um raio (km) a partir de uma coordenada.",
            querystring: nearbyQuerySchema,
            response: {
                200: z.array(nearbyEventSchema),
                400: errorSchema,
                500: errorSchema,
            },
        },
    }, async (request, reply) => {
        const latitude = Number(request.query.latitude);
        const longitude = Number(request.query.longitude);
        const radiusKm = request.query.radiusKm ? Number(request.query.radiusKm) : 10;

        if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
            return reply.status(400).send({
                message: "latitude, longitude e radiusKm devem ser números válidos",
            });
        }

        try {
            const key = nearbyKey(latitude, longitude, radiusKm);
            const events = await cacheAside(key, 90, () =>
                listEventsService.listEvents({ latitude, longitude, radiusKm }),
            );
            return reply.status(200).send(events);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: "Error listing nearby events" });
        }
    });

    router.get("/establishment/:establishmentId", {
        schema: {
            tags: ["Events"],
            summary: "Eventos de um estabelecimento",
            description: "Retorna todos os eventos vinculados a um estabelecimento.",
            params: establishmentIdParamsSchema,
            response: {
                200: z.array(eventDetailsSchema),
                500: errorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const events = await byEstablishmentService.get(request.params.establishmentId);
            return reply.status(200).send(events);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: "Error listing events by establishment" });
        }
    });

    router.get("/:eventId", {
        schema: {
            tags: ["Events"],
            summary: "Detalhes do evento",
            params: eventIdParamsSchema,
            response: {
                200: eventDetailsSchema,
                404: errorSchema,
                500: errorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const eventDetails = await detailsService.get(request.params.eventId);
            return reply.status(200).send(eventDetails);
        } catch (error) {
            if (error instanceof Error && error.message === "Evento não encontrado") {
                return reply.status(404).send({ message: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ message: "Error event details" });
        }
    });

    router.patch("/:eventId/featured", {
        schema: {
            tags: ["Events"],
            summary: "Destacar/remover destaque de evento",
            security: [{ bearerAuth: [] }],
            params: eventIdParamsSchema,
            body: toggleFeaturedBodySchema,
            response: {
                200: z.object({ id: z.string().uuid(), isFeatured: z.boolean() }),
                401: errorSchema,
                404: errorSchema,
                500: errorSchema,
            },
        },
        preHandler: [authenticate],
    }, async (request, reply) => {
        try {
            const event = await toggleFeaturedService.toggleFeatured(
                request.params.eventId,
                request.body.isFeatured,
            );
            return reply.status(200).send(event);
        } catch (error) {
            if (error instanceof Error && error.message === "Evento não encontrado") {
                return reply.status(404).send({ message: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ message: "Error updating featured status" });
        }
    });

    router.get("/featured", {
        schema: {
            tags: ["Events"],
            summary: "Eventos em destaque",
            description: "Retorna todos os eventos marcados como destaque.",
            response: {
                200: z.array(eventDetailsSchema),
                500: errorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const events = await featuredEventsService.get();
            return reply.status(200).send(events);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: "Error listing featured events" });
        }
    });

    router.get("/week", {
        schema: {
            tags: ["Events"],
            summary: "Eventos da semana",
            description: "Retorna todos os eventos que irão acontecer nos 7 dias a partir da data informada.",
            querystring: weekQuerySchema,
            response: {
                200: z.array(eventDetailsSchema),
                400: errorSchema,
                500: errorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const date = request.query.date ?? new Date().toISOString().slice(0, 10);
            const events = await eventsByWeekService.get(date);
            return reply.status(200).send(events);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: "Error listing events by week" });
        }
    });

    router.post("/:eventId/checkin", {
        schema: {
            tags: ["Events"],
            summary: "Marcar presença em evento",
            params: eventIdParamsSchema,
            body: checkInBodySchema,
            response: {
                200: checkInResponseSchema,
                404: errorSchema,
                409: errorSchema,
                500: errorSchema,
            },
        },
        
    }, async (request, reply) => {
        try {
            const result = await checkInService.checkIn(request.params.eventId, request.body.userId);
            return reply.status(200).send(result);
        } catch (error) {
            if (error instanceof Error && error.message === "Evento não encontrado") {
                return reply.status(404).send({ message: error.message });
            }
            if (error instanceof Error && error.message === "Usuário já fez check-in neste evento") {
                return reply.status(409).send({ message: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ message: "Error checking in event" });
        }
    });

    router.delete("/:eventId/checkin", {
        schema: {
            tags: ["Events"],
            summary: "Remover presença em evento",
            params: eventIdParamsSchema,
            body: checkInBodySchema,
            response: {
                200: checkInResponseSchema,
                404: errorSchema,
                500: errorSchema,
            },
        },
        
    }, async (request, reply) => {
        try {
            const result = await checkInService.checkOut(request.params.eventId, request.body.userId);
            return reply.status(200).send(result);
        } catch (error) {
            if (error instanceof Error && error.message === "Check-in não encontrado") {
                return reply.status(404).send({ message: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ message: "Error checking out event" });
        }
    });

    router.get("/checkins/:userId", {
        schema: {
            tags: ["Events"],
            summary: "Eventos que o usuário confirmou presença",
            params: userIdParamsSchema,
            response: {
                200: z.array(eventDetailsSchema.extend({ checkedInAt: z.date() })),
                500: errorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const events = await listUserCheckInsService.list(request.params.userId);
            return reply.status(200).send(events);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: "Error listing user check-ins" });
        }
    });

    router.get("/:eventId/checkin/:userId", {
        schema: {
            tags: ["Events"],
            summary: "Verifica se o usuário fez check-in no evento",
            params: eventIdAndUserIdParamsSchema,
            response: {
                200: checkInResponseSchema,
                500: errorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const result = await checkUserCheckInService.check(
                request.params.eventId,
                request.params.userId,
            );
            return reply.status(200).send(result);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: "Error checking check-in status" });
        }
    });
}
