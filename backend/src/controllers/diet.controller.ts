import { Request, Response, NextFunction } from 'express';
import * as service from '../services/diet.service.js';

export async function searchFoods(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.searchFoods(req.query as any)); }
  catch (err) { next(err); }
}

export async function createFood(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCustomFood(req.user!.userId, req.body)); }
  catch (err) { next(err); }
}

export async function recentFoods(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getRecentFoods(req.user!.userId)); }
  catch (err) { next(err); }
}

export async function getMeals(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getMealsByDate(req.user!.userId, req.query.date as string)); }
  catch (err) { next(err); }
}

export async function createMeal(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMealLog(req.user!.userId, req.body)); }
  catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: { message: err.message } }); return; }
    next(err);
  }
}

export async function updateMeal(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.updateMealLog(req.user!.userId, req.params.id, req.body)); }
  catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: { message: err.message } }); return; }
    next(err);
  }
}

export async function deleteMeal(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteMealLog(req.user!.userId, req.params.id); res.status(204).send(); }
  catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: { message: err.message } }); return; }
    next(err);
  }
}

export async function dailySummary(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getDailySummary(req.user!.userId, req.query.date as string)); }
  catch (err) { next(err); }
}
