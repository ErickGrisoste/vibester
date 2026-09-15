import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { r2Client } from "../config/r2";
import { env } from "../config/env";
import { HttpError } from "../errors/http.error";
import { PostRepository } from "../repository/post.repository";
import { LikeRepository } from "../repository/like.repository";
import { CommentRepository } from "../repository/comment.repository";
import { PostService } from "./post.service";
import { LikeService } from "./like.service";
import { CommentService } from "./comment.service";
import { MEDIA_KEY_PREFIX } from "./upload.service";
import { decodeCommentCursor, decodeCursor, decodeLikeCursor } from "../utils/cursor";

/** Itens lidos por rodada em cada tabela por usuário. */
export const DELETION_PAGE_SIZE = 100;

type Storage = Pick<S3Client, "send">;

/**
 * Apaga o conteúdo de uma conta excluída (evento `user.deleted` do
 * auth-service): publicações, curtidas, comentários e toda mídia no R2.
 *
 * Cada passo reaproveita o caminho normal do serviço (softDelete, unlikePost,
 * softDelete de comentário), então contadores, caches e os eventos que o
 * feed-service e o user-service consomem saem iguais aos de uma ação manual.
 *
 * Idempotente: posts e comentários já removidos não voltam nas listagens, e
 * 404/409 de algo que outra rodada já apagou é ignorado. Qualquer outro erro
 * sobe para o Kafka reentregar o evento.
 */
export class AccountContentDeletionService {
    constructor(
        private readonly postRepository: PostRepository,
        private readonly postService: PostService,
        private readonly likeRepository: LikeRepository,
        private readonly likeService: LikeService,
        private readonly commentRepository: CommentRepository,
        private readonly commentService: CommentService,
        private readonly storage: Storage = r2Client,
    ) {}

    async deleteAllContent(userId: string): Promise<void> {
        await this.deletePosts(userId);
        await this.removeLikes(userId);
        await this.deleteComments(userId);
        await this.deleteMedia(userId);
    }

    private async deletePosts(userId: string): Promise<void> {
        let cursor = undefined as ReturnType<typeof decodeCursor>;
        do {
            const page = await this.postRepository.findByUser(userId, DELETION_PAGE_SIZE, cursor);

            for (const post of page.posts) {
                // A linha fica marcada como excluída; a legenda não precisa ficar.
                await this.postRepository.updateCaptionInAllViews(post, "", new Date());
                await ignoreAlreadyGone(() => this.postService.softDelete(post.postId, userId));
            }

            cursor = decodeCursor(page.nextCursor ?? undefined);
        } while (cursor);
    }

    private async removeLikes(userId: string): Promise<void> {
        let cursor = undefined as ReturnType<typeof decodeLikeCursor>;
        do {
            const page = await this.likeRepository.findLikesByUser(userId, DELETION_PAGE_SIZE, cursor);

            for (const like of page.likes) {
                await ignoreAlreadyGone(() => this.likeService.unlikePost(like.postId, userId));
            }

            cursor = decodeLikeCursor(page.nextCursor ?? undefined);
        } while (cursor);
    }

    private async deleteComments(userId: string): Promise<void> {
        let cursor = undefined as ReturnType<typeof decodeCommentCursor>;
        do {
            const page = await this.commentRepository.findByUser(userId, DELETION_PAGE_SIZE, cursor);

            for (const comment of page.comments) {
                if (comment.isDeleted) continue;
                await ignoreAlreadyGone(() => this.commentService.softDelete(comment.commentId, userId));
            }

            cursor = decodeCommentCursor(page.nextCursor ?? undefined);
        } while (cursor);
    }

    /** Toda mídia enviada pela conta (posts e avatar) vive em `posts/<userId>/`. */
    private async deleteMedia(userId: string): Promise<void> {
        let continuationToken: string | undefined;
        do {
            const listed = await this.storage.send(new ListObjectsV2Command({
                Bucket: env.r2_bucket_name,
                Prefix: `${MEDIA_KEY_PREFIX}${userId}/`,
                ContinuationToken: continuationToken,
            }));

            const keys = (listed.Contents ?? [])
                .map((object) => object.Key)
                .filter((key): key is string => Boolean(key));

            if (keys.length > 0) {
                await this.storage.send(new DeleteObjectsCommand({
                    Bucket: env.r2_bucket_name,
                    Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
                }));
            }

            continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
        } while (continuationToken);
    }
}

async function ignoreAlreadyGone(action: () => Promise<unknown>): Promise<void> {
    try {
        await action();
    } catch (error) {
        if (error instanceof HttpError && (error.statusCode === 404 || error.statusCode === 409)) return;
        throw error;
    }
}

export function buildAccountContentDeletionService(): AccountContentDeletionService {
    const postRepository = new PostRepository();
    const likeRepository = new LikeRepository();
    const commentRepository = new CommentRepository();

    return new AccountContentDeletionService(
        postRepository,
        new PostService(postRepository, likeRepository),
        likeRepository,
        new LikeService(likeRepository, postRepository),
        commentRepository,
        new CommentService(commentRepository, postRepository),
    );
}
