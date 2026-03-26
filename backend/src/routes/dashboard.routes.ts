import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/today', ctrl.getToday);

export default router;
