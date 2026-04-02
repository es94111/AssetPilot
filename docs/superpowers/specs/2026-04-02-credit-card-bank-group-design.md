# 信用卡銀行分組與一鍵還款 — 設計規格

**日期：** 2026-04-02  
**狀態：** 待實作

---

## 1. 需求摘要

使用者在同一家銀行持有多張信用卡，還款時是以銀行為單位統一還款。需要：

1. 信用卡帳戶可以「連結到所屬銀行帳戶」，進行視覺分組
2. 在信用卡銀行群組上提供「一鍵還款」功能，支援逐張設定還款金額

---

## 2. 資料層

### 2.1 schema 變更

```sql
ALTER TABLE accounts ADD COLUMN linked_bank_id TEXT DEFAULT NULL;
```

- 僅對 `account_type = '信用卡'` 的帳戶有意義
- 值為同一使用者另一個 `account_type = '銀行'` 帳戶的 `id`
- `NULL` = 未分組（維持現有行為，不影響任何既有功能）

### 2.2 資料完整性

- 刪除銀行帳戶（`DELETE /api/accounts/:id`）時，需同步將旗下所有信用卡的 `linked_bank_id` 設為 `NULL`：
  ```sql
  UPDATE accounts SET linked_bank_id = NULL
  WHERE linked_bank_id = :deletedId AND user_id = :userId;
  ```
- API 建立/更新信用卡帳戶時，需驗證 `linked_bank_id` 對應的帳戶確實存在、屬於同一使用者，且類型為 `銀行`

### 2.3 API 變更

| 端點 | 變更說明 |
|------|---------|
| `POST /api/accounts` | 新增 `linkedBankId` 欄位（選填） |
| `PUT /api/accounts/:id` | 新增 `linkedBankId` 欄位（選填） |
| `DELETE /api/accounts/:id` | 刪除前清空旗下信用卡的 `linked_bank_id` |
| `GET /api/accounts` | 回傳結果新增 `linkedBankId` 欄位 |

新增一鍵還款端點：

```
POST /api/accounts/credit-card-repayment
```

Request body：
```json
{
  "fromAccountId": "bank-account-id",
  "date": "2026-04-02",
  "repayments": [
    { "cardId": "card-id-1", "amount": 3200 },
    { "cardId": "card-id-2", "amount": 1500 }
  ]
}
```

行為：
- 驗證 `fromAccountId` 屬於該使用者
- 驗證每個 `cardId` 屬於該使用者且為信用卡
- 過濾 `amount <= 0` 的項目（不產生交易）
- 為每張卡各呼叫現有轉帳邏輯（INSERT 兩筆 transactions，`linked_id` 互相對應）
- 全部成功後呼叫 `saveDB()`

---

## 3. 前端：帳戶管理頁面

### 3.1 帳戶編輯 Modal（`modalAccount`）

- 當 `accType` 選為「信用卡」時，顯示「所屬銀行」欄位（`accLinkedBank`）
- 當 `accType` 改為其他類型時，隱藏並清空該欄位
- 欄位為下拉選單（`<select>`）：
  - 第一個選項：`<option value="">不分組</option>`
  - 其餘選項：使用者所有 `account_type = '銀行'` 的帳戶

### 3.2 帳戶管理頁面分組顯示

**「全部」tab 與「信用卡」tab 的信用卡渲染邏輯變更：**

1. 將信用卡依 `linked_bank_id` 分組
2. 有連結銀行的卡：以銀行帳戶名稱為子群組標題顯示
   - 子群組標題格式：`<銀行名稱> · 共 N 張 · 欠款合計 $X,XXX`
   - 標題右側放「還款」按鈕（`fa-hand-holding-dollar`）
3. `linked_bank_id = NULL` 的卡：歸在「未分組」區塊（無還款按鈕）

### 3.3 還款 Modal（新增 `modalCreditRepayment`）

觸發：點擊銀行子群組的「還款」按鈕，傳入 `bankAccountId`

Modal 結構：
```
標題：信用卡還款（<銀行名稱>）

付款帳戶：[下拉選單，預設該銀行帳戶]
日期：    [date input，預設今天]

─────────────────────────────
信用卡名稱     目前欠款    還款金額
國泰 CUBE 卡   -$3,200    [3,200  ]
國泰 鈦金卡    -$1,500    [1,500  ]
─────────────────────────────
                還款總計：$4,700

[全部歸零]  [清除全部]          [取消] [確認還款]
```

行為細節：
- **全部歸零**：將各卡還款金額填入「目前欠款的絕對值」（負數取正）
- **清除全部**：所有還款金額欄位清為空白
- **還款總計**：即時加總所有還款金額輸入值
- **確認還款**：`amount = 0` 或空白的卡跳過，只送出有金額的卡
- 成功後關閉 Modal 並重新整理帳戶頁面

---

## 4. 不在此次範圍

- 信用卡「最低應繳金額」計算
- 信用卡還款提醒/通知
- 自動定期還款

---

## 5. 版本

此功能完成後版本號定為小版本更新（如 X.Y+1），changelog tag 為 `new`。
