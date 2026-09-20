import { z } from "zod";

// O post-service publica quem curtiu como `likedByUserId` (mesmo campo lido
// pelo notification-service). Exigir `userId` fazia todo `post.liked` falhar
// na validação e ser descartado pelo consumer — `is_liked` nunca virava true
// no feed. `userId` continua aceito como reserva para eventos antigos.
export const postLikedSchema = z
    .object({
        postId: z.string().uuid(),
        likedByUserId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        createdAt: z.string().optional(),
    })
    .refine((event) => event.likedByUserId ?? event.userId, {
        message: "likedByUserId ou userId é obrigatório",
    })
    .transform(({ likedByUserId, userId, ...event }) => ({
        ...event,
        userId: (likedByUserId ?? userId) as string,
    }));

export type PostLikedEvent = z.infer<typeof postLikedSchema>;