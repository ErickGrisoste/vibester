export enum MediaType {
    IMAGE = "IMAGE",
    VIDEO = "VIDEO",
}

export interface MediaItem {
    url: string;
    type: MediaType;
    thumbnailUrl?: string;
}

// Linha da UDT media_item como o driver do Cassandra devolve/espera.
export interface MediaItemRow {
    url: string;
    type: string;
    thumbnail_url: string | null;
}

/**
 * Converte a coluna `media` (UDT) para o domínio.
 *
 * Itens gravados antes da migração de mídia não têm `media` — para esses a
 * lista é derivada de `image_urls`, onde todo item é necessariamente IMAGE.
 */
export function toMediaItems(
    mediaRows: MediaItemRow[] | null | undefined,
    legacyImageUrls: string[] | null | undefined,
): MediaItem[] | undefined {
    if (mediaRows && mediaRows.length > 0) {
        return mediaRows.map((row) => ({
            url: row.url,
            type: row.type === MediaType.VIDEO ? MediaType.VIDEO : MediaType.IMAGE,
            ...(row.thumbnail_url ? { thumbnailUrl: row.thumbnail_url } : {}),
        }));
    }

    if (!legacyImageUrls || legacyImageUrls.length === 0) { return undefined; }

    return legacyImageUrls.map((url) => ({ url, type: MediaType.IMAGE }));
}

/** Converte o domínio para a UDT antes do INSERT. */
export function toMediaRows(media: MediaItem[] | undefined): MediaItemRow[] | null {
    if (!media) { return null; }

    return media.map((item) => ({
        url: item.url,
        type: item.type,
        thumbnail_url: item.thumbnailUrl ?? null,
    }));
}
