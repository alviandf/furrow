/** Response contracts for the REST API (PRD Appendix C). */

import type { GrowthStage } from './irrigation/kc';
import type { Action, PlotStatus } from './irrigation/recommend';
import type { CreateActivityInput, ReadingsRange } from './schemas';

export type IrrigationMethod = 'drip' | 'bubbler' | 'sprinkler';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface DailyForecast {
  /** Local date, "YYYY-MM-DD". */
  date: string;
  maxTempC: number;
  minTempC: number;
  rainMm: number;
  rainProbability: number | null;
  et0Mm: number;
}

export interface WeatherMeta {
  fetchedAt: string;
  source: 'open-meteo' | 'synthetic';
  /** True when the forecast could not be refreshed for over an hour. */
  stale: boolean;
  attribution: { text: string; url: string } | null;
}

export interface FarmDto {
  id: string;
  name: string;
  location: string;
  timezone: string;
  latitude: number;
  longitude: number;
  irrigationWindow: { start: string; end: string };
}

export interface FarmResponse {
  farm: FarmDto;
  today: DailyForecast | null;
  weather: WeatherMeta;
  summary: {
    plotsNeedingAttention: number;
    waterUsedTodayL: number;
    waterPlannedL: number;
  };
  generatedAt: string;
}

export interface RecommendationInputsDto {
  vwc: number | null;
  fieldCapacity: number;
  wiltingPoint: number;
  rootDepthM: number;
  kc: number;
  growthStage: GrowthStage;
  dayOfSeason: number | null;
  et0Next24hMm: number;
  etcNext24hMm: number;
  etcBeforeStartMm: number;
  p: number;
  tawMm: number;
  rawMm: number;
  refillPoint: number;
  depletionMm: number | null;
  depletionAtStartMm: number | null;
  depletionAfter24hMm: number | null;
  effectiveRainMm: number;
  efficiency: number;
  flowRateLph: number;
  areaM2: number;
}

export interface RecommendationDto {
  action: Action;
  startAt: string | null;
  stressAt: string | null;
  netDepthMm: number | null;
  grossDepthMm: number | null;
  volumeL: number | null;
  durationMin: number | null;
  nextIrrigationAt: string | null;
  daysUntilNext: number | null;
  inputs: RecommendationInputsDto;
}

export interface PlotSummaryDto {
  id: string;
  name: string;
  crop: { id: string; name: string };
  growthStage: GrowthStage;
  dayOfSeason: number | null;
  seasonLength: number | null;
  soil: { id: string; name: string };
  irrigationMethod: IrrigationMethod;
  status: PlotStatus;
  latest: { vwc: number; recordedAt: string } | null;
  /** Hourly readings over the last 24 h, oldest first. */
  sparkline: number[];
  target: { refillPoint: number; fieldCapacity: number };
  recommendation: RecommendationDto;
}

export type ActivityDto = DistributiveOmit<CreateActivityInput, 'note'> & {
  plotName: string;
  note: string | null;
  createdAt: string;
};

export interface PlotDetailDto extends PlotSummaryDto {
  areaM2: number;
  flowRateLph: number;
  efficiency: number;
  rootDepthM: number;
  plantedOn: string | null;
  soilParams: { fieldCapacity: number; wiltingPoint: number };
  recentActivities: ActivityDto[];
}

export interface PlotsResponse {
  plots: PlotSummaryDto[];
  generatedAt: string;
}

export interface ReadingPoint {
  t: string;
  vwc: number;
}

export interface ChartEvent {
  type: 'irrigation' | 'rain';
  t: string;
  amount: number;
  unit: 'L' | 'mm';
}

export interface ReadingsResponse {
  range: ReadingsRange;
  from: string;
  to: string;
  points: ReadingPoint[];
  events: ChartEvent[];
  target: { refillPoint: number; fieldCapacity: number };
}

export interface ForecastResponse {
  days: DailyForecast[];
  weather: WeatherMeta;
}

export interface ActivitiesResponse {
  items: ActivityDto[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
