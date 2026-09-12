import { env } from "../config/env";
import { PostSummary } from "../types/notification.types";

interface PostResponse {
  postId: string;
  imageUrls?: string[];
  caption?: string;
  isDeleted?: boolean;
}

export class PostClient {
  private baseURL: string;
  private timeoutMs: number;

  constructor() {
    this.baseURL = env.postServiceUrl;
    this.timeoutMs = env.httpClientTimeoutMs;
  }

  async getPost(postId: string): Promise<PostSummary | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseURL}/posts/${postId}`, {
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = (await response.json()) as PostResponse;
      const imageUrl = data.imageUrls && data.imageUrls.length > 0 ? data.imageUrls[0] : "";
      const isDeleted = !!data.isDeleted;
      const caption = isDeleted ? "Publicação removida" : (data.caption ?? "");

      return {
        postId: data.postId ?? postId,
        imageUrl,
        caption,
        isDeleted,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
