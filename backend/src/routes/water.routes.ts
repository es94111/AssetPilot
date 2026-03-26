import { Router } from 'express';
import * as ctrl from '../controllers/water.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { createWaterLogSchema } from '../schemas/water.schema.js';

const router = Router();

router.use(authMiddleware);
router.get('/', ctrl.getByDate);
router.post('/', validate(createWaterLogSchema), ctrl.create);
router.delete('/:id', ctrl.remove);

export default router;
