function encode(value: Record<string, string>): string {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode(raw: string | undefined, requiredKeys: string[]): Record<string, string> | undefined {
    if (!raw) { return undefined; }

    try {
        const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
        if (!parsed || typeof parsed !== "object") { return undefined; }
        if (requiredKeys.some((key) => typeof parsed[key] !== "string")) { return undefined; }
        return parsed;
    } catch {
        return undefined;
    }
}

export interface PostCursor {
    createdAt: Date;
    postId: string;
}

export function encodeCursor(cursor: PostCursor): string {
    return encode({ createdAt: cursor.createdAt.toISOString(), postId: cursor.postId });
}

export function decodeCursor(raw: string | undefined): PostCursor | undefined {
    const parsed = decode(raw, ["createdAt", "postId"]);
    if (!parsed) { return undefined; }
    return { createdAt: new Date(parsed.createdAt), postId: parsed.postId };
}

export interface CommentCursor {
    createdAt: Date;
    commentId: string;
}

export function encodeCommentCursor(cursor: CommentCursor): string {
    return encode({ createdAt: cursor.createdAt.toISOString(), commentId: cursor.commentId });
}

export function decodeCommentCursor(raw: string | undefined): CommentCursor | undefined {
    const parsed = decode(raw, ["createdAt", "commentId"]);
    if (!parsed) { return undefined; }
    return { createdAt: new Date(parsed.createdAt), commentId: parsed.commentId };
}

export interface LikeCursor {
    likedAt: Date;
    postId: string;
}

export function encodeLikeCursor(cursor: LikeCursor): string {
    return encode({ likedAt: cursor.likedAt.toISOString(), postId: cursor.postId });
}

export function decodeLikeCursor(raw: string | undefined): LikeCursor | undefined {
    const parsed = decode(raw, ["likedAt", "postId"]);
    if (!parsed) { return undefined; }
    return { likedAt: new Date(parsed.likedAt), postId: parsed.postId };
}

// likes_by_post não é clusterizada por tempo (PRIMARY KEY (post_id, user_id),
// ver migrations/V005) — recriar a tabela clusterizada por liked_at exigiria
// migração de dado que não dá para validar sem Cassandra real. O cursor usa a
// própria clustering key (user_id): ordem estável e sem duplicatas/saltos
// entre páginas, só não é ordenado por recência.
export interface LikeByPostCursor {
    userId: string;
}

export function encodeLikeByPostCursor(cursor: LikeByPostCursor): string {
    return encode({ userId: cursor.userId });
}

export function decodeLikeByPostCursor(raw: string | undefined): LikeByPostCursor | undefined {
    const parsed = decode(raw, ["userId"]);
    if (!parsed) { return undefined; }
    return { userId: parsed.userId };
}
