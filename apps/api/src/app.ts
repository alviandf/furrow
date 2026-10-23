import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';

import { errorBody, HttpError } from './http/errors';
import { rateLimit, requestLogger, type AppEnv } from './http/middleware';
import { registerRoutes } from './http/routes';
import type { Services } from './services/container';

export function createApp(services: Services): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestId());
  app.use('*', requestLogger(services.logger));
  app.use('/v1/*', cors());
  app.use('/v1/*', rateLimit({ read: 120, write: 30 }));

  app.get('/health', async (c) => {
    await services.db.execute(sql`select 1`);
    return c.json({ ok: true });
  });

  // Lazy catch-up: readings are current even if the scheduler was asleep.
  app.use('/v1/*', async (_c, next) => {
    await services.ensureFresh();
    await next();
  });

  registerRoutes(app, services);

  app.notFound((c) => c.json(errorBody('NOT_FOUND', 'Route not found'), 404));

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json(errorBody(error.code, error.message, error.details), error.status);
    }
    if (error instanceof HTTPException) {
      return c.json(errorBody('HTTP_ERROR', error.message), error.status);
    }
    services.logger.error('request.failed', {
      requestId: c.get('requestId'),
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    return c.json(errorBody('INTERNAL', 'Something went wrong'), 500);
  });

  return app;
}
