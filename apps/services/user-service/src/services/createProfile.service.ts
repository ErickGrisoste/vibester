import prismaClient from "../prisma/index.js";
import { CreateProfileInput } from "../types/profile.types.js";
import { profileSelect, type ProfileView } from "../prisma/profile.select.js";

export class CreateProfileService {
    async createProfile(input: CreateProfileInput): Promise<ProfileView> {
        const profile = await prismaClient.userProfile.create({
            data: {
                userID: input.accountId,
                name: input.name,
                username: input.username,
            },
            select: profileSelect,
        });

        return profile;
    }
}
