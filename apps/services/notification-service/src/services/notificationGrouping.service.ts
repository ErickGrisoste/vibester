import { NotificationRow, NotificationGroup } from "../types/notification.types";

function getGroupKey(row: NotificationRow): string {
  if (row.type === "follow") {
    if (row.read) {
      const dateStr = row.createdAt.toISOString().slice(0, 10);
      return `follow:read:${dateStr}`;
    }
    return "follow:unread";
  }
  return `${row.type}:${row.refId}`;
}

export function groupNotifications(rows: NotificationRow[]): NotificationGroup[] {
  const groupsMap = new Map<string, NotificationGroup>();
  const order: string[] = [];

  for (const row of rows) {
    const key = getGroupKey(row);
    let g = groupsMap.get(key);

    if (!g) {
      g = {
        key,
        type: row.type,
        refId: row.refId,
        actorId: row.actorId,
        actorIds: [],
        othersCount: 0,
        totalCount: 0,
        content: row.content,
        read: true,
        createdAt: row.createdAt,
      };
      groupsMap.set(key, g);
      order.push(key);
    }

    if (!g.actorIds.includes(row.actorId)) {
      g.actorIds.push(row.actorId);
    }

    if (!row.read) {
      g.read = false;
    }
  }

  const result: NotificationGroup[] = [];
  for (const key of order) {
    const g = groupsMap.get(key)!;
    g.totalCount = g.actorIds.length;
    g.othersCount = Math.max(0, g.totalCount - 1);
    result.push(g);
  }

  return result;
}
