import { describe, expect, it } from 'vitest';

import { openMeteoUrl, parseOpenMeteo } from '../src/weather/open-meteo';

describe('Open-Meteo client', () => {
  it('requests FAO-56 ET₀ with unix times, local time zone and 14 days of history', () => {
    const url = new URL(openMeteoUrl(24.2, 55.7));
    expect(url.searchParams.get('hourly')).toContain('et0_fao_evapotranspiration');
    expect(url.searchParams.get('daily')).toContain('precipitation_probability_max');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('past_days')).toBe('14');
  });

  it('parses hourly and daily series, tolerating nulls', () => {
    // 2026-10-21 00:00 in Asia/Dubai = 2026-10-20T20:00Z
    const midnight = Date.UTC(2026, 9, 20, 20) / 1000;
    const data = parseOpenMeteo(
      {
        timezone: 'Asia/Dubai',
        hourly: {
          time: [midnight + 3600, midnight + 7200],
          et0_fao_evapotranspiration: [0.02, null],
          precipitation: [0, 0.4],
          precipitation_probability: [5, null],
          temperature_2m: [26.1, 25.4],
          relative_humidity_2m: [61, null],
        },
        daily: {
          time: [midnight],
          et0_fao_evapotranspiration: [5.71],
          precipitation_sum: [0.4],
          precipitation_probability_max: [12],
          temperature_2m_max: [34.2],
          temperature_2m_min: [24.9],
        },
      },
      1_000,
    );

    expect(data.source).toBe('open-meteo');
    expect(data.hourly[0]).toEqual({
      time: (midnight + 3600) * 1000,
      et0: 0.02,
      precipitation: 0,
      precipitationProbability: 5,
      temperatureC: 26.1,
      humidity: 61,
    });
    expect(data.hourly[1]).toMatchObject({
      et0: 0,
      precipitationProbability: null,
      humidity: null,
    });
    expect(data.daily[0]).toEqual({
      date: '2026-10-21',
      maxTempC: 34.2,
      minTempC: 24.9,
      rainMm: 0.4,
      rainProbability: 12,
      et0Mm: 5.71,
    });
  });
});
