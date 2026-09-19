export interface CheckoutInputInterface {
    productId: string;
    quantity: number;
    methods?: string[];
}

export interface CheckoutOutputInterface {
    url: string;
}
