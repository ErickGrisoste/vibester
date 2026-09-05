import { env } from "../config/env";
import { ActorSummary } from "../types/notification.types";

interface UserProfileResponse {
  accountId: string;
  name: string;
  username: string;
  avatarUrl: string;
}

export class UserClient {
  private baseURL: string;
  private timeoutMs: number;

  constructor() {
    this.baseURL = env.userServiceUrl;
    this.timeoutMs = env.httpClientTimeoutMs;
  }

  async getProfile(accountId: string): Promise<ActorSummary | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseURL}/users/profile/${accountId}`, {
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = (await response.json()) as UserProfileResponse;
      return {
        accountId: data.accountId ?? accountId,
        name: data.name ?? "",
        username: data.username ?? "",
        avatarUrl: data.avatarUrl ?? "",
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
