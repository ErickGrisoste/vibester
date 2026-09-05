import prismaClient from "../prisma";

export async function insertNotification(
  type: string,
  recipientId: string,
  actorId: string,
  refId: string,
  content?: string,
): Promise<void> {
  await prismaClient.notification.create({
    data: {
      type,
      recipientId,
      actorId,
      refId,
      content: content ?? null,
    },
  });
}
