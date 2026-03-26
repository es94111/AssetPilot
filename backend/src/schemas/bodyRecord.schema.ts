import { z } from 'zod';

export const createBodyRecordSchema = z.object({
  recordedAt: z.string().datetime().optional(),
  weightKg: z.number().positive().optional().nullable(),
  bodyFatPct: z.number().min(0).max(100).optional().nullable(),
  muscleMassKg: z.number().positive().optional().nullable(),
  visceralFatLevel: z.number().int().min(0).optional().nullable(),
  bodyWaterPct: z.number().min(0).max(100).optional().nullable(),
  bmrKcal: z.number().int().positive().optional().nullable(),
  chestCm: z.number().positive().optional().nullable(),
  waistCm: z.number().positive().optional().nullable(),
  hipCm: z.number().positive().optional().nullable(),
  upperArmCm: z.number().positive().optional().nullable(),
  thighCm: z.number().positive().optional().nullable(),
  calfCm: z.number().positive().optional().nullable(),
});

export const updateBodyRecordSchema = createBodyRecordSchema.partial();

export const bodyRecordQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateBodyRecordInput = z.infer<typeof createBodyRecordSchema>;
export type BodyRecordQuery = z.infer<typeof bodyRecordQuerySchema>;
