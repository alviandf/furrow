import {
  DAY_MS,
  HOUR_MS,
  round,
  toZonedIso,
  type ChartEvent,
  type ReadingsRange,
  type ReadingsResponse,
} from '@furrow/shared';
import { and, asc, eq, gt, lte } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities, sensorReadings, type WeatherData } from '../db/schema';
import { irrigationVolumeL } from '../domain';
import type { PlotView } from './plot-views';

const RAIN_EVENT_MIN_MM = 0.2;

/**
 * Chart data: raw 15-minute readings for 24 h, hourly averages for 7 days,
 * plus irrigation and rain markers in the same range. The 7-day series ends on
 * the latest raw reading so the line finishes where the readout does.
 */
export async function getReadings(
  db: Db,
  options: { view: PlotView; range: ReadingsRange; now: number; weather: WeatherData; tz: string },
): Promise<ReadingsResponse> {
  const { view, range, now, weather, tz } = options;
  const plotId = view.model.plot.id;
  const from = now - (range === '24h' ? DAY_MS : 7 * DAY_MS);

  const rows = await db
    .select({ recordedAt: sensorReadings.recordedAt, vwc: sensorReadings.vwc })
    .from(sensorReadings)
    .where(
      and(
        eq(sensorReadings.plotId, plotId),
        gt(sensorReadings.recordedAt, new Date(from)),
        lte(sensorReadings.recordedAt, new Date(now)),
      ),
    )
    .orderBy(asc(sensorReadings.recordedAt));

  let points: ReadingsResponse['points'];
  if (range === '24h') {
    points = rows.map((r) => ({ t: toZonedIso(r.recordedAt.getTime(), tz), vwc: r.vwc }));
  } else {
    const buckets = new Map<number, { sum: number; count: number; last: number }>();
    for (const r of rows) {
      const t = r.recordedAt.getTime();
      const key = Math.floor((t - 1) / HOUR_MS);
      const bucket = buckets.get(key) ?? { sum: 0, count: 0, last: t };
      bucket.sum += r.vwc;
      bucket.count += 1;
      bucket.last = t;
      buckets.set(key, bucket);
    }
    points = [...buckets.values()].map((b) => ({
      t: toZonedIso(b.last, tz),
      vwc: round(b.sum / b.count, 4),
    }));
    // The current hour is still filling up, and averaging it would hide a
    // watering logged minutes ago.
    const latest = rows.at(-1);
    if (latest && points.length > 0) {
      points[points.length - 1] = {
        t: toZonedIso(latest.recordedAt.getTime(), tz),
        vwc: latest.vwc,
      };
    }
  }

  const irrigations = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.plotId, plotId),
        eq(activities.type, 'irrigation'),
        gt(activities.occurredAt, new Date(from)),
        lte(activities.occurredAt, new Date(now)),
      ),
    )
    .orderBy(asc(activities.occurredAt));

  const events: ChartEvent[] = [
    ...irrigations.map((a) => ({
      type: 'irrigation' as const,
      t: toZonedIso(a.occurredAt.getTime(), tz),
      amount: Math.round(irrigationVolumeL(a.details, view.model.plot)),
      unit: 'L' as const,
    })),
    ...weather.hourly
      .filter((h) => h.time > from && h.time <= now && h.precipitation >= RAIN_EVENT_MIN_MM)
      .map((h) => ({
        type: 'rain' as const,
        t: toZonedIso(h.time, tz),
        amount: round(h.precipitation, 1),
        unit: 'mm' as const,
      })),
  ].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  return {
    range,
    from: toZonedIso(from, tz),
    to: toZonedIso(now, tz),
    points,
    events,
    target: {
      refillPoint: round(view.recommendation.budget.refillPoint, 4),
      fieldCapacity: view.model.soil.fieldCapacity,
    },
  };
}
