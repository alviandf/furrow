/** Request schemas — validated on the device before queuing and again on the server. */

import { z } from 'zod';

export const ACTIVITY_TYPES = ['irrigation', 'fertilizer', 'pest', 'note'] as const;
export const PEST_SEVERITIES = ['low', 'medium', 'high'] as const;
export const FERTILIZER_UNITS = ['kg', 'L'] as const;
export const READINGS_RANGES = ['24h', '7d'] as const;

export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

const common = {
  /** Client-generated UUID; makes retries idempotent. */
  id: z.uuid(),
  plotId: z.uuid(),
  occurredAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(1000).optional(),
};

export const irrigationDetailsSchema = z.object({
  durationMin: z.number().int().min(1).max(1440),
  volumeL: z.number().positive().max(10_000_000).optional(),
});

export const fertilizerDetailsSchema = z.object({
  product: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(100_000),
  unit: z.enum(FERTILIZER_UNITS),
});

export const pestDetailsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  severity: z.enum(PEST_SEVERITIES),
});

export const noteDetailsSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

export const createActivitySchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('irrigation'), details: irrigationDetailsSchema }),
  z.object({ ...common, type: z.literal('fertilizer'), details: fertilizerDetailsSchema }),
  z.object({ ...common, type: z.literal('pest'), details: pestDetailsSchema }),
  z.object({ ...common, type: z.literal('note'), details: noteDetailsSchema }),
]);

export const readingsQuerySchema = z.object({
  range: z.enum(READINGS_RANGES).default('7d'),
});

export const activitiesQuerySchema = z.object({
  plotId: z.uuid().optional(),
  type: activityTypeSchema.optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type ActivityType = z.infer<typeof activityTypeSchema>;
export type PestSeverity = (typeof PEST_SEVERITIES)[number];
export type ReadingsRange = (typeof READINGS_RANGES)[number];
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ActivityDetails<T extends ActivityType> = Extract<
  CreateActivityInput,
  { type: T }
>['details'];
