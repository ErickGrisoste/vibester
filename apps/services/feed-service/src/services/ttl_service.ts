import { FeedItem } from "../types/feed.types";

export const FEED_TTL = {
    USER_POST: 60 * 60 * 24 * 7,
    ESTABLISHMENT_POST: 60 * 60 * 24 * 15

} as const;

export class FeedTtlService {
    getTtl(item: Omit<FeedItem, "userId">): number {

        switch (item.itemType) {

            case "USER_POST":
                return FEED_TTL.USER_POST;

            case "ESTABLISHMENT_POST":
                return FEED_TTL.ESTABLISHMENT_POST;

            case "SPONSORED_POST":
                //return item.campaignDurationInSeconds;
                return FEED_TTL.ESTABLISHMENT_POST;

            case "EVENT":
                return this.calculateEventTTL(item.eventDate!);

            default:
                return 60 * 60 * 24 * 7;
        }

    }

    public calculateEventTTL(eventDate: Date): number {
        const expiresAt = new Date(eventDate);

        expiresAt.setDate(expiresAt.getDate() + 2);

        return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    }

}