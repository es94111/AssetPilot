export const MEAL_TYPES = {
  BREAKFAST: '早餐',
  LUNCH: '午餐',
  DINNER: '晚餐',
  SNACK: '點心',
} as const;

export const ACTIVITY_LEVELS = {
  SEDENTARY: '久坐（幾乎不運動）',
  LIGHT: '輕度活動（每週 1-3 天）',
  MODERATE: '中度活動（每週 3-5 天）',
  HIGH: '高度活動（每週 6-7 天）',
  VERY_HIGH: '極高活動（高強度運動或體力勞動）',
} as const;

export const GENDERS = {
  MALE: '男',
  FEMALE: '女',
  OTHER: '其他',
} as const;

export const FOOD_CATEGORIES = [
  '主食', '肉類', '海鮮', '蛋豆類', '蔬菜', '水果', '乳製品', '飲料', '零食',
] as const;

export const WATER_PRESETS = [150, 250, 350, 500] as const;
