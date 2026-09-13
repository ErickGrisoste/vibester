import { FeedRepository } from "../repositories/feed.repository";
import { FeedEntriesByPostRepository } from "../repositories/feed_entries.repository";
import { UserFollowerRepository } from "../repositories/followers_by_user.repository";
import { EstablishmentFollowersRepository } from "../repositories/followers_by_establishment.repository";
import { PostsByUserRepository } from "../repositories/posts_by_user.repository";
import { EventsByIdRepository } from "../repositories/events_by_id.repository";
import { EventsByUserRepository } from "../repositories/events_by_user.repository";
import { FeedItem, FeedItemType } from "../types/feed.types";
import { Post } from "../types/post.types";
import { FeedItemPayload } from "../schema/events/post-created.schema";
import { PostDeletedEvent } from "../schema/events/post-deleted.schema";
import { UpdatePostContentEvent } from "../schema/events/post-content-updated.schema";
import { UpdatePostStatsEvent } from "../schema/events/post-stats-updated.schema";
import { PostLikedEvent } from "../schema/events/post-liked.schema";
import { PostUnlikedEvent } from "../schema/events/post-unliked.schema";
import { FeedTtlService } from "./ttl_service";
import { FeedWriterService } from "./feed-writer.service";
import { runFanout } from "../utils/fanout";
import { toEventItem, toFeedItem, toPost } from "./feed-item.mapper";

/**
 * Tamanho de página/lote do fan-out de seguidores: quantos seguidores são
 * lidos por vez (`LIMIT` da paginação por cursor em `UserFollowerRepository`/
 * `EstablishmentFollowersRepository`) e, portanto, quantas escritas
 * concorrentes no feed cada chamada a `runFanout` dispara. 500 é o mesmo
 * número já usado como teto de segurança em `FeedRepository`
 * (`MAX_TIED_TIMESTAMP_GROUP`) — grande o bastante para que contas com poucos
 * seguidores (o caso comum) continuem resolvendo em 1 única leitura, pequeno
 * o bastante para não gerar uma leva de centenas de milhares de writes
 * simultâneos no Cassandra por post/evento de uma conta grande.
 */
export const FANOUT_BATCH_SIZE = 500;

/**
 * Fan-out on write: consome eventos de criação/atualização/exclusão de posts e
 * eventos, e propaga (distribui) o item já desnormalizado para a partição de
 * feed de cada seguidor. Não decide "quem é seguidor de quem" (isso é
 * FollowService) nem confirma presença em evento (EventAttendanceService) —
 * só reage ao conteúdo em si (post/evento) sendo criado, editado, curtido ou
 * removido.
 */
export class FeedFanoutService {
    private readonly feedTtlService = new FeedTtlService();
    private readonly feedWriter = new FeedWriterService();
    private eventByIdRepository = new EventsByIdRepository();
    private feedRepository = new FeedRepository();
    private feedEntriesRepository = new FeedEntriesByPostRepository();
    private userFollowerRepository = new UserFollowerRepository();
    private establishmentFollowersRepository = new EstablishmentFollowersRepository();
    private postByUserRepository = new PostsByUserRepository();
    private eventsByUserRepository = new EventsByUserRepository();

    async handlePostCreated(data: FeedItemPayload) {
        const feedItem = toFeedItem(data);
        const post = toPost(feedItem);

        await this.savePostByUser(post);
        await this.distributePostToFollowers(feedItem);
    }

    async handleContentPostUpdated(event: UpdatePostContentEvent) {
        const entries = await this.feedEntriesRepository.findByItemId(event.postId);
        await this.postByUserRepository.updateContent(event.authorId, new Date(event.createdAt), event)

        await runFanout(
            "handleContentPostUpdated",
            entries.rows.map((entry) => () =>
                this.feedRepository.updatePostContent(entry.user_id, entry.created_at, event)
            )
        );
    }

    async handlePostLiked(event: PostLikedEvent) {
        const entry = await this.feedEntriesRepository.findByItemIdAndUser(event.postId, event.userId);

        if (!entry) { return; }

        await this.feedRepository.markAsLiked(event.userId, entry.created_at, event.postId);
    }

    async handlePostUnliked(event: PostUnlikedEvent) {
        const entry = await this.feedEntriesRepository.findByItemIdAndUser(event.postId, event.userId);

        if (!entry) { return; }

        await this.feedRepository.markAsUnliked(event.userId, entry.created_at, event.postId);
    }

    async handlePostStatsUpdated(event: UpdatePostStatsEvent) {
        const entries = await this.feedEntriesRepository.findByItemId(event.postId);
        await this.postByUserRepository.updateStats(event.authorId, new Date(event.createdAt), event.postId, event.totalLikes, event.totalComments)

        await runFanout(
            "handlePostStatsUpdated",
            entries.rows.map((entry) => () =>
                this.feedRepository.updatePostStats(entry.user_id, entry.created_at, event.postId, event.totalLikes, event.totalComments)
            )
        );
    }

    async handlePostDeleted(postDeleted: PostDeletedEvent) {
        const entries = await this.feedEntriesRepository.findByItemId(postDeleted.postId);
        // Soft delete: a cópia canônica em posts_by_user é só marcada
        // is_deleted = true (e continua expirando via TTL de 30 dias), nunca
        // fisicamente removida. A cópia já distribuída em feed_by_user
        // (abaixo) continua sendo DELETE físico imediato do feed de cada
        // seguidor — isso não muda; só a cópia canônica do autor passa a
        // soft delete.
        await this.postByUserRepository.softDelete(postDeleted.authorId, new Date(postDeleted.createdAt), postDeleted.postId)

        await runFanout(
            "handlePostDeleted",
            entries.rows.map((entry) => () =>
                this.feedRepository.delete(entry.user_id, entry.created_at, entry.post_id)
            )
        );

        await this.feedEntriesRepository.deleteByItemId(postDeleted.postId);
    }

    async handleEventCreated(data: FeedItemPayload) {
        const feedItem = toFeedItem(data);
        const event = toEventItem(feedItem);

        const ttl = this.feedTtlService.getTtl(feedItem);

        await this.eventByIdRepository.create(feedItem, ttl);
        await this.eventsByUserRepository.create(event, ttl);

        await this.distributeEventToFollowers(feedItem);
    }

    // Só estabelecimentos criam eventos (regra de produto) — não há distinção de
    // tipo de autor para distribuir, sempre followers_by_establishment.
    private async distributeEventToFollowers(feedItem: Omit<FeedItem, "userId">) {
        if (!feedItem.authorId) {
            return;
        }

        const ttl = this.feedTtlService.getTtl(feedItem);
        const authorId = feedItem.authorId;
        let cursor: string | undefined;

        // Fan-out em lotes: lê uma página de seguidores por vez (LIMIT
        // explícito no repository) e só dispara escritas concorrentes para os
        // seguidores dessa página — nunca para a base inteira de uma vez. Ver
        // FANOUT_BATCH_SIZE acima e CLAUDE.md deste serviço, seção Performance,
        // item 3.
        do {
            const page = await this.establishmentFollowersRepository.findFollowersByEstablishment(
                authorId,
                FANOUT_BATCH_SIZE,
                cursor
            );

            await runFanout(
                "distributeEventToFollowers",
                page.followerIds.map((followerId) => () =>
                    this.feedWriter.addItemToUserFeed(this.buildFollowerFeedItem(feedItem, followerId), ttl)
                )
            );

            cursor = page.nextCursor ?? undefined;
        } while (cursor);
    }

    private async savePostByUser(post: Post) {
        const ttl = 60 * 60 * 24 * 30; // 30 dias em segundos
        await this.postByUserRepository.create(post, ttl);
    }

    async distributePostToFollowers(feedItem: Omit<FeedItem, "userId">) {
        const ttl = this.feedTtlService.getTtl(feedItem);
        const authorId = feedItem.authorId!;
        let cursor: string | undefined;

        // Mesmo padrão de paginação em lote de distributeEventToFollowers: uma
        // página de seguidores (LIMIT FANOUT_BATCH_SIZE) por vez, distribuída
        // via runFanout, até o cursor da página não indicar mais próxima
        // página. Contas com menos seguidores que o tamanho do lote resolvem
        // em uma única leitura, como antes.
        do {
            const page = await this.fetchPostFollowerPage(feedItem.itemType, authorId, cursor);

            await runFanout(
                "distributePostToFollowers",
                page.followerIds.map((followerId) => () =>
                    this.feedWriter.addItemToUserFeed(this.buildFollowerFeedItem(feedItem, followerId), ttl)
                )
            );

            cursor = page.nextCursor ?? undefined;
        } while (cursor);
    }

    private async fetchPostFollowerPage(itemType: FeedItemType, authorId: string, cursor?: string) {
        switch (itemType) {
            case FeedItemType.USER_POST:
                return this.userFollowerRepository.findFollowersByUser(authorId, FANOUT_BATCH_SIZE, cursor);

            case FeedItemType.ESTABLISHMENT_POST:
                return this.establishmentFollowersRepository.findFollowersByEstablishment(authorId, FANOUT_BATCH_SIZE, cursor);

            default:
                throw new Error(`Unsupported feed item type: ${itemType}`);
        }
    }

    /**
     * Monta a cópia desnormalizada do item de feed para um seguidor específico
     * (mesmos campos do `feedItem` original, trocando só `userId` pelo
     * `followerId`) — extraído para ser reutilizado por
     * `distributePostToFollowers` e `distributeEventToFollowers`, que
     * distribuem o mesmo formato de item, só que a partir de fontes de
     * seguidores diferentes.
     */
    private buildFollowerFeedItem(feedItem: Omit<FeedItem, "userId">, followerId: string): FeedItem {
        return {
            userId: followerId,

            createdAt: feedItem.createdAt,

            itemId: feedItem.itemId,
            itemType: feedItem.itemType,

            authorId: feedItem.authorId,
            authorUsername: feedItem.authorUsername,
            authorProfilePicture: feedItem.authorProfilePicture,
            authorVerified: feedItem.authorVerified,

            establishmentId: feedItem.establishmentId,
            establishmentName: feedItem.establishmentName,
            establishmentLogo: feedItem.establishmentLogo,
            establishmentCategory: feedItem.establishmentCategory,

            eventId: feedItem.eventId,
            eventTitle: feedItem.eventTitle,
            eventBanner: feedItem.eventBanner,
            eventLineup: feedItem.eventLineup,
            eventDate: feedItem.eventDate,
            eventLocation: feedItem.eventLocation,
            eventOrganizerName: feedItem.eventOrganizerName,
            eventOrganizerLogo: feedItem.eventOrganizerLogo,
            totalConfirmed: feedItem.totalConfirmed,

            title: feedItem.title,
            content: feedItem.content,
            imageUrls: feedItem.imageUrls,
            media: feedItem.media,
            tags: feedItem.tags,

            totalLikes: feedItem.totalLikes ?? 0,
            totalComments: feedItem.totalComments ?? 0,

            isLiked: feedItem.isLiked,
            isSponsored: feedItem.isSponsored,
            isDeleted: feedItem.isDeleted,
            updatedAt: feedItem.updatedAt,
        };
    }
}
