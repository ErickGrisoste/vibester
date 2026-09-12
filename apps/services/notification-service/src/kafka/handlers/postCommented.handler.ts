import { insertNotification } from "../../services/insertNotification.service";

interface PostCommentedEvent {
  postId: string;
  postOwnerId: string;
  commentedByUserId?: string;
  userId?: string;
  content?: string;
}

export async function handlePostCommentedEvent(value: string): Promise<void> {
  try {
    const event: PostCommentedEvent = JSON.parse(value);
    const commenterId = event.commentedByUserId || event.userId;

    if (!event.postId || !event.postOwnerId || !commenterId) return;
    if (commenterId === event.postOwnerId) return;

    await insertNotification("comment", event.postOwnerId, commenterId, event.postId, event.content ?? "");
    console.log(`[Kafka] Comment notification created for post ${event.postId}`);
  } catch (err) {
    console.error("[Kafka] Error handling post.commented event:", err);
  }
}
