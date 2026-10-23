/**
 * Deterministic stand-in weather used by tests and whenever Open-Meteo is
 * unreachable with nothing cached. Clearly labelled `source: 'synthetic'`.
 * Shape: dry, sunny days with ~5–6.5 mm ET₀, roughly an October day in Al Ain.
 */

import { DAY_MS, HOUR_MS, zonedDate, zonedParts, type DailyForecast } from '@furrow/shared';

import type { WeatherData } from '../db/schema';

const PAST_DAYS = 15;
const FUTURE_DAYS = 8;

/** Share of daily ET₀ falling in each local hour (mid-hour sun curve, 06:00–18:00). */
const ET0_SHAPE = (() => {
  const weights = Array.from({ length: 24 }, (_, hour) =>
    Math.max(0, Math.sin((Math.PI * (hour + 0.5 - 6)) / 12)),
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => w / total);
})();

function dailyEt0(dayIndex: number): number {
  return 5.8 + 0.6 * Math.sin(dayIndex * 0.9);
}

export function syntheticWeather(location: { timezone: string }, now: number): WeatherData {
  const { timezone } = location;
  const firstHour = Math.floor(now / HOUR_MS) * HOUR_MS - PAST_DAYS * DAY_MS;
  const lastHour = Math.floor(now / HOUR_MS) * HOUR_MS + FUTURE_DAYS * DAY_MS;

  const hourly: WeatherData['hourly'] = [];
  for (let end = firstHour + HOUR_MS; end <= lastHour; end += HOUR_MS) {
    const mid = end - HOUR_MS / 2;
    const { hour } = zonedParts(mid, timezone);
    const dayIndex = Math.floor(mid / DAY_MS);
    const diurnal = Math.cos((2 * Math.PI * (hour + 0.5 - 15)) / 24);
    hourly.push({
      time: end,
      et0: dailyEt0(dayIndex) * (ET0_SHAPE[hour] ?? 0),
      precipitation: 0,
      precipitationProbability: 0,
      temperatureC: Math.round((29 + 6 * diurnal) * 10) / 10,
      humidity: Math.round(50 - 20 * diurnal),
    });
  }

  const byDate = new Map<string, DailyForecast>();
  for (const h of hourly) {
    const date = zonedDate(h.time - HOUR_MS / 2, timezone);
    const day = byDate.get(date) ?? {
      date,
      maxTempC: Number.NEGATIVE_INFINITY,
      minTempC: Number.POSITIVE_INFINITY,
      rainMm: 0,
      rainProbability: 0,
      et0Mm: 0,
    };
    day.et0Mm += h.et0;
    day.rainMm += h.precipitation;
    day.maxTempC = Math.max(day.maxTempC, h.temperatureC ?? day.maxTempC);
    day.minTempC = Math.min(day.minTempC, h.temperatureC ?? day.minTempC);
    byDate.set(date, day);
  }

  return {
    source: 'synthetic',
    fetchedAt: now,
    timezone,
    hourly,
    daily: [...byDate.values()].map((day) => ({
      ...day,
      et0Mm: Math.round(day.et0Mm * 100) / 100,
    })),
  };
}
