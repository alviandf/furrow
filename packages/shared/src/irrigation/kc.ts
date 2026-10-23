/**
 * Crop coefficient curve, FAO-56 Chapter 6 (single crop coefficient).
 * Kc is constant in the initial and mid-season stages and changes linearly
 * during development and late season.
 */

export type GrowthStage = 'initial' | 'development' | 'mid' | 'late' | 'complete' | 'perennial';

export interface CropParams {
  kcIni: number;
  kcMid: number;
  kcEnd: number;
  /** Depletion fraction p at ETc ≈ 5 mm/day (FAO-56 Table 22). */
  pTable: number;
  /** Stage lengths in days [initial, development, mid, late]; null for perennials. */
  stageDays: readonly [number, number, number, number] | null;
}

export interface CropCoefficient {
  kc: number;
  stage: GrowthStage;
  /** Days since planting; null for perennials. */
  day: number | null;
}

export function cropCoefficient(
  crop: CropParams,
  daysSincePlanting: number | null,
): CropCoefficient {
  if (crop.stageDays === null || daysSincePlanting === null) {
    return { kc: crop.kcMid, stage: 'perennial', day: null };
  }

  const day = Math.max(0, daysSincePlanting);
  const [ini, dev, mid, late] = crop.stageDays;

  if (day < ini) return { kc: crop.kcIni, stage: 'initial', day };
  if (day < ini + dev) {
    const kc = crop.kcIni + ((day - ini) / dev) * (crop.kcMid - crop.kcIni);
    return { kc, stage: 'development', day };
  }
  if (day < ini + dev + mid) return { kc: crop.kcMid, stage: 'mid', day };
  if (day <= ini + dev + mid + late) {
    const kc = crop.kcMid + ((day - ini - dev - mid) / late) * (crop.kcEnd - crop.kcMid);
    return { kc, stage: 'late', day };
  }
  return { kc: crop.kcEnd, stage: 'complete', day };
}

export function seasonLength(crop: CropParams): number | null {
  return crop.stageDays === null ? null : crop.stageDays.reduce((sum, days) => sum + days, 0);
}
