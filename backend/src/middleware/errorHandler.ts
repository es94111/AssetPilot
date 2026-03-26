import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'CONFLICT', message: '資料已存在' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '找不到資料' } });
      return;
    }
  }

  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '伺服器內部錯誤' } });
}
