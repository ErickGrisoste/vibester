import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatório"),
  JWT_EXPIRES_IN: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().optional(),
  DATABASE_URL: z.string().url("DATABASE_URL deve ser uma URL válida"),
  SERP_API_KEY: z.string().min(1, "SERP_API_KEY é obrigatório"),
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY é obrigatório"),
  ESTABLISHMENT_SERVICE_URL: z
    .string()
    .url("ESTABLISHMENT_SERVICE_URL deve ser uma URL válida"),
  KAFKA_BROKERS: z.string().default("kafka:9092"),
  TZ: z.string().optional(),
  CORS_ORIGIN: z.string().default("*"),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_TIME_WINDOW: z.string().default("1 minute"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "[env] Variáveis de ambiente inválidas:",
    parsedEnv.error.format()
  );
  process.exit(1);
}

const validated = parsedEnv.data;

export const env = {
  port: validated.PORT,
  jwtSecret: validated.JWT_SECRET,
  jwtExpiresIn: validated.JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: validated.JWT_REFRESH_EXPIRES_IN,
  databaseUrl: validated.DATABASE_URL,
  dbPoolMax: process.env.DB_POOL_MAX,
  serpapiKey: validated.SERP_API_KEY,
  googleKey: validated.GOOGLE_API_KEY,
  establishmentServiceUrl: validated.ESTABLISHMENT_SERVICE_URL,
  kafkaBrokers: validated.KAFKA_BROKERS,
  timezone: validated.TZ,
  corsOrigin: validated.CORS_ORIGIN,
  rateLimitMax: validated.RATE_LIMIT_MAX,
  rateLimitTimeWindow: validated.RATE_LIMIT_TIME_WINDOW,
};
