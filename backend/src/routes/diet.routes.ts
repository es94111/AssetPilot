import { Router } from 'express';
import * as ctrl from '../controllers/diet.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { createFoodSchema, createMealLogSchema, updateMealLogSchema, foodSearchSchema } from '../schemas/diet.schema.js';

const router = Router();

router.use(authMiddleware);

// Foods
router.get('/foods', validate(foodSearchSchema, 'query'), ctrl.searchFoods);
router.get('/foods/recent', ctrl.recentFoods);
router.post('/foods', validate(createFoodSchema), ctrl.createFood);

// Meals
router.get('/meals', ctrl.getMeals);
router.get('/meals/summary', ctrl.dailySummary);
router.post('/meals', validate(createMealLogSchema), ctrl.createMeal);
router.put('/meals/:id', validate(updateMealLogSchema), ctrl.updateMeal);
router.delete('/meals/:id', ctrl.deleteMeal);

export default router;
