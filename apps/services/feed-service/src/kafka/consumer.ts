import { Consumer, EachMessagePayload } from "kafkajs";
import { FeedFanoutService } from "../services/feed-fanout.service";
import { FollowService } from "../services/follow.service";
import { EventAttendanceService } from "../services/event-attendance.service";
import { kafkaEventSchema } from "../schema/events/kafka-event.schema";
import { feedItemSchema } from "../schema/events/post-created.schema";
import { followSchema } from "../schema/events/follow.schema";
import { postContentUpdatedSchema } from "../schema/events/post-content-updated.schema";
import { postDeletedDataSchema } from "../schema/events/post-deleted.schema";
import { postStatsUpdatedSchema } from "../schema/events/post-stats-updated.schema";
import { eventUnconfirmanceSchema } from "../schema/events/event-unconfirmance";
import { eventConfirmanceSchema } from "../schema/events/event-confirmance";
import { postLikedSchema } from "../schema/events/post-liked.schema";
import { postUnlikedSchema } from "../schema/events/post-unliked.schema";
import { kafka } from "./client";

export class KafkaConsumer {
    private consumer: Consumer;

    private readonly topics = [
        "posts",
        "users",
        "establishments",
        "events",
        "post.liked",
        "post.unliked",
        "user.followed",
        "user.unfollowed",
    ];

    private readonly directTopicHandlers: Record<string, (data: unknown) => Promise<void>> = {
        "post.liked": async (data: unknown) =>
            this.feedFanoutService.handlePostLiked(postLikedSchema.parse(data)),

        "post.unliked": async (data: unknown) =>
            this.feedFanoutService.handlePostUnliked(postUnlikedSchema.parse(data)),

        "user.followed": async (data: unknown) =>
            this.followService.handleUserFollowed(followSchema.parse(data)),

        "user.unfollowed": async (data: unknown) =>
            this.followService.handleUserUnfollowed(followSchema.parse(data)),
    };

    private handlers = {
        "post.created": async (data: unknown) =>
            this.feedFanoutService.handlePostCreated(feedItemSchema.parse(data)),

        "post.deleted": async (data: unknown) =>
            this.feedFanoutService.handlePostDeleted(postDeletedDataSchema.parse(data)),

        "post.content.updated": async (data: unknown) =>
            this.feedFanoutService.handleContentPostUpdated(postContentUpdatedSchema.parse(data)),

        "post.stats.updated": async (data: unknown) =>
            this.feedFanoutService.handlePostStatsUpdated(postStatsUpdatedSchema.parse(data)),

        // "user.followed"/"user.unfollowed" NÃO entram aqui (convenção de
        // envelope genérico sobre o tópico "users"): o produtor real
        // (user-service, editProfile.service.ts) publica direto nos tópicos
        // "user.followed"/"user.unfollowed" com payload cru
        // ({followerId, followingId}/{followerId, followedId}), sem envelope
        // {eventId, eventType, data} — ver directTopicHandlers abaixo. Manter
        // as duas entradas era ambiguidade de contrato sem produtor real do
        // lado do envelope.

        "establishment.followed": async (data: unknown) =>
            this.followService.handleEstablishmentFollowed(followSchema.parse(data)),

        "establishment.unfollowed": async (data: unknown) =>
            this.followService.handleEstablishmentUnfollowed(followSchema.parse(data)),

        "event.created": async (data: unknown) =>
            this.feedFanoutService.handleEventCreated(feedItemSchema.parse(data)),

        "event.confirmed": async (data: unknown) =>
            this.eventAttendanceService.handleEventConfirmed(eventConfirmanceSchema.parse(data)),

        "event.unconfirmed": async (data: unknown) =>
            this.eventAttendanceService.handleEventUnconfirmed(eventUnconfirmanceSchema.parse(data)),
    };

    constructor(
        private readonly feedFanoutService: FeedFanoutService,
        private readonly followService: FollowService,
        private readonly eventAttendanceService: EventAttendanceService,
    ) {
        this.consumer = kafka.consumer({
            groupId: "feed-service-group",
        });
    }

    async start() {
        await this.connectWithRetry();

        for (const topic of this.topics) {
            await this.consumer.subscribe({
                topic,
                fromBeginning: false,
            });
        }

        await this.consumer.run({
            eachMessage: async (payload) => {
                await this.handleMessage(payload);
            },
        });

        console.log("Kafka consumer started");
    }

    private async handleMessage({ topic, message }: EachMessagePayload) {
        const value = message.value?.toString();

        if (!value) return;

        try {
            const rawEvent = JSON.parse(value);

            const directHandler = this.directTopicHandlers[topic];
            if (directHandler) {
                await directHandler(rawEvent);
                return;
            }

            const event = kafkaEventSchema.parse(rawEvent);
            const handler = this.handlers[event.eventType as keyof typeof this.handlers];

            if (!handler) {
                console.warn(`Unhandled event type: ${event.eventType}`, event.data);
                return;
            }

            await handler(event.data);
        } catch (error) {
            console.error(error);
        }
    }

    async stop() {
        await this.consumer.disconnect();
    }

    private async connectWithRetry(maxAttempts = 10) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.consumer.connect();
                console.log("Kafka connected");
                return;
            } catch (error) {
                console.error(`Kafka unavailable. Attempt ${attempt}/${maxAttempts}. Retrying in 5s...`);

                if (attempt === maxAttempts) {
                    throw new Error(`Failed to connect to Kafka after ${maxAttempts} attempts`);
                }

                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
    }
}
