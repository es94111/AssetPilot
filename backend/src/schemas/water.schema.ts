import { z } from 'zod';

export const createWaterLogSchema = z.object({
  amountMl: z.number().int().positive('飲水量需大於 0'),
  loggedAt: z.string().datetime().optional(),
});

export type CreateWaterLogInput = z.infer<typeof createWaterLogSchema>;
