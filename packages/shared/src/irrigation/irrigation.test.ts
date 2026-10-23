import { describe, expect, it } from 'vitest';

import { cropCoefficient, type CropParams } from './kc';
import {
  irrigationAmount,
  recommend,
  type PlotParams,
  type RecommendInput,
  type SoilParams,
} from './recommend';
import { simulateStep, type SimulationParams } from './simulate';
import {
  adjustDepletionFraction,
  readilyAvailableWater,
  totalAvailableWater,
  waterStressCoefficient,
} from './water-balance';
import { HOUR_MS, effectiveRain, sumEt0, type HourlyWeather } from './weather';

/** Hourly records ending at from+1h … to, sharing `totalEt0` (and optional rain) evenly. */
function hours(
  from: number,
  to: number,
  totalEt0: number,
  rain: { totalMm: number; probability: number | null } = { totalMm: 0, probability: null },
): HourlyWeather[] {
  const count = Math.round((to - from) / HOUR_MS);
  return Array.from({ length: count }, (_, i) => ({
    time: from + (i + 1) * HOUR_MS,
    et0: totalEt0 / count,
    precipitation: rain.totalMm / count,
    precipitationProbability: rain.probability,
  }));
}

const TOMATO: CropParams = {
  kcIni: 0.6,
  kcMid: 1.15,
  kcEnd: 0.8,
  pTable: 0.4,
  stageDays: [35, 45, 70, 30],
};

const SANDY_LOAM: SoilParams = { fieldCapacity: 0.23, wiltingPoint: 0.1 };

const FIELD_3: PlotParams = { rootDepthM: 0.7, efficiency: 0.9, areaM2: 2000, flowRateLph: 9000 };

// 21:00 and 12:00 in Asia/Dubai (UTC+4) on 2026-10-21.
const NINE_PM = Date.UTC(2026, 9, 21, 17, 0);
const NOON = Date.UTC(2026, 9, 21, 8, 0);
const DAY = 24 * HOUR_MS;

function input(overrides: Partial<RecommendInput>): RecommendInput {
  return {
    now: NINE_PM,
    startAt: NINE_PM,
    soil: SANDY_LOAM,
    crop: TOMATO,
    daysSincePlanting: 100, // mid-season → Kc 1.15
    plot: FIELD_3,
    hourly: hours(NINE_PM, NINE_PM + 4 * DAY, 4 * 7.1),
    theta: 0.205,
    lastReadingAt: NINE_PM - 10 * 60_000,
    ...overrides,
  };
}

describe('FAO-56 water balance', () => {
  it('matches FAO-56 Example 37 for TAW and RAW', () => {
    const taw = totalAvailableWater(0.32, 0.12, 0.8);
    expect(taw).toBeCloseTo(160, 6);
    expect(readilyAvailableWater(taw, 0.4)).toBeCloseTo(64, 6);
  });

  it('matches FAO-56 Example 37 water stress coefficients', () => {
    expect(waterStressCoefficient(160, 0.4, 67.0)).toBeCloseTo(0.97, 2);
    expect(waterStressCoefficient(160, 0.4, 100.8)).toBeCloseTo(0.62, 2);
    expect(waterStressCoefficient(160, 0.4, 40)).toBe(1);
    expect(waterStressCoefficient(160, 0.4, 160)).toBe(0);
  });

  it('adjusts p for ETc and clamps it to 0.1–0.8', () => {
    expect(adjustDepletionFraction(0.4, 8.165)).toBeCloseTo(0.2734, 4);
    expect(adjustDepletionFraction(0.3, 12)).toBe(0.1);
    expect(adjustDepletionFraction(0.7, 0)).toBe(0.8);
  });
});

describe('crop coefficient curve', () => {
  it('follows the FAO-56 stage shape for tomato (35/45/70/30 days)', () => {
    expect(cropCoefficient(TOMATO, 20)).toMatchObject({ kc: 0.6, stage: 'initial' });
    expect(cropCoefficient(TOMATO, 62).kc).toBeCloseTo(0.93, 6);
    expect(cropCoefficient(TOMATO, 62).stage).toBe('development');
    expect(cropCoefficient(TOMATO, 100)).toMatchObject({ kc: 1.15, stage: 'mid' });
    expect(cropCoefficient(TOMATO, 165).kc).toBeCloseTo(0.975, 6);
    expect(cropCoefficient(TOMATO, 165).stage).toBe('late');
    expect(cropCoefficient(TOMATO, 200)).toMatchObject({ kc: 0.8, stage: 'complete' });
  });

  it('uses a constant mid-season Kc for perennials', () => {
    const datePalm: CropParams = {
      kcIni: 0.9,
      kcMid: 0.95,
      kcEnd: 0.95,
      pTable: 0.5,
      stageDays: null,
    };
    expect(cropCoefficient(datePalm, null)).toEqual({ kc: 0.95, stage: 'perennial', day: null });
  });
});

describe('weather sums', () => {
  it('ignores rain below 0.2 × ET₀ or below 50% probability', () => {
    const from = NINE_PM;
    const to = NINE_PM + DAY;
    const withRain = (totalMm: number, probability: number) =>
      effectiveRain(hours(from, to, 7.1, { totalMm, probability }), from, to);
    expect(withRain(1.0, 80)).toBe(0);
    expect(withRain(6.0, 80)).toBeCloseTo(6.0, 6);
    expect(withRain(6.0, 30)).toBe(0);
  });

  it('counts partial hours proportionally', () => {
    const data = hours(NINE_PM, NINE_PM + 2 * HOUR_MS, 2); // 1 mm per hour
    expect(sumEt0(data, NINE_PM + 30 * 60_000, NINE_PM + 2 * HOUR_MS)).toBeCloseTo(1.5, 6);
  });
});

describe('recommend', () => {
  it('reproduces the PRD worked example (A.3)', () => {
    const result = recommend(input({}));

    expect(result.action).toBe('IRRIGATE_TONIGHT');
    expect(result.status).toBe('OPTIMAL');
    expect(result.startAt).toBe(NINE_PM);
    expect(result.budget.etcNext24hMm).toBeCloseTo(8.165, 2);
    expect(result.budget.p).toBeCloseTo(0.2734, 3);
    expect(result.budget.tawMm).toBeCloseTo(91.0, 2);
    expect(result.budget.rawMm).toBeCloseTo(24.879, 2);
    expect(result.budget.refillPoint).toBeCloseTo(0.1945, 3);
    expect(result.depletionMm).toBeCloseTo(17.5, 2);
    expect(result.depletionAfter24hMm).toBeCloseTo(25.665, 2);
    expect(result.amount?.netDepthMm).toBeCloseTo(17.5, 2);
    expect(result.amount?.grossDepthMm).toBeCloseTo(19.444, 2);
    expect(result.amount?.volumeL).toBeCloseTo(38888.9, 0);
    expect(result.amount?.durationMin).toBe(260);
  });

  it('projects depletion to tonight when called at midday', () => {
    const hourly = [...hours(NOON, NINE_PM, 4.0), ...hours(NINE_PM, NINE_PM + 3 * DAY, 3 * 7.1)];
    const result = recommend(input({ now: NOON, startAt: NINE_PM, hourly, lastReadingAt: NOON }));

    expect(result.depletionAtStartMm).toBeCloseTo(22.1, 2);
    expect(result.action).toBe('IRRIGATE_TONIGHT');
    expect(result.amount?.netDepthMm).toBeCloseTo(22.1, 2);
    expect(result.amount?.volumeL).toBeCloseTo(49111.1, 0);
    expect(result.amount?.durationMin).toBe(325);
  });

  it('irrigates now when stress would arrive before the evening window', () => {
    const hourly = [...hours(NOON, NINE_PM, 4.0), ...hours(NINE_PM, NINE_PM + 3 * DAY, 3 * 7.1)];
    const result = recommend(
      input({ now: NOON, startAt: NINE_PM, hourly, lastReadingAt: NOON, theta: 0.195 }),
    );

    expect(result.status).toBe('OPTIMAL');
    expect(result.depletionMm).toBeCloseTo(24.5, 2);
    expect(result.depletionAtStartMm).toBeCloseTo(29.1, 2);
    expect(result.action).toBe('IRRIGATE_NOW');
    expect(result.stressAt).toBeGreaterThan(NOON);
    expect(result.stressAt).toBeLessThanOrEqual(NINE_PM);
    expect(result.amount?.netDepthMm).toBeCloseTo(24.5, 2);
    expect(result.amount?.volumeL).toBeCloseTo(54444.4, 0);
    expect(result.amount?.durationMin).toBe(365);
  });

  it('flags depletion past RAW as needs water', () => {
    const result = recommend(input({ theta: 0.18 }));
    expect(result.status).toBe('NEEDS_WATER');
    expect(result.action).toBe('IRRIGATE_NOW');
  });

  it('skips irrigation when forecast rain covers the deficit', () => {
    const hourly = [
      ...hours(NINE_PM, NINE_PM + DAY, 7.1, { totalMm: 6, probability: 80 }),
      ...hours(NINE_PM + DAY, NINE_PM + 4 * DAY, 3 * 7.1),
    ];
    const result = recommend(input({ hourly }));
    expect(result.depletionAfter24hMm).toBeCloseTo(19.665, 2);
    expect(result.action).toBe('SKIP_RAIN');
  });

  it('estimates the next irrigation when nothing is needed tonight', () => {
    const result = recommend(input({ theta: 0.22 }));
    expect(result.action).toBe('NO_ACTION');
    expect(result.daysUntilNext).toBe(2);
    expect(result.nextIrrigationAt).toBe(NINE_PM + 2 * DAY);
  });

  it('pauses irrigation above field capacity', () => {
    const result = recommend(input({ theta: 0.26 }));
    expect(result).toMatchObject({ action: 'PAUSE', status: 'OVERWATERED', amount: null });
  });

  it('reports a sensor as offline after 2 h without readings', () => {
    const result = recommend(input({ lastReadingAt: NINE_PM - 3 * HOUR_MS }));
    expect(result).toMatchObject({ action: 'SENSOR_OFFLINE', status: 'OFFLINE', amount: null });
  });

  it('rounds run time to the nearest 5 minutes, never below 5', () => {
    expect(irrigationAmount(17.5, FIELD_3).durationMin).toBe(260);
    expect(irrigationAmount(0.01, FIELD_3).durationMin).toBe(5);
  });
});

describe('simulateStep', () => {
  const params: SimulationParams = {
    fieldCapacity: 0.23,
    wiltingPoint: 0.1,
    rootDepthM: 0.5,
    kc: 1,
    pTable: 0.4,
    drainagePerHour: 0.1,
  };
  const still = { dtHours: 1, et0Mm: 0, etcDailyMm: 5, rainMm: 0, irrigationNetMm: 0 };

  it('drains water above field capacity exponentially', () => {
    expect(simulateStep(0.27, still, params)).toBeCloseTo(0.23 + 0.04 * 0.9, 6);
  });

  it('adds net irrigation as depth over the root zone', () => {
    expect(simulateStep(0.18, { ...still, irrigationNetMm: 10 }, params)).toBeCloseTo(0.2, 6);
  });

  it('stops drying at the wilting point (Ks = 0)', () => {
    expect(simulateStep(0.1, { ...still, et0Mm: 2 }, params)).toBe(0.1);
  });

  it('dries at the full crop rate while depletion is below RAW', () => {
    expect(simulateStep(0.22, { ...still, et0Mm: 1 }, params)).toBeCloseTo(0.218, 6);
  });
});
