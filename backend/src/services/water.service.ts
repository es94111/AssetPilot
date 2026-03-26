import { prisma } from '../lib/prisma.js';
import { CreateWaterLogInput } from '../schemas/water.schema.js';

export async function getByDate(userId: string, date: string) {
  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  const logs = await prisma.waterLog.findMany({
    where: { userId, loggedAt: { gte: start, lt: end } },
    orderBy: { loggedAt: 'desc' },
  });

  const total = logs.reduce((sum, l) => sum + l.amountMl, 0);
  return { logs, total };
}

export async function createLog(userId: string, input: CreateWaterLogInput) {
  return prisma.waterLog.create({
    data: {
      userId,
      amountMl: input.amountMl,
      loggedAt: input.loggedAt ? new Date(input.loggedAt) : new Date(),
    },
  });
}

export async function deleteLog(userId: string, id: string) {
  const log = await prisma.waterLog.findFirst({ where: { id, userId } });
  if (!log) throw Object.assign(new Error('找不到紀錄'), { statusCode: 404 });
  return prisma.waterLog.delete({ where: { id } });
}
