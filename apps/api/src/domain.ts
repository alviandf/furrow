import type { CropParams, PlotParams, SoilParams } from '@furrow/shared';
import { daysBetween, zonedDate } from '@furrow/shared';
import { asc, eq, inArray, and } from 'drizzle-orm';

import type { Db } from './db/client';
import { crops, plots, soils, type Crop, type Farm, type Plot, type Soil } from './db/schema';

/** A plot joined with its crop and soil — everything the model needs. */
export interface PlotModel {
  plot: Plot;
  crop: Crop;
  soil: Soil;
}

export async function loadPlotModels(
  db: Db,
  farmId: string,
  plotIds?: string[],
): Promise<PlotModel[]> {
  const where = plotIds
    ? and(eq(plots.farmId, farmId), inArray(plots.id, plotIds))
    : eq(plots.farmId, farmId);
  const rows = await db
    .select({ plot: plots, crop: crops, soil: soils })
    .from(plots)
    .innerJoin(crops, eq(plots.cropId, crops.id))
    .innerJoin(soils, eq(plots.soilId, soils.id))
    .where(where)
    .orderBy(asc(plots.sortOrder));
  return rows;
}

export function cropParams(crop: Crop): CropParams {
  return {
    kcIni: crop.kcIni,
    kcMid: crop.kcMid,
    kcEnd: crop.kcEnd,
    pTable: crop.pTable,
    stageDays: crop.stageDays,
  };
}

export function soilParams(soil: Soil): SoilParams {
  return { fieldCapacity: soil.fieldCapacity, wiltingPoint: soil.wiltingPoint };
}

export function plotParams({ plot, crop }: PlotModel): PlotParams {
  return {
    rootDepthM: plot.rootDepthM ?? crop.rootDepthM,
    efficiency: plot.efficiency,
    areaM2: plot.areaM2,
    flowRateLph: plot.flowRateLph,
  };
}

export function drainagePerHour({ plot, soil }: PlotModel): number {
  return plot.drainagePerHour ?? soil.drainagePerHour;
}

export function daysSincePlanting(plot: Plot, now: number, timeZone: string): number | null {
  return plot.plantedOn ? daysBetween(plot.plantedOn, zonedDate(now, timeZone)) : null;
}

export function irrigationWindow(farm: Farm) {
  return { start: farm.irrigationWindowStart, end: farm.irrigationWindowEnd };
}

/** Volume of a logged irrigation; falls back to duration × flow rate. */
export function irrigationVolumeL(details: Record<string, unknown>, plot: Plot): number {
  if (typeof details.volumeL === 'number') return details.volumeL;
  const minutes = typeof details.durationMin === 'number' ? details.durationMin : 0;
  return (minutes / 60) * plot.flowRateLph;
}
