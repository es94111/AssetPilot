import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FoodSeed {
  name: string;
  category: string;
  caloriesPer100g: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG?: number;
  sodiumMg?: number;
}

const foods: FoodSeed[] = [
  // 主食
  { name: "白飯", category: "主食", caloriesPer100g: 168, carbsG: 37.1, proteinG: 2.8, fatG: 0.3, fiberG: 0.3, sodiumMg: 1 },
  { name: "糙米飯", category: "主食", caloriesPer100g: 165, carbsG: 35.6, proteinG: 3.3, fatG: 1.2, fiberG: 2.0, sodiumMg: 2 },
  { name: "白麵條(熟)", category: "主食", caloriesPer100g: 140, carbsG: 28.4, proteinG: 4.8, fatG: 0.6, fiberG: 1.2, sodiumMg: 3 },
  { name: "白吐司", category: "主食", caloriesPer100g: 270, carbsG: 49.7, proteinG: 8.4, fatG: 4.0, fiberG: 2.3, sodiumMg: 460 },
  { name: "全麥吐司", category: "主食", caloriesPer100g: 247, carbsG: 43.1, proteinG: 10.0, fatG: 3.5, fiberG: 5.6, sodiumMg: 450 },
  { name: "地瓜", category: "主食", caloriesPer100g: 114, carbsG: 27.0, proteinG: 1.0, fatG: 0.1, fiberG: 2.5, sodiumMg: 13 },
  { name: "馬鈴薯", category: "主食", caloriesPer100g: 81, carbsG: 17.5, proteinG: 2.6, fatG: 0.1, fiberG: 1.8, sodiumMg: 5 },
  { name: "燕麥片", category: "主食", caloriesPer100g: 384, carbsG: 67.7, proteinG: 13.2, fatG: 6.5, fiberG: 10.1, sodiumMg: 6 },
  { name: "冬粉(熟)", category: "主食", caloriesPer100g: 80, carbsG: 19.5, proteinG: 0.1, fatG: 0.0, fiberG: 0.0, sodiumMg: 2 },
  { name: "饅頭", category: "主食", caloriesPer100g: 233, carbsG: 47.0, proteinG: 7.0, fatG: 1.1, fiberG: 1.5, sodiumMg: 280 },

  // 肉類
  { name: "雞胸肉", category: "肉類", caloriesPer100g: 117, carbsG: 0.0, proteinG: 24.2, fatG: 1.9, fiberG: 0, sodiumMg: 52 },
  { name: "雞腿肉(去皮)", category: "肉類", caloriesPer100g: 140, carbsG: 0.0, proteinG: 20.0, fatG: 6.5, fiberG: 0, sodiumMg: 70 },
  { name: "豬里肌", category: "肉類", caloriesPer100g: 143, carbsG: 0.2, proteinG: 22.2, fatG: 5.6, fiberG: 0, sodiumMg: 53 },
  { name: "豬五花", category: "肉類", caloriesPer100g: 393, carbsG: 0.0, proteinG: 14.5, fatG: 37.0, fiberG: 0, sodiumMg: 42 },
  { name: "牛腱", category: "肉類", caloriesPer100g: 140, carbsG: 0.0, proteinG: 24.0, fatG: 4.5, fiberG: 0, sodiumMg: 60 },
  { name: "牛小排", category: "肉類", caloriesPer100g: 295, carbsG: 0.0, proteinG: 18.5, fatG: 24.0, fiberG: 0, sodiumMg: 55 },
  { name: "鴨肉", category: "肉類", caloriesPer100g: 132, carbsG: 0.0, proteinG: 18.3, fatG: 6.2, fiberG: 0, sodiumMg: 65 },

  // 海鮮
  { name: "鮭魚", category: "海鮮", caloriesPer100g: 208, carbsG: 0.0, proteinG: 20.4, fatG: 13.4, fiberG: 0, sodiumMg: 59 },
  { name: "蝦仁", category: "海鮮", caloriesPer100g: 91, carbsG: 0.6, proteinG: 20.1, fatG: 0.6, fiberG: 0, sodiumMg: 185 },
  { name: "鱈魚", category: "海鮮", caloriesPer100g: 82, carbsG: 0.0, proteinG: 18.0, fatG: 0.7, fiberG: 0, sodiumMg: 54 },
  { name: "鯖魚", category: "海鮮", caloriesPer100g: 235, carbsG: 0.0, proteinG: 20.7, fatG: 16.6, fiberG: 0, sodiumMg: 65 },
  { name: "花枝(透抽)", category: "海鮮", caloriesPer100g: 75, carbsG: 0.8, proteinG: 15.6, fatG: 0.8, fiberG: 0, sodiumMg: 230 },
  { name: "蛤蜊", category: "海鮮", caloriesPer100g: 37, carbsG: 1.5, proteinG: 6.0, fatG: 0.6, fiberG: 0, sodiumMg: 510 },
  { name: "鮪魚(水煮罐頭)", category: "海鮮", caloriesPer100g: 116, carbsG: 0.0, proteinG: 26.0, fatG: 1.0, fiberG: 0, sodiumMg: 340 },

  // 蛋豆類
  { name: "雞蛋", category: "蛋豆類", caloriesPer100g: 143, carbsG: 0.7, proteinG: 12.6, fatG: 9.9, fiberG: 0, sodiumMg: 140 },
  { name: "豆腐(嫩)", category: "蛋豆類", caloriesPer100g: 55, carbsG: 1.8, proteinG: 5.3, fatG: 3.1, fiberG: 0.3, sodiumMg: 7 },
  { name: "豆腐(板)", category: "蛋豆類", caloriesPer100g: 88, carbsG: 2.4, proteinG: 8.5, fatG: 4.9, fiberG: 0.6, sodiumMg: 9 },
  { name: "毛豆", category: "蛋豆類", caloriesPer100g: 125, carbsG: 8.9, proteinG: 12.0, fatG: 5.2, fiberG: 4.2, sodiumMg: 5 },
  { name: "豆乾", category: "蛋豆類", caloriesPer100g: 160, carbsG: 5.5, proteinG: 17.4, fatG: 7.6, fiberG: 0.5, sodiumMg: 15 },

  // 蔬菜
  { name: "高麗菜", category: "蔬菜", caloriesPer100g: 23, carbsG: 4.6, proteinG: 1.3, fatG: 0.1, fiberG: 1.1, sodiumMg: 12 },
  { name: "花椰菜(綠)", category: "蔬菜", caloriesPer100g: 28, carbsG: 4.3, proteinG: 3.7, fatG: 0.3, fiberG: 3.3, sodiumMg: 22 },
  { name: "地瓜葉", category: "蔬菜", caloriesPer100g: 30, carbsG: 5.1, proteinG: 2.4, fatG: 0.3, fiberG: 2.6, sodiumMg: 10 },
  { name: "菠菜", category: "蔬菜", caloriesPer100g: 22, carbsG: 2.6, proteinG: 2.9, fatG: 0.4, fiberG: 2.1, sodiumMg: 65 },
  { name: "番茄", category: "蔬菜", caloriesPer100g: 19, carbsG: 3.9, proteinG: 0.9, fatG: 0.2, fiberG: 1.2, sodiumMg: 4 },
  { name: "小黃瓜", category: "蔬菜", caloriesPer100g: 13, carbsG: 2.4, proteinG: 0.7, fatG: 0.1, fiberG: 0.8, sodiumMg: 3 },
  { name: "紅蘿蔔", category: "蔬菜", caloriesPer100g: 37, carbsG: 8.1, proteinG: 0.8, fatG: 0.2, fiberG: 3.2, sodiumMg: 35 },
  { name: "洋蔥", category: "蔬菜", caloriesPer100g: 41, carbsG: 9.3, proteinG: 1.1, fatG: 0.1, fiberG: 1.4, sodiumMg: 3 },
  { name: "空心菜", category: "蔬菜", caloriesPer100g: 24, carbsG: 3.4, proteinG: 2.6, fatG: 0.2, fiberG: 2.1, sodiumMg: 30 },

  // 水果
  { name: "香蕉", category: "水果", caloriesPer100g: 85, carbsG: 22.0, proteinG: 1.1, fatG: 0.2, fiberG: 1.6, sodiumMg: 1 },
  { name: "蘋果", category: "水果", caloriesPer100g: 53, carbsG: 13.8, proteinG: 0.3, fatG: 0.2, fiberG: 1.3, sodiumMg: 0 },
  { name: "芭樂", category: "水果", caloriesPer100g: 38, carbsG: 8.9, proteinG: 0.8, fatG: 0.1, fiberG: 3.6, sodiumMg: 4 },
  { name: "柳橙", category: "水果", caloriesPer100g: 43, carbsG: 10.5, proteinG: 0.8, fatG: 0.1, fiberG: 1.8, sodiumMg: 1 },
  { name: "鳳梨", category: "水果", caloriesPer100g: 53, carbsG: 13.1, proteinG: 0.7, fatG: 0.1, fiberG: 1.1, sodiumMg: 2 },
  { name: "西瓜", category: "水果", caloriesPer100g: 33, carbsG: 8.1, proteinG: 0.6, fatG: 0.1, fiberG: 0.5, sodiumMg: 1 },
  { name: "葡萄", category: "水果", caloriesPer100g: 57, carbsG: 14.2, proteinG: 0.5, fatG: 0.2, fiberG: 0.9, sodiumMg: 2 },
  { name: "木瓜", category: "水果", caloriesPer100g: 38, carbsG: 9.1, proteinG: 0.6, fatG: 0.1, fiberG: 1.7, sodiumMg: 3 },

  // 乳製品
  { name: "鮮奶(全脂)", category: "乳製品", caloriesPer100g: 63, carbsG: 4.8, proteinG: 3.2, fatG: 3.6, fiberG: 0, sodiumMg: 40 },
  { name: "鮮奶(低脂)", category: "乳製品", caloriesPer100g: 46, carbsG: 4.9, proteinG: 3.4, fatG: 1.5, fiberG: 0, sodiumMg: 42 },
  { name: "豆漿(無糖)", category: "乳製品", caloriesPer100g: 35, carbsG: 1.6, proteinG: 3.3, fatG: 1.8, fiberG: 0.2, sodiumMg: 14 },
  { name: "優格(原味無糖)", category: "乳製品", caloriesPer100g: 59, carbsG: 3.6, proteinG: 3.5, fatG: 3.3, fiberG: 0, sodiumMg: 46 },
  { name: "起司片", category: "乳製品", caloriesPer100g: 310, carbsG: 3.5, proteinG: 20.0, fatG: 24.5, fiberG: 0, sodiumMg: 1100 },

  // 飲料
  { name: "綠茶(無糖)", category: "飲料", caloriesPer100g: 1, carbsG: 0.2, proteinG: 0.0, fatG: 0.0, fiberG: 0, sodiumMg: 1 },
  { name: "黑咖啡", category: "飲料", caloriesPer100g: 2, carbsG: 0.3, proteinG: 0.1, fatG: 0.0, fiberG: 0, sodiumMg: 2 },
  { name: "可樂", category: "飲料", caloriesPer100g: 42, carbsG: 10.6, proteinG: 0.0, fatG: 0.0, fiberG: 0, sodiumMg: 4 },
  { name: "珍珠奶茶", category: "飲料", caloriesPer100g: 80, carbsG: 17.0, proteinG: 0.5, fatG: 1.2, fiberG: 0, sodiumMg: 15 },
  { name: "柳橙汁(鮮榨)", category: "飲料", caloriesPer100g: 44, carbsG: 10.4, proteinG: 0.7, fatG: 0.1, fiberG: 0.2, sodiumMg: 1 },
  { name: "運動飲料", category: "飲料", caloriesPer100g: 26, carbsG: 6.4, proteinG: 0.0, fatG: 0.0, fiberG: 0, sodiumMg: 45 },

  // 零食/小吃
  { name: "水煎包", category: "零食", caloriesPer100g: 220, carbsG: 26.0, proteinG: 7.5, fatG: 9.5, fiberG: 1.0, sodiumMg: 380 },
  { name: "蔥油餅", category: "零食", caloriesPer100g: 290, carbsG: 35.0, proteinG: 5.5, fatG: 14.0, fiberG: 1.2, sodiumMg: 420 },
  { name: "滷肉飯", category: "零食", caloriesPer100g: 185, carbsG: 25.0, proteinG: 6.5, fatG: 6.5, fiberG: 0.3, sodiumMg: 350 },
  { name: "便當(排骨)", category: "零食", caloriesPer100g: 170, carbsG: 20.0, proteinG: 10.0, fatG: 5.5, fiberG: 1.5, sodiumMg: 400 },
  { name: "牛肉麵", category: "零食", caloriesPer100g: 110, carbsG: 12.0, proteinG: 6.5, fatG: 3.8, fiberG: 0.5, sodiumMg: 450 },
  { name: "小籠包", category: "零食", caloriesPer100g: 210, carbsG: 22.0, proteinG: 9.5, fatG: 9.0, fiberG: 0.5, sodiumMg: 390 },
  { name: "蛋餅", category: "零食", caloriesPer100g: 230, carbsG: 27.0, proteinG: 8.0, fatG: 10.0, fiberG: 0.8, sodiumMg: 360 },
  { name: "鍋貼", category: "零食", caloriesPer100g: 225, carbsG: 24.0, proteinG: 8.5, fatG: 10.5, fiberG: 0.7, sodiumMg: 370 },
];

async function main() {
  console.log("Seeding foods...");

  for (const food of foods) {
    await prisma.food.create({
      data: {
        name: food.name,
        category: food.category,
        caloriesPer100g: food.caloriesPer100g,
        carbsG: food.carbsG,
        proteinG: food.proteinG,
        fatG: food.fatG,
        fiberG: food.fiberG ?? null,
        sodiumMg: food.sodiumMg ?? null,
        isCustom: false,
      },
    }).catch(() => {
      // skip duplicates on re-run
    });
  }

  console.log(`Seeded ${foods.length} foods successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
