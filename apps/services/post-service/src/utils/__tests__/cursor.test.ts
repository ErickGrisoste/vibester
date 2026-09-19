import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  encodeCommentCursor,
  decodeCommentCursor,
  encodeLikeCursor,
  decodeLikeCursor,
  encodeLikeByPostCursor,
  decodeLikeByPostCursor,
} from "../cursor";

describe("PostCursor", () => {
  it("faz round-trip preservando createdAt e postId", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const encoded = encodeCursor({ createdAt, postId: "post-1" });
    const decoded = decodeCursor(encoded);

    expect(decoded?.postId).toBe("post-1");
    expect(decoded?.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it("retorna undefined para cursor ausente", () => {
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it("retorna undefined para cursor malformado", () => {
    expect(decodeCursor("não-é-base64url-json-válido")).toBeUndefined();
  });

  it("retorna undefined quando falta um campo obrigatório", () => {
    const malformed = Buffer.from(JSON.stringify({ postId: "post-1" })).toString("base64url");
    expect(decodeCursor(malformed)).toBeUndefined();
  });
});

describe("CommentCursor", () => {
  it("faz round-trip preservando createdAt e commentId", () => {
    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    const encoded = encodeCommentCursor({ createdAt, commentId: "cmt-1" });
    const decoded = decodeCommentCursor(encoded);

    expect(decoded?.commentId).toBe("cmt-1");
    expect(decoded?.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it("retorna undefined para cursor ausente", () => {
    expect(decodeCommentCursor(undefined)).toBeUndefined();
  });
});

describe("LikeCursor", () => {
  it("faz round-trip preservando likedAt e postId", () => {
    const likedAt = new Date("2026-03-01T00:00:00.000Z");
    const encoded = encodeLikeCursor({ likedAt, postId: "post-2" });
    const decoded = decodeLikeCursor(encoded);

    expect(decoded?.postId).toBe("post-2");
    expect(decoded?.likedAt.toISOString()).toBe(likedAt.toISOString());
  });

  it("retorna undefined para cursor ausente", () => {
    expect(decodeLikeCursor(undefined)).toBeUndefined();
  });
});

describe("LikeByPostCursor", () => {
  it("faz round-trip preservando userId", () => {
    const encoded = encodeLikeByPostCursor({ userId: "user-9" });
    const decoded = decodeLikeByPostCursor(encoded);

    expect(decoded?.userId).toBe("user-9");
  });

  it("retorna undefined para cursor ausente", () => {
    expect(decodeLikeByPostCursor(undefined)).toBeUndefined();
  });

  it("retorna undefined quando falta o campo obrigatório", () => {
    const malformed = Buffer.from(JSON.stringify({ notUserId: "x" })).toString("base64url");
    expect(decodeLikeByPostCursor(malformed)).toBeUndefined();
  });
});
