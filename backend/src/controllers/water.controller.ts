import { Request, Response, NextFunction } from 'express';
import * as service from '../services/water.service.js';

export async function getByDate(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getByDate(req.user!.userId, req.query.date as string)); }
  catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLog(req.user!.userId, req.body)); }
  catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteLog(req.user!.userId, req.params.id); res.status(204).send(); }
  catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: { message: err.message } }); return; }
    next(err);
  }
}
