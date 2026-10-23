/**
 * One step of the soil-moisture simulator (PRD Appendix A.4).
 * Physics only — scheduling, noise and storage live in the API.
 */

import {
  adjustDepletionFraction,
  rootZoneDepletion,
  totalAvailableWater,
  waterStressCoefficient,
} from './water-balance';

export interface SimulationParams {
  fieldCapacity: number;
  wiltingPoint: number;
  rootDepthM: number;
  kc: number;
  pTable: number;
  /** Share of the water above field capacity that drains per hour. */
  drainagePerHour: number;
}

export interface SimulationInputs {
  dtHours: number;
  /** ET₀ during this step, mm. */
  et0Mm: number;
  /** Crop water use for the whole day, used to adjust p. */
  etcDailyMm: number;
  rainMm: number;
  /** Net irrigation reaching the root zone during this step, mm. */
  irrigationNetMm: number;
}

export function simulateStep(
  theta: number,
  inputs: SimulationInputs,
  params: SimulationParams,
): number {
  const { fieldCapacity, wiltingPoint, rootDepthM, kc, pTable, drainagePerHour } = params;
  const mmToTheta = 1 / (1000 * rootDepthM);

  const taw = totalAvailableWater(fieldCapacity, wiltingPoint, rootDepthM);
  const p = adjustDepletionFraction(pTable, inputs.etcDailyMm);
  const ks = waterStressCoefficient(
    taw,
    p,
    rootZoneDepletion(theta, fieldCapacity, rootDepthM, taw),
  );

  let next = theta - ks * kc * inputs.et0Mm * mmToTheta;
  next += (inputs.rainMm + inputs.irrigationNetMm) * mmToTheta;

  if (next > fieldCapacity) {
    next = fieldCapacity + (next - fieldCapacity) * Math.pow(1 - drainagePerHour, inputs.dtHours);
  }
  return Math.max(next, wiltingPoint);
}
