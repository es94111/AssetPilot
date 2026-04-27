# 更新文件與版號

完成功能開發或修正後，依序執行以下步驟確保所有文件保持同步。

> **撰寫 changelog 條目前必讀**：`.specify/memory/changelog-style.md`（Changelog 公開撰寫規格）。本指令的步驟 2 必須完全遵守該規格。

## 步驟 1：判斷版號

根據異動規模決定版號：
- **大版本**（如 4.0）：新增重大模組
- **小版本**（如 3.8）：新增功能或重要改進
- **修正版**（如 3.7.1）：Bug 修正

讀取 `changelog.json` 的 `currentVersion` 確認目前版號，再決定新版號。

## 步驟 2：更新 `changelog.json`

> **重要**：`changelog.json` 是給**一般使用者**看的，不是給開發者看的。完整規格見 `.specify/memory/changelog-style.md`。

### 2.1 結構

1. 將 `currentVersion` 改為新版號
2. 在 `releases` 陣列**最前面**插入新版本紀錄：

```json
{
  "version": "X.Y.Z",
  "date": "YYYY-MM-DD",
  "title": "12–25 字一句話描述本次更新",
  "type": "new | feature | improved | fixed | removed | warning",
  "changes": [
    { "tag": "warning", "text": "升級需注意事項（如有）" },
    { "tag": "new", "text": "新增的功能說明" },
    { "tag": "improved", "text": "改進的功能說明" },
    { "tag": "fixed", "text": "修正的問題說明" }
  ]
}
```

`tag` 可用值：`new`（新增）、`improved`（改進）、`fixed`（修正）、`removed`（移除）、`warning`（升級需注意）

### 2.2 撰寫前必做：技術 → 使用者翻譯

先寫一份「給工程師看」的內部筆記（含完整技術細節，用於 commit message／PR），再對照下表逐條翻譯成「給使用者看」的版本：

| 不可出現 | 範例 | 改寫方向 |
|---|---|---|
| 內部規格代號 | `FR-033`、`T099`、`Round 1 Q5`、`SC-004`、`CT-1` | 直接刪掉 |
| 分支／spec 編號 | `008-frontend-routing` | 改成功能名稱 |
| 內部審查標記 | `Copilot Review v4.18.2`、`CodeQL 警告` | 改成「資安修正」「程式碼審查修正」 |
| API 路徑 | `POST /api/transactions/import` | 改成「匯入交易功能」 |
| 檔名／函式／變數 | `server.js`、`refreshRecFxUi()`、`SERVER_TIME_OFFSET` | 改成它做的事情 |
| 資料表／欄位 | `system_settings`、`token_version`、`recurring.amount` | 改成「設定值」「登入憑證」「金額」 |
| 環境變數 | `TWSE_MAX_CONCURRENCY`、`MTLS_CF_ONLY` | 改成「並發上限」「Cloudflare 模式」 |
| 程式術語 | `BEGIN/COMMIT/ROLLBACK`、`setImmediate`、`partial unique index`、`bcrypt.compare` | 改成「全部成功或全部回復」「背景執行」「重複保護」 |
| 套件版號／CVE 細節 | `resend 6.1.3 → 6.12.2`、`GHSA-…` | 改成「升級寄信套件」「修補已知漏洞」 |
| Schema migration 細節 | `ALTER TABLE … REAL → INTEGER`、`冪等 ALTER` | 用 `warning` tag 提醒「升級時自動轉換，建議先備份」 |
| 內部演算法名稱 | `三層 fallback`、`atomic delete + insert`、`token bucket` | 改成「自動備援」「原子化更新」 |

允許保留：服務／品牌名（Google、Resend、Cloudflare、Passkey、IPinfo…）、通用前端詞（深色模式、響應式、彈窗、圓餅圖）、投資領域用詞（FIFO、ETF、除權息、定期定額、實現損益）、合規標示、有意義的數字（90 天保留、500 筆上限等）。

### 2.3 條目撰寫規則

- **標題**：12–25 字，不含規格代號、分支名、Review 標記。多重點用「+」串接。
- **每條 change**：40–120 字一句完整中文，從使用者角度寫，主詞通常是「使用者可以…」「系統會自動…」「介面新增…」。描述「結果」勝於「實作」。
- **條目順序**：`warning` →`new` → `improved` → `fixed` → `removed`。
- **warning 條目**：必須明確說會發生什麼 + 給出具體建議。範例：「升級時系統會自動執行 Email 正規化；若大小寫混用造成重複帳號，將保留最早建立者並合併其餘資料。建議升級前先備份資料庫。」

### 2.4 提交前驗證

逐項執行：

```bash
# 1. JSON 格式有效
node -e "require('./changelog.json')"

# 2. 沒有禁用字眼殘留（任一指令有輸出代表還沒清乾淨）
grep -n "FR-[0-9]" changelog.json
grep -n "/api/" changelog.json
grep -nE "[a-z]+\.js" changelog.json
grep -n "Round [0-9]" changelog.json
grep -n "Copilot" changelog.json
grep -n "CodeQL" changelog.json
```

### 2.5 自我檢查清單

- [ ] JSON 格式有效（步驟 2.4 第 1 項通過）
- [ ] `currentVersion` 與最新版本一致
- [ ] 標題沒有規格代號、分支名、Review 標記
- [ ] 沒有 API 路徑、檔名、函式名、資料表名稱
- [ ] 沒有 `FR-XXX`、`T0XX`、`Round X Q Y` 之類的內部代號
- [ ] 每條 change 都從使用者角度描述
- [ ] `warning` 條目有清楚的建議動作
- [ ] 全文為繁體中文（Constitution Principle I）

## 步驟 3：更新 `SRS.md`

找到版本歷程表（8.2 節），在表格**最前面**插入一行：

```
| X.Y.Z | YYYY-MM-DD | 簡短說明 |
```

SRS.md 是給開發者看的內部規格，**可以**保留技術術語（API 路徑、資料表名稱等），與 changelog.json 規範不同。

## 步驟 4：更新 `README.md`（若存在）

若 README.md 中有版本徽章或變更日誌區塊，同步更新版本號。

---

完成後回報：「已更新版號至 X.Y.Z，changelog.json（已通過格式與用語檢查）、SRS.md 已同步。」
