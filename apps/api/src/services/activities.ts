import { DAY_MS, type ActivityType, type CreateActivityInput } from '@furrow/shared';
import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities, plots, type ActivityRow, type Farm } from '../db/schema';
import { irrigationVolumeL, loadPlotModels } from '../domain';
import { HttpError } from '../http/errors';

const FUTURE_TOLERANCE_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * DAY_MS;

export interface ActivityWithPlot {
  row: ActivityRow;
  plotName: string;
}

function encodeCursor(row: ActivityRow): string {
  return Buffer.from(`${row.occurredAt.getTime()}_${row.id}`).toString('base64url');
}

function decodeCursor(cursor: string): { time: Date; id: string } {
  const [time, id] = Buffer.from(cursor, 'base64url').toString().split('_');
  const ms = Number(time);
  if (!id || !Number.isFinite(ms)) throw new HttpError(400, 'INVALID_CURSOR', 'Cursor is invalid');
  return { time: new Date(ms), id };
}

/** Newest first, keyset-paginated on (occurred_at, id). */
export async function listActivities(
  db: Db,
  options: { farmId: string; plotId?: string; type?: ActivityType; cursor?: string; limit: number },
): Promise<{ items: ActivityWithPlot[]; nextCursor: string | null }> {
  const conditions: SQL[] = [eq(plots.farmId, options.farmId)];
  if (options.plotId) conditions.push(eq(activities.plotId, options.plotId));
  if (options.type) conditions.push(eq(activities.type, options.type));
  if (options.cursor) {
    const { time, id } = decodeCursor(options.cursor);
    conditions.push(
      or(
        lt(activities.occurredAt, time),
        and(eq(activities.occurredAt, time), lt(activities.id, id)),
      )!,
    );
  }

  const rows = await db
    .select({ row: activities, plotName: plots.name })
    .from(activities)
    .innerJoin(plots, eq(activities.plotId, plots.id))
    .where(and(...conditions))
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(options.limit + 1);

  const items = rows.slice(0, options.limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > options.limit && last ? encodeCursor(last.row) : null };
}

/**
 * Creates an activity. Idempotent on the client-generated id: a retry with the
 * same id returns the stored row; the same id with different content is a 409.
 */
export async function createActivity(
  db: Db,
  input: CreateActivityInput,
  options: { farm: Farm; now: number },
): Promise<ActivityWithPlot & { created: boolean }> {
  const occurredAt = Date.parse(input.occurredAt);
  if (occurredAt > options.now + FUTURE_TOLERANCE_MS) {
    throw new HttpError(400, 'OCCURRED_IN_FUTURE', 'occurredAt cannot be in the future');
  }
  if (occurredAt < options.now - MAX_AGE_MS) {
    throw new HttpError(400, 'OCCURRED_TOO_LONG_AGO', 'occurredAt must be within the last 30 days');
  }

  const [model] = await loadPlotModels(db, options.farm.id, [input.plotId]);
  if (!model) throw new HttpError(404, 'PLOT_NOT_FOUND', 'Plot not found');

  const details: Record<string, unknown> =
    input.type === 'irrigation'
      ? { ...input.details, volumeL: Math.round(irrigationVolumeL(input.details, model.plot)) }
      : { ...input.details };

  const [inserted] = await db
    .insert(activities)
    .values({
      id: input.id,
      plotId: input.plotId,
      type: input.type,
      occurredAt: new Date(occurredAt),
      details,
      note: input.note || null,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) return { row: inserted, plotName: model.plot.name, created: true };

  const [existing] = await db.select().from(activities).where(eq(activities.id, input.id));
  if (!existing || existing.plotId !== input.plotId || existing.type !== input.type) {
    throw new HttpError(
      409,
      'ID_CONFLICT',
      'An activity with this id already exists with different content',
    );
  }
  return { row: existing, plotName: model.plot.name, created: false };
}
