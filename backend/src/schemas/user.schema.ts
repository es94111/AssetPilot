import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthDate: z.string().datetime().optional().nullable(),
  heightCm: z.number().positive().optional().nullable(),
  activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'HIGH', 'VERY_HIGH']).optional(),
});

export const updatePreferencesSchema = z.object({
  unitPreference: z.enum(['METRIC', 'IMPERIAL']).optional(),
  language: z.string().optional(),
  dailyCalorieTarget: z.number().int().positive().optional().nullable(),
  dailyWaterTargetMl: z.number().int().positive().optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
