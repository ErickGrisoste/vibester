import prismaClient from "../prisma/index.js";
import { UpdateAvatarInput, UpdateBioInput, UpdateProfileInfoInput } from "../types/profile.types.js";
import { producer } from "../kafka/producer.js";
import { redis } from "../config/redis.js";
import { profileSelect } from "../prisma/profile.select.js";

export class EditProfileService {
    async updateProfileInfo(input: UpdateProfileInfoInput) {
        const profile = await prismaClient.userProfile.update({
            where: { userID: input.accountId },
            data: { name: input.name, username: input.username },
            select: profileSelect,
        });
        await redis.del(`user:profile:${profile.userID}`).catch(() => {});
        return profile;
    }

    async updateBio(input: UpdateBioInput) {
        const profile = await prismaClient.userProfile.update({
            where: { userID: input.accountId },
            data: { bio: input.bio },
            select: profileSelect,
        });
        await redis.del(`user:profile:${profile.userID}`).catch(() => {});
        return profile;
    }

    async updateAvatar(input: UpdateAvatarInput) {
        const profile = await prismaClient.userProfile.update({
            where: { userID: input.accountId },
            data: { avatarUrl: input.avatarUrl },
            select: profileSelect,
        });
        await redis.del(`user:profile:${profile.userID}`).catch(() => {});
        return profile;
    }

    async increaseFollower(followerId: string, followingId: string) {
        const result = await prismaClient.$transaction(async (tx) => {
            await tx.userFollow.create({ data: { followerId, followingId } });

            const [followingProfile] = await Promise.all([
                tx.userProfile.update({
                    where: { userID: followingId },
                    data: { followers: { increment: 1 } },
                    select: profileSelect,
                }),
                tx.userProfile.update({
                    where: { userID: followerId },
                    data: { following: { increment: 1 } },
                    select: profileSelect,
                }),
            ]);

            return followingProfile;
        });

        await producer.send({
            topic: 'user.followed',
            messages: [{ value: JSON.stringify({ followerId, followingId }) }],
        });

        await redis.del(
            `user:followers:${followingId}`,
            `user:following:${followerId}`,
            `user:profile:${followingId}`,
            `user:profile:${followerId}`,
        ).catch(() => {});

        return result;
    }

    async decreaseFollower(followerId: string, followingId: string) {
        const result = await prismaClient.$transaction(async (tx) => {
            await tx.userFollow.delete({
                where: { followerId_followingId: { followerId, followingId } },
            });

            const [followingProfile] = await Promise.all([
                tx.userProfile.update({
                    where: { userID: followingId },
                    data: { followers: { decrement: 1 } },
                    select: profileSelect,
                }),
                tx.userProfile.update({
                    where: { userID: followerId },
                    data: { following: { decrement: 1 } },
                    select: profileSelect,
                }),
            ]);

            return followingProfile;
        });

        await producer.send({
            topic: 'user.unfollowed',
            messages: [{ value: JSON.stringify({ followerId, followedId: followingId }) }],
        });

        await redis.del(
            `user:followers:${followingId}`,
            `user:following:${followerId}`,
            `user:profile:${followingId}`,
            `user:profile:${followerId}`,
        ).catch(() => {});

        return result;
    }
}
