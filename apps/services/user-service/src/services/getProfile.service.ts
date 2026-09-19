import prismaClient from "../prisma/index.js";
import { cacheAside } from "../config/redis.js";
import { profileSelect, type ProfileView } from "../prisma/profile.select.js";

export class GetProfileService {
    async getProfileByAccountId(accountId: string): Promise<ProfileView | null> {
        return cacheAside(`user:profile:${accountId}`, 60, () =>
            prismaClient.userProfile.findUnique({
                where: { userID: accountId },
                select: profileSelect,
            })
        );
    }
}
