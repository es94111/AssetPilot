import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { updateProfileSchema, updatePreferencesSchema } from '../schemas/user.schema.js';

const router = Router();

router.use(authMiddleware);
router.put('/profile', validate(updateProfileSchema), ctrl.updateProfile);
router.put('/preferences', validate(updatePreferencesSchema), ctrl.updatePreferences);

export default router;
