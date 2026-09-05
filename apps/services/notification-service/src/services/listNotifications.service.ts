import prismaClient from "../prisma";
import { UserClient } from "../clients/user.client";
import { PostClient } from "../clients/post.client";
import { groupNotifications } from "./notificationGrouping.service";
import {
  NotificationRow,
  NotificationGroup,
  NotificationGroupResponse,
  NotificationListResponse,
  ActorSummary,
  PostSummary,
} from "../types/notification.types";

const defaultListLimit = 50;
const rawFetchLimit = 200;

export class ListNotificationsService {
  private userClient: UserClient;
  private postClient: PostClient;

  constructor() {
    this.userClient = new UserClient();
    this.postClient = new PostClient();
  }

  async buildFeed(
    recipientId: string,
    limit = defaultListLimit,
    before?: Date,
  ): Promise<NotificationListResponse> {
    if (limit <= 0) limit = defaultListLimit;

    const rawRows = await prismaClient.notification.findMany({
      where: {
        recipientId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: rawFetchLimit,
    });

    const rows: NotificationRow[] = rawRows.map((r) => ({
      id: r.id,
      type: r.type,
      recipientId: r.recipientId,
      actorId: r.actorId,
      refId: r.refId,
      content: r.content,
      read: r.read,
      createdAt: r.createdAt,
    }));

    let groups = groupNotifications(rows);

    const truncated = groups.length > limit;
    if (truncated) {
      groups = groups.slice(0, limit);
    }

    const items = await this.enrich(groups);

    let nextCursor: string | null = null;
    const hasMore = truncated || rawRows.length >= rawFetchLimit;
    if (hasMore && groups.length > 0) {
      lastGroupDate = groups[groups.length - 1].createdAt;
      nextCursor = lastGroupDate.toISOString();
    }

    return { items, nextCursor };
  }

  private async enrich(groups: NotificationGroup[]): Promise<NotificationGroupResponse[]> {
    const actorCache = new Map<string, Promise<ActorSummary | null>>();
    const postCache = new Map<string, Promise<PostSummary | null>>();

    const getActor = (actorId: string): Promise<ActorSummary | null> => {
      if (!actorCache.has(actorId)) {
        actorCache.set(actorId, this.userClient.getProfile(actorId));
      }
      return actorCache.get(actorId)!;
    };

    const getPost = (postId: string): Promise<PostSummary | null> => {
      if (!postCache.has(postId)) {
        postCache.set(postId, this.postClient.getPost(postId));
      }
      return postCache.get(postId)!;
    };

    return Promise.all(
      groups.map(async (g) => {
        const actor = await getActor(g.actorId);
        let post: PostSummary | null = null;

        if (g.type === "like" || g.type === "comment") {
          post = await getPost(g.refId);
        }

        return {
          id: g.key,
          type: g.type,
          refId: g.refId,
          othersCount: g.othersCount,
          totalCount: g.totalCount,
          content: g.content ?? undefined,
          read: g.read,
          createdAt: g.createdAt,
          actor,
          post,
        };
      }),
    );
  }
}
let lastGroupDate: Date;
