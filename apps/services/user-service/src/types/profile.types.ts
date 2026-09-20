export interface CreateProfileInput {
  accountId: string;
  name?: string;
  username?: string;
}

export interface UpdateBioInput {
  accountId: string;
  bio: string;
}

export interface UpdateAvatarInput {
  accountId: string;
  avatarUrl: string;
}

export interface UpdateProfileInfoInput {
  accountId: string;
  name: string;
  username: string;
}

export interface GenerateShareLinkInput {
  accountId: string;
}

/** Um vínculo de follow já reduzido ao perfil do "outro lado" da relação. */
export interface FollowRef {
  accountId: string;
  createdAt: Date;
}

export interface FollowProfile {
  accountId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  followers: number;
  /** Quando o follow foi criado — é também o cursor da paginação. */
  followedAt: Date;
}

export interface FollowProfilesPage {
  data: FollowProfile[];
  nextCursor: string | null;
}
