import { serve } from '@hono/node-server';

import { createApp } from './app';
import { config } from './config';
import { createDatabase } from './db/client';
import { createLogger } from './logger';
import { startScheduler } from './scheduler';
import { createServices } from './services/container';
import { openMeteoProvider, syntheticProvider } from './weather/service';

const logger = createLogger();
const database = await createDatabase({ url: config.databaseUrl, dataDir: config.pgliteDir });
await database.migrate();

const services = createServices({
  db: database.db,
  clock: Date.now,
  weatherProvider: config.weatherProvider === 'synthetic' ? syntheticProvider : openMeteoProvider,
  logger,
});
await services.bootstrap();

const app = createApp(services);
const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  logger.info('server.listening', {
    port: info.port,
    database: database.kind,
    weather: config.weatherProvider,
  });
});

const scheduler = startScheduler(services, {
  nightlyReset: config.nightlyReset,
  resetAt: config.resetAt,
});

const shutdown = (signal: string) => {
  logger.info('server.shutdown', { signal });
  scheduler.stop();
  server.close(() => {
    void database.close().finally(() => process.exit(0));
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
