import {
  ACTION_PRIORITY,
  activitiesQuerySchema,
  createActivitySchema,
  readingsQuerySchema,
  startOfZonedDay,
  zonedDate,
  type ActivitiesResponse,
  type FarmResponse,
  type ForecastResponse,
  type PlotsResponse,
} from '@furrow/shared';
import { zValidator } from '@hono/zod-validator';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';

import { activities, plots } from '../db/schema';
import { irrigationVolumeL } from '../domain';
import { createActivity, listActivities } from '../services/activities';
import type { Services } from '../services/container';
import { buildPlotViews } from '../services/plot-views';
import { getReadings } from '../services/readings';
import { advanceSimulation } from '../sim/simulator';
import {
  activityDto,
  dailyForecastDto,
  farmDto,
  plotDetailDto,
  plotSummaryDto,
  weatherMeta,
} from './dto';
import { errorBody, HttpError } from './errors';
import type { AppEnv } from './middleware';

const ATTENTION_ACTIONS = new Set(['IRRIGATE_NOW', 'SENSOR_OFFLINE', 'PAUSE']);
const PLANNED_ACTIONS = new Set(['IRRIGATE_NOW', 'IRRIGATE_TONIGHT']);

/** Turns zod failures into the API's error shape. */
const validationError = (result: { success: boolean; error?: { issues: unknown } }) =>
  result.success
    ? undefined
    : errorBody('VALIDATION_FAILED', 'Request validation failed', result.error?.issues);

const plotParam = zValidator('param', z.object({ id: z.uuid() }), (result, c) => {
  const body = validationError(result);
  if (body) return c.json(body, 400);
});

export function registerRoutes(app: Hono<AppEnv>, services: Services): void {
  const { db } = services;

  app.get('/v1/farm', async (c) => {
    const { now, farm, weather } = await services.context();
    const views = await buildPlotViews(db, { farm, weather: weather.data, now });
    const usedRows = await db
      .select({ details: activities.details, plot: plots })
      .from(activities)
      .innerJoin(plots, eq(activities.plotId, plots.id))
      .where(
        and(
          eq(activities.type, 'irrigation'),
          gte(activities.occurredAt, new Date(startOfZonedDay(now, farm.timezone))),
          lte(activities.occurredAt, new Date(now)),
        ),
      );

    const today = zonedDate(now, farm.timezone);
    const todayForecast = weather.data.daily.find((d) => d.date === today);
    const body: FarmResponse = {
      farm: farmDto(farm),
      today: todayForecast ? dailyForecastDto(todayForecast) : null,
      weather: weatherMeta(weather, farm.timezone),
      summary: {
        plotsNeedingAttention: views.filter((v) => ATTENTION_ACTIONS.has(v.recommendation.action))
          .length,
        waterUsedTodayL: Math.round(
          usedRows.reduce((sum, r) => sum + irrigationVolumeL(r.details, r.plot), 0),
        ),
        waterPlannedL: Math.round(
          views
            .filter((v) => PLANNED_ACTIONS.has(v.recommendation.action))
            .reduce((sum, v) => sum + (v.recommendation.amount?.volumeL ?? 0), 0),
        ),
      },
      generatedAt: new Date(now).toISOString(),
    };
    return c.json(body);
  });

  app.get('/v1/plots', async (c) => {
    const { now, farm, weather } = await services.context();
    const views = await buildPlotViews(db, { farm, weather: weather.data, now });
    views.sort(
      (a, b) =>
        ACTION_PRIORITY[a.recommendation.action] - ACTION_PRIORITY[b.recommendation.action] ||
        a.model.plot.sortOrder - b.model.plot.sortOrder,
    );
    const body: PlotsResponse = {
      plots: views.map((v) => plotSummaryDto(v, farm.timezone)),
      generatedAt: new Date(now).toISOString(),
    };
    return c.json(body);
  });

  app.get('/v1/plots/:id', plotParam, async (c) => {
    const { id } = c.req.valid('param');
    const { now, farm, weather } = await services.context();
    const [view] = await buildPlotViews(db, { farm, weather: weather.data, now, plotIds: [id] });
    if (!view) throw new HttpError(404, 'PLOT_NOT_FOUND', 'Plot not found');
    const recent = await listActivities(db, { farmId: farm.id, plotId: id, limit: 5 });
    return c.json(
      plotDetailDto(
        view,
        farm.timezone,
        recent.items.map((a) => activityDto(a.row, a.plotName, farm.timezone)),
      ),
    );
  });

  app.get(
    '/v1/plots/:id/readings',
    plotParam,
    zValidator('query', readingsQuerySchema, (result, c) => {
      const body = validationError(result);
      if (body) return c.json(body, 400);
    }),
    async (c) => {
      const { id } = c.req.valid('param');
      const { range } = c.req.valid('query');
      const { now, farm, weather } = await services.context();
      const [view] = await buildPlotViews(db, { farm, weather: weather.data, now, plotIds: [id] });
      if (!view) throw new HttpError(404, 'PLOT_NOT_FOUND', 'Plot not found');
      return c.json(
        await getReadings(db, { view, range, now, weather: weather.data, tz: farm.timezone }),
      );
    },
  );

  app.get('/v1/forecast', async (c) => {
    const { now, farm, weather } = await services.context();
    const today = zonedDate(now, farm.timezone);
    const body: ForecastResponse = {
      days: weather.data.daily
        .filter((d) => d.date >= today)
        .slice(0, 7)
        .map(dailyForecastDto),
      weather: weatherMeta(weather, farm.timezone),
    };
    return c.json(body);
  });

  app.get(
    '/v1/activities',
    zValidator('query', activitiesQuerySchema, (result, c) => {
      const body = validationError(result);
      if (body) return c.json(body, 400);
    }),
    async (c) => {
      const query = c.req.valid('query');
      const farm = await services.getFarm();
      const page = await listActivities(db, { farmId: farm.id, ...query });
      const body: ActivitiesResponse = {
        items: page.items.map((a) => activityDto(a.row, a.plotName, farm.timezone)),
        nextCursor: page.nextCursor,
      };
      return c.json(body);
    },
  );

  app.post(
    '/v1/activities',
    zValidator('json', createActivitySchema, (result, c) => {
      const body = validationError(result);
      if (body) return c.json(body, 400);
    }),
    async (c) => {
      const input = c.req.valid('json');
      const { now, farm, weather } = await services.context();
      const result = await createActivity(db, input, { farm, now });

      if (result.created && input.type === 'irrigation') {
        // Apply the water right away so the chart reflects it within seconds.
        await advanceSimulation(db, {
          farm,
          weather: weather.data,
          now,
          plotIds: [input.plotId],
          includeNow: true,
        });
      }
      return c.json(
        activityDto(result.row, result.plotName, farm.timezone),
        result.created ? 201 : 200,
      );
    },
  );
}
