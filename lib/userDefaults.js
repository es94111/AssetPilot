'use strict';
// lib/userDefaults.js — 新使用者預設資料建立（從 server.js 提取）

const crypto = require('crypto');
const { getDB, queryOne, queryAll, saveDB } = require('./db');

function uid() {
  return crypto.randomUUID().replace(/-/g, '');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_EXPENSE_PARENTS = [
  ['餐飲', '#ef4444'], ['交通', '#f97316'], ['購物', '#eab308'],
  ['娛樂', '#8b5cf6'], ['居住', '#06b6d4'], ['醫療', '#ec4899'],
  ['教育', '#3b82f6'], ['其他', '#64748b'],
];
const DEFAULT_INCOME_PARENTS = [
  ['薪資', '#10b981'], ['獎金', '#14b8a6'], ['投資', '#6366f1'],
  ['兼職', '#f59e0b'], ['其他', '#71717a'],
];
const DEFAULT_SUBCATEGORIES = {
  expense: {
    '餐飲': [['早餐','#fca5a5'], ['午餐','#f87171'], ['晚餐','#dc2626'], ['飲料','#fb923c'], ['點心','#fdba74']],
    '交通': [['大眾運輸','#fdba74'], ['計程車','#fb923c'], ['加油','#f97316'], ['停車費','#ea580c'], ['高鐵/火車','#c2410c']],
    '購物': [['日用品','#fde047'], ['服飾','#facc15'], ['3C用品','#eab308'], ['家電','#ca8a04'], ['美妝保養','#a16207']],
    '娛樂': [['電影/影音','#a78bfa'], ['遊戲','#8b5cf6'], ['旅遊','#7c3aed'], ['運動健身','#6d28d9'], ['訂閱服務','#5b21b6']],
    '居住': [['房租/房貸','#22d3ee'], ['水電費','#06b6d4'], ['瓦斯費','#0891b2'], ['網路費','#0e7490'], ['管理費','#155e75']],
    '醫療': [['掛號費','#f9a8d4'], ['藥品','#f472b6'], ['保健食品','#ec4899'], ['牙科','#db2777'], ['健檢','#be185d']],
    '教育': [['學費','#93c5fd'], ['書籍','#60a5fa'], ['線上課程','#3b82f6'], ['補習費','#2563eb']],
    '其他': [['雜支','#94a3b8'], ['禮金/紅包','#64748b'], ['捐款','#475569'], ['罰款','#334155']],
  },
  income: {
    '薪資': [['月薪','#34d399'], ['加班費','#10b981']],
    '獎金': [['年終獎金','#5eead4'], ['績效獎金','#2dd4bf'], ['節日禮金','#14b8a6']],
    '投資': [['股利','#a5b4fc'], ['利息','#818cf8'], ['資本利得','#6366f1']],
    '兼職': [['接案','#fbbf24'], ['家教','#f59e0b'], ['打工','#d97706']],
    '其他': [['退稅','#a1a1aa'], ['贈與/紅包','#71717a'], ['雜項','#52525b']],
  },
};

const DEFAULT_STOCK_SETTINGS = {
  feeRate: 0.001425,
  feeDiscount: 1,
  feeMinLot: 20,
  feeMinOdd: 1,
  sellTaxRateStock: 0.003,
  sellTaxRateEtf: 0.001,
  sellTaxRateWarrant: 0.001,
  sellTaxMin: 1,
};

function categoryDefaultKey(type, parentName, name) {
  if (parentName === null || parentName === undefined || parentName === '') return `${type}:${name}`;
  return `${type}:${parentName}:${name}`;
}

function createDefaultsForUser(userId) {
  const db = getDB();
  let order = 0;
  for (const [name, color] of DEFAULT_EXPENSE_PARENTS) {
    const parentId = uid();
    order++;
    db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",
      [parentId, userId, name, 'expense', color, order]);
    const subs = (DEFAULT_SUBCATEGORIES.expense || {})[name] || [];
    for (const [subName, subColor] of subs) {
      order++;
      db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",
        [uid(), userId, subName, 'expense', subColor, order, parentId]);
    }
  }
  for (const [name, color] of DEFAULT_INCOME_PARENTS) {
    const parentId = uid();
    order++;
    db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",
      [parentId, userId, name, 'income', color, order]);
    const subs = (DEFAULT_SUBCATEGORIES.income || {})[name] || [];
    for (const [subName, subColor] of subs) {
      order++;
      db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",
        [uid(), userId, subName, 'income', subColor, order, parentId]);
    }
  }
  const nowMs = Date.now();
  db.run(
    "INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, account_type, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [uid(), userId, '現金', 'cash', 0, 'TWD', 'fa-wallet', 0, null, null, '現金', todayStr(), nowMs]
  );
  db.run(
    "INSERT OR IGNORE INTO user_settings (user_id, pinned_currencies, updated_at) VALUES (?, ?, ?)",
    [userId, '["TWD"]', nowMs]
  );
  db.run("INSERT OR IGNORE INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at) VALUES (?, 0, 0, ?)",
    [userId, nowMs]);
  db.run(`INSERT OR IGNORE INTO stock_settings (user_id, fee_rate, fee_discount, fee_min_lot, fee_min_odd, sell_tax_rate_stock, sell_tax_rate_etf, sell_tax_rate_warrant, sell_tax_min, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, DEFAULT_STOCK_SETTINGS.feeRate, DEFAULT_STOCK_SETTINGS.feeDiscount,
      DEFAULT_STOCK_SETTINGS.feeMinLot, DEFAULT_STOCK_SETTINGS.feeMinOdd,
      DEFAULT_STOCK_SETTINGS.sellTaxRateStock, DEFAULT_STOCK_SETTINGS.sellTaxRateEtf,
      DEFAULT_STOCK_SETTINGS.sellTaxRateWarrant, DEFAULT_STOCK_SETTINGS.sellTaxMin, nowMs]);
}

function backfillDefaultsForUser(userId) {
  const db = getDB();
  const deletedRows = queryAll('SELECT default_key FROM deleted_defaults WHERE user_id = ?', [userId]);
  const deletedSet = new Set(deletedRows.map(r => r.default_key));
  let maxOrder = queryOne(
    'SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE user_id = ?',
    [userId]
  )?.m || 0;
  let inserted = 0;
  db.run('BEGIN');
  try {
    for (const [type, parents] of [['expense', DEFAULT_EXPENSE_PARENTS], ['income', DEFAULT_INCOME_PARENTS]]) {
      for (const [pName, pColor] of parents) {
        const pKey = categoryDefaultKey(type, null, pName);
        if (deletedSet.has(pKey)) continue;
        let parent = queryOne(
          "SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND (parent_id = '' OR parent_id IS NULL)",
          [userId, type, pName]
        );
        if (!parent) {
          const pid = uid();
          maxOrder++;
          db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",
            [pid, userId, pName, type, pColor, maxOrder]);
          parent = { id: pid };
          inserted++;
        }
        const subs = (DEFAULT_SUBCATEGORIES[type] || {})[pName] || [];
        for (const [sName, sColor] of subs) {
          const sKey = categoryDefaultKey(type, pName, sName);
          if (deletedSet.has(sKey)) continue;
          const exists = queryOne('SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ?',
            [userId, parent.id, sName]);
          if (exists) continue;
          maxOrder++;
          db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",
            [uid(), userId, sName, type, sColor, maxOrder, parent.id]);
          inserted++;
        }
      }
    }
    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch (_) {}
    throw err;
  }
  return inserted;
}

module.exports = {
  uid,
  todayStr,
  createDefaultsForUser,
  backfillDefaultsForUser,
  DEFAULT_EXPENSE_PARENTS,
  DEFAULT_INCOME_PARENTS,
  DEFAULT_SUBCATEGORIES,
  DEFAULT_STOCK_SETTINGS,
  categoryDefaultKey,
};
