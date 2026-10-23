/**
 * Sensor simulator (PRD Appendix A.4): advances each plot in 15-minute steps
 * from its last simulated time up to now. Safe to call repeatedly — readings
 * are keyed by (plot, time) and state only moves forward.
 */

import {
  DAY_MS,
  HOUR_MS,
  cropCoefficient,
  simulateStep,
  sumEt0,
  sumPrecipitation,
  zonedDate,
} from '@furrow/shared';
import { and, asc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import {
  activities,
  plotSimState,
  sensorReadings,
  type Farm,
  type WeatherData,
} from '../db/schema';
import {
  cropParams,
  daysSincePlanting,
  drainagePerHour,
  irrigationVolumeL,
  loadPlotModels,
  plotParams,
  type PlotModel,
} from '../domain';

export const STEP_MS = 15 * 60_000;
export const MAX_CATCH_UP_MS = 14 * DAY_MS;
const SENSOR_NOISE_SIGMA = 0.001;
const INSERT_CHUNK = 1000;

/** Grid times (multiples of 15 min) in (from, to]. */
export function gridPoints(from: number, to: number): number[] {
  const points: number[] = [];
  for (let t = Math.floor(from / STEP_MS) * STEP_MS + STEP_MS; t <= to; t += STEP_MS)
    points.push(t);
  return points;
}

/** FNV-1a → mulberry32: a reproducible pseudo-random number in [0, 1) per key. */
function seededRandom(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let t = (hash + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Gaussian sensor noise (Box–Muller), identical for the same plot and time. */
export function sensorNoise(plotId: string, time: number): number {
  const u1 = Math.max(seededRandom(`${plotId}:${time}:a`), 1e-12);
  const u2 = seededRandom(`${plotId}:${time}:b`);
  return SENSOR_NOISE_SIGMA * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function reportedVwc(plotId: string, time: number, theta: number): number {
  const value = Math.min(0.6, Math.max(0, theta + sensorNoise(plotId, time)));
  return Math.round(value * 10_000) / 10_000;
}

/** Net irrigation depth reaching the root zone for a logged irrigation, mm. */
export function irrigationNetMm(details: Record<string, unknown>, model: PlotModel): number {
  return (irrigationVolumeL(details, model.plot) * model.plot.efficiency) / model.plot.areaM2;
}

/** One simulation step for a plot between two instants. */
export function stepPlot(
  model: PlotModel,
  theta: number,
  from: number,
  to: number,
  weather: WeatherData,
  irrigationMm: number,
  timeZone: string,
): number {
  const { kc } = cropCoefficient(
    cropParams(model.crop),
    daysSincePlanting(model.plot, to, timeZone),
  );
  const localDate = zonedDate(to, timeZone);
  const dailyEt0 = weather.daily.find((day) => day.date === localDate)?.et0Mm ?? 5;
  return simulateStep(
    theta,
    {
      dtHours: (to - from) / HOUR_MS,
      et0Mm: sumEt0(weather.hourly, from, to),
      etcDailyMm: kc * dailyEt0,
      rainMm: sumPrecipitation(weather.hourly, from, to),
      irrigationNetMm: irrigationMm,
    },
    {
      fieldCapacity: model.soil.fieldCapacity,
      wiltingPoint: model.soil.wiltingPoint,
      rootDepthM: plotParams(model).rootDepthM,
      kc,
      pTable: model.crop.pTable,
      drainagePerHour: drainagePerHour(model),
    },
  );
}

/** Upserts readings; the simulator's latest value for a timestamp wins. */
export async function insertReadings(
  db: Db,
  rows: Array<{ plotId: string; recordedAt: Date; vwc: number }>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await db
      .insert(sensorReadings)
      .values(rows.slice(i, i + INSERT_CHUNK))
      .onConflictDoUpdate({
        target: [sensorReadings.plotId, sensorReadings.recordedAt],
        set: { vwc: sql`excluded.vwc` },
      });
  }
}

/**
 * Advances plots to `now`. With `includeNow`, a final step ends exactly at
 * `now` (zero-length if the plot is already there), so a just-logged
 * irrigation shows up immediately.
 */
export async function advanceSimulation(
  db: Db,
  options: {
    farm: Farm;
    weather: WeatherData;
    now: number;
    plotIds?: string[];
    includeNow?: boolean;
  },
): Promise<number> {
  const { farm, weather, now } = options;
  const models = await loadPlotModels(db, farm.id, options.plotIds);
  if (models.length === 0) return 0;
  const ids = models.map((m) => m.plot.id);

  const states = await db.select().from(plotSimState).where(inArray(plotSimState.plotId, ids));
  const pending = await db
    .select()
    .from(activities)
    .where(
      and(
        inArray(activities.plotId, ids),
        eq(activities.type, 'irrigation'),
        isNull(activities.appliedAt),
        lte(activities.occurredAt, new Date(now)),
      ),
    )
    .orderBy(asc(activities.occurredAt));

  let written = 0;
  for (const model of models) {
    const state = states.find((s) => s.plotId === model.plot.id);
    if (!state || state.pausedAt) continue;

    let t = Math.max(state.asOf.getTime(), now - MAX_CATCH_UP_MS);
    let theta = state.theta;
    const endpoints = gridPoints(t, now);
    if (options.includeNow && now >= t && endpoints.at(-1) !== now) endpoints.push(now);
    if (endpoints.length === 0) continue;

    const queue = pending.filter((a) => a.plotId === model.plot.id);
    const applied: Array<{ id: string; at: number }> = [];
    const rows: Array<{ plotId: string; recordedAt: Date; vwc: number }> = [];

    for (const end of endpoints) {
      let irrigationMm = 0;
      while (queue[0] && queue[0].occurredAt.getTime() <= end) {
        const activity = queue.shift()!;
        irrigationMm += irrigationNetMm(activity.details, model);
        applied.push({ id: activity.id, at: end });
      }
      theta = stepPlot(model, theta, t, end, weather, irrigationMm, farm.timezone);
      rows.push({
        plotId: model.plot.id,
        recordedAt: new Date(end),
        vwc: reportedVwc(model.plot.id, end, theta),
      });
      t = end;
    }

    await insertReadings(db, rows);
    await db
      .update(plotSimState)
      .set({ theta, asOf: new Date(t) })
      .where(eq(plotSimState.plotId, model.plot.id));
    for (const { id, at } of applied) {
      await db
        .update(activities)
        .set({ appliedAt: new Date(at) })
        .where(eq(activities.id, id));
    }
    written += rows.length;
  }
  return written;
}
