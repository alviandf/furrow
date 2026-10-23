import { zonedDate } from '@furrow/shared';

import type { WeatherData } from '../db/schema';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const HOURLY = [
  'et0_fao_evapotranspiration',
  'precipitation',
  'precipitation_probability',
  'temperature_2m',
  'relative_humidity_2m',
] as const;

const DAILY = [
  'et0_fao_evapotranspiration',
  'precipitation_sum',
  'precipitation_probability_max',
  'temperature_2m_max',
  'temperature_2m_min',
] as const;

type Series = (number | null)[];

interface OpenMeteoResponse {
  timezone: string;
  hourly: Record<(typeof HOURLY)[number], Series> & { time: number[] };
  daily: Record<(typeof DAILY)[number], Series> & { time: number[] };
}

export function openMeteoUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
    timezone: 'auto',
    timeformat: 'unixtime',
    past_days: '14',
    forecast_days: '7',
  });
  return `${BASE_URL}?${params}`;
}

export async function fetchOpenMeteo(
  location: { latitude: number; longitude: number },
  options: { now: number; timeoutMs?: number },
): Promise<WeatherData> {
  const response = await fetch(openMeteoUrl(location.latitude, location.longitude), {
    signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
    headers: { 'user-agent': 'furrow-demo/0.1 (+https://github.com/alviandf/furrow)' },
  });
  if (!response.ok) throw new Error(`Open-Meteo responded with ${response.status}`);
  return parseOpenMeteo((await response.json()) as OpenMeteoResponse, options.now);
}

export function parseOpenMeteo(body: OpenMeteoResponse, fetchedAt: number): WeatherData {
  const { hourly, daily, timezone } = body;
  return {
    source: 'open-meteo',
    fetchedAt,
    timezone,
    hourly: hourly.time.map((seconds, i) => ({
      time: seconds * 1000,
      et0: hourly.et0_fao_evapotranspiration[i] ?? 0,
      precipitation: hourly.precipitation[i] ?? 0,
      precipitationProbability: hourly.precipitation_probability[i] ?? null,
      temperatureC: hourly.temperature_2m[i] ?? null,
      humidity: hourly.relative_humidity_2m[i] ?? null,
    })),
    daily: daily.time.map((seconds, i) => ({
      date: zonedDate(seconds * 1000, timezone),
      maxTempC: daily.temperature_2m_max[i] ?? 0,
      minTempC: daily.temperature_2m_min[i] ?? 0,
      rainMm: daily.precipitation_sum[i] ?? 0,
      rainProbability: daily.precipitation_probability_max[i] ?? null,
      et0Mm: daily.et0_fao_evapotranspiration[i] ?? 0,
    })),
  };
}
