import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import prismaClient from "../prisma/index";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import { SessionAccess, TokenPair } from "../types/session.types";

/** Tamanho do refresh token: 256 bits, codificado em base64url (43 chars). */
const REFRESH_TOKEN_BYTES = 32;

/** O user-agent só serve para identificar o aparelho; não guarda mais que isso. */
const USER_AGENT_MAX_LENGTH = 255;

const INVALID_SESSION_MESSAGE = "Sessão inválida ou expirada";

export function hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

function refreshExpiresAt(now: number): Date {
    return new Date(now + env.refreshTokenTtlSeconds * 1000);
}

function normalizeUserAgent(userAgent?: string): string | null {
    return userAgent ? userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null;
}

/**
 * Sessões de login: access token curto (JWT) + refresh token longo e opaco.
 *
 * O access token é o mesmo JWT de sempre e continua sendo conferido sozinho
 * pelos outros serviços. O refresh token é um valor aleatório, não um JWT: se
 * fosse assinado com o mesmo segredo, os outros serviços o aceitariam como
 * access token. Do refresh token o banco guarda só o hash.
 *
 * A cada refresh o token é trocado (rotação). Reapresentar o token anterior
 * fora de `refreshTokenReuseGraceSeconds` significa que duas partes têm a mesma
 * sessão — o dono e alguém que a copiou — e a sessão inteira é encerrada.
 */
export class SessionService {
    signAccessToken(access: SessionAccess): string {
        return jwt.sign(
            { userId: access.id, accountId: access.accountId },
            env.jwtSecret,
            { expiresIn: env.accessTokenTtlSeconds },
        );
    }

    /** Abre uma sessão nova para o aparelho que acabou de fazer login. */
    async start(access: SessionAccess, userAgent?: string): Promise<TokenPair> {
        const refreshToken = generateRefreshToken();

        await prismaClient.session.create({
            data: {
                accountId: access.accountId,
                tokenHash: hashRefreshToken(refreshToken),
                expiresAt: refreshExpiresAt(Date.now()),
                userAgent: normalizeUserAgent(userAgent),
            },
            select: { id: true },
        });

        return this.pair(access, refreshToken);
    }

    /** Troca o refresh token por um par novo. */
    async refresh(refreshToken: string, userAgent?: string): Promise<TokenPair> {
        const hash = hashRefreshToken(refreshToken);

        const session = await prismaClient.session.findFirst({
            where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }] },
            select: {
                id: true,
                tokenHash: true,
                rotatedAt: true,
                expiresAt: true,
                access: { select: { id: true, accountId: true, suspendedAt: true } },
            },
        });

        if (!session) {
            throw new AppError(INVALID_SESSION_MESSAGE, 401, "refresh_token_not_found");
        }

        const now = Date.now();

        if (session.expiresAt.getTime() <= now) {
            await this.deleteSession(session.id);
            throw new AppError(INVALID_SESSION_MESSAGE, 401, "refresh_token_expired");
        }

        if (session.access.suspendedAt) {
            await this.deleteSession(session.id);
            throw new AppError(
                "Sua conta foi suspensa por violar os Termos de Uso. Fale com contato@vibester.com.br.",
                403,
                "account_suspended",
            );
        }

        const next = generateRefreshToken();
        const nextHash = hashRefreshToken(next);
        const userAgentData = normalizeUserAgent(userAgent);

        if (session.tokenHash === hash) {
            // Condicional no hash atual: se duas requisições trocarem o mesmo
            // token ao mesmo tempo, só uma vence aqui e a outra cai na
            // tolerância abaixo, em vez das duas gerarem sessões divergentes.
            const rotated = await prismaClient.session.updateMany({
                where: { id: session.id, tokenHash: hash },
                data: {
                    tokenHash: nextHash,
                    previousTokenHash: hash,
                    rotatedAt: new Date(now),
                    expiresAt: refreshExpiresAt(now),
                    ...(userAgentData ? { userAgent: userAgentData } : {}),
                },
            });

            if (rotated.count === 1) return this.pair(session.access, next);

            return this.reissueWithinGrace(session.id, hash, now, nextHash, next, session.access);
        }

        // Chegou o token anterior.
        const rotatedAt = session.rotatedAt?.getTime() ?? 0;

        if (now - rotatedAt > env.refreshTokenReuseGraceSeconds * 1000) {
            await this.deleteSession(session.id);
            throw new AppError(INVALID_SESSION_MESSAGE, 401, "refresh_token_reused");
        }

        return this.reissueWithinGrace(session.id, hash, now, nextHash, next, session.access);
    }

    /** Encerra a sessão do aparelho. Idempotente: token desconhecido não é erro. */
    async revoke(refreshToken: string): Promise<void> {
        const hash = hashRefreshToken(refreshToken);

        await prismaClient.session.deleteMany({
            where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }] },
        });
    }

    /** Encerra todas as sessões da conta (troca de senha, suspensão). */
    async revokeAll(accountId: string): Promise<void> {
        await prismaClient.session.deleteMany({ where: { accountId } });
    }

    /**
     * Reenvio do token recém-trocado dentro da tolerância: o cliente nunca
     * recebeu o par anterior (resposta perdida) ou mandou duas requisições
     * juntas. Emite outro par e descarta o que ficou sem dono; o token
     * anterior segue valendo só até a janela original acabar.
     */
    private async reissueWithinGrace(
        sessionId: string,
        previousHash: string,
        now: number,
        nextHash: string,
        next: string,
        access: SessionAccess,
    ): Promise<TokenPair> {
        const reissued = await prismaClient.session.updateMany({
            where: {
                id: sessionId,
                previousTokenHash: previousHash,
                rotatedAt: { gte: new Date(now - env.refreshTokenReuseGraceSeconds * 1000) },
            },
            data: { tokenHash: nextHash, expiresAt: refreshExpiresAt(now) },
        });

        if (reissued.count !== 1) {
            throw new AppError(INVALID_SESSION_MESSAGE, 401, "refresh_token_race_lost");
        }

        return this.pair(access, next);
    }

    private async deleteSession(id: string): Promise<void> {
        await prismaClient.session.deleteMany({ where: { id } });
    }

    private pair(access: SessionAccess, refreshToken: string): TokenPair {
        return {
            accessToken: this.signAccessToken(access),
            refreshToken,
            expiresIn: env.accessTokenTtlSeconds,
        };
    }
}
