export interface VerifyEmailInputInterface {
    email: string;
    code: string;
}

export interface PendingRegistration {
    username: string;
    name: string;
    email: string;
    passwordHash: string;
    bornAt: string;
    /** HMAC do código — o código em si nunca é persistido. */
    codeHash?: string;
    /**
     * Código em texto puro, formato antigo.
     *
     * Mantido só para as pendências que já estavam no Redis no momento do
     * deploy do HMAC; pode ser removido depois de uma janela de TTL (10 min).
     */
    code?: string;
    /** Quantos códigos errados já foram enviados para esta pendência. */
    attempts?: number;
}
