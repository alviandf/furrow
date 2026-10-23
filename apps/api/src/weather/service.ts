import { HOUR_MS } from '@furrow/shared';
import { and, desc, eq, lt } from 'drizzle-orm';

import type { Db } from '../db/client';
import { weatherSnapshots, type Farm, type WeatherData } from '../db/schema';
import type { Logger } from '../logger';
import { fetchOpenMeteo } from './open-meteo';
import { syntheticWeather } from './synthetic';

export interface WeatherProvider {
  name: string;
  fetch: (farm: Farm, now: number) => Promise<WeatherData>;
}

export const openMeteoProvider: WeatherProvider = {
  name: 'open-meteo',
  fetch: (farm, now) => fetchOpenMeteo(farm, { now }),
};

export const syntheticProvider: WeatherProvider = {
  name: 'synthetic',
  fetch: async (farm, now) => syntheticWeather(farm, now),
};

export interface WeatherResult {
  data: WeatherData;
  /** The cached forecast is older than two refresh intervals. */
  stale: boolean;
}

const KEEP_SNAPSHOTS = 3;

/**
 * Hourly cached forecast per farm: serve the cached snapshot, refresh it in the
 * background once it is older than `maxAgeMs`, and fall back to synthetic data
 * only when nothing has ever been fetched.
 */
export function createWeatherService(options: {
  db: Db;
  provider: WeatherProvider;
  logger: Logger;
  maxAgeMs?: number;
}) {
  const { db, provider, logger } = options;
  const maxAgeMs = options.maxAgeMs ?? HOUR_MS;
  let cached: WeatherData | null = null;
  let inFlight: Promise<WeatherData | null> | null = null;

  async function latestSnapshot(farmId: string): Promise<WeatherData | null> {
    const [row] = await db
      .select({ data: weatherSnapshots.data })
      .from(weatherSnapshots)
      .where(eq(weatherSnapshots.farmId, farmId))
      .orderBy(desc(weatherSnapshots.fetchedAt))
      .limit(1);
    return row?.data ?? null;
  }

  async function store(farmId: string, data: WeatherData): Promise<void> {
    await db
      .insert(weatherSnapshots)
      .values({ farmId, fetchedAt: new Date(data.fetchedAt), source: data.source, data })
      .onConflictDoNothing();
    const keep = await db
      .select({ fetchedAt: weatherSnapshots.fetchedAt })
      .from(weatherSnapshots)
      .where(eq(weatherSnapshots.farmId, farmId))
      .orderBy(desc(weatherSnapshots.fetchedAt))
      .limit(KEEP_SNAPSHOTS);
    const oldestKept = keep.at(-1)?.fetchedAt;
    if (keep.length === KEEP_SNAPSHOTS && oldestKept) {
      await db
        .delete(weatherSnapshots)
        .where(
          and(eq(weatherSnapshots.farmId, farmId), lt(weatherSnapshots.fetchedAt, oldestKept)),
        );
    }
  }

  function refresh(farm: Farm, now: number): Promise<WeatherData | null> {
    inFlight ??= (async () => {
      try {
        const data = await provider.fetch(farm, now);
        await store(farm.id, data);
        cached = data;
        logger.info('weather.refreshed', { source: data.source, hours: data.hourly.length });
        return data;
      } catch (error) {
        logger.warn('weather.refresh_failed', { provider: provider.name, error: String(error) });
        return null;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function get(farm: Farm, now: number): Promise<WeatherResult> {
    cached ??= await latestSnapshot(farm.id);
    const age = cached ? now - cached.fetchedAt : Number.POSITIVE_INFINITY;

    if (cached && age < maxAgeMs) return { data: cached, stale: false };

    if (cached) {
      void refresh(farm, now);
      return { data: cached, stale: age > 2 * maxAgeMs };
    }

    const fresh = await refresh(farm, now);
    if (fresh) return { data: fresh, stale: false };

    const fallback = syntheticWeather(farm, now);
    await store(farm.id, fallback);
    cached = fallback;
    logger.warn('weather.synthetic_fallback', {});
    return { data: fallback, stale: false };
  }

  return {
    get,
    refresh,
    /** Wait for any background refresh (used by tests and shutdown). */
    settle: () => inFlight ?? Promise.resolve(null),
    clearCache: () => {
      cached = null;
    },
  };
}

export type WeatherService = ReturnType<typeof createWeatherService>;
