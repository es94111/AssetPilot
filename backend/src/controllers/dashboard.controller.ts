import { Request, Response, NextFunction } from 'express';
import * as service from '../services/dashboard.service.js';

export async function getToday(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getTodaySummary(req.user!.userId)); }
  catch (err) { next(err); }
}
