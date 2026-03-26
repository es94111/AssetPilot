import { prisma } from '../lib/prisma.js';
import { CreateBodyRecordInput, BodyRecordQuery } from '../schemas/bodyRecord.schema.js';

export async function listRecords(userId: string, query: BodyRecordQuery) {
  const where: any = { userId };
  if (query.from || query.to) {
    where.recordedAt = {};
    if (query.from) where.recordedAt.gte = new Date(query.from);
    if (query.to) where.recordedAt.lte = new Date(query.to);
  }

  const [records, total] = await Promise.all([
    prisma.bodyRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.bodyRecord.count({ where }),
  ]);

  return { records, total };
}

export async function createRecord(userId: string, input: CreateBodyRecordInput) {
  return prisma.bodyRecord.create({
    data: {
      userId,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      weightKg: input.weightKg,
      bodyFatPct: input.bodyFatPct,
      muscleMassKg: input.muscleMassKg,
      visceralFatLevel: input.visceralFatLevel,
      bodyWaterPct: input.bodyWaterPct,
      bmrKcal: input.bmrKcal,
      chestCm: input.chestCm,
      waistCm: input.waistCm,
      hipCm: input.hipCm,
      upperArmCm: input.upperArmCm,
      thighCm: input.thighCm,
      calfCm: input.calfCm,
    },
  });
}

export async function updateRecord(userId: string, id: string, input: Partial<CreateBodyRecordInput>) {
  const record = await prisma.bodyRecord.findFirst({ where: { id, userId } });
  if (!record) throw Object.assign(new Error('找不到紀錄'), { statusCode: 404 });

  return prisma.bodyRecord.update({
    where: { id },
    data: {
      ...input,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : undefined,
    },
  });
}

export async function deleteRecord(userId: string, id: string) {
  const record = await prisma.bodyRecord.findFirst({ where: { id, userId } });
  if (!record) throw Object.assign(new Error('找不到紀錄'), { statusCode: 404 });
  return prisma.bodyRecord.delete({ where: { id } });
}

export async function getTrends(userId: string, from?: string, to?: string) {
  const where: any = { userId };
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = new Date(from);
    if (to) where.recordedAt.lte = new Date(to);
  }

  return prisma.bodyRecord.findMany({
    where,
    orderBy: { recordedAt: 'asc' },
    select: {
      recordedAt: true, weightKg: true, bodyFatPct: true,
      muscleMassKg: true, waistCm: true,
    },
  });
}
