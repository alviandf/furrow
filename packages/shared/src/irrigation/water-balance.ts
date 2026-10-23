/**
 * Root-zone water balance, FAO-56 Chapter 8.
 * Units: θ in m³/m³, depths in mm, root depth in m.
 */

export const P_MIN = 0.1;
export const P_MAX = 0.8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** p adjusted for the crop's water use: p = p_table + 0.04 (5 − ETc), limited to 0.1–0.8. */
export function adjustDepletionFraction(pTable: number, etcMmPerDay: number): number {
  return clamp(pTable + 0.04 * (5 - etcMmPerDay), P_MIN, P_MAX);
}

/** TAW = 1000 (θFC − θWP) Zr — Eq. 82 */
export function totalAvailableWater(
  fieldCapacity: number,
  wiltingPoint: number,
  rootDepthM: number,
): number {
  return 1000 * (fieldCapacity - wiltingPoint) * rootDepthM;
}

/** RAW = p · TAW — Eq. 83 */
export function readilyAvailableWater(taw: number, p: number): number {
  return p * taw;
}

/** Dr = 1000 (θFC − θ) Zr, bounded to 0 ≤ Dr ≤ TAW — Eqs. 86–87 */
export function rootZoneDepletion(
  theta: number,
  fieldCapacity: number,
  rootDepthM: number,
  taw: number,
): number {
  return clamp(1000 * (fieldCapacity - theta) * rootDepthM, 0, taw);
}

/** Water content at which depletion reaches RAW; the bottom of the target band. */
export function refillPoint(fieldCapacity: number, raw: number, rootDepthM: number): number {
  return fieldCapacity - raw / (1000 * rootDepthM);
}

/** Ks = (TAW − Dr) / ((1 − p) TAW) once Dr > RAW, otherwise 1 — Eq. 84 */
export function waterStressCoefficient(taw: number, p: number, depletion: number): number {
  if (taw <= 0) return 0;
  if (depletion <= p * taw) return 1;
  return clamp((taw - depletion) / ((1 - p) * taw), 0, 1);
}

/** Water content for a given depletion — the inverse of {@link rootZoneDepletion}. */
export function thetaForDepletion(
  depletion: number,
  fieldCapacity: number,
  rootDepthM: number,
): number {
  return fieldCapacity - depletion / (1000 * rootDepthM);
}
