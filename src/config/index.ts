import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const configSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_SERVICE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  CORS_ORIGIN: z.union([z.string().url(), z.literal('*')]).default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
});

export async function initConfig() {
  return configSchema.parse(process.env);
}

export type Config = Awaited<ReturnType<typeof initConfig>>;

let config: Config | null = null;

export async function getConfig(): Promise<Config> {
  if (!config) {
    config = await initConfig();
  }
  return config;
}