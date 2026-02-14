 import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default('3003'),
  HOST: z.string().default('0.0.0.0'),


  DATABASE_URL: z.string(),


  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),
SUPABASE_STORAGE_BUCKET: z.string().regex(/^[a-z0-9-_]+$/),


  SERVICE_API_KEY: z.string(),


  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),


  ONBOARDING_SERVICE_URL: z.string().url().default('http://localhost:3004'),

  Thumbnail_STORAGE_BUCKET: z.string().regex(/^[a-z0-9-_]+$/),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config) {
    return config;
  }

  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid configuration:');
    for (const error of result.error.errors) {
      console.error(`  ${error.path.join('.')}: ${error.message}`);
    }
    process.exit(1);
  }

  config = result.data;
  return config;
}

export function getConfig(): Config {
  if (!config) {
    return loadConfig();
  }
  return config;
}
