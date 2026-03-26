import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.updateProfile(req.user!.userId, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const prefs = await userService.updatePreferences(req.user!.userId, req.body);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
}
