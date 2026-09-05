import { redis } from "../config/redis.js";
import { GetProfileService } from "./getProfile.service.js";

const SHARE_TOKEN_KEY = (token: string) => `share:token:${token}`;

const getProfileService = new GetProfileService();

export class ResolveShareLinkService {
    // Não deleta a chave após ler (ao contrário do PENDING_KEY de
    // email-verification do auth-service): o link de compartilhamento pode
    // ser aberto várias vezes por várias pessoas dentro da janela de 24h,
    // não é uso único.
    async resolve(token: string) {
        const accountId = await redis.get(SHARE_TOKEN_KEY(token));
        if (!accountId) return null;

        return getProfileService.getProfileByAccountId(accountId);
    }
}
