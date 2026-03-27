import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { authRateLimiter, apiRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authRateLimiter, validate(loginSchema), ctrl.login);
router.get('/me', apiRateLimiter, authMiddleware, ctrl.getMe);

export default router;
