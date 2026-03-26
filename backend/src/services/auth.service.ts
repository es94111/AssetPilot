import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw Object.assign(new Error('此 Email 已被註冊'), { statusCode: 409 });
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, name: input.name },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw Object.assign(new Error('帳號或密碼錯誤'), { statusCode: 401 });
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('帳號或密碼錯誤'), { statusCode: 401 });
  }

  const token = signToken({ userId: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, gender: true, birthDate: true,
      heightCm: true, activityLevel: true, unitPreference: true, language: true,
      dailyCalorieTarget: true, dailyWaterTargetMl: true, createdAt: true,
    },
  });
  if (!user) throw Object.assign(new Error('使用者不存在'), { statusCode: 404 });
  return user;
}
