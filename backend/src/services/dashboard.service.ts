import { prisma } from '../lib/prisma.js';

export async function getTodaySummary(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('使用者不存在'), { statusCode: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Latest body record
  const latestBody = await prisma.bodyRecord.findFirst({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
    select: { weightKg: true, bodyFatPct: true, recordedAt: true },
  });

  // Today's meals summary
  const todayMeals = await prisma.mealLog.findMany({
    where: { userId, date: { gte: today, lt: tomorrow } },
  });

  const nutrition = todayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.caloriesKcal,
      carbs: acc.carbs + m.carbsG,
      protein: acc.protein + m.proteinG,
      fat: acc.fat + m.fatG,
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );

  // Today's water
  const waterLogs = await prisma.waterLog.findMany({
    where: { userId, loggedAt: { gte: today, lt: tomorrow } },
  });
  const waterTotal = waterLogs.reduce((sum, l) => sum + l.amountMl, 0);

  // Calculate BMR using Mifflin-St Jeor
  let bmr: number | null = null;
  let tdee: number | null = null;
  if (latestBody?.weightKg && user.heightCm && user.birthDate) {
    const age = Math.floor((Date.now() - new Date(user.birthDate).getTime()) / 31557600000);
    bmr = 10 * latestBody.weightKg + 6.25 * user.heightCm - 5 * age;
    bmr += user.gender === 'MALE' ? 5 : -161;

    const multipliers: Record<string, number> = {
      SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, HIGH: 1.725, VERY_HIGH: 1.9,
    };
    tdee = Math.round(bmr * (multipliers[user.activityLevel] || 1.55));
    bmr = Math.round(bmr);
  }

  // Weight trend (last 7 days)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weightTrend = await prisma.bodyRecord.findMany({
    where: { userId, recordedAt: { gte: sevenDaysAgo }, weightKg: { not: null } },
    orderBy: { recordedAt: 'asc' },
    select: { recordedAt: true, weightKg: true },
  });

  return {
    weight: latestBody?.weightKg ?? null,
    bodyFatPct: latestBody?.bodyFatPct ?? null,
    lastWeighDate: latestBody?.recordedAt ?? null,
    calories: {
      consumed: Math.round(nutrition.calories),
      target: user.dailyCalorieTarget ?? tdee ?? 2000,
    },
    macros: {
      carbs: Math.round(nutrition.carbs * 10) / 10,
      protein: Math.round(nutrition.protein * 10) / 10,
      fat: Math.round(nutrition.fat * 10) / 10,
    },
    water: {
      consumed: waterTotal,
      target: user.dailyWaterTargetMl ?? 2000,
    },
    bmr,
    tdee,
    weightTrend: weightTrend.map((w) => ({
      date: w.recordedAt.toISOString().split('T')[0],
      weight: w.weightKg,
    })),
  };
}
