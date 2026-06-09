# AssetPilot 安卓客戶端（Flutter）

AssetPilot 資產管理系統的 Android App，以 Flutter 撰寫，透過現有 REST API 與後端溝通。

## 目前功能

- **登入**：`POST /api/auth/login`（電子郵件 + 密碼），自動保存 httpOnly `authToken` Cookie 並持久化，重啟 App 免再登入
- **儀表板**：顯示使用者、各帳戶餘額，以及換算為 TWD 的總資產（`GET /api/auth/me`、`GET /api/accounts`）
- **登出**：`POST /api/auth/logout`，清除本地 Cookie
- **後端位址可設定**：登入頁「後端設定」可改 base URL（持久化）

## 專案結構

```text
lib/
├── main.dart                    # App 入口 + AuthGate（依登入狀態切換頁面）
├── api_client.dart              # 後端 API client（單例，含 Cookie 管理）
├── models.dart                  # AppUser / Account 資料模型
└── screens/
    ├── login_screen.dart        # 登入頁
    └── dashboard_screen.dart    # 儀表板（總資產 + 帳戶清單）
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

- 交易列表與新增（`/api/transactions`）
- 股票持股與損益（`/api/stocks`）
- 統計報表圖表（`/api/reports`）
- Google / LINE / Passkey 登入
