import {
  round,
  seasonLength,
  toZonedIso,
  type ActivityDto,
  type DailyForecast,
  type FarmDto,
  type PlotDetailDto,
  type PlotSummaryDto,
  type RecommendationDto,
  type WeatherMeta,
} from '@furrow/shared';

import type { ActivityRow, Farm } from '../db/schema';
import { cropParams, plotParams } from '../domain';
import type { PlotView } from '../services/plot-views';
import type { WeatherResult } from '../weather/service';

const iso = (epochMs: number | null, tz: string) =>
  epochMs === null ? null : toZonedIso(epochMs, tz);
const mm = (value: number | null) => (value === null ? null : round(value, 2));

export function farmDto(farm: Farm): FarmDto {
  return {
    id: farm.id,
    name: farm.name,
    location: farm.location,
    timezone: farm.timezone,
    latitude: farm.latitude,
    longitude: farm.longitude,
    irrigationWindow: { start: farm.irrigationWindowStart, end: farm.irrigationWindowEnd },
  };
}

export function weatherMeta(result: WeatherResult, tz: string): WeatherMeta {
  return {
    fetchedAt: toZonedIso(result.data.fetchedAt, tz),
    source: result.data.source,
    stale: result.stale,
    attribution:
      result.data.source === 'open-meteo'
        ? { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/' }
        : null,
  };
}

export function dailyForecastDto(day: DailyForecast): DailyForecast {
  return {
    ...day,
    maxTempC: round(day.maxTempC, 1),
    minTempC: round(day.minTempC, 1),
    rainMm: round(day.rainMm, 1),
    et0Mm: round(day.et0Mm, 2),
  };
}

export function recommendationDto(view: PlotView, tz: string): RecommendationDto {
  const r = view.recommendation;
  const { model } = view;
  const params = plotParams(model);
  return {
    action: r.action,
    startAt: iso(r.startAt, tz),
    stressAt: iso(r.stressAt, tz),
    netDepthMm: mm(r.amount?.netDepthMm ?? null),
    grossDepthMm: mm(r.amount?.grossDepthMm ?? null),
    volumeL: r.amount ? Math.round(r.amount.volumeL) : null,
    durationMin: r.amount?.durationMin ?? null,
    nextIrrigationAt: iso(r.nextIrrigationAt, tz),
    daysUntilNext: r.daysUntilNext,
    inputs: {
      vwc: view.latest ? round(view.latest.theta, 4) : null,
      fieldCapacity: model.soil.fieldCapacity,
      wiltingPoint: model.soil.wiltingPoint,
      rootDepthM: params.rootDepthM,
      kc: round(r.budget.kc, 3),
      growthStage: r.budget.stage,
      dayOfSeason: r.budget.day,
      et0Next24hMm: round(r.budget.et0Next24hMm, 2),
      etcNext24hMm: round(r.budget.etcNext24hMm, 2),
      etcBeforeStartMm: round(r.budget.etcBeforeStartMm, 2),
      p: round(r.budget.p, 4),
      tawMm: round(r.budget.tawMm, 2),
      rawMm: round(r.budget.rawMm, 2),
      refillPoint: round(r.budget.refillPoint, 4),
      depletionMm: mm(r.depletionMm),
      depletionAtStartMm: mm(r.depletionAtStartMm),
      depletionAfter24hMm: mm(r.depletionAfter24hMm),
      effectiveRainMm: round(r.budget.effectiveRainNext24hMm, 2),
      efficiency: params.efficiency,
      flowRateLph: params.flowRateLph,
      areaM2: params.areaM2,
    },
  };
}

export function plotSummaryDto(view: PlotView, tz: string): PlotSummaryDto {
  const { model, recommendation: r } = view;
  return {
    id: model.plot.id,
    name: model.plot.name,
    crop: { id: model.crop.id, name: model.crop.name },
    growthStage: r.budget.stage,
    dayOfSeason: r.budget.day,
    seasonLength: seasonLength(cropParams(model.crop)),
    soil: { id: model.soil.id, name: model.soil.name },
    irrigationMethod: model.plot.irrigationMethod,
    status: r.status,
    latest: view.latest
      ? { vwc: round(view.latest.theta, 4), recordedAt: toZonedIso(view.latest.at, tz) }
      : null,
    sparkline: view.sparkline.map((v) => round(v, 4)),
    target: {
      refillPoint: round(r.budget.refillPoint, 4),
      fieldCapacity: model.soil.fieldCapacity,
    },
    recommendation: recommendationDto(view, tz),
  };
}

export function plotDetailDto(
  view: PlotView,
  tz: string,
  recentActivities: ActivityDto[],
): PlotDetailDto {
  const { model } = view;
  const params = plotParams(model);
  return {
    ...plotSummaryDto(view, tz),
    areaM2: params.areaM2,
    flowRateLph: params.flowRateLph,
    efficiency: params.efficiency,
    rootDepthM: params.rootDepthM,
    plantedOn: model.plot.plantedOn,
    soilParams: { fieldCapacity: model.soil.fieldCapacity, wiltingPoint: model.soil.wiltingPoint },
    recentActivities,
  };
}

export function activityDto(row: ActivityRow, plotName: string, tz: string): ActivityDto {
  return {
    id: row.id,
    plotId: row.plotId,
    plotName,
    type: row.type,
    occurredAt: toZonedIso(row.occurredAt.getTime(), tz),
    details: row.details,
    note: row.note,
    createdAt: toZonedIso(row.createdAt.getTime(), tz),
  } as ActivityDto;
}
