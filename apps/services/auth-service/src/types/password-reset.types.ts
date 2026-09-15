export interface ForgotPasswordInputInterface {
    email: string;
}

export interface ResetPasswordInputInterface {
    email: string;
    code: string;
    password: string;
}

export interface PendingPasswordReset {
    accountId: string;
    /** HMAC do código — o código em si nunca é persistido. */
    codeHash: string;
    /** Quantos códigos errados já foram enviados para esta pendência. */
    attempts?: number;
}
