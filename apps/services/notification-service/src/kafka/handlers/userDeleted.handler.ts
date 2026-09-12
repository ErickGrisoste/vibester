import prismaClient from "../../prisma";

interface UserDeletedEvent {
  userId: string;
}

export async function handleUserDeletedEvent(value: string): Promise<void> {
  try {
    const event: UserDeletedEvent = JSON.parse(value);
    if (!event.userId) return;

    await prismaClient.notification.deleteMany({
      where: {
        OR: [
          { recipientId: event.userId },
          { actorId: event.userId },
        ],
      },
    });
    console.log(`[Kafka] Deleted notifications for user ${event.userId}`);
  } catch (err) {
    console.error("[Kafka] Error handling user.deleted event:", err);
  }
}
