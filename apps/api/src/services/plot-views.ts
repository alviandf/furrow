import {
  DAY_MS,
  HOUR_MS,
  irrigationWindowStart,
  recommend,
  type Recommendation,
} from '@furrow/shared';
import { and, asc, desc, gt, inArray } from 'drizzle-orm';

import type { Db } from '../db/client';
import { sensorReadings, type Farm, type WeatherData } from '../db/schema';
import {
  cropParams,
  daysSincePlanting,
  irrigationWindow,
  loadPlotModels,
  plotParams,
  soilParams,
  type PlotModel,
} from '../domain';

export interface PlotView {
  model: PlotModel;
  recommendation: Recommendation;
  latest: { theta: number; at: number } | null;
  /** Hourly values over the last 24 h, oldest first. */
  sparkline: number[];
}

/** Loads plots with their latest readings and computes each recommendation. */
export async function buildPlotViews(
  db: Db,
  options: { farm: Farm; weather: WeatherData; now: number; plotIds?: string[] },
): Promise<PlotView[]> {
  const { farm, weather, now } = options;
  const models = await loadPlotModels(db, farm.id, options.plotIds);
  if (models.length === 0) return [];
  const ids = models.map((m) => m.plot.id);

  const latestRows = await db
    .selectDistinctOn([sensorReadings.plotId], {
      plotId: sensorReadings.plotId,
      recordedAt: sensorReadings.recordedAt,
      vwc: sensorReadings.vwc,
    })
    .from(sensorReadings)
    .where(inArray(sensorReadings.plotId, ids))
    .orderBy(sensorReadings.plotId, desc(sensorReadings.recordedAt));

  const since = now - DAY_MS;
  const recentRows = await db
    .select({
      plotId: sensorReadings.plotId,
      recordedAt: sensorReadings.recordedAt,
      vwc: sensorReadings.vwc,
    })
    .from(sensorReadings)
    .where(and(inArray(sensorReadings.plotId, ids), gt(sensorReadings.recordedAt, new Date(since))))
    .orderBy(asc(sensorReadings.recordedAt));

  const startAt = irrigationWindowStart(now, farm.timezone, irrigationWindow(farm));

  return models.map((model) => {
    const latestRow = latestRows.find((r) => r.plotId === model.plot.id);
    const latest = latestRow ? { theta: latestRow.vwc, at: latestRow.recordedAt.getTime() } : null;

    const hourly = new Map<number, number>();
    for (const row of recentRows) {
      if (row.plotId !== model.plot.id) continue;
      hourly.set(Math.floor((row.recordedAt.getTime() - since) / HOUR_MS), row.vwc);
    }

    const recommendation = recommend({
      now,
      startAt,
      soil: soilParams(model.soil),
      crop: cropParams(model.crop),
      daysSincePlanting: daysSincePlanting(model.plot, now, farm.timezone),
      plot: plotParams(model),
      hourly: weather.hourly,
      theta: latest?.theta ?? null,
      lastReadingAt: latest?.at ?? null,
    });

    return {
      model,
      recommendation,
      latest,
      sparkline: [...hourly.entries()].sort(([a], [b]) => a - b).map(([, vwc]) => vwc),
    };
  });
}
