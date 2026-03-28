import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 30;
const LOGIN_LOCK_MESSAGE = `登入失敗次數過多，請 ${LOGIN_LOCK_MINUTES} 分鐘後再試`;

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
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw Object.assign(new Error('帳號或密碼錯誤'), { statusCode: 401 });
  }

  if (user.lockUntil && user.lockUntil > now) {
    throw Object.assign(new Error(LOGIN_LOCK_MESSAGE), { statusCode: 429 });
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    const shouldLock = await prisma.$transaction(async (tx) => {
      const incrementResult = await tx.user.updateMany({
        where: {
          id: user.id,
          OR: [{ lockUntil: null }, { lockUntil: { lte: now } }],
        },
        data: {
          failedLoginAttempts: { increment: 1 },
        },
      });

      if (incrementResult.count === 0) {
        return true;
      }

      const updatedUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { failedLoginAttempts: true },
      });

      if (!updatedUser) {
        throw Object.assign(new Error('使用者不存在'), { statusCode: 404 });
      }

      if (updatedUser.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockUntil: new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000),
          },
        });
        return true;
      }

      return false;
    });

    if (shouldLock) {
      throw Object.assign(new Error(LOGIN_LOCK_MESSAGE), { statusCode: 429 });
    }

    throw Object.assign(new Error('帳號或密碼錯誤'), { statusCode: 401 });
  }

  if (user.failedLoginAttempts !== 0 || user.lockUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockUntil: null,
      },
    });
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
