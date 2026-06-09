# AssetPilot 安卓客戶端（Flutter）

AssetPilot 資產管理系統的 Android App，以 Flutter 撰寫，透過現有 REST API 與後端溝通。

## 功能

底部導覽四大分頁：**首頁 / 記帳 / 股票 / 更多**。

| 模組 | 功能 | 端點 |
|------|------|------|
| 登入 | 帳密登入，httpOnly Cookie 持久化 | `auth/login`、`auth/me`、`auth/logout` |
| 儀表板 | 月份切換、收入/支出/淨額、銀行餘額、股票市值、支出分類圓餅圖、最近交易 | `dashboard` |
| 記帳 | 列表（全部/收入/支出）、新增/編輯/刪除、轉帳 | `transactions`、`transactions/transfer` |
| 帳戶 | 列表 + 新增/編輯/刪除，多幣別、類型、排除總資產 | `accounts` |
| 分類 | 父子兩層、顏色、收入/支出，CRUD | `categories` |
| 預算 | 月度/分類預算進度條（四段配色）、新增/刪除 | `budgets` |
| 固定收支 | 週期性收支列表、啟用切換、新增/刪除 | `recurring` |
| 股票 | 持股總覽（市值/損益/報酬率）、交易、股利、已實現損益 | `stocks`、`stock-transactions`、`stock-dividends`、`stock-realized` |
| 報表 | 自訂區間 + 收入/支出，分類圓餅圖與明細 | `reports` |
| 設定 | 顯示名稱、主題（淺/深/系統）、後端位址、登出 | `account/settings/*` |

> 尚未涵蓋：Google/LINE/Passkey 登入、CSV 匯出入、備份還原、管理員系統設定、交易照片附件。
> 這些屬後台管理或需 OAuth/WebView，行動端優先度較低，可後續補。

## 專案結構

```text
lib/
├── main.dart                 # 入口：初始化 + 載入主題
├── app.dart                  # MaterialApp + 主題 + AuthGate + 底部導覽 shell
├── api_client.dart           # 後端 API client（單例，Cookie 管理，所有端點）
├── models.dart               # 資料模型（User/Account/Txn/Category/Budget/Stock…）
├── format.dart               # 金額/顏色格式化
├── widgets.dart              # AsyncView / EmptyState / toast 共用元件
└── screens/                  # 各功能畫面（login / dashboard / transactions /
                              #   accounts / categories / budgets / recurring /
                              #   stocks / reports / settings / more）
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

App 預設後端位址為 `http://10.0.2.2:3000`（Android 模擬器對應宿主機的 `localhost:3000`）。

- **模擬器**：先在電腦啟動 AssetPilot（`npm run dev`），保留預設位址即可
- **實機**：在登入頁「後端設定」改成電腦的區網 IP（如 `http://192.168.x.x:3000`）或正式網域

> 註：`AndroidManifest.xml` 已開啟 `usesCleartextTraffic="true"` 以便開發時連 HTTP。
> 正式環境請改用 HTTPS 並移除此設定。

## 後續可擴充

- Google / LINE / Passkey 登入（需 OAuth / WebView）
- CSV 匯出入、整檔備份還原
- 交易照片附件（拍照上傳）
- 股利新增與除權息同步、定期定額
- 管理員系統設定
