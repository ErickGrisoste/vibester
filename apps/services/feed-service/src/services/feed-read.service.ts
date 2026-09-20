import { FeedRepository } from "../repositories/feed.repository";
import { toFeedResponseItem } from "../utils/feed_item";

export class FeedReadService {
    private feedRepository = new FeedRepository();

    async getFeedByUser(userId: string, limit: number, cursor?: Date) {
        const result = await this.feedRepository.findByUser(userId, limit, cursor);

        // O mapeamento mora em utils/feed_item.ts para que o feed cronológico e o
        // rankeado nunca divirjam no formato do item.
        const items = result.rows.map(toFeedResponseItem);

        return {
            items,
            nextCursor: result.rows.length > 0 ? result.rows[result.rows.length - 1].created_at : null
        };
    }
}
