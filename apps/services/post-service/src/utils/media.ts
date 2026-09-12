import { MediaItem, MediaItemRow, MediaType } from "../types/post.types";

/**
 * Converte a coluna `media` (UDT) para o domínio.
 *
 * Posts gravados antes da migração de mídia não têm `media` preenchido — para
 * esses, a lista é derivada de `image_urls`, onde todo item é necessariamente
 * IMAGE. Isso mantém a leitura correta durante a janela de escrita dupla,
 * sem exigir backfill das três tabelas.
 */
export function toMediaItems(
    mediaRows: MediaItemRow[] | null | undefined,
    legacyImageUrls: string[] | null | undefined,
): MediaItem[] {
    if (mediaRows && mediaRows.length > 0) {
        return mediaRows.map((row) => ({
            url: row.url,
            type: row.type === MediaType.VIDEO ? MediaType.VIDEO : MediaType.IMAGE,
            ...(row.thumbnail_url ? { thumbnailUrl: row.thumbnail_url } : {}),
        }));
    }

    return (legacyImageUrls ?? []).map((url) => ({ url, type: MediaType.IMAGE }));
}

/** Converte o domínio para a UDT antes do INSERT. */
export function toMediaRows(media: MediaItem[]): MediaItemRow[] {
    return media.map((item) => ({
        url: item.url,
        type: item.type,
        thumbnail_url: item.thumbnailUrl ?? null,
    }));
}

/**
 * Projeção legada de `media`: só as imagens, na ordem original.
 *
 * Continua sendo gravada em `image_urls` para que versões do app anteriores ao
 * suporte a vídeo não recebam uma lista vazia enquanto não atualizam.
 */
export function toLegacyImageUrls(media: MediaItem[]): string[] {
    return media
        .filter((item) => item.type === MediaType.IMAGE)
        .map((item) => item.url);
}
