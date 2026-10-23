import { randomUUID } from 'node:crypto';

import type {
  ActivitiesResponse,
  ActivityDto,
  ApiErrorBody,
  FarmResponse,
  ForecastResponse,
  PlotDetailDto,
  PlotsResponse,
  ReadingsResponse,
} from '@furrow/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { createDatabase, type Database } from '../src/db/client';
import { createLogger } from '../src/logger';
import { PLOTS } from '../src/seed/data';
import { createServices, type Services } from '../src/services/container';
import { syntheticProvider } from '../src/weather/service';

const HOUR = 3_600_000;
const plotId = (name: string) => PLOTS.find((p) => p.name === name)!.id;

// 13:00 in Al Ain (UTC+4).
let now = Date.UTC(2026, 9, 21, 9, 0);
let database: Database;
let services: Services;
let app: ReturnType<typeof createApp>;

async function get<T>(path: string): Promise<{ status: number; body: T }> {
  const res = await app.request(path);
  return { status: res.status, body: (await res.json()) as T };
}

async function post<T>(path: string, payload: unknown): Promise<{ status: number; body: T }> {
  const res = await app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: (await res.json()) as T };
}

const actionsByName = (plots: PlotsResponse['plots']) =>
  Object.fromEntries(plots.map((p) => [p.name, p.recommendation.action]));

beforeAll(async () => {
  database = await createDatabase({});
  await database.migrate();
  services = createServices({
    db: database.db,
    clock: () => now,
    weatherProvider: syntheticProvider,
    logger: createLogger({ silent: true }),
  });
  await services.resetDemo();
  app = createApp(services);
});

afterAll(async () => {
  await database.close();
});

describe('demo seed', () => {
  it('puts every plot in its intended scenario, sorted by urgency', async () => {
    const { status, body } = await get<PlotsResponse>('/v1/plots');
    expect(status).toBe(200);
    expect(body.plots.map((p) => [p.name, p.recommendation.action])).toEqual([
      ['Field 4', 'IRRIGATE_NOW'],
      ['Block B', 'SENSOR_OFFLINE'],
      ['Field 5', 'PAUSE'],
      ['Field 3', 'IRRIGATE_TONIGHT'],
      ['Block A', 'NO_ACTION'],
    ]);
    expect(body.plots.map((p) => [p.name, p.status])).toEqual([
      ['Field 4', 'NEEDS_WATER'],
      ['Block B', 'OFFLINE'],
      ['Field 5', 'OVERWATERED'],
      ['Field 3', 'OPTIMAL'],
      ['Block A', 'OPTIMAL'],
    ]);
  });

  it('recommends a run that fits the night window for the "tonight" plot', async () => {
    const { body } = await get<PlotDetailDto>(`/v1/plots/${plotId('Field 3')}`);
    const r = body.recommendation;
    expect(r.startAt).toBe('2026-10-21T21:00:00+04:00');
    expect(r.durationMin! % 5).toBe(0);
    expect(r.durationMin!).toBeLessThanOrEqual(8 * 60);
    expect(r.inputs.depletionAtStartMm!).toBeLessThan(r.inputs.rawMm);
    expect(r.inputs.depletionAfter24hMm!).toBeGreaterThanOrEqual(r.inputs.rawMm);
    expect(body.growthStage).toBe('development');
    expect(body.recentActivities.some((a) => a.type === 'pest')).toBe(true);
  });

  it('builds 24 h sparklines and a 14-day history', async () => {
    const { body } = await get<PlotsResponse>('/v1/plots');
    const field3 = body.plots.find((p) => p.name === 'Field 3')!;
    expect(field3.sparkline.length).toBeGreaterThanOrEqual(23);
    const blockB = body.plots.find((p) => p.name === 'Block B')!;
    expect(Date.parse(blockB.latest!.recordedAt)).toBeLessThanOrEqual(now - 5 * HOUR);
  });
});

describe('GET endpoints', () => {
  it('reports health', async () => {
    expect((await get('/health')).status).toBe(200);
  });

  it('summarizes the farm', async () => {
    const { body } = await get<FarmResponse>('/v1/farm');
    expect(body.farm.timezone).toBe('Asia/Dubai');
    expect(body.summary.plotsNeedingAttention).toBe(3);
    expect(body.summary.waterPlannedL).toBeGreaterThan(0);
    expect(body.weather.source).toBe('synthetic');
    expect(body.weather.attribution).toBeNull();
    expect(body.today?.et0Mm).toBeGreaterThan(4);
  });

  it('returns raw readings for 24 h and hourly averages for 7 days', async () => {
    const day = await get<ReadingsResponse>(`/v1/plots/${plotId('Field 3')}/readings?range=24h`);
    expect(day.body.points.length).toBeGreaterThanOrEqual(95);
    const week = await get<ReadingsResponse>(`/v1/plots/${plotId('Field 3')}/readings?range=7d`);
    expect(week.body.points.length).toBeGreaterThanOrEqual(167);
    expect(week.body.points.length).toBeLessThanOrEqual(169);
    expect(week.body.events.some((e) => e.type === 'irrigation')).toBe(true);
    expect(week.body.target.fieldCapacity).toBe(0.15);
    expect(week.body.points.at(-1)).toEqual(day.body.points.at(-1));
  });

  it('returns a 7-day forecast', async () => {
    const { body } = await get<ForecastResponse>('/v1/forecast');
    expect(body.days).toHaveLength(7);
    expect(body.days[0]!.date).toBe('2026-10-21');
  });

  it('rejects bad ids and unknown plots', async () => {
    expect((await get<ApiErrorBody>('/v1/plots/not-a-uuid')).status).toBe(400);
    const missing = await get<ApiErrorBody>(`/v1/plots/${randomUUID()}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('PLOT_NOT_FOUND');
  });

  it('paginates activities newest first', async () => {
    const first = await get<ActivitiesResponse>('/v1/activities?limit=3');
    expect(first.body.items).toHaveLength(3);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await get<ActivitiesResponse>(
      `/v1/activities?limit=3&cursor=${first.body.nextCursor}`,
    );
    const firstIds = new Set(first.body.items.map((a) => a.id));
    expect(second.body.items.every((a) => !firstIds.has(a.id))).toBe(true);
    const times = [...first.body.items, ...second.body.items].map((a) => Date.parse(a.occurredAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe('POST /v1/activities', () => {
  it('logs an irrigation idempotently and applies the water immediately', async () => {
    const field4 = plotId('Field 4');
    const before = await get<PlotDetailDto>(`/v1/plots/${field4}`);
    const payload = {
      id: randomUUID(),
      plotId: field4,
      type: 'irrigation',
      occurredAt: new Date(now).toISOString(),
      details: { durationMin: before.body.recommendation.durationMin },
    };

    const created = await post<ActivityDto>('/v1/activities', payload);
    expect(created.status).toBe(201);
    expect(created.body.plotName).toBe('Field 4');

    const retried = await post<ActivityDto>('/v1/activities', payload);
    expect(retried.status).toBe(200);
    expect(retried.body.id).toBe(payload.id);

    const list = await get<ActivitiesResponse>(`/v1/activities?plotId=${field4}&type=irrigation`);
    expect(list.body.items.filter((a) => a.id === payload.id)).toHaveLength(1);

    const after = await get<PlotDetailDto>(`/v1/plots/${field4}`);
    expect(after.body.status).toBe('OPTIMAL');
    expect(after.body.latest!.vwc).toBeGreaterThan(before.body.latest!.vwc + 0.02);
    expect(Date.parse(after.body.latest!.recordedAt)).toBe(now);
  });

  it('rejects the same id with different content', async () => {
    const id = randomUUID();
    const base = {
      id,
      occurredAt: new Date(now).toISOString(),
      type: 'note',
      details: { text: 'x' },
    };
    expect((await post('/v1/activities', { ...base, plotId: plotId('Block A') })).status).toBe(201);
    const conflict = await post<ApiErrorBody>('/v1/activities', {
      ...base,
      plotId: plotId('Field 5'),
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('ID_CONFLICT');
  });

  it('validates input', async () => {
    const invalid = await post<ApiErrorBody>('/v1/activities', {
      id: randomUUID(),
      plotId: plotId('Field 3'),
      type: 'irrigation',
      occurredAt: new Date(now).toISOString(),
      details: { durationMin: 0 },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');

    const future = await post<ApiErrorBody>('/v1/activities', {
      id: randomUUID(),
      plotId: plotId('Field 3'),
      type: 'note',
      occurredAt: new Date(now + 2 * HOUR).toISOString(),
      details: { text: 'later' },
    });
    expect(future.status).toBe(400);
    expect(future.body.error.code).toBe('OCCURRED_IN_FUTURE');

    const unknownPlot = await post<ApiErrorBody>('/v1/activities', {
      id: randomUUID(),
      plotId: randomUUID(),
      type: 'note',
      occurredAt: new Date(now).toISOString(),
      details: { text: 'x' },
    });
    expect(unknownPlot.status).toBe(404);
  });
});

describe('simulation over time', () => {
  it('catches up readings when time moves on', async () => {
    const field3 = plotId('Field 3');
    const before = await get<PlotDetailDto>(`/v1/plots/${field3}`);
    now += 2 * HOUR;
    const after = await get<PlotDetailDto>(`/v1/plots/${field3}`);
    expect(Date.parse(after.body.latest!.recordedAt)).toBe(now);
    expect(after.body.latest!.vwc).toBeLessThan(before.body.latest!.vwc); // afternoon dry-down
    expect(after.body.recommendation.action).toBe('IRRIGATE_TONIGHT');
  });

  it('starts "tonight" immediately when seeded inside the night window', async () => {
    now = Date.UTC(2026, 9, 21, 18, 0); // 22:00 local
    await services.resetDemo();
    const { body } = await get<PlotsResponse>('/v1/plots');
    expect(actionsByName(body.plots)).toMatchObject({
      'Field 3': 'IRRIGATE_TONIGHT',
      'Field 4': 'IRRIGATE_NOW',
      'Field 5': 'PAUSE',
      'Block B': 'SENSOR_OFFLINE',
    });
    const field3 = body.plots.find((p) => p.name === 'Field 3')!;
    expect(field3.recommendation.startAt).toBe('2026-10-21T22:00:00+04:00');
  });
});
