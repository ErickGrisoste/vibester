import { z } from "zod";

// post-service publica `likedByUserId` (ver like.service.ts), não `userId` —
// mapeado aqui para manter o mesmo formato interno de PostUnlikedEvent/handlers.
export const postLikedSchema = z.object({
    postId: z.string().uuid(),
    likedByUserId: z.string().uuid(),
    createdAt: z.string().optional(),
}).transform(({ likedByUserId, ...rest }) => ({ ...rest, userId: likedByUserId }));

export type PostLikedEvent = z.infer<typeof postLikedSchema>;