import { z } from 'zod';
import dotenv from 'dotenv';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

dotenv.config();

const secretManagerClient = new SecretManagerServiceClient();

async function getSecret(name: string): Promise<string> {
  const [version] = await secretManagerClient.accessSecretVersion({
    name: `projects/delta-entity-447812-p2/secrets/${name}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

export const configSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_SERVICE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.union([z.string().url(), z.literal('*')]).default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
});

export async function initConfig() {
  const [
    authServiceUrl,
    jwtSecret,
    dbName,
    dbUser,
    dbPassword,
  ] = await Promise.all([
    getSecret('SERVICE_URL_AUTH'),
    getSecret('JWT_SECRET'),
    getSecret('DB_NAME'),
    getSecret('DB_USER'),
    getSecret('DB_PASSWORD'),
  ]);

  const config = configSchema.parse({
    ...process.env,
    AUTH_SERVICE_URL: authServiceUrl || process.env.AUTH_SERVICE_URL,
    JWT_SECRET: jwtSecret || process.env.JWT_SECRET,
  });

  return {
    ...config,
    DB_NAME: dbName,
    DB_USER: dbUser,
    DB_PASSWORD: dbPassword,
  };
}

export type Config = Awaited<ReturnType<typeof initConfig>>;

let config: Config | null = null;

export async function getConfig(): Promise<Config> {
  if (!config) {
    config = await initConfig();
  }
  return config;
}