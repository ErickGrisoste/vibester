import dotenv from "dotenv";

dotenv.config();

export const env = {
    port: Number(process.env.PORT) || 8080,
    databaseUrl: process.env.DATABASE_URL as string,
    jwtSecret: process.env.JWT_SECRET as string,
    abacatePayApiKey: process.env.ABACATEPAY_API_KEY as string,
    abacatePayWebhookSecret: process.env.ABACATEPAY_WEBHOOK_SECRET as string,
    kafkaBrokers: process.env.KAFKA_BROKERS as string,
    corsOrigin: process.env.CORS_ORIGIN || false as string | false,
    fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS) || 15_000,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 60,
    rateLimitCheckoutMax: Number(process.env.RATE_LIMIT_CHECKOUT_MAX) || 10,
};
