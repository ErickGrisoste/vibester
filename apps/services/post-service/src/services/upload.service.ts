import { r2Client } from "../config/r2";
import { env } from "../config/env";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MediaType, PresignedUrlItem, UploadFileInput } from "../types/post.types";

const PRESIGN_CONCURRENCY = 5;

// A URL assinada carrega o content-type: se o app subir o arquivo com outro
// header, o R2 rejeita a assinatura. Por isso a lista é fechada — aceitar
// qualquer string aqui deixaria o objeto no bucket com metadado arbitrário.
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
};

export class UploadService {
    async uploadImages(files: Array<{ buffer: Buffer; mimetype: string }>, userId: string,
        postId: string,): Promise<string[]> {
        return this.runWithConcurrency(
            files.map((file) => () => this.processAndUpload(file, userId, postId)),
            PRESIGN_CONCURRENCY
        );
    }

    async generatePresignedUrls(userId: string, files: UploadFileInput[]): Promise<PresignedUrlItem[]> {
        const tasks = files.map((file) => () => this.generateOnePresignedUrl(userId, file));
        return this.runWithConcurrency(tasks, PRESIGN_CONCURRENCY);
    }

    private async generateOnePresignedUrl(userId: string, file: UploadFileInput): Promise<PresignedUrlItem> {
        const extension = EXTENSION_BY_CONTENT_TYPE[file.contentType];
        const key = `posts/${userId}/${randomUUID()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: env.r2_bucket_name,
            Key: key,
            ContentType: file.contentType,
        });

        const uploadUrl = await getSignedUrl(r2Client, command, {
            expiresIn: 300,
            signableHeaders: new Set(["content-type"]),
        });

        const publicUrl = `${env.r2_public_url}/${key}`;

        return { uploadUrl, key, publicUrl, type: file.type, contentType: file.contentType };
    }

    private async processAndUpload(
        { buffer, mimetype }: { buffer: Buffer; mimetype: string },
        userId: string,
        postId: string,
    ): Promise<string> {
        // Caminho de upload direto (multipart), usado apenas para imagem.
        // Vídeo sobe por presigned URL — passar um MP4 pelo sharp quebraria.
        if (!mimetype.startsWith("image/")) {
            throw new Error(`Tipo não suportado no upload direto: ${mimetype}`);
        }

        const key = `posts/${userId}/${postId}/${randomUUID()}.webp`;

        await r2Client.send(new PutObjectCommand({
            Bucket: env.r2_bucket_name,
            Key: key,
            Body: sharp(buffer)
                .resize({ width: 1080, withoutEnlargement: true })
                .webp({ quality: 80 }),
            ContentType: "image/webp",
        }));

        return `${env.r2_public_url}/${key}`;
    }

    private async runWithConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
        const results: T[] = [];
        for (let i = 0; i < tasks.length; i += concurrency) {
            const batch = tasks.slice(i, i + concurrency).map((t) => t());
            results.push(...await Promise.all(batch));
        }
        return results;
    }
}

export const SUPPORTED_CONTENT_TYPES = Object.keys(EXTENSION_BY_CONTENT_TYPE);

export const CONTENT_TYPE_BY_MEDIA_TYPE: Record<MediaType, string[]> = {
    [MediaType.IMAGE]: SUPPORTED_CONTENT_TYPES.filter((ct) => ct.startsWith("image/")),
    [MediaType.VIDEO]: SUPPORTED_CONTENT_TYPES.filter((ct) => ct.startsWith("video/")),
};
