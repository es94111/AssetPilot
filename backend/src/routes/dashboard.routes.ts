import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.get('/today', apiRateLimiter, authMiddleware, ctrl.getToday);

export default router;
