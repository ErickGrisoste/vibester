export interface NotificationRow {
  id: string;
  type: string;
  recipientId: string;
  actorId: string;
  refId: string;
  content: string | null;
  read: boolean;
  createdAt: Date;
}

export interface NotificationGroup {
  key: string;
  type: string;
  refId: string;
  actorId: string;
  actorIds: string[];
  othersCount: number;
  totalCount: number;
  content: string | null;
  read: boolean;
  createdAt: Date;
}

export interface ActorSummary {
  accountId: string;
  name: string;
  username: string;
  avatarUrl: string;
}

export interface PostSummary {
  postId: string;
  imageUrl: string;
  caption: string;
  isDeleted: boolean;
}

export interface NotificationGroupResponse {
  id: string;
  type: string;
  refId?: string;
  othersCount: number;
  totalCount: number;
  content?: string;
  read: boolean;
  createdAt: Date;
  actor: ActorSummary | null;
  post: PostSummary | null;
}

export interface NotificationListResponse {
  items: NotificationGroupResponse[];
  nextCursor: string | null;
}
