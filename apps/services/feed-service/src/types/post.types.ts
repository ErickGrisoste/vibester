import { MediaItem } from "../utils/media";

export interface Post {
    postId: string;

    userId: string;
    username: string;
    userProfilePicture: string;
    userVerified: boolean;

    establishmentId?: string;
    establishmentName?: string;
    establishmentLogo?: string;
    establishmentCategory?: string;

    imageUrls: string[];
    media?: MediaItem[];
    caption?: string;
    tags?: string[];

    totalLikes: number;
    totalComments: number;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt?: Date;
}