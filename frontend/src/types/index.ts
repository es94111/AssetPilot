export interface User {
  id: string;
  email: string;
  name: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  birthDate?: string | null;
  heightCm?: number | null;
  activityLevel: string;
  unitPreference: string;
  language: string;
  dailyCalorieTarget?: number | null;
  dailyWaterTargetMl?: number | null;
}

export interface BodyRecord {
  id: string;
  recordedAt: string;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  visceralFatLevel?: number | null;
  bodyWaterPct?: number | null;
  bmrKcal?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  upperArmCm?: number | null;
  thighCm?: number | null;
  calfCm?: number | null;
}

export interface Food {
  id: string;
  name: string;
  category?: string;
  caloriesPer100g: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG?: number;
  isCustom: boolean;
}

export interface MealLog {
  id: string;
  date: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  foodId: string;
  foodName: string;
  quantityG: number;
  caloriesKcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  note?: string;
  food?: Food;
}

export interface WaterLog {
  id: string;
  loggedAt: string;
  amountMl: number;
}

export interface DashboardSummary {
  weight: number | null;
  bodyFatPct: number | null;
  lastWeighDate: string | null;
  calories: { consumed: number; target: number };
  macros: { carbs: number; protein: number; fat: number };
  water: { consumed: number; target: number };
  bmr: number | null;
  tdee: number | null;
  weightTrend: Array<{ date: string; weight: number | null }>;
}
