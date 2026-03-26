import { prisma } from '../lib/prisma.js';
import { CreateFoodInput, CreateMealLogInput, FoodSearchQuery } from '../schemas/diet.schema.js';

export async function searchFoods(query: FoodSearchQuery) {
  const where: any = {};
  if (query.q) {
    where.name = { contains: query.q, mode: 'insensitive' };
  }
  if (query.category) {
    where.category = query.category;
  }

  const [foods, total] = await Promise.all([
    prisma.food.findMany({
      where,
      orderBy: { name: 'asc' },
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    }),
    prisma.food.count({ where }),
  ]);

  return { foods, total, page: query.page, perPage: query.perPage };
}

export async function createCustomFood(userId: string, input: CreateFoodInput) {
  return prisma.food.create({
    data: { ...input, isCustom: true, createdById: userId },
  });
}

export async function getRecentFoods(userId: string) {
  const recentMeals = await prisma.mealLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { foodId: true },
    distinct: ['foodId'],
  });

  const foodIds = recentMeals.map((m) => m.foodId);
  if (foodIds.length === 0) return [];

  return prisma.food.findMany({ where: { id: { in: foodIds } } });
}

export async function getMealsByDate(userId: string, date: string) {
  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  return prisma.mealLog.findMany({
    where: { userId, date: { gte: start, lt: end } },
    include: { food: true },
    orderBy: [{ mealType: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createMealLog(userId: string, input: CreateMealLogInput) {
  const food = await prisma.food.findUnique({ where: { id: input.foodId } });
  if (!food) throw Object.assign(new Error('找不到食物'), { statusCode: 404 });

  const ratio = input.quantityG / 100;
  return prisma.mealLog.create({
    data: {
      userId,
      date: new Date(input.date),
      mealType: input.mealType,
      foodId: input.foodId,
      foodName: food.name,
      quantityG: input.quantityG,
      caloriesKcal: Math.round(food.caloriesPer100g * ratio * 10) / 10,
      carbsG: Math.round(food.carbsG * ratio * 10) / 10,
      proteinG: Math.round(food.proteinG * ratio * 10) / 10,
      fatG: Math.round(food.fatG * ratio * 10) / 10,
      note: input.note,
    },
    include: { food: true },
  });
}

export async function updateMealLog(userId: string, id: string, input: any) {
  const meal = await prisma.mealLog.findFirst({ where: { id, userId } });
  if (!meal) throw Object.assign(new Error('找不到紀錄'), { statusCode: 404 });

  const data: any = { ...input };
  if (input.quantityG) {
    const food = await prisma.food.findUnique({ where: { id: meal.foodId } });
    if (food) {
      const ratio = input.quantityG / 100;
      data.caloriesKcal = Math.round(food.caloriesPer100g * ratio * 10) / 10;
      data.carbsG = Math.round(food.carbsG * ratio * 10) / 10;
      data.proteinG = Math.round(food.proteinG * ratio * 10) / 10;
      data.fatG = Math.round(food.fatG * ratio * 10) / 10;
    }
  }

  return prisma.mealLog.update({ where: { id }, data, include: { food: true } });
}

export async function deleteMealLog(userId: string, id: string) {
  const meal = await prisma.mealLog.findFirst({ where: { id, userId } });
  if (!meal) throw Object.assign(new Error('找不到紀錄'), { statusCode: 404 });
  return prisma.mealLog.delete({ where: { id } });
}

export async function getDailySummary(userId: string, date: string) {
  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  const meals = await prisma.mealLog.findMany({
    where: { userId, date: { gte: start, lt: end } },
  });

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.caloriesKcal,
      carbs: acc.carbs + m.carbsG,
      protein: acc.protein + m.proteinG,
      fat: acc.fat + m.fatG,
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );

  return {
    date,
    totalCalories: Math.round(totals.calories),
    totalCarbs: Math.round(totals.carbs * 10) / 10,
    totalProtein: Math.round(totals.protein * 10) / 10,
    totalFat: Math.round(totals.fat * 10) / 10,
    mealCount: meals.length,
  };
}
