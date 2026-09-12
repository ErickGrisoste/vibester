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
