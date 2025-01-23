import { z } from 'zod';
import dotenv from 'dotenv';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

dotenv.config();

const secretManagerClient = new SecretManagerServiceClient();

async function getSecret(name: string): Promise<string> {
  const [version] = await secretManagerClient.accessSecretVersion({
    name: `projects/delta-entity-447812/secrets/${name}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

const configSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_SERVICE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url(),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
});

export async function initConfig() {
  const [
    dbHost,
    dbPort,
    dbName,
    dbUser,
    dbPassword,
    dbInstance,
  ] = await Promise.all([
    getSecret('DB_HOST'),
    getSecret('DB_PORT'),
    getSecret('DB_NAME'),
    getSecret('DB_USER'),
    getSecret('DB_PASSWORD'),
    getSecret('DB_INSTANCE_CONNECTION_NAME'),
  ]);

  const config = configSchema.parse(process.env);

  return {
    ...config,
    DB_HOST: dbHost,
    DB_PORT: parseInt(dbPort, 10),
    DB_NAME: dbName,
    DB_USER: dbUser,
    DB_PASSWORD: dbPassword,
    DB_INSTANCE_CONNECTION_NAME: dbInstance,
  };
}
