import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import bodyRecordRoutes from './bodyRecord.routes.js';
import dietRoutes from './diet.routes.js';
import waterRoutes from './water.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/body-records', bodyRecordRoutes);
router.use('/diet', dietRoutes);
router.use('/water', waterRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
