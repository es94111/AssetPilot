import { z } from 'zod';

export const createFoodSchema = z.object({
  name: z.string().min(1, '食物名稱為必填'),
  category: z.string().optional(),
  caloriesPer100g: z.number().min(0),
  carbsG: z.number().min(0),
  proteinG: z.number().min(0),
  fatG: z.number().min(0),
  fiberG: z.number().min(0).optional(),
  sodiumMg: z.number().min(0).optional(),
});

export const createMealLogSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  foodId: z.string(),
  quantityG: z.number().positive('份量需大於 0'),
  note: z.string().optional(),
});

export const updateMealLogSchema = z.object({
  quantityG: z.number().positive().optional(),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).optional(),
  note: z.string().optional(),
});

export const foodSearchSchema = z.object({
  q: z.string().optional().default(''),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20),
});

export type CreateFoodInput = z.infer<typeof createFoodSchema>;
export type CreateMealLogInput = z.infer<typeof createMealLogSchema>;
export type FoodSearchQuery = z.infer<typeof foodSearchSchema>;
