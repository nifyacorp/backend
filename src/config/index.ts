import { z } from 'zod';

export const configSchema = z.object({
  CORS_ORIGIN: z.array(z.string()).default(['https://nifya.com', 'https://*.webcontainer.io']),
  RATE_LIMIT_WINDOW_MS: z.number().default(900000),
  RATE_LIMIT_MAX: z.number().default(100)
});

export async function initConfig() {
  return configSchema.parse({
    CORS_ORIGIN: ['https://nifya.com', 'https://*.webcontainer.io'],
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX: 100
  });
}

export type Config = Awaited<ReturnType<typeof initConfig>>;

let config: Config | null = null;

export async function getConfig(): Promise<Config> {
  if (!config) {
    config = await initConfig();
  }
  return config;
}