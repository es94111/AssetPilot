import { prisma } from '../lib/prisma.js';
import { UpdateProfileInput, UpdatePreferencesInput } from '../schemas/user.schema.js';

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...input,
      birthDate: input.birthDate ? new Date(input.birthDate) : input.birthDate,
    },
    select: {
      id: true, email: true, name: true, gender: true, birthDate: true,
      heightCm: true, activityLevel: true, unitPreference: true, language: true,
      dailyCalorieTarget: true, dailyWaterTargetMl: true,
    },
  });
}

export async function updatePreferences(userId: string, input: UpdatePreferencesInput) {
  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true, unitPreference: true, language: true,
      dailyCalorieTarget: true, dailyWaterTargetMl: true,
    },
  });
}
