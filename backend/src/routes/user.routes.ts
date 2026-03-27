import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { updateProfileSchema, updatePreferencesSchema } from '../schemas/user.schema.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.put('/profile', apiRateLimiter, authMiddleware, validate(updateProfileSchema), ctrl.updateProfile);
router.put('/preferences', apiRateLimiter, authMiddleware, validate(updatePreferencesSchema), ctrl.updatePreferences);

export default router;
