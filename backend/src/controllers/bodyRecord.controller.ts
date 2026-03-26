import { Request, Response, NextFunction } from 'express';
import * as service from '../services/bodyRecord.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listRecords(req.user!.userId, req.query as any);
    res.json(result);
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const record = await service.createRecord(req.user!.userId, req.body);
    res.status(201).json(record);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const record = await service.updateRecord(req.user!.userId, req.params.id, req.body);
    res.json(record);
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: { message: err.message } }); return; }
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteRecord(req.user!.userId, req.params.id);
    res.status(204).send();
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: { message: err.message } }); return; }
    next(err);
  }
}

export async function trends(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getTrends(req.user!.userId, req.query.from as string, req.query.to as string);
    res.json(data);
  } catch (err) { next(err); }
}
