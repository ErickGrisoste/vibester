export interface Comment {
    commentId: string;
    postId: string;
    userId: string;
    content: string;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt?: Date | null;
}

export interface CreateCommentInput {
    postId: string;
    userId: string;
    content: string;
}

export interface UpdateCommentInput {
    commentId: string;
    content: string;
}

export interface PaginatedComments {
    comments: Comment[];
    nextCursor: string | null;
}