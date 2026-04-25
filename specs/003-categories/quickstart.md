# Phase 1 快速驗證流程：分類系統（Category System）

**Branch**: `003-categories`｜**Date**: 2026-04-25｜**Plan**: [plan.md](./plan.md)

本檔提供本功能的最短可重現驗證流程，作為 PR 合併前人工驗收 checklist。
所有指令於 Windows PowerShell 或 macOS/Linux bash 皆可執行（HTTP 工具
擇一：curl／PowerShell `Invoke-RestMethod`／瀏覽器 DevTools）。

## §1 準備環境

```bash
# 切換到本功能分支
git switch 003-categories

# 安裝（不應有任何新增 dependency；應與 002 完全一致）
npm ci

# 啟動本機伺服器
npm start
# 預期：listening on http://localhost:3000
```

## §2 OpenAPI 契約 lint（憲章 Principle II）

```bash
npx @redocly/cli lint openapi.yaml
npx @redocly/cli lint specs/003-categories/contracts/categories.openapi.yaml
```

**預期**：兩份檔案皆 `0 errors`。

## §3 註冊新使用者並驗證預設樹（US1：FR-007、FR-008、SC-001）

```bash
# 1. 註冊（沿用 001 端點；密碼任意）
curl -c cookies.txt -X POST http://localhost:3000/api/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa-003-a@example.com","password":"Test12345!","displayName":"QA-003-A"}'

# 2. 列出分類
curl -b cookies.txt http://localhost:3000/api/categories | jq '. | length'
```

**預期**：分類總數 = 13（父）+ 56（子）= **69**，且回傳 JSON **不含**
`isHidden` 欄位（已於 003 移除）。

進一步檢查：

```bash
# 父分類數
curl -b cookies.txt http://localhost:3000/api/categories \
  | jq '[.[] | select(.parentId == "")] | length'
# 預期：13

# 收入父分類
curl -b cookies.txt http://localhost:3000/api/categories \
  | jq '[.[] | select(.parentId == "" and .type == "income")] | .[].name'
# 預期：薪資 / 獎金 / 投資 / 兼職 / 其他

# 「薪資」底下的子分類
curl -b cookies.txt http://localhost:3000/api/categories \
  | jq -r '
    [.[] | select(.parentId == "" and .name == "薪資" and .type == "income")][0] as $p
    | [.[] | select(.parentId == $p.id)] | .[].name
  '
# 預期：月薪、加班費
```

## §4 約束驗證（FR-005、FR-005a、FR-013a、FR-014c、FR-015、FR-020、SC-003）

```bash
# (a) 顏色非 #RRGGBB → 400
curl -b cookies.txt -X POST http://localhost:3000/api/categories \
  -H 'Content-Type: application/json' \
  -d '{"name":"測試","type":"expense","color":"red","parentId":""}'
# 預期：HTTP 400，{"error":"顏色格式不正確"}

curl -b cookies.txt -X POST http://localhost:3000/api/categories \
  -H 'Content-Type: application/json' \
  -d '{"name":"測試","type":"expense","color":"#abc","parentId":""}'
# 預期：HTTP 400（縮寫格式）

curl -b cookies.txt -X POST http://localhost:3000/api/categories \
  -H 'Content-Type: application/json' \
  -d '{"name":"測試","type":"expense","color":"#FFFFFFFF","parentId":""}'
# 預期：HTTP 400（含 alpha）

# (b) 同父下重名 → 400（FR-005）
DINING_ID=$(curl -s -b cookies.txt http://localhost:3000/api/categories \
  | jq -r '[.[] | select(.parentId == "" and .name == "餐飲" and .type == "expense")][0].id')

curl -b cookies.txt -X POST http://localhost:3000/api/categories \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"早餐\",\"type\":\"expense\",\"color\":\"#ff0000\",\"parentId\":\"$DINING_ID\"}"
# 預期：HTTP 400，{"error":"同分類下名稱不可重複"}

# (c) 同 type 父分類重名 → 400（FR-005a）
curl -b cookies.txt -X POST http://localhost:3000/api/categories \
  -H 'Content-Type: application/json' \
  -d '{"name":"餐飲","type":"expense","color":"#ff0000","parentId":""}'
# 預期：HTTP 400

# (d) 跨 type 父分類同名 → 200（FR-005a：跨類型可同名，預設樹「其他」即雙存）
# 已存在預設「其他」expense + 「其他」income，無需測試

# (e) PUT 試圖變更 type → 200 但 type 維持原值（後端忽略）
CAT_ID=$(curl -s -b cookies.txt http://localhost:3000/api/categories \
  | jq -r '[.[] | select(.parentId == "" and .name == "餐飲" and .type == "expense")][0].id')
curl -b cookies.txt -X PUT http://localhost:3000/api/categories/$CAT_ID \
  -H 'Content-Type: application/json' \
  -d '{"name":"餐飲","color":"#ef4444","type":"income"}'
curl -b cookies.txt http://localhost:3000/api/categories \
  | jq -r ".[] | select(.id == \"$CAT_ID\") | .type"
# 預期：仍為 expense（type 未被變更，FR-014c）
```

## §5 升級既有 v3.x／v4.x 資料庫驗證（CT-1、CT-2）

> 本步驟模擬「001/002 已上線、首次部署 003」的升級情境。

```bash
# 1. 備份既有 database.db
cp database.db database.db.bak.before-003-test

# 2. （可選）以 sqlite3 檢查升級前 schema
sqlite3 database.db "PRAGMA table_info(categories);"
# 預期：看到 9 個欄位，包含 is_hidden

# 3. 啟動 003 server，觀察 console 是否輸出 migration log
npm start
# 預期 console 出現：
#   [003-migration] dropping is_hidden via rebuild...
#   [003-migration] creating deleted_defaults table...
#   [003-migration] creating idx_cat_user_parent_sort...

# 4. 升級後 schema
sqlite3 database.db "PRAGMA table_info(categories);"
# 預期：8 個欄位，**不含** is_hidden

sqlite3 database.db "PRAGMA table_info(deleted_defaults);"
# 預期：3 個欄位（user_id, default_key, deleted_at）

# 5. 既有使用者資料完整性
sqlite3 database.db "SELECT COUNT(*) FROM categories;"
# 預期：升級前 == 升級後（無資料遺失）

# 6. 既有交易未受影響
sqlite3 database.db "SELECT COUNT(*) FROM transactions;"
# 預期：與升級前相同

# 7. 觀察 backfill：若舊使用者原無「美妝保養」「訂閱服務」等新預設子分類，
#    登入後應被補建
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<舊使用者 email>","password":"<密碼>"}'
curl -b cookies.txt http://localhost:3000/api/categories \
  | jq '[.[] | select(.name == "美妝保養")] | length'
# 預期：1（自動補建成功）

# 失敗時的回滾
# cp database.db.bak.before-003-test database.db && npm start
```

## §6 拖曳排序（FR-024a/b）

> 本步驟需透過瀏覽器手動操作；以下為 API 驗證流程。

```bash
# 1. 取得餐飲底下的全部子分類 id 與當前 sortOrder
DINING_ID=$(curl -s -b cookies.txt http://localhost:3000/api/categories \
  | jq -r '[.[] | select(.name == "餐飲" and .type == "expense")][0].id')

curl -b cookies.txt http://localhost:3000/api/categories \
  | jq "[.[] | select(.parentId == \"$DINING_ID\")] | sort_by(.sortOrder)
        | [.[] | {id, name, sortOrder}]"
# 範例輸出（順序：早餐→午餐→晚餐→飲料→點心）

# 2. 模擬拖曳「點心」到第一位
curl -b cookies.txt -X POST http://localhost:3000/api/categories/reorder \
  -H 'Content-Type: application/json' \
  -d "{
    \"scope\": \"children:$DINING_ID\",
    \"items\": [
      {\"id\": \"<點心 id>\", \"sortOrder\": 1},
      {\"id\": \"<早餐 id>\", \"sortOrder\": 2},
      {\"id\": \"<午餐 id>\", \"sortOrder\": 3},
      {\"id\": \"<晚餐 id>\", \"sortOrder\": 4},
      {\"id\": \"<飲料 id>\", \"sortOrder\": 5}
    ]
  }"
# 預期：HTTP 200 {"ok":true}

# 3. 重新讀取，驗證持久化
curl -b cookies.txt http://localhost:3000/api/categories \
  | jq "[.[] | select(.parentId == \"$DINING_ID\")] | sort_by(.sortOrder) | .[].name"
# 預期：點心、早餐、午餐、晚餐、飲料
```

## §7 子分類跨父歸屬變更（FR-014a/b/d）

```bash
# 將「停車費」（原屬「交通」）移到「居住」底下
PARKING_ID=$(curl -s -b cookies.txt http://localhost:3000/api/categories \
  | jq -r '[.[] | select(.name == "停車費" and .type == "expense")][0].id')
HOUSING_ID=$(curl -s -b cookies.txt http://localhost:3000/api/categories \
  | jq -r '[.[] | select(.name == "居住" and .type == "expense")][0].id')

curl -b cookies.txt -X PATCH http://localhost:3000/api/categories/$PARKING_ID \
  -H 'Content-Type: application/json' \
  -d "{\"parentId\":\"$HOUSING_ID\"}"
# 預期：HTTP 200

# 驗證：停車費 parentId == 居住 id，且 sortOrder = 居住底下最大 + 1
curl -b cookies.txt http://localhost:3000/api/categories \
  | jq ".[] | select(.id == \"$PARKING_ID\") | {name, parentId, sortOrder}"

# 驗證既有交易仍掛在停車費（FR-014b：交易不變）
sqlite3 database.db "SELECT COUNT(*) FROM transactions WHERE category_id = '$PARKING_ID';"
```

## §8 刪除規則與 deleted_defaults（FR-017、FR-018、FR-019、FR-011b/b1）

```bash
# (a) 刪除有交易的子分類 → 400
TX_CAT_ID=<某有交易的子分類 id>
curl -b cookies.txt -X DELETE http://localhost:3000/api/categories/$TX_CAT_ID
# 預期：HTTP 400，{"error":"此分類下有交易記錄..."}

# (b) 刪除無交易的預設子分類 → 200，且寫入 deleted_defaults
EMPTY_DEFAULT_SUB=<某無交易的預設子分類 id>
curl -b cookies.txt -X DELETE http://localhost:3000/api/categories/$EMPTY_DEFAULT_SUB
# 預期：HTTP 200

sqlite3 database.db \
  "SELECT default_key FROM deleted_defaults WHERE user_id = '<user_id>';"
# 預期：含對應 default_key（格式 expense:餐飲:點心 等）

# (c) 登出再登入，驗證該預設項未被自動補回（FR-011c）
curl -b cookies.txt -X POST http://localhost:3000/api/logout
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa-003-a@example.com","password":"Test12345!"}'
curl -b cookies.txt http://localhost:3000/api/categories \
  | jq '[.[] | select(.name == "點心")] | length'
# 預期：0（未補回）

# (d) 還原預設 → 補回（FR-011d/e）
curl -b cookies.txt -X POST http://localhost:3000/api/categories/restore-defaults
# 預期：HTTP 200，{"ok":true,"restored":1}

curl -b cookies.txt http://localhost:3000/api/categories \
  | jq '[.[] | select(.name == "點心")] | length'
# 預期：1（補回）

# (e) 連帶刪除整棵樹後 deleted_defaults 對稱寫入（FR-011b1）
EMPTY_PARENT_ID=<某預設父分類 id 且其下子分類皆無交易>
curl -b cookies.txt -X DELETE http://localhost:3000/api/categories/$EMPTY_PARENT_ID
# 預期：HTTP 200

sqlite3 database.db \
  "SELECT default_key FROM deleted_defaults WHERE user_id = '<user_id>'
   ORDER BY default_key;"
# 預期：父分類本身 + 其下所有預設子分類的 default_key 皆出現
```

## §9 leaf-only 在交易端點的驗證（FR-013a）

```bash
# 嘗試新增交易並指定父分類為 category_id → 400
PARENT_ID=$(curl -s -b cookies.txt http://localhost:3000/api/categories \
  | jq -r '[.[] | select(.parentId == "" and .name == "餐飲")][0].id')

curl -b cookies.txt -X POST http://localhost:3000/api/transactions \
  -H 'Content-Type: application/json' \
  -d "{
    \"type\":\"expense\",\"amount\":100,\"date\":\"2026-04-25\",
    \"accountId\":\"<某 account id>\",\"categoryId\":\"$PARENT_ID\"
  }"
# 預期：HTTP 400，{"error":"交易必須指派至子分類，不能直接掛在父分類底下"}

# 嘗試新增交易並指定子分類 → 200
LEAF_ID=$(curl -s -b cookies.txt http://localhost:3000/api/categories \
  | jq -r '[.[] | select(.parentId != "" and .name == "午餐")][0].id')
curl -b cookies.txt -X POST http://localhost:3000/api/transactions \
  -H 'Content-Type: application/json' \
  -d "{
    \"type\":\"expense\",\"amount\":100,\"date\":\"2026-04-25\",
    \"accountId\":\"<某 account id>\",\"categoryId\":\"$LEAF_ID\"
  }"
# 預期：HTTP 200，{ id: "..." }
```

## §10 補建效能 P95（FR-010a、SC-007）

```bash
# 連續 20 次登入，量測補建延遲（單機 sql.js）
for i in $(seq 1 20); do
  /usr/bin/time -f '%e' curl -s -c /tmp/c.txt -X POST http://localhost:3000/api/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"qa-003-a@example.com","password":"Test12345!"}' 2>&1 \
    | tail -1
done | sort -n | awk 'BEGIN{c=0} {a[c++]=$1} END{print "P95(s) =", a[int(c*0.95)]}'
```

**預期**：P95 < 0.5 s（含網路 RTT；其中補建本身應 < 0.2 s）。

## §11 UI 手動驗收（US1～US3）

於瀏覽器 (Chrome 最新版) 開啟 `https://localhost:3000`：

1. 登入後切換至「分類管理」頁。**SC-002 計時驗證**：以秒錶量測「新增父分
   類『寵物』(設定名稱、收支類型、顏色) → 在其下新增 3 個子分類（飼料、
   醫療、美容）→ 全部送出存檔」全流程，目標 ≤ 90 秒；超時表示介面流暢度
   或步驟數需檢討。
2. **雙區塊**（FR-022a）：頁面從上到下先「支出」區塊（含 8 父分類列 +
   各父底下子分類網格）、再「收入」區塊（5 父 + 子）；中間有區塊標題與
   分隔線。
3. **拖曳父分類列**：拖動「居住」整列至「餐飲」之上 → 釋放後順序立即
   更新；F5 重整後順序持久化。
4. **拖曳子分類網格**：拖動「點心」至「早餐」之前 → 同上驗證。
5. **跨層拖曳被阻擋**（FR-024b）：嘗試把支出「餐飲」拖到收入區塊，或把
   「停車費」拖到「餐飲」網格 → 視覺回饋顯示禁止圖示，drop 不生效。
6. **編輯 modal 中 type 為 read-only**（FR-014c）：點任一分類「編輯」按
   鈕，type 欄位顯示為 disabled radio／灰階文字，附說明「分類類型一經建立
   不可變更」。
7. **編輯子分類「父分類」下拉**（FR-014a）：modal 中提供下拉「移到另一
   父分類」；選項僅含同 type 的父分類；確認後子分類落於新父最末位
   （FR-014d）。
8. **「還原預設分類」按鈕**（FR-011d/f）：頁面右上有按鈕，文案明確為
   「補回過去刪除的預設分類」（**不**使用「重置」「恢復出廠」字眼）；
   按下後若 registry 為空，提示「目前沒有需要補回的預設分類」；若有則
   顯示「已補回 N 個分類」。
9. **顏色選擇器**：點分類旁顏色色塊，瀏覽器原生 `<input type="color">`
   開啟，選色後立即更新；無自訂第三方元件。
10. **無「隱藏」按鈕／開關**：頁面與 modal 完全不出現「隱藏」「顯示」相
    關 UI（FR-002 已移除）。
11. **顏色跨頁面一致性**（FR-025、SC-004）：選取 5 個不同的子分類（建議
    跨「餐飲／交通／居住」與「薪資／投資」涵蓋收支），於分類管理頁讀取
    其色點 hex（透過瀏覽器 DevTools Inspector 查 `background-color` 並
    轉為 `#RRGGBB`）→ 切換至儀表板與報表頁，比對該分類圖例的色點 hex
    是否完全相同（5/5 必須一致）。任何一筆不一致即判定 SC-004 未通過。

## §12 PR 合併前最終 checklist

- [ ] §2 OpenAPI lint 0 errors
- [ ] §3 新使用者預設樹完整（69 筆 = 13 + 56）
- [ ] §4 顏色／重名／type 變更約束皆 400
- [ ] §5 升級既有 DB 不遺失資料、is_hidden 欄位已消失、deleted_defaults 表已建
- [ ] §6 拖曳排序持久化
- [ ] §7 子分類移動歸屬，交易維持原參照
- [ ] §8 刪除規則 + DeletedDefaultRegistry 對稱寫入 + 還原補回
- [ ] §9 leaf-only 後端強制
- [ ] §10 補建 P95 < 200 ms
- [ ] §11 UI 手動驗收全項通過（含 §11.1 SC-002 計時 ≤ 90 秒、§11.11 SC-004 顏色 5/5 一致）
- [ ] `changelog.json` 4.24.0 條目補上（含本功能 highlights）
- [ ] `SRS.md` 版本歷史更新
- [ ] 根目錄 `openapi.yaml` `info.version` 已 bump 至 4.24.0、含本功能新端點
