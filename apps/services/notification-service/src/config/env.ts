import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  port: Number(process.env.PORT ?? 3006),
  jwtSecret: process.env.JWT_SECRET ?? "default-jwt-secret",
  databaseUrl: required("DATABASE_URL"),
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "https://vibester.com.br,http://localhost:3000").split(","),
  
  smtpHost: process.env.SMTP_HOST ?? "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpEmail: process.env.SMTP_EMAIL ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  smtpFromName: process.env.SMTP_FROM_NAME ?? "Vibester",

  userServiceUrl: process.env.USER_SERVICE_URL ?? "http://localhost:3003",
  postServiceUrl: process.env.POST_SERVICE_URL ?? "http://localhost:3000",
  httpClientTimeoutMs: Number(process.env.HTTP_CLIENT_TIMEOUT_MS ?? 5000),
  templatesDir: process.env.TEMPLATES_DIR ?? "",
};
