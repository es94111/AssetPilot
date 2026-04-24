# Phase 0 研究：使用者與權限

**功能**：使用者與權限（001-user-permissions）
**階段**：Phase 0（研究／決策落地）
**日期**：2026-04-24

## 研究目的

本功能規格涵蓋的 42 項 FR 大部分對應 `server.js` 既有實作。本份研究文件
不做「選型」型的調查，重點在於：

1. 逐項確認每項 FR 在 `server.js` 的**現狀**（已實作／部分實作／缺漏）。
2. 將 10 項 Clarification 的決策展開為**具體落地步驟**與受影響檔案區段。
3. 記錄本階段辨識出的**潛在風險與降級備案**，供 Phase 1 設計參考。

## §1. 既有實作對照表

| FR       | 現狀           | 位置（`server.js` 行號）                        | 備註                                        |
| -------- | ------------ | -------------------------------------------- | ------------------------------------------- |
| FR-001   | **部分實作**   | `1874` 註冊 / `1914` 登入                      | 現況未統一 `trim + lowercase`；**Clarify 需新增**    |
| FR-002   | 已實作         | 密碼雜湊邏輯（bcryptjs）                          | 強密碼規則同時由前端與後端驗證                     |
| FR-003   | 已實作         | `createDefaultsForUser`（~862）               | 分類／帳戶對照 spec FR-003 全文                  |
| FR-004   | **部分實作**   | Cookie 設定段                                 | `Max-Age` 需與 `JWT_EXPIRES` 對齊；需移除「記住我」 UI（若存在） |
| FR-005   | **部分實作**   | `1833` 驗證 / `1909, 1951, 2364` 簽發         | 登出已遞增；**密碼變更未遞增 → Clarify 需新增**           |
| FR-006   | 已實作         | 登入 API 回應 `currentLogin`                   | —                                           |
| FR-007   | **部分實作**   | `express-rate-limit` 初始化段                  | 目前單一桶；**Clarify 需拆成兩桶**                   |
| FR-010   | 已實作         | Google 按鈕渲染段                               | 依 `GOOGLE_CLIENT_ID` 條件顯示                  |
| FR-011   | **部分實作**   | `2267` Google 交換                            | 未驗 `redirect_uri` 白名單；**Clarify 需新增**       |
| FR-012   | 已實作         | `2329` 查找／建立 Google 使用者                 | 隨機雜湊填入 `password_hash`                    |
| FR-013   | 已實作         | 帳號設定補設本機密碼                             | —                                           |
| FR-020   | 已實作         | `785` 資料表 / Passkey 註冊路由                 | 可命名、可獨立刪除                              |
| FR-021   | 已實作         | `2402` challenge / `2408` login              | usernameless discoverable credential        |
| FR-022   | 已實作         | origin 比對段                                  | —                                           |
| FR-023   | 已實作         | WebAuthn JS 由 server 本地提供                 | 非 CDN                                      |
| FR-030   | 已實作         | `682-686` 管理員追認                            | —                                           |
| FR-031   | 已實作         | 系統設定 API                                   | —                                           |
| FR-032   | **部分實作**   | 白名單比對邏輯                                  | 目前為完全比對；**Clarify 需新增 `*@domain` 規則** |
| FR-033   | 已實作         | 註冊 API 前置檢查                               | —                                           |
| FR-034   | 已實作         | 管理員使用者 CRUD                               | —                                           |
| FR-035   | **部分實作**   | 刪除流程                                        | 目前為全硬刪；**Clarify 需改為混合策略**             |
| FR-036   | 已實作         | 管理員互刪／自刪檢查                             | —                                           |
| FR-037   | 已實作         | 管理員重設密碼段                                 | 新舊密碼不得相同                               |
| FR-040   | 已實作         | 登入路由皆寫入 `login_attempt_logs`            | `login_audit_logs` 僅紀錄成功                 |
| FR-041   | 已實作         | IP 國家判讀段                                   | `CF-IPCountry` 優先                          |
| FR-042   | 已實作         | 使用者登入紀錄 API                              | 取最新 100 筆                                |
| FR-043   | 已實作         | 管理員登入紀錄 API                              | 管理員 200／全站 500                          |
| FR-044   | 已實作         | 管理員紀錄單刪／批次刪／同步                     | —                                           |
| FR-045   | 已實作         | 缺主鍵時以時間戳備援刪除                         | —                                           |
| FR-046   | **未實作**     | 無                                              | **Clarify 新增：每日清除 90 天前資料**            |
| FR-050   | 已實作         | 伺服器時間區塊                                   | —                                           |
| FR-051   | 已實作         | 目標時間／毫秒偏移輸入                            | —                                           |
| FR-052   | 已實作         | `system_settings.server_time_offset`            | ±10 年 bounds check                        |
| FR-053   | 已實作         | SNTP v3 fallback 鏈                             | 3 秒逾時                                    |
| FR-054   | 已實作         | 「僅預覽」模式                                    | —                                           |
| FR-055   | 已實作         | NTP 主機白名單檢查                               | 拒絕 IPv6／私有網段                           |
| FR-060   | 已實作         | 全站 HTML escape 函式                            | —                                           |
| FR-061   | 已實作         | 分類顏色正規表示式檢查                            | —                                           |
| FR-062   | 已實作         | `helmet` 啟用                                    | —                                           |
| FR-063   | 已實作         | `index.html` 中所有 CDN `integrity`             | —                                           |
| FR-064   | 已實作         | `.env` 權限 / `.gitignore` / `.dockerignore`    | —                                           |
| FR-065   | 已實作         | 登入錯誤訊息通用化                                | —                                           |

**小結**：42 FR 中，`已實作` = 33、`部分實作` = 8、`未實作` = 1。落地重點為
Clarification 衍生的 9 項調整。

## §2. Clarification 落地決策

| Q  | 決策                                        | 影響範圍                                           | 具體變更                                                                 |
| -- | ------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| Q1 | 90 天保留；顯示 100/200/500                 | 背景排程 + 查詢 SQL                                | 新增 `pruneAuditLogs()` 每 24 小時執行；`DELETE WHERE login_at < now - 90d` 兩表並清。 |
| Q2 | 密碼變更遞增 `token_version`                | 使用者自行改密碼 / 管理員重設                      | 在 `UPDATE users SET password_hash = ?` 相鄰 `token_version = token_version + 1`。 |
| Q3 | 白名單 `*` 觸發 domain wildcard             | 註冊與 Google 首次註冊                             | 新增 `matchAllowlist(email, list)` 工具：逐項 `if item.startsWith('*@')` 則域名比對，否則完全比對（已 lowercase）。 |
| Q4 | Passkey usernameless discoverable           | 登入頁 Passkey 按鈕                                | 既有實作已符合；本案僅於文件 / 契約固化語意。                                  |
| Q5 | 以 `server.js` 既有預設為準                  | 預設分類／帳戶建立                                  | `createDefaultsForUser()` 即為權威；FR-003 已錄入完整清單。                      |
| Q6 | JWT 7 天、persistent Cookie                 | 登入 Cookie 設定                                    | `res.cookie('authToken', token, { httpOnly, secure, sameSite: 'strict', maxAge: 7*24*3600*1000 })`；`JWT_EXPIRES='7d'` 於 `.env.example` 同步。 |
| Q7 | auth 桶 + 靜態頁桶各 20/15min/IP            | `express-rate-limit` 初始化                         | `const authLimiter = rateLimit({...})`；`const staticLimiter = rateLimit({...})`；分別套用。 |
| Q8 | Email trim + lowercase 正規化                | 註冊／登入／白名單／管理員新增                      | 新增 `normalizeEmail(raw)` 工具，於上述所有進入點呼叫；DB 儲存值一律正規化。              |
| Q9 | 混合刪除：成功硬刪、失敗匿名                 | `DELETE /api/admin/users/:id`                       | 兩步驟：`DELETE FROM login_audit_logs WHERE user_id = ?`；`UPDATE login_attempt_logs SET user_id = NULL, email = ? WHERE user_id = ?`（`?` 為 `sha256(lower(email))`）。 |
| Q10 | `redirect_uri` 白名單                       | `POST /api/auth/google`                             | 啟動時解析 `GOOGLE_OAUTH_REDIRECT_URIS`（逗號分隔）為 `Set<string>`；交換 code 前比對 `req.body.redirect_uri`；不符回 400 並寫入失敗稽核。 |

## §3. 風險與降級

- **R1 — Email 正規化遷移**：現存使用者若曾以大小寫混用註冊，`UNIQUE(email)`
  在未統一時可能存在重複列。**降級**：啟動時執行一次性 migration
  `UPDATE users SET email = LOWER(TRIM(email))`，若 `UNIQUE` 衝突則保留較早
  的 `created_at`、提示管理員人工處理。此 migration 寫入版本變更紀錄。
- **R2 — `redirect_uri` 白名單阻斷合法流量**：部署新環境時若忘記設定
  `GOOGLE_OAUTH_REDIRECT_URIS` 將全部 Google 登入失敗。**降級**：啟動時若環境
  變數未設定，自動以 `APP_HOST` + `PORT` 推導預設值並於 log 明確提醒。
- **R3 — 90 天清除時效**：單次清除大量筆數可能造成 sql.js 寫入阻塞。
  **降級**：每次最多刪 5,000 筆，剩餘留到下次排程；清除後呼叫 `saveDB()`。
- **R4 — SHA-256 雜湊失敗紀錄查重**：管理員批次刪除時若以 Email 搜尋將
  失效。**降級**：UI 明示「已匿名化」並改以 IP/時間區間為主要查詢軸。
- **R5 — `token_version` 於管理員重設密碼時遞增**：若使用者當下在另一裝置
  操作中將被迫登出。**降級**：此為預期行為（與 spec 一致），於管理介面
  加註「重設密碼將強制該使用者所有裝置下線」提示。

## §4. 開放議題（非阻塞）

- Clarification 未觸及 Passkey 的 Relying Party ID（RP ID）切換策略；
  目前代碼採動態 `req.hostname`，多 origin 部署（如 `app.example.com` 與
  `localhost`）的 Passkey 無法跨用。本計畫**不處理**，留待後續功能規格。
- `login_attempt_logs.user_id` 的型別為 `TEXT DEFAULT ''`（非 NULLable）；
  匿名化改寫時以空字串 `''` 取代 NULL，SQL 語意等價但與 spec「`user_id`
  置 NULL」措辭不同。**決定**：資料庫欄位維持 `DEFAULT ''`，程式層以
  空字串代表匿名；契約 / 文件以「匿名化」描述，不揭露欄位內部表徵。
- OpenAPI 契約中 `redirect_uri` 不在白名單時回傳的 error code 尚未決定；
  本計畫採 `400 Bad Request` + `{ error: 'invalid_redirect_uri' }`，於 Phase 1
  的 contract 中寫定。

## §5. 相依套件版本確認

下表以 `package-lock.json` 實際安裝版本為準，並對照 2026-04-24 於 npm registry
查得之 latest。本功能**不新增套件**，亦不強制升級。

| 套件                             | 實際安裝 | npm latest | 狀態 | 用途 / 備註                                  |
| -------------------------------- | ------- | ---------- | ---- | ------------------------------------------- |
| `express`                        | 5.2.1   | 5.2.1      | ✅   | HTTP 框架；v5 原生支援 async handler。        |
| `@passwordless-id/webauthn`      | 2.3.5   | 2.3.5      | ✅   | 支援 discoverable credential（usernameless）。 |
| `jsonwebtoken`                   | 9.0.3   | 9.0.3      | ✅   | HS256 + `JWT_SECRET`；用於 FR-004 / FR-005。  |
| `bcryptjs`                       | 3.0.3   | 3.0.3      | ✅   | 純 JS，不需 native build。                    |
| `helmet`                         | 8.1.0   | 8.1.0      | ✅   | CSP / HSTS / X-Content-Type-Options。         |
| `sql.js`                         | 1.14.1  | 1.14.1     | ✅   | SQLite on WASM；手動 `saveDB()` 持久化。       |
| `cookie-parser`                  | 1.4.7   | 1.4.7      | ✅   | Cookie 解析。                                 |
| `cors`                           | 2.8.6   | 2.8.6      | ✅   | CORS 中介層。                                 |
| `nodemailer`                     | 8.0.5   | 8.0.5      | ✅   | SMTP 寄信（與 Resend 並存）。                  |
| `express-rate-limit`             | 8.4.0   | 8.4.0      | ✅   | v8 支援 `keyGenerator`；FR-007 兩桶 rate limit 用。 |
| `dotenv`                         | 17.4.2  | 17.4.2     | ✅   | 讀取 `.env`。                                 |
| `adm-zip`                        | 0.5.17  | 0.5.17     | ✅   | 匯入／匯出備份檔。                             |
| `resend`                         | 6.1.3   | **6.12.2** | 🟡   | 落後 11 個 minor（2025-10-14 → 2026-04-20）；本功能不涉及寄信路徑，不影響實作。 |

**合計**：13 個直接相依中，12 個已為 npm latest、1 個（`resend`）大幅落後但
本功能不涉及寄信路徑，不影響實作。

若要在同一 PR 順手對齊 `resend`，可執行：

```bash
npm install resend@latest
# 升級後需驗證 server.js 內所有 `require('resend')` 使用點（寄信、報表排程）
# 參考：https://github.com/resend/resend-node/releases
```

## §6. 下一步

- 進入 Phase 1：
  - [data-model.md](./data-model.md) ── 資料表 schema 與狀態流
  - [contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml) ── 3.2.0 子契約
  - [quickstart.md](./quickstart.md) ── 本機與容器驗證步驟
