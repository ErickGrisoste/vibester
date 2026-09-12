export interface AbacatePayWebhookPayload {
    event: string;
    data: {
        id: string;
    };
}

export interface WebhookQueryInterface {
    webhookSecret?: string;
}
