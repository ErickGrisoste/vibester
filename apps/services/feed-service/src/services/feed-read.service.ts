import { FeedRepository } from "../repositories/feed.repository";
import { toMediaItems } from "../utils/media";

export class FeedReadService {
    private feedRepository = new FeedRepository();

    async getFeedByUser(userId: string, limit: number, cursor?: Date) {
        const result = await this.feedRepository.findByUser(userId, limit, cursor);

        // A UDT volta em snake_case do driver; o restante da linha já é
        // snake_case por contrato dessa rota, mas `media` é campo novo e sai
        // camelCase para bater com o formato do post-service.
        const items = result.rows.map((row) => ({
            ...row,
            media: toMediaItems(row.media, row.image_urls) ?? null,
        }));

        return {
            items,
            nextCursor: result.rows.length > 0 ? result.rows[result.rows.length - 1].created_at : null
        };
    }
}
