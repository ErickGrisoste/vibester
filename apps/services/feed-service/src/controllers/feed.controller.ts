import { FastifyReply, FastifyRequest } from "fastify";
import { FeedReadService } from "../services/feed-read.service";

const feedReadService = new FeedReadService();

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

    const cursor = request.query.cursor ? new Date(request.query.cursor) : undefined;

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

    if (request.query.cursor && cursor && Number.isNaN(cursor.getTime())) {
      return reply.status(400).send({
        message: "Invalid cursor",
      });
    }

    // Erros daqui pra frente (ex.: Cassandra fora do ar) propagam para o
    // errorHandler global (src/errors/error.handler.ts), que decide o status
    // code e loga de forma estruturada — não capturar aqui de novo.
    const feed = await feedReadService.getFeedByUser(userId, limit, cursor);

    return reply.status(200).send(feed);
  }
}