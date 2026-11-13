# 第三方憑證輪換 Runbook

本文件涵蓋第三方憑證與資料庫連線秘密的人工輪換。AssetPilot 不會建立、撤銷或排程輪換供應商憑證；實際欄位、重疊有效期與撤銷方式須先依各供應商帳戶的最新設定確認。任何憑證值都不得放入 issue、稽核 metadata、命令列參數、截圖或一般日誌。

## 共通流程

1. 建立變更紀錄：服務、使用目的、憑證識別（不可記錄憑證值）、負責人、影響範圍、切換窗口、回滾方式及預計撤銷舊憑證時間。
2. 確認有可用的管理員／break-glass 存取方式；對資料加密相關服務，先完成資料庫及 `KEYRING_ROOT_KEK` 備份，並抽樣測試還原。
3. 在供應商端建立新憑證，暫時保留舊憑證。若供應商不支援憑證重疊，安排短維護窗口並先確認回復舊憑證的可行性。
4. 將新值直接存入部署平台 Secret Manager；不要經由程式碼、shell history、建置參數或明文文件傳遞。更新所有環境及副本。
5. 依應用載入方式重新部署／重啟，再確認所有副本健康。執行對應的端到端驗證，並觀察錯誤率、稽核紀錄及供應商使用狀態。
6. 經核准的觀察期且確認沒有舊憑證流量後，才在供應商端撤銷舊憑證。若失敗，先恢復舊設定並重新部署；查明原因前不要同時撤銷兩組憑證。
7. 記錄結果、驗證證據位置、舊憑證撤銷時間及任何剩餘風險；紀錄不得包含秘密本身。

## OAuth 與登入供應商

適用 Google、LINE Login、Apple Sign in 等登入整合。

1. 在供應商後台建立替代 client secret／signing key，核對 client ID、team/key ID、允許的 origin 與 callback URI。
2. 更新部署 Secret Manager 中對應設定（例如 `GOOGLE_CLIENT_SECRET`、`LINE_CHANNEL_SECRET`；Apple 的 key material 依目前部署設定管理），確認 redirect URI 與 `APP_URL` 一致。
3. 部署所有副本後，分別測試新登入、既有帳號登入與帳號連結回呼；確認 callback state／nonce 驗證正常且沒有 redirect mismatch。
4. 觀察登入錯誤及供應商事件記錄。只有供應商允許並行且測試成功時才保留雙憑證窗口；否則執行已排程的單次切換。確認穩定後撤銷舊憑證。

## LINE Messaging webhook

適用 `LINE_MESSAGING_CHANNEL_SECRET` 與 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`。

1. 先確認 LINE Developers Console 是否允許兩組憑證並行。Webhook 簽章驗證若不支援雙 secret，不可先撤銷舊 secret；安排切換窗口並準備立即回復舊值。
2. 更新部署秘密並重新部署，確認 webhook 驗章、事件處理及回覆訊息均成功；不得在日誌輸出 channel secret、access token 或完整簽章。
3. 確認 webhook 重送／失敗率正常、測試訊息可往返後，再撤銷舊 token／secret。任一驗證失敗即回復舊設定並重新部署。

## 郵件通道

適用 `SMTP_*`、`ZEABUR_API_KEY`、`RESEND_API_KEY` 及 `EMAIL_PROVIDER_PRIMARY`／`EMAIL_PROVIDER_FALLBACK`。

1. 在郵件供應商建立新的 API key 或 SMTP credential，確認寄件地址／網域已驗證且寄送額度足夠。
2. 先更新秘密；若切換主要寄信通道，同時確認 fallback 已配置且不會使用即將撤銷的舊 credential。
3. 重新部署後，使用管理後台測試寄信，確認收件、寄件者、退信處理及供應商事件狀態；測試信不可包含真實個資。
4. 觀察寄送成功率後撤銷舊 credential，並更新回復程序中的憑證版本記錄。

## S3 相容儲存與備份

分別適用 `MEGA_S4_ACCESS_KEY_ID`／`MEGA_S4_SECRET_ACCESS_KEY` 和 `TRANSACTION_PHOTO_S3_ACCESS_KEY_ID`／`TRANSACTION_PHOTO_S3_SECRET_ACCESS_KEY`。勿假設兩組設定屬於同一 bucket 或 IAM principal。

1. 建立最小權限的新 access key，確認 bucket、region、endpoint、prefix 及讀寫／列舉權限符合原用途。
2. 將新憑證部署至所有副本。以非敏感測試物件驗證上傳、下載、刪除；對備份 bucket 另外驗證新備份可產生且可抽樣還原。
3. 觀察儲存錯誤及備份工作至少一個完整週期，確認照片與備份各自成功後才停用舊 access key。
4. 不要只以「新物件可上傳」作為撤銷依據；確認歷史物件仍可讀、舊備份保留與災難復原流程不依賴舊身分。

## PostgreSQL 連線憑證

適用 `DATABASE_URL`／`POSTGRES_URL`。不可直接改同一資料庫角色密碼後假設既有連線池會自動更新。

1. 建立替代登入角色（例如 `app_b` 對應目前 `app_a`），設定必要 schema/table/sequence 權限及預設權限。核對 migration、排程工作及物件 owner 的需求；不得將應用角色升為 superuser。
2. 以新角色在 staging 測試連線、讀寫、migration、備份／還原及所有副本啟動。確認權限與 `search_path` 相容。
3. 更新 Secret Manager 中連線字串並重新部署所有副本；檢查應用健康狀態、背景工作及資料庫連線池，確認沒有舊角色的新連線。
4. 等待舊連線歸零並觀察一個完整工作週期後，再撤銷舊角色登入權限。保留舊角色至回復窗口結束；不要在確認 owner／權限轉移前刪除角色。

## 其他供應商 API

適用 `IPINFO_TOKEN`、`EXCHANGE_RATE_API_KEY`、`RECEIPT_OCR_API_KEY`、`EINVOICE_API_APP_ID`／`EINVOICE_API_KEY`、`PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON` 等設定。

1. 依供應商流程建立替代憑證，確認其 scope、限制、配額、環境（測試／正式）及到期時間。
2. 更新 Secret Manager 並重新部署；逐一測試相應功能，例如 IP 查詢、匯率更新、收據 OCR、發票同步或 App Integrity 驗證。
3. 觀察供應商回應碼、配額及應用錯誤；確認替代憑證已被所有副本使用，再撤銷舊憑證。若供應商不提供測試憑證，使用最小影響的合成請求並記錄風險。

## VAPID 緊急輪換

VAPID 不做固定週期輪換；私鑰外洩或供應商要求時才執行。輪換會使現有瀏覽器 push 訂閱失效，需預期使用者重新訂閱。

1. 建立新 VAPID key pair，透過 Secret Manager 更新 `VAPID_PUBLIC_KEY`／`VAPID_PRIVATE_KEY`，並依應用既有流程更新資料庫中的 public-key marker。
2. 重新部署全部副本，確認新 public key 一致，並以測試訂閱驗證 push 發送成功；不要將 private key 放入資料庫、日誌或變更紀錄。
3. 透過產品介面提示客戶端重新訂閱，監控訂閱成功率與 push 錯誤。確認新 pair 穩定後，封存並依事件應變政策銷毀已外洩舊 private key。

## 相關用途 keyring 的界線

第三方憑證不由 `/admin` 金鑰自動輪換排程管理。AssetPilot 的 `jwt`、`api-token`、`einvoice`、`photo` 用途金鑰須使用管理後台排程或 `npm run rotate:key`；Root KEK 不可直接替換（見下方 OpenBao 小節的範圍限制）。所有 previous key 在確認線上資料、資料庫備份、匯出及災難復原資料均不再引用前，必須保留並由管理員另行核准退役／銷毀。

## OpenBao Root KEK provider（選用）

本節僅適用於自行架設並維運 [OpenBao](https://openbao.org)（Vault API 相容）的部署。預設 `KEYRING_ROOT_KEK_PROVIDER=env` 不受影響；一般自架者可忽略本節。

**此整合的範圍**：OpenBao 只保護「root KEK 這個 32-byte 值本身」被一個 Transit 具名金鑰包裝後的**單一密文**；它從不包裝個別用途金鑰（`jwt`／`api-token`／`einvoice`／`photo`），也從不出現在任何請求的熱路徑上。啟動時 AssetPilot 以 Transit `decrypt` 還原出同一個明文 root KEK，寫入該程序的 `process.env.KEYRING_ROOT_KEK` 後，`lib/keyring.ts`／`lib/keyringCore.ts` 的本地 AES-256-GCM 包裝/解包邏輯完全不變。

**OpenBao 設定（一次性）**

1. 啟用 Transit secrets engine：`bao secrets enable transit`（若尚未啟用）。
2. 建立具名金鑰並設定自動輪換：
   ```
   bao write -f transit/keys/assetpilot-root-kek
   bao write transit/keys/assetpilot-root-kek/config auto_rotate_period=2160h
   ```
   `auto_rotate_period` 由 OpenBao 自行按排程產生新金鑰版本；舊版本密文仍可解密，不需要 AssetPilot 做任何事。
3. 建立一個只能對 `transit/datakey/plaintext/assetpilot-root-kek`、`transit/decrypt/assetpilot-root-kek`、`transit/rewrap/assetpilot-root-kek` 操作的 policy/token，不要給予整個 `transit/*` 或更高權限。

**AssetPilot 設定**

```
KEYRING_ROOT_KEK_PROVIDER=openbao
OPENBAO_ADDR=https://openbao.internal:8200
OPENBAO_TOKEN=<上述 policy 對應的 token>
OPENBAO_TRANSIT_KEY=assetpilot-root-kek
```
不需要設定 `KEYRING_ROOT_KEK`；首次啟動會透過 OpenBao 的 datakey API 建立一次，並把 OpenBao 包裝後的密文存入 `keyring_control.root_kek_wrapped`（資料庫中永遠不含明文）。之後每次啟動改呼叫 `decrypt` 還原相同明文，所有副本須指向同一個 OpenBao 與同一個 Transit 金鑰，否則會各自解出不同值而彼此的用途金鑰互不相容。

**日常操作**

- `npm run rootkek:openbao -- --status`：顯示目前供應者、是否已建立包裝後的 root KEK、最後更新時間，並測試 OpenBao 連線；不會建立或變更任何金鑰。
- `npm run rootkek:openbao -- --rewrap`：在 OpenBao 的 `auto_rotate_period` 產生新金鑰版本後，把資料庫中保存的那一筆密文更新到最新版本；只動那一筆密文，不觸碰任何用途金鑰，也不改變明文 root KEK。可依 OpenBao 的輪換週期手動或排入 cron 執行。

**範圍限制（刻意不做的事）**

- **不會**自動產生新的 root KEK 明文值並重新包裝所有 `keyring_keys`；真正更換 root KEK 的值仍是未支援的操作，與上方「Root KEK 不可直接替換」一致。
- **不會**把 `jwt`/`api-token`/`einvoice`/`photo` 用途金鑰的加解密改成呼叫 OpenBao；這些仍由既有、已上線的本地 keyring 處理，`npm run rotate:key` 的操作方式不變。
- OpenBao 無法連線或回應非預期時會 fail closed（啟動失敗並記錄不含秘密的錯誤訊息），不會退化成明文或自動略過 keyring。

**停用／切換回 env**：移除 `KEYRING_ROOT_KEK_PROVIDER`（或設為 `env`），改設定與目前 `keyring_control.root_kek_wrapped` 對應的明文 `KEYRING_ROOT_KEK`（可用上述 `--status` 確認已建立，再由管理員在 OpenBao 端 `transit/decrypt` 一次取出並妥善銷毀查詢紀錄）。切換前務必先確認新舊設定在同一批副本上不會同時生效，避免同用途金鑰被不同 root KEK 解讀。
