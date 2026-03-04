import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SQLITE_BUSY_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  GMAIL: z.string().email().optional(),
  APP_PASSWORD: z.string().min(8).optional(),
  APP_URL: z.string().url().optional()
});

export const env = envSchema.parse(process.env);