import { FastifyReply, FastifyRequest } from "fastify";
import { SerpApiService } from "../services/serpapi.service";
import { MovementService } from "../services/movement.service";

const serpApiService = new SerpApiService();

const movementService = new MovementService();

export async function getPlacePopularity(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { placeId } = request.params as { placeId: string };

    const data = await serpApiService.getPlacePopularity(placeId);

    if (!data) {
      return reply.status(404).send({
        message: "Popularidade não disponível",
      });
    }

    return reply.status(200).send(data);
  } catch (error) {
    console.error("[PopularityController] Erro:", error);

    return reply.status(500).send({
      message: "Erro ao consultar popularidade",
    });
  }
}

export async function getMovementByEstablishmentId(
  request: FastifyRequest<{ Params: { establishmentId: string } }>,
  reply: FastifyReply
) {
  try {
    const { establishmentId } = request.params;

    const movement = await movementService.getMovementByEstablishmentId(establishmentId);

    if (!movement) {
      return reply.status(404).send({
        message: "Movement not found",
      });
    }

    return reply.status(200).send(movement);
  } catch (error) {
    console.error("[MovementController] Erro:", error);

    return reply.status(500).send({
      message: "Erro ao consultar movimento",
    });
  }
}