import { randomUUID } from "node:crypto";
import prismaClient from "../prisma/index.js";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { GenerateShareLinkInput } from "../types/profile.types.js";

const SHARE_TOKEN_KEY = (token: string) => `share:token:${token}`;

export class GenerateShareLinkService {
    async generate(input: GenerateShareLinkInput) {
        // Incrementa o contador e valida (implicitamente) que o perfil existe:
        // se accountId não existir, o Prisma lança e a exceção propaga pro
        // controller, igual ao padrão de updateBio/updateAvatar/updateProfileInfo.
        await prismaClient.userProfile.update({
            where: { userID: input.accountId },
            data: { shareCount: { increment: 1 } },
        });

        const token = randomUUID();

        // Diferente da invalidação de cache (fire-and-forget): aqui o Redis é o
        // único lugar onde o vínculo token->accountId existe. Se essa escrita
        // falhar, deixamos propagar (sem .catch()) para que a API responda 500
        // em vez de devolver um shareUrl que nunca vai resolver.
        await redis.set(SHARE_TOKEN_KEY(token), input.accountId, "EX", env.shareLinkTtlSeconds);

        const expiresAt = new Date(Date.now() + env.shareLinkTtlSeconds * 1000);

        return {
            token,
            shareUrl: `${env.webBaseUrl}/u/${token}`,
            expiresAt,
        };
    }
}
