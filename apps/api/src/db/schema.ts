import type { ActivityType, DailyForecast, HourlyWeather, IrrigationMethod } from '@furrow/shared';
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  date,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const farms = pgTable('farms', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  timezone: text('timezone').notNull(),
  irrigationWindowStart: text('irrigation_window_start').notNull().default('21:00'),
  irrigationWindowEnd: text('irrigation_window_end').notNull().default('05:00'),
});

export const crops = pgTable('crops', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kcIni: doublePrecision('kc_ini').notNull(),
  kcMid: doublePrecision('kc_mid').notNull(),
  kcEnd: doublePrecision('kc_end').notNull(),
  pTable: doublePrecision('p_table').notNull(),
  rootDepthM: doublePrecision('root_depth_m').notNull(),
  /** [initial, development, mid, late] in days; null for perennials. */
  stageDays: jsonb('stage_days').$type<[number, number, number, number] | null>(),
});

export const soils = pgTable('soils', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  fieldCapacity: doublePrecision('field_capacity').notNull(),
  wiltingPoint: doublePrecision('wilting_point').notNull(),
  drainagePerHour: doublePrecision('drainage_per_hour').notNull().default(0.1),
});

export const plots = pgTable('plots', {
  id: uuid('id').primaryKey(),
  farmId: uuid('farm_id')
    .notNull()
    .references(() => farms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cropId: text('crop_id')
    .notNull()
    .references(() => crops.id),
  soilId: text('soil_id')
    .notNull()
    .references(() => soils.id),
  plantedOn: date('planted_on', { mode: 'string' }),
  areaM2: doublePrecision('area_m2').notNull(),
  /** Overrides the crop's default root depth. */
  rootDepthM: doublePrecision('root_depth_m'),
  irrigationMethod: text('irrigation_method').$type<IrrigationMethod>().notNull(),
  efficiency: doublePrecision('efficiency').notNull(),
  flowRateLph: doublePrecision('flow_rate_lph').notNull(),
  /** Overrides the soil's drainage rate (e.g. compacted soil). */
  drainagePerHour: doublePrecision('drainage_per_hour'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const sensorReadings = pgTable(
  'sensor_readings',
  {
    plotId: uuid('plot_id')
      .notNull()
      .references(() => plots.id, { onDelete: 'cascade' }),
    recordedAt: timestamptz('recorded_at').notNull(),
    vwc: doublePrecision('vwc').notNull(),
  },
  (table) => [primaryKey({ columns: [table.plotId, table.recordedAt] })],
);

export const plotSimState = pgTable('plot_sim_state', {
  plotId: uuid('plot_id')
    .primaryKey()
    .references(() => plots.id, { onDelete: 'cascade' }),
  theta: doublePrecision('theta').notNull(),
  asOf: timestamptz('as_of').notNull(),
  /** Set for plots whose sensor is "offline" in the demo; no readings are produced. */
  pausedAt: timestamptz('paused_at'),
});

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey(),
    plotId: uuid('plot_id')
      .notNull()
      .references(() => plots.id, { onDelete: 'cascade' }),
    type: text('type').$type<ActivityType>().notNull(),
    occurredAt: timestamptz('occurred_at').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull(),
    note: text('note'),
    photoKey: text('photo_key'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    /** When the simulator added this irrigation to the soil. */
    appliedAt: timestamptz('applied_at'),
  },
  (table) => [index('activities_plot_time_idx').on(table.plotId, table.occurredAt.desc())],
);

export interface WeatherData {
  source: 'open-meteo' | 'synthetic';
  /** Epoch ms. */
  fetchedAt: number;
  timezone: string;
  hourly: Array<HourlyWeather & { temperatureC: number | null; humidity: number | null }>;
  daily: DailyForecast[];
}

export const weatherSnapshots = pgTable(
  'weather_snapshots',
  {
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'cascade' }),
    fetchedAt: timestamptz('fetched_at').notNull(),
    source: text('source').$type<WeatherData['source']>().notNull(),
    data: jsonb('data').$type<WeatherData>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.farmId, table.fetchedAt] })],
);

export type Farm = typeof farms.$inferSelect;
export type Crop = typeof crops.$inferSelect;
export type Soil = typeof soils.$inferSelect;
export type Plot = typeof plots.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
