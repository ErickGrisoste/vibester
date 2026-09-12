export interface LikePostInput {
    postId: string;
    userId: string;
}

export interface PostLike {
    postId: string;
    userId: string;
    likedAt: Date;
}

export interface PaginatedLikes {
    likes: PostLike[];
    nextCursor: string | null;
}