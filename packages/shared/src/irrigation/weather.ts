/**
 * Helpers over hourly weather. Each record follows Open-Meteo's convention:
 * `time` marks the END of the hour, and ET₀ / precipitation are sums over the
 * preceding hour (time − 1 h, time].
 */

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** Rain only counts when the forecast probability is at least this (product assumption). */
export const RAIN_PROBABILITY_THRESHOLD = 50;
/** FAO-56: daily rain below about 0.2 × ET₀ can usually be ignored. */
export const NEGLIGIBLE_RAIN_FRACTION = 0.2;

export interface HourlyWeather {
  /** End of the hour, epoch ms. */
  time: number;
  /** Reference evapotranspiration over the preceding hour, mm. */
  et0: number;
  /** Precipitation over the preceding hour, mm. */
  precipitation: number;
  /** Probability of precipitation, %. Null for observed (past) hours. */
  precipitationProbability: number | null;
}

/** Fraction of the hour ending at `time` that falls inside (from, to]. */
function overlap(time: number, from: number, to: number): number {
  const start = time - HOUR_MS;
  const covered = Math.min(time, to) - Math.max(start, from);
  return covered <= 0 ? 0 : covered / HOUR_MS;
}

function sumWeighted(
  hours: readonly HourlyWeather[],
  from: number,
  to: number,
  pick: (hour: HourlyWeather) => number,
): number {
  let total = 0;
  for (const hour of hours) {
    const weight = overlap(hour.time, from, to);
    if (weight > 0) total += weight * pick(hour);
  }
  return total;
}

/** Σ ET₀ over (from, to], counting partial hours proportionally. */
export function sumEt0(hours: readonly HourlyWeather[], from: number, to: number): number {
  return sumWeighted(hours, from, to, (hour) => hour.et0);
}

/** Σ precipitation over (from, to], ignoring probability (for observed weather). */
export function sumPrecipitation(
  hours: readonly HourlyWeather[],
  from: number,
  to: number,
): number {
  return sumWeighted(hours, from, to, (hour) => hour.precipitation);
}

/**
 * Effective rain over (from, to]: hours below the probability threshold are
 * dropped, and the total is ignored if it is below 0.2 × ET₀ for the same
 * period. Runoff is assumed to be zero.
 */
export function effectiveRain(hours: readonly HourlyWeather[], from: number, to: number): number {
  const et0 = sumEt0(hours, from, to);
  const rain = sumWeighted(hours, from, to, (hour) =>
    (hour.precipitationProbability ?? 100) >= RAIN_PROBABILITY_THRESHOLD ? hour.precipitation : 0,
  );
  return rain > 0 && rain >= NEGLIGIBLE_RAIN_FRACTION * et0 ? rain : 0;
}

/** Latest hour end covered by the data, or -Infinity when empty. */
export function lastHour(hours: readonly HourlyWeather[]): number {
  let latest = Number.NEGATIVE_INFINITY;
  for (const hour of hours) latest = Math.max(latest, hour.time);
  return latest;
}
