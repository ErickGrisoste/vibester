import dotenv from "dotenv";

dotenv.config();

export const env = {
    port: Number(process.env.PORT) || 3001,
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    databaseUrl: process.env.DATABASE_URL as string,
    profileServiceUrl: process.env.PROFILE_SERVICE_URL as string,
    kafkaBrokers: process.env.KAFKA_BROKERS as string,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    corsOrigin: process.env.CORS_ORIGIN || false as string | false,
    fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS) || 5_000,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 60,
    rateLimitRegisterMax: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 5,
    rateLimitVerifyEmailMax: Number(process.env.RATE_LIMIT_VERIFY_EMAIL_MAX) || 10,
    rateLimitLoginMax: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
    emailVerificationTtlSeconds: Number(process.env.EMAIL_VERIFICATION_TTL_SECONDS) || 600,
    // Quantos codigos errados um mesmo email pode tentar antes da pendencia ser
    // descartada. Limita forca bruta sobre o codigo de 6 digitos, que sozinho
    // teria os 10 minutos inteiros de TTL como janela de tentativa.
    maxCodeAttempts: Number(process.env.MAX_CODE_ATTEMPTS) || 5,
    // Chave do HMAC que protege o codigo de verificacao no Redis. Cai para o
    // JWT_SECRET quando nao definida, para nao exigir config nova no deploy,
    // mas o ideal e um segredo proprio (rotacionavel sem invalidar tokens).
    verificationCodeSecret: (process.env.VERIFICATION_CODE_SECRET || process.env.JWT_SECRET) as string,
    // Janela e limite do contador de falhas de login, usados para avisar o dono
    // da conta. Contador fica no Redis para valer entre as replicas.
    authFailWindowSeconds: Number(process.env.AUTH_FAIL_WINDOW_SECONDS) || 900,
    authFailNotifyThreshold: Number(process.env.AUTH_FAIL_NOTIFY_THRESHOLD) || 5,
};
