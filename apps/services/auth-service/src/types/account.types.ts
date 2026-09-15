export interface DeleteAccountInputInterface {
    password: string;
}

export interface AccountIdParamsInterface {
    accountId: string;
}

/** Payload do evento `user.deleted`, consumido por user, post e notification. */
export interface UserDeletedEvent {
    userId: string;
    accountId: string;
    occurredAt: string;
}
