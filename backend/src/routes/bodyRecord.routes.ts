import { Router } from 'express';
import * as ctrl from '../controllers/bodyRecord.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { createBodyRecordSchema, updateBodyRecordSchema, bodyRecordQuerySchema } from '../schemas/bodyRecord.schema.js';

const router = Router();

router.use(authMiddleware);
router.get('/', validate(bodyRecordQuerySchema, 'query'), ctrl.list);
router.get('/trends', ctrl.trends);
router.post('/', validate(createBodyRecordSchema), ctrl.create);
router.put('/:id', validate(updateBodyRecordSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
