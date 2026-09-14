import { FastifyReply, FastifyRequest } from "fastify";
import { InvalidFeedCursorError, RankedFeedService } from "../services/ranked_feed.service";

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
    try {
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

      // O cursor segue cru: é o serviço que sabe distinguir data legada de token de sessão.
      const feed = await rankedFeedService.getFeed(userId, limit, request.query.cursor);

      return reply.status(200).send(feed);
    } catch (error) {
      if (error instanceof InvalidFeedCursorError) {
        return reply.status(400).send({
          message: "Invalid cursor",
        });
      }

      console.error(error);

      return reply.status(500).send({
        message: "Internal server error",
      });
    }
  }
}
