/** Campos do `Access` que entram no access token. */
export interface SessionAccess {
    id: string;
    accountId: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    /** Validade do access token, em segundos. */
    expiresIn: number;
}

export interface RefreshTokenInputInterface {
    refreshToken: string;
}
