/**
 * Irrigation recommendation (PRD Appendix A.2).
 *
 * All times are epoch milliseconds. The caller decides the start time S of the
 * next irrigation window (see `irrigationWindowStart` in time.ts) so this
 * module stays free of time-zone logic.
 */

import { cropCoefficient, type CropParams, type GrowthStage } from './kc';
import {
  adjustDepletionFraction,
  clamp,
  readilyAvailableWater,
  refillPoint,
  rootZoneDepletion,
  totalAvailableWater,
} from './water-balance';
import { DAY_MS, HOUR_MS, effectiveRain, lastHour, sumEt0, type HourlyWeather } from './weather';

export const OFFLINE_AFTER_MS = 2 * HOUR_MS;
export const OVERWATER_TOLERANCE = 0.02;
export const DURATION_STEP_MIN = 5;

export type Action =
  'IRRIGATE_NOW' | 'SENSOR_OFFLINE' | 'PAUSE' | 'IRRIGATE_TONIGHT' | 'SKIP_RAIN' | 'NO_ACTION';

export type PlotStatus = 'OPTIMAL' | 'NEEDS_WATER' | 'OVERWATERED' | 'OFFLINE';

/** Sort order for the overview: lower comes first. */
export const ACTION_PRIORITY: Record<Action, number> = {
  IRRIGATE_NOW: 0,
  SENSOR_OFFLINE: 1,
  PAUSE: 2,
  IRRIGATE_TONIGHT: 3,
  SKIP_RAIN: 4,
  NO_ACTION: 5,
};

export interface SoilParams {
  fieldCapacity: number;
  wiltingPoint: number;
}

export interface PlotParams {
  rootDepthM: number;
  /** Application efficiency Ea, 0–1. */
  efficiency: number;
  areaM2: number;
  flowRateLph: number;
}

export interface BudgetInput {
  now: number;
  /** Start of the next irrigation window (S). Equal to `now` inside the window. */
  startAt: number;
  soil: SoilParams;
  crop: CropParams;
  daysSincePlanting: number | null;
  plot: PlotParams;
  hourly: readonly HourlyWeather[];
}

export interface WaterBudget {
  kc: number;
  stage: GrowthStage;
  day: number | null;
  et0Next24hMm: number;
  etcNext24hMm: number;
  p: number;
  tawMm: number;
  rawMm: number;
  refillPoint: number;
  /** Crop water use between now and S. */
  etcBeforeStartMm: number;
  effectiveRainBeforeStartMm: number;
  effectiveRainNext24hMm: number;
}

export interface IrrigationAmount {
  netDepthMm: number;
  grossDepthMm: number;
  volumeL: number;
  /** Rounded to the nearest 5 minutes. */
  durationMin: number;
}

export interface RecommendInput extends BudgetInput {
  /** Latest reading (m³/m³), possibly stale. */
  theta: number | null;
  lastReadingAt: number | null;
}

export interface Recommendation {
  action: Action;
  status: PlotStatus;
  /** Planned start for IRRIGATE_NOW / IRRIGATE_TONIGHT. */
  startAt: number | null;
  /** When the crop is projected to pass RAW, if that happens before S. */
  stressAt: number | null;
  amount: IrrigationAmount | null;
  /** NO_ACTION only: start of the window in which irrigation is next expected. */
  nextIrrigationAt: number | null;
  daysUntilNext: number | null;
  budget: WaterBudget;
  depletionMm: number | null;
  depletionAtStartMm: number | null;
  depletionAfter24hMm: number | null;
}

/** Soil water budget for the next window; shared by the recommendation and the demo seed. */
export function waterBudget(input: BudgetInput): WaterBudget {
  const { now, startAt, soil, crop, daysSincePlanting, plot, hourly } = input;
  const { kc, stage, day } = cropCoefficient(crop, daysSincePlanting);
  const windowEnd = startAt + DAY_MS;

  const et0Next24hMm = sumEt0(hourly, startAt, windowEnd);
  const etcNext24hMm = kc * et0Next24hMm;
  const p = adjustDepletionFraction(crop.pTable, etcNext24hMm);
  const tawMm = totalAvailableWater(soil.fieldCapacity, soil.wiltingPoint, plot.rootDepthM);
  const rawMm = readilyAvailableWater(tawMm, p);

  return {
    kc,
    stage,
    day,
    et0Next24hMm,
    etcNext24hMm,
    p,
    tawMm,
    rawMm,
    refillPoint: refillPoint(soil.fieldCapacity, rawMm, plot.rootDepthM),
    etcBeforeStartMm: kc * sumEt0(hourly, now, startAt),
    effectiveRainBeforeStartMm: effectiveRain(hourly, now, startAt),
    effectiveRainNext24hMm: effectiveRain(hourly, startAt, windowEnd),
  };
}

/** Net depth → gross depth, volume (1 mm over 1 m² = 1 L) and run time. */
export function irrigationAmount(netDepthMm: number, plot: PlotParams): IrrigationAmount {
  const grossDepthMm = netDepthMm / plot.efficiency;
  const volumeL = grossDepthMm * plot.areaM2;
  const minutes = (volumeL / plot.flowRateLph) * 60;
  const durationMin = Math.max(
    DURATION_STEP_MIN,
    Math.round(minutes / DURATION_STEP_MIN) * DURATION_STEP_MIN,
  );
  return { netDepthMm, grossDepthMm, volumeL, durationMin };
}

export function recommend(input: RecommendInput): Recommendation {
  const { now, startAt, soil, plot, hourly, theta, lastReadingAt } = input;
  const budget = waterBudget(input);
  const { kc, tawMm, rawMm } = budget;

  const base = {
    startAt: null,
    stressAt: null,
    amount: null,
    nextIrrigationAt: null,
    daysUntilNext: null,
    budget,
    depletionMm: null,
    depletionAtStartMm: null,
    depletionAfter24hMm: null,
  } satisfies Omit<Recommendation, 'action' | 'status'>;

  if (theta === null || lastReadingAt === null) {
    return { ...base, action: 'SENSOR_OFFLINE', status: 'OFFLINE' };
  }

  const depletionMm = rootZoneDepletion(theta, soil.fieldCapacity, plot.rootDepthM, tawMm);
  const depletionAtStartMm = clamp(
    depletionMm + budget.etcBeforeStartMm - budget.effectiveRainBeforeStartMm,
    0,
    tawMm,
  );
  const dryAfter24h = depletionAtStartMm + budget.etcNext24hMm;
  const depletionAfter24hMm = clamp(dryAfter24h - budget.effectiveRainNext24hMm, 0, tawMm);
  const withDepletion = { ...base, depletionMm, depletionAtStartMm, depletionAfter24hMm };

  if (now - lastReadingAt > OFFLINE_AFTER_MS) {
    return { ...withDepletion, action: 'SENSOR_OFFLINE', status: 'OFFLINE' };
  }

  const overwatered = theta > soil.fieldCapacity + OVERWATER_TOLERANCE;
  const status: PlotStatus = overwatered
    ? 'OVERWATERED'
    : depletionMm >= rawMm
      ? 'NEEDS_WATER'
      : 'OPTIMAL';

  if (overwatered) {
    return { ...withDepletion, action: 'PAUSE', status };
  }

  if (depletionMm >= rawMm) {
    return {
      ...withDepletion,
      action: 'IRRIGATE_NOW',
      status,
      startAt: now,
      amount: irrigationAmount(depletionMm, plot),
    };
  }

  if (depletionAtStartMm >= rawMm) {
    return {
      ...withDepletion,
      action: 'IRRIGATE_NOW',
      status,
      startAt: now,
      stressAt: stressCrossing(hourly, kc, depletionMm, rawMm, now, startAt),
      amount: irrigationAmount(depletionMm, plot),
    };
  }

  if (depletionAfter24hMm >= rawMm) {
    return {
      ...withDepletion,
      action: 'IRRIGATE_TONIGHT',
      status,
      startAt,
      amount: irrigationAmount(depletionAtStartMm, plot),
    };
  }

  if (dryAfter24h >= rawMm) {
    return { ...withDepletion, action: 'SKIP_RAIN', status };
  }

  const next = nextIrrigation(hourly, kc, depletionAfter24hMm, rawMm, tawMm, startAt);
  return { ...withDepletion, action: 'NO_ACTION', status, ...next };
}

/** Steps hour by hour from now until depletion reaches RAW (rain ignored, conservative). */
function stressCrossing(
  hourly: readonly HourlyWeather[],
  kc: number,
  depletionMm: number,
  rawMm: number,
  now: number,
  until: number,
): number {
  let depletion = depletionMm;
  for (let t = now; t < until; t += HOUR_MS) {
    const end = Math.min(t + HOUR_MS, until);
    depletion += kc * sumEt0(hourly, t, end);
    if (depletion >= rawMm) return end;
  }
  return until;
}

/** Walks the forecast one window at a time until projected depletion reaches RAW. */
function nextIrrigation(
  hourly: readonly HourlyWeather[],
  kc: number,
  depletionAfterFirstWindow: number,
  rawMm: number,
  tawMm: number,
  startAt: number,
): Pick<Recommendation, 'nextIrrigationAt' | 'daysUntilNext'> {
  const dataEnd = lastHour(hourly);
  let depletion = depletionAfterFirstWindow;

  for (let k = 1; ; k++) {
    const from = startAt + k * DAY_MS;
    const to = from + DAY_MS;
    if (to > dataEnd) return { nextIrrigationAt: null, daysUntilNext: null };
    depletion = clamp(
      depletion + kc * sumEt0(hourly, from, to) - effectiveRain(hourly, from, to),
      0,
      tawMm,
    );
    if (depletion >= rawMm) return { nextIrrigationAt: from, daysUntilNext: k };
  }
}
