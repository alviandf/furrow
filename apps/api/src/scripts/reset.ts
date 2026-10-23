/** `npm run seed` — wipe and re-seed the demo farm. */

import { config } from '../config';
import { createDatabase } from '../db/client';
import { createLogger } from '../logger';
import { createServices } from '../services/container';
import { openMeteoProvider, syntheticProvider } from '../weather/service';

const logger = createLogger();
const database = await createDatabase({ url: config.databaseUrl, dataDir: config.pgliteDir });
await database.migrate();

const services = createServices({
  db: database.db,
  clock: Date.now,
  weatherProvider: config.weatherProvider === 'synthetic' ? syntheticProvider : openMeteoProvider,
  logger,
});
await services.resetDemo();
await database.close();
