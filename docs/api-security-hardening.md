# 公開 API（/api/v1）安全加固指南

本文說明 AssetPilot 公開 API（`/api/v1/*`，API Token 認證）已內建的防護機制，
以及部署時建議在 Cloudflare／反向代理層補上的加固規則。
應用層防護的實作見 `lib/apiTokenRequestAuth.ts`、`lib/apiRateLimit.ts`、`lib/apiTokenCore.ts`。

## 1. 認證與授權（驗證機制）

| 機制 | 說明 |
| --- | --- |
| Bearer API Token | `Authorization: Bearer ap_api_…`（RFC 6750）；無效／過期／已撤銷／帳號停用一律回 401 同訊息，不揭露個別原因（防狀態枚舉） |
| 最小權限 scope | 逐 Token 權限範圍：`transactions:read`／`transactions:write`／`accounts:read`／`accounts:write`／`categories:read`／`webhooks:manage`；不足回 403 `InsufficientScope` |
| 帳本成員驗證 | 每次請求重新驗證帳本成員資格；非成員／不存在一律回 404 同形狀（不揭露帳本存在性）；viewer 寫入回 403 |
| 建立上限 | 每帳號最多 20 組啟用中 Token，可指定到期時間；撤銷立即生效 |

## 2. 加密機制

| 機制 | 說明 |
| --- | --- |
| Token 僅存雜湊 | Token 明文只在建立時回傳一次；資料庫只存 SHA-256 雜湊（`crypto.randomBytes(32)` 高熵亂數） |
| 密鑰加密儲存 | Webhook 簽章密鑰以 AES-256-GCM 加密後儲存（需 `API_TOKEN_ENCRYPTION_KEY`） |
| 金鑰輪替 | Keyring 支援 JWT／API Token／照片金鑰輪替，見 `docs/key-rotation-runbooks.md` |
| 傳輸安全 | 僅 HTTPS；所有 API 回應帶 `Cache-Control: no-store`，禁止共享快取留存個人資料 |

## 3. 防止攻擊機制

### 3.1 應用層速率限制（已內建）

雙層滑動窗口限制（`lib/apiRateLimit.ts`），超過回 `429` + `Retry-After` + `RateLimit-*` 標頭：

| 層級 | 額度（預設） | 用途 |
| --- | --- | --- |
| per-IP | 1200 次／5 分鐘 | 於認證**前**計數——無效 Token 的暴力猜測同樣消耗額度 |
| per-Token（讀取） | 600 次／5 分鐘 | `*:read` scope |
| per-Token（寫入） | 120 次／5 分鐘 | `*:write` 與 `webhooks:manage` scope |

- 拒絕的請求不記入窗口（窗口滑出後自然恢復）；key 數量設上限並逐出，防記憶體耗盡。
- 多實例部署時每實例各自計數，需以下方 Cloudflare Rate Limiting 補外層。

### 3.2 請求體驗證（已內建）

- JSON body 上限 64KB（超過 413 `PayloadTooLarge`）。
- body 必須為 JSON 物件（拒絕陣列／純值）；欄位白名單、型別／範圍／正規化驗證
  （日期嚴格 `YYYY-MM-DD`、金額為有限正數、名稱長度、類別白名單、ISO 4217 幣別等）。
- SQL 全部使用參數化查詢；分類／帳戶 id 強制歸屬檢查，防跨使用者寫入。

### 3.3 Webhook SSRF 防護（已內建）

- 訂閱網址必須為公開 HTTPS；封鎖 localhost／私有網段／回環位址（見 `lib/apiTokenCore.ts`）。
- 簽章為 `HMAC-SHA256(時間戳.請求體)`；驗證端應比對時間戳（容忍 5 分鐘）防重放。

### 3.4 Cloudflare 加固建議（部署層）

1. **API Shield Schema Validation**
   - 上傳 `asset_openapi.yaml`，為 `/api/v1/*` 端點啟用 Schema Validation（Request + Response）。
   - 模式建議先設 `log` 觀察一週，再切 `block`，避免誤擋既有整合。
2. **WAF Rate Limiting 規則**（建議在應用層之前）
   - `(/api/v1/*)`：每 IP 1500 次／5 分鐘 → 挑戰；再激增（>500 次／1 分鐘）→ 封鎖 10 分鐘。
   - `(/api/v1/* AND http.request.method eq "POST")`：每 IP 200 次／5 分鐘 → 挑戰。
   - `401` 回應比率過高（暴力猜測）：每 IP 50 次／10 分鐘 → 封鎖 1 小時。
3. **Bot Management**：對 `/api/v1/*` 啟用 Bot 分析，對自動機器人以外的流量記錄觀察。
4. **Transform Rules**：確認到源站的 `X-Forwarded-For` 由代理覆寫（見 `nginx.conf`），
   並依部署拓撲設定 `TRUST_PROXY`（見 `lib/requestIp.ts` 檔頭說明），否則 per-IP 限流可被偽造標頭繞過。
5. **TLS**：最低 TLS 1.2；啟用 HSTS 與 Automatic HTTPS Rewrites。
6. **觀測**：對 `429`／`401`／`413` 設告警儀表板；定期稽核 Token 使用紀錄（`last_used_at`）。

## 4. 端點與 scope 對照

| 端點 | 方法 | Scope |
| --- | --- | --- |
| `/api/v1/transactions` | GET | `transactions:read` |
| `/api/v1/transactions` | POST | `transactions:write` |
| `/api/v1/accounts` | GET | `accounts:read` |
| `/api/v1/accounts` | POST | `accounts:write` |
| `/api/v1/categories` | GET | `categories:read` |

完整請求／回應契約見 `asset_openapi.yaml`（`PublicApi` 標籤）。
