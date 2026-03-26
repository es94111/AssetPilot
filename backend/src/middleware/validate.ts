import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      (req as any)[source] = schema.parse((req as any)[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '輸入資料驗證失敗',
            details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
          },
        });
        return;
      }
      next(err);
    }
  };
}
