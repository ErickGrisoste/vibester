import { FastifyReply, FastifyRequest } from "fastify";
import { RankedFeedService } from "../services/ranked_feed.service";

const rankedFeedService = new RankedFeedService();

interface GetFeedParams { userId: string; }

interface GetFeedQuery {
  limit?: string;
  cursor?: string;
}

export class FeedController {
  async getFeedByUser(
    request: FastifyRequest<{
      Params: GetFeedParams;
      Querystring: GetFeedQuery;
    }>,
    reply: FastifyReply
  ) {
    const { userId } = request.params;

    const limit = request.query.limit ? Number(request.query.limit) : 20;

    if (!userId) {
      return reply.status(400).send({
        message: "User id is required",
      });
    }

    if (Number.isNaN(limit) || limit <= 0 || limit > 50) {
      return reply.status(400).send({
        message: "Invalid limit",
      });
    }

    // O cursor segue cru: é o serviço que sabe distinguir uma data legada de um
    // token de sessão rankeada. Cursor inválido vira InvalidFeedCursorError, que
    // é um HttpError 400 — assim ele segue o mesmo caminho de todo erro daqui
    // pra frente: o errorHandler global (src/errors/error.handler.ts) decide o
    // status e loga de forma estruturada, sem try/catch novo no controller.
    const feed = await rankedFeedService.getFeed(userId, limit, request.query.cursor);

    return reply.status(200).send(feed);
  }
}
