export enum MediaType {
    IMAGE = "IMAGE",
    VIDEO = "VIDEO",
}

export interface MediaItem {
    url: string;
    type: MediaType;
    // Capa do vídeo, gerada no dispositivo antes do upload. Sempre undefined em IMAGE.
    thumbnailUrl?: string;
}

// Linha da UDT media_item como o driver do Cassandra devolve/espera.
export interface MediaItemRow {
    url: string;
    type: string;
    thumbnail_url: string | null;
}

export interface Post {
    postId: string;
    userId: string;
    userUsername?: string;
    userProfilePicture?: string;
    userVerified?: boolean;
    establishmentId?: string;
    establishmentName?: string;
    establishmentLogo?: string;
    establishmentCategory?: string;
    media: MediaItem[];
    // Mantido por compatibilidade com clientes que ainda leem imageUrls.
    // Derivado de `media`, contém apenas os itens IMAGE.
    imageUrls: string[];
    caption: string;
    tags?: string[];
    totalLikes: number;
    totalComments: number;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt?: Date;
    // Calculado em tempo de leitura para o viewerId da requisição, nunca persistido.
    isLiked?: boolean;
}

export interface CreatePostInput {
    userId: string;
    userUsername?: string;
    userProfilePicture?: string;
    userVerified?: boolean;
    establishmentId?: string;
    establishmentName?: string;
    establishmentLogo?: string;
    establishmentCategory?: string;
    caption: string;
    tags?: string[];
    media: MediaItem[];
}

export interface UpdatePostInput {
    postId: string;
    caption: string;
}

export interface PresignedUrlItem {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  type: MediaType;
  contentType: string;
}

export interface UploadFileInput {
  type: MediaType;
  contentType: string;
}

export interface GeneratePresignedUrlsInput {
  userId: string;
  files: UploadFileInput[];
}

export interface PaginatedPosts {
  posts: Post[];
  nextCursor: string | null;
}
