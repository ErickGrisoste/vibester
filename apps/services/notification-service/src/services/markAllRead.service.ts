import prismaClient from "../prisma";

export async function markAllReadByRecipient(recipientId: string): Promise<number> {
  const result = await prismaClient.notification.updateMany({
    where: {
      recipientId,
      read: false,
    },
    data: {
      read: true,
    },
  });

  return result.count;
}
