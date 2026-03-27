import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(apiRateLimiter, authMiddleware);
router.get('/today', ctrl.getToday);

export default router;
