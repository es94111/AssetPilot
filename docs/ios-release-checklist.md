# iOS 發佈檢查表（TestFlight → App Store）

配合 `docs/ios-app-development-plan.md` 第 6 節的 M8／M9 里程碑使用。
每個項目都要有**可查核的證據**（截圖、建置號、審核回覆編號），不能只打勾。

## 0. 進度總覽

| 階段 | 狀態 | 負責人 | 備註 |
| --- | --- | --- | --- |
| M7 完整驗收 | ☐ 未開始 | | 見第 1 節 |
| Apple Developer 會員 | ☐ 未開始 | 維護者 | 個人申請；需完成身份核驗 |
| 憑證與描述檔 | ☐ 未開始 | 維護者 | 見第 3 節 |
| TestFlight 內部測試 | ☐ 未開始 | | |
| TestFlight 外部測試 | ☐ 未開始 | | 依 Apple 規範需 Beta 審核 |
| App Store 送審 | ☐ 未開始 | | |
| 發佈 | ☐ 未開始 | 維護者 | 人工發佈，不自動上架 |

---

## 1. M7 完整驗收

### 1.1 自動化檢查

> **一次跑完 iOS 端的三層測試**：`cd mobile && tool/test_ios.sh [simulator-udid]`
>
> 腳本會依序執行原生 XCTest → 整合測試 → Dart 單元測試 → 還原
> `FLUTTER_TARGET`。順序有意義：整合測試會把
> `ios/Flutter/Generated.xcconfig` 的 `FLUTTER_TARGET` 改寫成暫存目錄裡的
> `listener.dart`（測試後該目錄會被刪除），因此原生 XCTest 必須排在
> 整合測試之前。

| 檢查 | 指令 | 通過標準 |
| --- | --- | --- |
| Dart 靜態分析 | `cd mobile && flutter analyze` | 無新增問題；目前有 4 項既有提示（2 warning、2 info），指令以退出碼 1 結束 |
| Dart 單元測試 | `cd mobile && flutter test` | 全數通過（目前 127 項） |
| **iOS 原生單元測試** | `cd mobile && xcodebuild test -project ios/Runner.xcodeproj -scheme Runner -destination 'id=<UDID>' -only-testing:RunnerTests` | 全數通過（目前 33 項） |
| **iOS 整合測試** | `cd mobile && flutter test integration_test -d <simulator-udid>` | 全數通過（目前 10 項） |
| 後端型別檢查 | `npm run typecheck` | 通過 |
| i18n 一致性 | `npm run check:i18n` | 通過 |
| 時區格式檢查 | `npm run check:iso` | 通過 |
| iOS 編譯 | `flutter build ios --simulator` | 成功且擴充已嵌入 |
| 擴充嵌入驗證 | 見 `ios-build.yml` 的 `Verify iOS build output` | `PlugIns/` 下有 `AssetPilotWidget.appex` |

> 本機若無 Xcode，請用 `.github/workflows/ios-build.yml` 的 `verify` 工作
> （不需要任何 secret，fork 也能跑）。該工作已包含上述的原生單元測試與
> 整合測試。

> **整合測試的環境需求**
>
> `flutter test integration_test` 需要一個可用的 iOS 模擬器。若環境是
> **無 GUI 的 macOS**（沒有 `Simulator.app`），整合測試仍可執行
> （`url_launcher` 開啟自己的 scheme 不需要 UI 宿主），但**無法**以
> `xcrun simctl openurl` 從外部注入連結——SpringBoard 會顯示
> 「要在『AssetPilot』中打開嗎？」的確認提示，沒有 UI 可點「打開」。
> 外部注入的驗收請見第 1.2 節。

### 1.2 實機驗收（**模擬器不能取代**）

以下每一項都要在**真實 iPhone** 上執行並留下截圖：

| # | 情境 | 通過標準 |
| --- | --- | --- |
| 1 | 首次冷啟動 | 啟動畫面 → 登入頁，無白屏 |
| 2 | Apple 登入（首次授權） | 成功進入主畫面 |
| 3 | Apple 登入（第二次授權，已在 iCloud 登入） | 正確處理，不重複建帳號 |
| 4 | Apple 登入（使用者在對話框按取消） | 顯示錯誤訊息，**不卡住** |
| 5 | Google／LINE／Passkey 登入 | 三種方式都能登入 |
| 6 | 登入過期 | 自動導回登入頁 |
| 7 | 登出 | 憑證清除；**Widget 不殘留前一位使用者的金額** |
| 8 | 帳號切換 | 切換後 Widget 與草稿都切到新帳號 |
| 9 | 離線記帳 | 顯示已存草稿的提示，不報錯 |
| 10 | 離線後重啟 App | 草稿仍在 |
| 11 | 恢復連線 | **只提示**，不自動入帳 |
| 12 | 手動送出草稿 | 成功入帳且草稿消失 |
| 13 | 送出時斷網 | 草稿保留，可重試 |
| 14 | 送出後查帳 | **只出現一筆**（冪等性） |
| 15 | Widget 快速記帳 | 點擊開啟記帳表單 |
| 16 | Widget 收支摘要 | 數字與 App 一致 |
| 17 | 裝置鎖定時的 Widget | 依隱私設定遮蔽金額或顯示無資料 |
| 18 | Siri「記一筆 200 元 餐費」 | 開啟 App 並帶入金額與分類，**未自動儲存** |
| 19 | Siri 在未登入狀態 | 開啟 App 後要求登入，不猜測 |
| 20 | 冷啟動時收到 Siri 深層連結 | 正確開啟記帳表單 |
| 21 | 相機拍照 + 上傳憑證 | 成功；相機授權提示正確 |
| 22 | 相簿有限存取 | 正確運作 |
| 23 | 拒絕相機／相簿權限 | 顯示可理解的提示，不崩潰 |
| 24 | 語言切換 | 10 種語系皆切換成功（含 iOS 逐 App 語言） |
| 25 | 深色模式 | 所有畫面可讀 |
| 26 | 放大字級到最大 | 版面不破版 |
| 27 | VoiceOver | 可完整操作記帳流程 |
| 28 | 共享帳本切換 | 資料正確；**只讀成員不能寫入** |
| 29 | 一般使用者看不到管理員入口 | 確認 |
| 30 | 帳號刪除 | 完整流程，含 Apple 授權撤銷提示 |
| 31 | iOS 登入頁副標 | 顯示「資產管理 · iOS 客戶端」，**不是**「安卓客戶端」 |
| 32 | Universal Links | 從 Safari 點 `https://asset.shao.one/…` 可開啟 App（**需先補上 `apple-app-site-association`**，見第 5.3 節） |
| 33 | 外部深層連結 | 從 Safari／其他 App 點 `assetpilot://transaction/new?amount=120` 可開啟記帳表單並帶入金額 |

> **第 31–33 項是後來補上的**，因為它們是本次程式碼修改（iOS 副標修正、
> 深層連結原生通道）所對應的驗收點。第 33 項特別重要：整合測試只能驗證
> 「App 開啟自己的 scheme」，無法驗證「外部 App 開啟本 App」——
> 後者在無 GUI 的環境會被 SpringBoard 的確認提示阻斷。

### 1.3 Android 回歸

| 檢查 | 通過標準 |
| --- | --- |
| `flutter build apk --debug` | 成功 |
| Android 實機跑一次記帳流程 | 與 iOS 前行為一致 |
| Android Widget（桌布小工具） | 仍可更新與清除 |
| 後端 API 未破壞 Web／Android | Web 端登入與記帳正常 |

---

## 2. 商店素材

| 項目 | 需求 | 狀態 |
| --- | --- | --- |
| App 名稱 | AssetPilot | ☐ |
| 副標題 | 30 字元內 | ☐ |
| 描述 | 不宣稱未實作的功能；不提「投資績效保證」 | ☐ |
| 關鍵字 | 100 字元內 | ☐ |
| 支援網址 | 公開可讀，與隱私政策同網域 | ☐ |
| 隱私政策 | 公開可讀，**必須在送審前上線** | ☐ |
| 分類 | 財務（Finance） | ☐ |
| 年齡分級 | 如實填寫 | ☐ |
| 版權 | `LICENSE` 授權年份 | ☐ |
| 審核聯絡資訊 | 姓名／電話／Email | ☐ |
| 審核帳號 | 可登入的測試帳號，**不含真實個資** | ☐ |
| 示範資料 | 示範帳號內有合理資料供審核 | ☐ |
| 截圖 | 6.7" 與 6.5"（必要時） | ☐ |
| App 預覽影片 | 選填 | ☐ |
| 圖示 | 1024×1024，無 alpha 通道 | ☐ |

---

## 3. 簽署與憑證

| 項目 | 說明 | 狀態 |
| --- | --- | --- |
| Apple Developer Program | 個人申請；商店賣家名稱為個人法定姓名 | ☐ |
| App ID | `com.assetpilot.assetpilot` | ☐ |
| Widget App ID | `com.assetpilot.assetpilot.AssetPilotWidget` | ☐ |
| App Group | `group.com.assetpilot.assetpilot`（主 App 與 Widget 擴充都必須有） | ☐ |
| Keychain Sharing | `keychain-access-groups`（主 App 與 Widget 擴充都必須有） | ☐ |
| Distribution 憑證 | `.p12` | ☐ |
| App Store 描述檔 | 主 App | ☐ |
| App Store 描述檔 | Widget 擴充 | ☐ |

> **註：App Intents 不需要獨立的 App ID 或擴充 target。**
> 「開啟 App 讓使用者確認」的 Intent 放在主 App target 內
> （`ios/Runner/RecordTransactionIntent.swift`），因為
> `UIApplication.shared` 對 App Extension 是
> `NS_EXTENSION_UNAVAILABLE`，而 `openAppWhenRun = true` 在擴充中執行
> 會產生錯誤。主 App 連結 `AppIntents.framework` 後，Xcode 會自動產生
> `ExtractAppIntentsMetadata` 階段，輸出 `Metadata.appintents/`
> 供 Siri 與「捷徑」索引。
| App Store Connect API 金鑰 | `.p8`（`AuthKey_<KEY_ID>.p8`） | ☐ |

### 後端環境變數（**只在伺服器端設定**）

| 變數 | 說明 | 狀態 |
| --- | --- | --- |
| `APPLE_CLIENT_ID` | Service ID（`com.assetpilot.assetpilot`） | ☐ |
| `APPLE_TEAM_ID` | 10 字元團隊 ID | ☐ |
| `APPLE_KEY_ID` | 金鑰 ID | ☐ |
| `APPLE_PRIVATE_KEY` | `.p8` 內容（單行 PEM，含 `\n` 轉義） | ☐ |

> 這些值**絕不可**放進 App bundle、版控或 CI log。
> 確認方式：`grep -r "APPLE_PRIVATE_KEY" mobile/ios/` 應無結果。

### CI 環境變數（GitHub Repository secrets）

| Secret | 用途 |
| --- | --- |
| `APPLE_CERTIFICATE_BASE64` | Distribution 憑證（base64） |
| `APPLE_CERTIFICATE_PASSWORD` | 憑證密碼 |
| `APPLE_PROVISIONING_PROFILE_BASE64` | 描述檔（base64） |
| `APPLE_KEY_ID` | App Store Connect API 金鑰 ID |
| `APPLE_ISSUER_ID` | App Store Connect API 發行人 ID |
| `APPLE_PRIVATE_KEY_BASE64` | `.p8` 私鑰（base64） |
| `APPLE_TEAM_ID` | 團隊 ID |

---

## 4. 隱私與合規

### 4.1 App Privacy 標籤

盤點實際資料流後填寫，**不可**因自托管就宣稱「沒有第三方處理」。

| 資料類型 | 收集？ | 連結使用者？ | 追蹤？ | 用途 | 第三方 |
| --- | --- | --- | --- | --- | --- |
| 聯絡資訊（email） | ☐ | ☐ | ☐ | App 功能 | ☐ |
| 財務資訊 | ☐ | ☐ | ☐ | App 功能 | ☐ |
| 照片／影片 | ☐ | ☐ | ☐ | App 功能 | ☐ |
| 使用資料 | ☐ | ☐ | ☐ | 分析 | ☐ |
| 診斷資訊 | ☐ | ☐ | ☐ | Sentry | ☐ |

> 既有 Sentry 整合會傳送錯誤報告，須如實揭露。
> 確認 `mobile/lib/sentry_config.dart` 的 DSN 與過濾設定符合揭露內容。

### 4.2 隱私清單（Privacy Manifest）

| 項目 | 狀態 |
| --- | --- |
| 第三方套件的 `PrivacyInfo.xcprivacy` 已納入 | ☐ |
| Required Reason API 已宣告 | ☐ |
| 資料收集型別已宣告 | ☐ |
| 追蹤網域已宣告 | ☐ |

### 4.3 加密出口合規

| 項目 | 狀態 |
| --- | --- |
| 確認是否使用僅供內部加密的標準演算法 | ☐ |
| 若是，在 `ITSEncryptionExportComplianceCode` 宣告 | ☐ |

### 4.4 權限用途說明

| 權限 | Info.plist 鍵 | 狀態 |
| --- | --- | --- |
| 相機 | `NSCameraUsageDescription` | ☐ |
| 相簿讀取 | `NSPhotoLibraryUsageDescription` | ☐ |
| 相簿寫入 | `NSPhotoLibraryAddUsageDescription` | ☐ |

> 檢查 `mobile/ios/Runner/Info.plist`。若某項權限實際未使用，**應移除**，
> 不要為不存在的用途保留權限。

### 4.5 帳號刪除與登入

| 項目 | 依據 | 狀態 |
| --- | --- | --- |
| App 內有帳號刪除流程 | 4.8 / 5.1.1(v) | ☐ |
| 刪除時處理 Apple 授權撤銷 | 4.8 | ☐ |
| 提供 Apple 登入以外的其他登入選項 | 4.8 | ☐ |
| 隱私政策與支援頁面公開可讀 | 1.1.2 | ☐ |

---

## 5. 上架前置檢核（**可能阻擋上架**）

這兩項屬於「必須先解決，否則不能送審」。

### 5.1 個人開發者身份 vs. 金融類 App

- [ ] 已依**實際功能與資料處理**評估本產品屬於「個人記帳／投資紀錄工具」
      還是「涉及受規範的金融服務」。
- [ ] 已查閱當期 App Review Guidelines 3.2.1(viii) 與 5.1.1(ix)。
- [ ] 若判定需要特定提交主體或許可，已向 Apple 詢問並留下回覆紀錄。
- [ ] 已取得適當法律意見（必要時）。
- [ ] **未**以「加免責聲明」或「改商店描述」迴避實質問題。

> 維護者決策與日期：＿＿＿＿＿＿＿＿

### 5.2 AGPL-3.0 與 App Store 條款

- [ ] 已確認 App Store 發佈條款與 AGPL-3.0 對「向使用者授予權利、
      提供對應原始碼」等義務的相容性。
- [ ] 已盤點自有程式、歷史貢獻、第三方套件、字型、圖示與品牌素材的權利。
- [ ] 若評估需要其他授權安排，已取得**有權授權者**的同意。
- [ ] **未**僅修改 `LICENSE` 檔案或忽略第三方義務。

> 維護者決策與日期：＿＿＿＿＿＿＿＿

### 5.3 Universal Links 的 `apple-app-site-association`

`mobile/ios/Runner/Runner.entitlements` 宣告了 `applinks:asset.shao.one`，
對應的驗證檔 `public/.well-known/apple-app-site-association` **已建立**，
`next.config.ts` 也已設定 `Content-Type: application/json` 與不快取。

**但 Team ID 仍是 `TEAM_ID` 佔位符**——它屬於 Apple Developer 帳號資訊，
加入會員後才能確定，因此沒有寫死在版本控制中。在替換之前，
`https://asset.shao.one/…` 的 Universal Links **不會**開啟 App；
自訂 scheme（`assetpilot://`）不受影響，Widget／Siri／記帳入口都正常。

- [ ] **已將 `appID` 的 `TEAM_ID` 換成實際的 10 碼 Team ID**
      （`npm run test:universal-links` 會明確指出仍是佔位符）。
- [ ] 已確認部署環境以 `Content-Type: application/json` 提供該檔案，
      且**未**經轉址（301／302 會讓 Apple 的驗證失敗）。
- [ ] 檔案以 HTTPS 提供且不需要登入。
- [ ] 已在實機用 Safari 開啟 `https://asset.shao.one/…` 驗證可開啟 App
      （見第 1.2 節第 32 項）。
- [ ] 若決定不支援 Universal Links，已移除 `Runner.entitlements` 的
      `associated-domains` 宣告，避免 App Store 連線時出現無效設定。

> 維護者決策與日期：＿＿＿＿＿＿＿＿

---

## 6. TestFlight（M8）

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 上傳第一個建置 | ☐ | |
| 設定內部測試人員 | ☐ | |
| 撰寫測試說明 | ☐ | 需涵蓋第 1.2 節的情境 |
| 內部測試完成並回報問題 | ☐ | |
| 修正後重新上傳 | ☐ | |
| 設定外部測試人員 | ☐ | 補足不同機型與操作習慣 |
| 完成 Beta App Review | ☐ | 依 Apple 規範，外部測試需先通過審核 |
| 外部測試完成 | ☐ | |

### 建置紀錄

| 版本 | 建置號 | 提交 | 測試結果 | 備註 |
| --- | --- | --- | --- | --- |
| | | | | |

---

## 7. App Store 送審（M9）

| 項目 | 狀態 |
| --- | --- |
| 版本號與建置號正確 | ☐ |
| 描述與截圖與實際功能一致 | ☐ |
| 隱私政策 URL 可公開讀取 | ☐ |
| 支援 URL 可公開讀取 | ☐ |
| App Privacy 標籤已填寫 | ☐ |
| 審核帳號可登入 | ☐ |
| 審核示範資料已備妥 | ☐ |
| 審核備註已說明 Apple 登入與帳號綁定流程 | ☐ |
| 已送出審核 | ☐ |
| 已處理補件（Rejection） | ☐ |
| 已核准 | ☐ |
| 人工發佈（不自動上架） | ☐ |
| 上線後實機冒煙測試 | ☐ |

### 審核備註建議內容

> 本 App 為個人財務記帳工具。登入方式包含 Sign in with Apple、Google、LINE
> 與 Passkey。若使用 Sign in with Apple 登入，使用者可於「設定 → 帳號安全」
> 中將 Apple 帳號與既有 AssetPilot 帳號連結或解除連結。測試帳號：〔帳號〕，
> 密碼：〔密碼〕。App 內提供帳號刪除功能（設定 → 帳號 → 刪除帳號）。

---

## 8. 已知限制（送審前確認措辭）

以下項目在首版**不提供**，商店文案與送審備註不得暗示已有：

- [ ] 不支援離線修改／刪除既有交易（只有新增草稿）
- [ ] Siri 不會在背景直接入帳，一定需要 App 內確認
- [ ] 沒有獨立的 Face ID／Touch ID App 鎖
- [ ] 沒有 iPad 專用介面、沒有 Apple Watch App、沒有 Live Activities
- [ ] 沒有 iCloud 同步
- [ ] 沒有付費訂閱、買斷或內購
- [ ] 桌面 Widget 只有「快速記帳」與「本月收支摘要」兩種
