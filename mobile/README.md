# AssetPilot 安卓客戶端（Flutter）

AssetPilot 資產管理系統的 Android App，以 Flutter 撰寫，透過現有 REST API 與後端溝通。

## 功能

底部導覽四大分頁：**首頁 / 記帳 / 股票 / 更多**。

| 模組 | 功能 | 端點 |
|------|------|------|
| 登入 | 帳密、Google、LINE、Passkey 登入，httpOnly Cookie 持久化 | `auth/login`、`auth/me`、`auth/logout`、`auth/google`、`auth/line`、`auth/passkey` |
| 儀表板 | 月份切換、收入/支出/淨額、銀行餘額、股票市值、支出分類圓餅圖、最近交易 | `dashboard` |
| 記帳 | 列表（全部/收入/支出）、新增/編輯/刪除、轉帳、照片附件（拍照/選圖/刪除） | `transactions`、`transactions/transfer`、`transactions/[txId]/attachments` |
| 帳戶 | 列表 + 新增/編輯/刪除，多幣別、類型、排除總資產 | `accounts` |
| 分類 | 父子兩層、顏色、收入/支出，CRUD | `categories` |
| 預算 | 月度/分類預算進度條（四段配色）、新增/刪除 | `budgets` |
| 固定收支 | 週期性收支列表、啟用切換、新增/刪除 | `recurring` |
| 股票 | 持股總覽（市值/損益/報酬率）、交易、股利、已實現損益 | `stocks`、`stock-transactions`、`stock-dividends`、`stock-realized` |
| 股票設定 | 手續費/證交稅率、股票狀態管理（下市/恢復追蹤）、定期定額（新增/編輯/啟用/刪除） | `stock-settings`、`stock-recurring`、`stocks/batch-price` |
| 報表 | 自訂區間 + 收入/支出，分類圓餅圖與明細 | `reports` |
| 設定 | 顯示名稱、主題（淺/深/系統）、語言、幣別、定期報表通知、帳號安全、登出 | `account/settings/*` |
| 管理員 | 系統設定（開放註冊/LINE 登入/允許 Email/IP 白名單/稽核模式/照片儲存/股價自動更新）、使用者管理、登入稽核、股價立即更新、照片壓縮/加密、NTP 同步 | `admin/*` |

> 尚未涵蓋：CSV 匯出入、整檔備份還原。這些屬資料移轉用途，行動端優先度較低，可後續補。

## 專案結構

```text
lib/
├── main.dart                 # 入口：初始化 + 載入主題
├── app.dart                  # MaterialApp + 主題 + AuthGate + 底部導覽 shell
├── api_client.dart           # 後端 API client（單例，Cookie 管理，所有端點）
├── models.dart               # 資料模型（User/Account/Txn/Category/Budget/Stock…）
├── format.dart               # 金額/顏色格式化
├── widgets.dart              # AsyncView / EmptyState / toast 共用元件
├── google_auth.dart          # Google SSO（系統瀏覽器 + App Link 回呼）
├── line_auth.dart            # LINE 登入（系統瀏覽器 + App Link 回呼）
├── passkey_auth.dart         # Passkey 登入（網頁 WebAuthn + auth-ticket 回呼）
└── screens/                  # 各功能畫面（login / dashboard / transactions /
                              #   accounts / categories / budgets / recurring /
                              #   stocks / reports / settings / admin / more）
```

## 開發

```bash
cd mobile
flutter pub get
flutter run            # 連上模擬器或實機後執行
flutter analyze        # 靜態檢查
flutter test           # widget 測試
flutter build apk      # 打包 release APK
```

## 連線到後端

App 固定連線正式後台 `https://asset.shao.one`（`lib/api_client.dart` 的 `defaultBaseUrl`）。
App 端不提供使用者自行修改後端位址，避免 OAuth／CSRF 設定不一致。

## 後續可擴充

- CSV 匯出入、整檔備份還原
- 管理員報表排程／Email 提供者／資料稽核等進階後台功能（現僅涵蓋系統設定、使用者、登入稽核）
