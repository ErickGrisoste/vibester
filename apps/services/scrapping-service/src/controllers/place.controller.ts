import { FastifyReply, FastifyRequest } from "fastify";
import { GooglePlacesService } from "../services/google-places.service";
import { SerpApiService } from "../services/serpapi.service";
import { nearbyPlacesQuerySchema } from "../schemas/nearby-places.schema";
import { consoleLogger } from "../utils/logger";

const googlePlacesService = new GooglePlacesService();
const serpApiService = new SerpApiService();

export async function searchNearbyPlaces(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const result = nearbyPlacesQuerySchema.safeParse(request.query);

  if (!result.success) {
    return reply.status(400).send({
      message: "Parâmetros inválidos",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { types, lat, lng, radius } = result.data;

  try {
    const places = await serpApiService.searchNearbyPlaces(types, lat, lng, radius);
    return reply.status(200).send(places);
  } catch (serpApiError) {
    // SerpAPI é a fonte principal (não exige billing do Google Cloud); Google
    // Places só é usado como fallback se a SerpAPI falhar, para não deixar o
    // serviço 100% dependente de um único fornecedor externo.
    consoleLogger.warn(
      `[PlaceController] SerpAPI falhou ao buscar lugares próximos, tentando Google Places como fallback: ${serpApiError instanceof Error ? serpApiError.message : String(serpApiError)}`
    );

    try {
      const places = await googlePlacesService.searchNearbyPlaces(types, lat, lng, radius);
      return reply.status(200).send(places);
    } catch (googleError) {
      console.error(
        "[PlaceController] Erro ao buscar lugares próximos (SerpAPI e Google Places falharam):",
        googleError
      );

      return reply.status(500).send({
        message: "Erro interno ao buscar lugares próximos",
      });
    }
  }
}