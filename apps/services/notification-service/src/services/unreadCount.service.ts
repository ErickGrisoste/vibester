import prismaClient from "../prisma";
import { groupNotifications } from "./notificationGrouping.service";
import { NotificationRow } from "../types/notification.types";

export async function countUnreadGroups(recipientId: string): Promise<number> {
  const rawRows = await prismaClient.notification.findMany({
    where: {
      recipientId,
      read: false,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
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

  const groups = groupNotifications(rows);
  return groups.length;
}
