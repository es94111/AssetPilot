import { Router } from 'express';
import * as ctrl from '../controllers/diet.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { createFoodSchema, createMealLogSchema, updateMealLogSchema, foodSearchSchema } from '../schemas/diet.schema.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Foods
router.get('/foods', apiRateLimiter, authMiddleware, validate(foodSearchSchema, 'query'), ctrl.searchFoods);
router.get('/foods/recent', apiRateLimiter, authMiddleware, ctrl.recentFoods);
router.post('/foods', apiRateLimiter, authMiddleware, validate(createFoodSchema), ctrl.createFood);

// Meals
router.get('/meals', apiRateLimiter, authMiddleware, ctrl.getMeals);
router.get('/meals/summary', apiRateLimiter, authMiddleware, ctrl.dailySummary);
router.post('/meals', apiRateLimiter, authMiddleware, validate(createMealLogSchema), ctrl.createMeal);
router.put('/meals/:id', apiRateLimiter, authMiddleware, validate(updateMealLogSchema), ctrl.updateMeal);
router.delete('/meals/:id', apiRateLimiter, authMiddleware, ctrl.deleteMeal);

export default router;
