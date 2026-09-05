import { z } from "zod";
import { env } from "../config/env";
import { MediaType } from "../types/post.types";
import { CONTENT_TYPE_BY_MEDIA_TYPE, SUPPORTED_CONTENT_TYPES } from "../services/upload.service";

export const MAX_MEDIA_PER_POST = 10;

const mediaTypeSchema = z.nativeEnum(MediaType);

// Só aceita URL do próprio bucket: sem isso qualquer link externo poderia ser
// gravado como se fosse mídia do post.
const bucketUrlSchema = z
    .string()
    .url()
    .refine((url) => url.startsWith(`${env.r2_public_url}/`), {
        message: "URL não pertence ao bucket de mídia",
    });

const mediaItemSchema = z.object({
    url: bucketUrlSchema,
    type: mediaTypeSchema,
    thumbnailUrl: bucketUrlSchema.optional(),
});

const legacyImageUrlsSchema = z.array(bucketUrlSchema).min(1).max(MAX_MEDIA_PER_POST);

export const createPostSchema = z.object({
    userId: z.string().uuid(),
    userUsername: z.string().min(1).optional(),
    userProfilePicture: z.string().url().optional(),
    userVerified: z.boolean().optional(),
    establishmentId: z.string().uuid().optional(),
    establishmentName: z.string().optional(),
    establishmentLogo: z.string().url().optional(),
    establishmentCategory: z.string().optional(),
    caption: z.string().max(2000).optional(),
    tags: z.array(z.string().min(1)).max(30).optional(),
    media: z.array(mediaItemSchema).min(1).max(MAX_MEDIA_PER_POST).optional(),
    // Formato anterior ao suporte a vídeo. Aceito enquanto houver app publicado
    // que ainda envia só imagem; normalizado para `media` no transform abaixo.
    imageUrls: legacyImageUrlsSchema.optional(),
})
    .refine((body) => body.media !== undefined || body.imageUrls !== undefined, {
        message: "Informe `media` (ou `imageUrls`, formato legado)",
        path: ["media"],
    })
    .transform((body) => ({
        ...body,
        media: body.media ?? body.imageUrls!.map((url) => ({ url, type: MediaType.IMAGE })),
    }));

export const updatePostSchema = z.object({ caption: z.string().max(250), });

export const postIdParamsSchema = z.object({ postId: z.uuid(), });

export const userIdParamsSchema = z.object({ userId: z.uuid(), });

export const establishmentIdParamsSchema = z.object({ establishmentId: z.uuid(), });

const uploadFileSchema = z.object({
    type: mediaTypeSchema,
    contentType: z.enum(SUPPORTED_CONTENT_TYPES as [string, ...string[]]),
}).refine((file) => CONTENT_TYPE_BY_MEDIA_TYPE[file.type].includes(file.contentType), {
    message: "contentType não corresponde ao type informado",
    path: ["contentType"],
});

export const generateUploadUrlsSchema = z.object({
    userId: z.string().uuid(),
    files: z.array(uploadFileSchema).min(1).max(MAX_MEDIA_PER_POST).optional(),
    // Formato legado: N arquivos sem tipo, todos tratados como JPEG.
    count: z.number().int().min(1).max(MAX_MEDIA_PER_POST).optional(),
})
    .refine((body) => body.files !== undefined || body.count !== undefined, {
        message: "Informe `files` (ou `count`, formato legado)",
        path: ["files"],
    })
    .transform((body) => ({
        userId: body.userId,
        files: body.files ?? Array.from({ length: body.count! }, () => ({
            type: MediaType.IMAGE,
            contentType: "image/jpeg",
        })),
    }));
