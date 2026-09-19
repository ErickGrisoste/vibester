export type ReportTargetType = "USER" | "POST";

export type ReportReason =
  | "SPAM"
  | "NUDITY"
  | "VIOLENCE"
  | "HARASSMENT"
  | "HATE"
  | "ILLEGAL"
  | "IMPERSONATION"
  | "UNDERAGE"
  | "OTHER";

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  /** Autor do post. Ignorado em USER, onde o dono é o próprio targetId. */
  targetOwnerId?: string;
  reason: ReportReason;
  details?: string;
}

export interface BlockedProfile {
  accountId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  blockedAt: Date;
}

export interface BlockedProfilesPage {
  data: BlockedProfile[];
  nextCursor: string | null;
}

export interface BlockStatus {
  /** O usuário autenticado bloqueou o outro perfil. */
  blocking: boolean;
  /** O outro perfil bloqueou o usuário autenticado. */
  blockedBy: boolean;
}
