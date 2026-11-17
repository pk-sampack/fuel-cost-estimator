import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

function loadEnvFile(path = resolve(process.cwd(), '.env')): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1];
    const raw = match[2] ?? '';
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadEnvFile();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174'),
  DB_DRIVER: z.enum(['pglite', 'postgres']).default('pglite'),
  PGLITE_DIR: z.string().default('.data/pglite'),
  DATABASE_URL: z.string().optional(),
  MAPS_PROVIDER: z.enum(['auto', 'geoapify', 'google', 'mock']).default('auto'),
  GEOAPIFY_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  FUEL_SYNC_ENABLED: z.enum(['true', 'false']).default('true'),
  FUEL_SYNC_URL: z.string().url().optional(),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  origins: string[];
  dbDriver: 'pglite' | 'postgres';
  pgliteDir: string;
  databaseUrl?: string;
  mapsProvider: 'auto' | 'geoapify' | 'google' | 'mock';
  geoapifyApiKey?: string;
  googleMapsApiKey?: string;
  jwtSecret: string;
  sentryDsn?: string;
  adminEmail?: string;
  adminPassword?: string;
  fuelSyncEnabled: boolean;
  fuelSyncUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  const data = parsed.data;
  if (data.NODE_ENV === 'production') {
    if (!data.JWT_SECRET || data.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be set to at least 32 characters in production');
    }
    if (data.DB_DRIVER === 'postgres' && !data.DATABASE_URL) {
      throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
    }
  }
  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    origins: data.APP_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
    dbDriver: data.DB_DRIVER,
    pgliteDir: data.PGLITE_DIR,
    databaseUrl: data.DATABASE_URL,
    mapsProvider: data.MAPS_PROVIDER,
    geoapifyApiKey: data.GEOAPIFY_API_KEY || undefined,
    googleMapsApiKey: data.GOOGLE_MAPS_API_KEY || undefined,
    jwtSecret: data.JWT_SECRET || 'development-only-jwt-secret-not-for-production',
    sentryDsn: data.SENTRY_DSN || undefined,
    adminEmail: data.ADMIN_EMAIL || undefined,
    adminPassword: data.ADMIN_PASSWORD || undefined,
    fuelSyncEnabled: data.FUEL_SYNC_ENABLED === 'true',
    fuelSyncUrl: data.FUEL_SYNC_URL || 'https://api2.autoones.com/api/fuel-prices',
  };
}

export const config: AppConfig = loadConfig();
