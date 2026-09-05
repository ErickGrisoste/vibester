import { insertNotification } from "../../services/insertNotification.service";

interface PostLikedEvent {
  postId: string;
  postOwnerId: string;
  likedByUserId?: string;
  userId?: string;
}

export async function handlePostLikedEvent(value: string): Promise<void> {
  try {
    const event: PostLikedEvent = JSON.parse(value);
    const likerId = event.likedByUserId || event.userId;

    if (!event.postId || !event.postOwnerId || !likerId) return;
    if (likerId === event.postOwnerId) return;

    await insertNotification("like", event.postOwnerId, likerId, event.postId);
    console.log(`[Kafka] Like notification created for post ${event.postId}`);
  } catch (err) {
    console.error("[Kafka] Error handling post.liked event:", err);
  }
}
