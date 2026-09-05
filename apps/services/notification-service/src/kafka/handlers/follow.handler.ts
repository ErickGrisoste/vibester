import { insertNotification } from "../../services/insertNotification.service";

interface UserFollowedEvent {
  followerId?: string;
  followingId?: string;
  followedId?: string;
}

export async function handleFollowEvent(value: string): Promise<void> {
  try {
    const event: UserFollowedEvent = JSON.parse(value);
    const followerId = event.followerId;
    const recipientId = event.followingId || event.followedId;

    if (!followerId || !recipientId) {
      console.warn("[Kafka] Missing followerId or recipientId in user.followed event");
      return;
    }

    if (followerId === recipientId) return;

    await insertNotification("follow", recipientId, followerId, "");
    console.log(`[Kafka] Follow notification created: ${followerId} -> ${recipientId}`);
  } catch (err) {
    console.error("[Kafka] Error handling user.followed event:", err);
  }
}
