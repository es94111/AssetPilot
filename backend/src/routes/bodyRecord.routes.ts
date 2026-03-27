import { Router } from 'express';
import * as ctrl from '../controllers/bodyRecord.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { createBodyRecordSchema, updateBodyRecordSchema, bodyRecordQuerySchema } from '../schemas/bodyRecord.schema.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.get('/', apiRateLimiter, authMiddleware, validate(bodyRecordQuerySchema, 'query'), ctrl.list);
router.get('/trends', apiRateLimiter, authMiddleware, ctrl.trends);
router.post('/', apiRateLimiter, authMiddleware, validate(createBodyRecordSchema), ctrl.create);
router.put('/:id', apiRateLimiter, authMiddleware, validate(updateBodyRecordSchema), ctrl.update);
router.delete('/:id', apiRateLimiter, authMiddleware, ctrl.remove);

export default router;
