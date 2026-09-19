import { env } from "../config/env";

export const BASE_URL = "https://api.abacatepay.com/v2";

export interface CheckoutItem {
    id: string;
    quantity: number;
}

export interface CheckoutRequestPayload {
    items: CheckoutItem[];
    methods?: string[];
}

export interface CheckoutResponseData {
    id: string;
    url: string;
    // Nome do campo ainda não confirmado contra a API/sandbox real da AbacatePay.
    // Se o valor total vier com outro nome, ajustar só este parse.
    amount?: number;
}

export interface CheckoutResponse {
    data: CheckoutResponseData;
    success: boolean;
    error?: string;
}

export class AbacatePayClient {
    constructor(private readonly apiKey: string) {}

    async createCheckout(productId: string, quantity: number, methods?: string[]): Promise<CheckoutResponse> {
        const payload: CheckoutRequestPayload = {
            items: [{ id: productId, quantity }],
            methods,
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.fetchTimeoutMs);

        let response: Response;
        try {
            response = await fetch(`${BASE_URL}/checkouts/create`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
        } catch (error) {
            throw new Error(`Falha ao chamar a AbacatePay: ${(error as Error).message}`);
        } finally {
            clearTimeout(timeout);
        }

        const rawBody = await response.text();

        if (!response.ok) {
            throw new Error(`AbacatePay retornou status ${response.status}: ${rawBody}`);
        }

        let checkoutResponse: CheckoutResponse;
        try {
            checkoutResponse = JSON.parse(rawBody);
        } catch {
            throw new Error(`Falha ao interpretar resposta da AbacatePay: ${rawBody}`);
        }

        if (!checkoutResponse.success) {
            throw new Error(`Erro da AbacatePay: ${checkoutResponse.error}`);
        }

        return checkoutResponse;
    }
}

export const abacatePayClient = new AbacatePayClient(env.abacatePayApiKey);
