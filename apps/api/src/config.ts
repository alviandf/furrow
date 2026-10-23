import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Optional apps/api/.env (Node's built-in loader; real env vars win).
try {
  process.loadEnvFile(resolve(apiRoot, '.env'));
} catch {
  // no .env file — defaults apply
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  /** Postgres connection string (e.g. Neon). Without it, an embedded PGlite database is used. */
  databaseUrl: process.env.DATABASE_URL || undefined,
  pgliteDir: process.env.PGLITE_DIR ?? resolve(apiRoot, '.data/pglite'),
  weatherProvider: process.env.WEATHER_PROVIDER === 'synthetic' ? 'synthetic' : 'open-meteo',
  /** Re-seed the demo every day just after the irrigation window closes. */
  nightlyReset: process.env.DEMO_NIGHTLY_RESET !== 'false',
  resetAt: process.env.DEMO_RESET_AT ?? '05:30',
} as const;
