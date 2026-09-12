import { z } from "zod";
import { mediaItemSchema } from "./post-created.schema";

export const postContentUpdatedSchema = z.object({
    authorId: z.string().uuid(),
    postId: z.string().uuid(),
    createdAt: z.iso.datetime(),
    caption: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),
    media: z.array(mediaItemSchema).optional(),
    tags: z.array(z.string()).optional()
});

export type UpdatePostContentEvent =
    z.infer<typeof postContentUpdatedSchema>;