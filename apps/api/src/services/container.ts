import type { Db } from '../db/client';
import { farms, type Farm } from '../db/schema';
import { HttpError } from '../http/errors';
import type { Logger } from '../logger';
import { FARM } from '../seed/data';
import { seedHistory, seedReference } from '../seed/reset-demo';
import { advanceSimulation } from '../sim/simulator';
import { createWeatherService, type WeatherProvider, type WeatherResult } from '../weather/service';

/** Simulation catch-up runs at most this often on the request path. */
const SYNC_INTERVAL_MS = 60_000;

export interface RequestContext {
  now: number;
  farm: Farm;
  weather: WeatherResult;
}

export function createServices(deps: {
  db: Db;
  clock: () => number;
  weatherProvider: WeatherProvider;
  logger: Logger;
}) {
  const { db, clock, logger } = deps;
  const weather = createWeatherService({ db, provider: deps.weatherProvider, logger });
  let lastSync = Number.NEGATIVE_INFINITY;
  let syncing: Promise<void> | null = null;

  async function getFarm(): Promise<Farm> {
    const [farm] = await db.select().from(farms).limit(1);
    if (!farm) throw new HttpError(503, 'NOT_SEEDED', 'Demo data has not been seeded yet');
    return farm;
  }

  /** Brings weather and simulated readings up to date (lazy catch-up). */
  function ensureFresh(force = false): Promise<void> {
    const now = clock();
    if (!force && now - lastSync < SYNC_INTERVAL_MS) return Promise.resolve();
    syncing ??= (async () => {
      const farm = await getFarm();
      const { data } = await weather.get(farm, now);
      const written = await advanceSimulation(db, { farm, weather: data, now });
      lastSync = now;
      if (written > 0) logger.info('simulation.advanced', { readings: written });
    })().finally(() => {
      syncing = null;
    });
    return syncing;
  }

  async function context(): Promise<RequestContext> {
    const now = clock();
    const farm = await getFarm();
    return { now, farm, weather: await weather.get(farm, now) };
  }

  async function resetDemo(): Promise<void> {
    const now = clock();
    await seedReference(db, now);
    const { data } = await weather.get(FARM, now);
    await seedHistory(db, { now, weather: data });
    lastSync = now;
    logger.info('demo.reset', { weather: data.source });
  }

  /** Seeds on first boot. */
  async function bootstrap(): Promise<void> {
    const [farm] = await db.select({ id: farms.id }).from(farms).limit(1);
    if (!farm) await resetDemo();
  }

  return { db, clock, logger, weather, getFarm, ensureFresh, context, resetDemo, bootstrap };
}

export type Services = ReturnType<typeof createServices>;
