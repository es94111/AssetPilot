# M0：Android 功能矩陣（iOS 移植基準）

這份文件是 `docs/ios-app-development-plan.md` 第 4.1 節要求的「逐頁功能矩陣」，
用來界定 iOS 首版的對齊基準，也用來對照實作成果。

## 使用方式

- **來源**：以 `mobile/lib/` 目前的 Flutter 程式碼為準（Android App 內功能）。
  每一列都標註對應的 Dart 檔案與畫面，方便逐項核對。
- **狀態定義**：
  - `共碼` — iOS 與 Android 走同一份 Dart 程式，平台無差異，無需額外處理。
  - `等效` — 平台機制不同，已改用 iOS 的等效做法（需列出差異與理由）。
  - `待補` — 尚未完成，需實作。
  - `不適用` — 該功能在 iOS 上不成立或已明確排除（需寫明依據）。
- **驗收**：需在**實機**（非模擬器）通過才算 `已驗收`。
  模擬器無法驗證相機、Siri、真實登入授權、Keychain 與 WidgetKit 的鎖定行為。

## 1. 啟動、登入與帳號生命週期

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 啟動畫面 | 顯示品牌與載入狀態 | `splash_screen.dart` | 共碼 | 共碼 | 冷啟動不卡死 |
| 登入頁 | Passkey 為主要入口，另有 Google／LINE | `login_screen.dart` | 共碼 + Apple 按鈕置首位 | 等效 | Apple 登入成功／取消／失敗三種結果 |
| Apple 登入 | 無（Android 不提供） | `lib/apple_auth.dart` | `ASAuthorizationAppleIDProvider` → 後端驗證 | 等效 | 首次授權、二次授權、已在其他裝置登入 |
| Google 登入 | 系統瀏覽器 OAuth + App Link 回呼 | `api_client.dart` | 共碼（系統瀏覽器） | 共碼 | 冷啟動回呼、取消授權 |
| LINE 登入 | 同上 | `api_client.dart` | 共碼 | 共碼 | 同上 |
| Passkey 登入 | WebAuthn 平台驗證器 | `api_client.dart` | 共碼（Face ID／Touch ID 走系統） | 等效 | 生物辨識失敗時的錯誤訊息 |
| 登出 | 清除憑證 | `api_client.dart` `_clearAuth` | 共碼 + 清除 Widget 快照 | 等效 | 登出後 Widget 不殘留金額 |
| 重新登入 | 從啟動畫面恢復 session | `app.dart` `AuthGate` | 共碼 | 共碼 | 登入過期自動導回登入頁 |
| Apple 帳號連結 | 無 | `app/api/account/link-apple` | 共碼 | 等效 | A 帳號的 state 不能用在 B 帳號 |
| Apple 解除連結 | 無 | `app/api/account/unlink-apple` | 共碼 | 等效 | 解除前必須保留另一種登入方式 |
| 刪除帳號 | 設定頁有入口 | `settings_screen.dart` | 共碼 | 共碼 | 需處理 Apple 授權撤銷 |
| 使用教學 | 首次進入自動彈出 | `onboarding_screen.dart` | 共碼 | 共碼 | 看過後不再重複 |

## 2. 儀表板

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 月份切換 | 上／下月 | `dashboard_screen.dart` | 共碼 | 共碼 | 月界線與時區 |
| 收入／支出／淨額 | 本月彙總 | `dashboard_screen.dart` | 共碼 | 共碼 | 與後端金額一致 |
| 帳戶餘額 | 各帳戶餘額清單 | `dashboard_screen.dart` | 共碼 | 共碼 | 多幣別顯示 |
| 資產／股票摘要 | 銀行餘額 + 股票市值 | `dashboard_screen.dart` | 共碼 | 共碼 | — |
| 圖表 | 圓餅圖／趨勢圖 | `fl_chart` | 共碼 | 共碼 | 深淺色皆可讀 |
| 快捷入口 | 帳戶／預算等 | `dashboard_screen.dart` | 共碼 | 共碼 | — |
| 預算進度警示 | 顯示預算使用情形 | `dashboard_screen.dart` | 共碼 | 共碼 | — |

## 3. 帳本與協作

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 帳本選擇／切換 | 個人與共用帳本 | `ledger_screen.dart` | 共碼 | 共碼 | 切換後 Widget 快照清除 |
| 成員管理 | 邀請、移除、改角色 | `ledger_screen.dart` | 共碼 | 共碼 | — |
| 只讀角色 | viewer 不得寫入 | `api_client.dart` | 共碼 | 共碼 | 只讀帳本不得新增交易 |
| 邀請深層連結 | `assetpilot://ledger/invite` | `app.dart` | 共碼 | 共碼 | App 未安裝時的後備網頁 |

## 4. 記帳

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 新增交易 | 多種收支類型 | `transaction_form_screen.dart` | 共碼 | 共碼 | 金額精度、日期、幣別 |
| 編輯交易 | 支援一般編輯 | `transaction_form_screen.dart` | 共碼 | 共碼 | 編輯不產生離線草稿 |
| 刪除交易 | 有 | `transactions_screen.dart` | 共碼 | 共碼 | 確認對話框 |
| 轉帳 | 帳戶間轉移 | `transaction_form_screen.dart` | 共碼 | 共碼 | 同一交易兩筆 |
| 篩選／搜尋 | 多條件篩選 | `transactions_screen.dart` | 共碼 | 共碼 | — |
| 照片附件 | 相機／相簿選取後上傳 | `transaction_form_screen.dart` | 共碼 | 等效 | iOS 授權（相機／相簿）與有限存取 |
| OCR 預填 | 憑證辨識帶入金額 | `transaction_form_screen.dart` | 共碼 | 等效 | 辨識失敗可手動修改 |
| **Siri／捷徑帶入** | 無 | `ios/Runner/`（App Intent） | App Intent → 深層連結 → 表單 | 等效 | **未確認不入帳**；參數齊全才帶入 |
| **Widget 快速記帳** | 無 | `ios/AssetPilotWidget/` | Widget → 深層連結 → 表單 | 等效 | 與 Siri 共用同一入口 |
| **深層連結接收（iOS）** | Android 走 `app_links` | `lib/platform/app_link_service.dart` | 等效（**實作不同**） | 等效 | iOS 走自訂原生通道（`DeepLinkChannel.swift`）；冷啟動、登入回呼與記帳入口互不干擾 |

## 5. 帳戶與分類

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 帳戶 CRUD | 新增／編輯／刪除 | `accounts_screen.dart` | 共碼 | 共碼 | — |
| 帳戶類型 | 一般／信用卡等 | `accounts_screen.dart` | 共碼 | 共碼 | — |
| 多幣別 | 每個帳戶可設幣別 | `accounts_screen.dart` | 共碼 | 共碼 | 匯率換算 |
| 信用卡還款 | 還款與分攤 | `credit_card_repayment_allocation_test.dart` | 共碼 | 共碼 | 應繳金額與循環帳單 |
| 分類階層 | 兩段式父子分類 | `categories_screen.dart` | 共碼 | 共碼 | 子分類實際寫入 |

## 6. 預算與固定收支

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 預算進度 | 總預算與分類預算 | `budgets_screen.dart` | 共碼 | 共碼 | 超支邊界 |
| 固定收支 | 週期性收支 | `recurring_screen.dart` | 共碼 | 共碼 | 下次扣款日計算 |
| 啟用／停用 | 可切換 | `recurring_screen.dart` | 共碼 | 共碼 | 停用後不列入提醒 |

## 7. 股票

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 持股清單 | 含損益 | `stocks_screen.dart` | 共碼 | 共碼 | 損益計算 |
| 買賣交易 | 記錄與統計 | `stocks_screen.dart` | 共碼 | 共碼 | — |
| 股利 | 股利記錄 | `stocks_screen.dart` | 共碼 | 共碼 | — |
| 股票設定 | 追蹤標的 | `stock_settings_screen.dart` | 共碼 | 共碼 | 排程更新 |
| 定期定額 | DCA 設定 | `stocks_screen.dart` | 共碼 | 共碼 | 排程執行結果 |

## 8. 報表

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 日期區間報表 | 區間統計 | `reports_screen.dart` | 共碼 | 共碼 | 跨月區間 |
| 分類彙總 | 分類占比 | `reports_screen.dart` | 共碼 | 共碼 | — |
| 圖表 | 既有圖表 | `reports_screen.dart` | 共碼 | 共碼 | — |
| 報表排程 | 定期寄送 | `report_schedule_screen.dart` | 共碼 | 共碼 | 寄送設定保存 |

## 9. 個人設定與整合

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 名稱 | 可修改 | `settings_screen.dart` | 共碼 | 共碼 | — |
| 主題 | 跟隨系統 | `theme.dart` | 共碼 | 共碼 | 深淺色 |
| 語言 | 多語系（10 種） | `settings_screen.dart`／`l10n.dart` | 共碼 + iOS 逐 App 語言 | 等效 | `assetpilot/locale` channel 與系統設定一致 |
| 幣別 | 預設顯示幣別 | `settings_screen.dart` | 共碼 | 共碼 | — |
| 安全設定 | Passkey／登入紀錄 | `security_screens.dart` | 共碼 | 共碼 | — |
| 既有整合入口 | 通知／API Token 等 | `security_screens.dart` | 共碼 | 共碼 | — |
| 帳號刪除 | 有 | `settings_screen.dart` | 共碼 | 共碼 | 需處理 Apple 授權撤銷 |
| 版本資訊 | 有 | `changelog_screen.dart` | 共碼 | 共碼 | — |
| **離線草稿** | 無 | `lib/offline/` | 草稿 + 確認送出 | 等效 | 見第 11 節 |

## 10. 管理員

| 功能 | Android 基準行為 | 來源 | iOS 對應方式 | 狀態 | 驗收重點 |
| --- | --- | --- | --- | --- | --- |
| 管理操作 | 管理面板 | `admin_screen.dart` | 共碼 | 共碼 | 不得開放給一般使用者 |
| 權限控制 | 後端授權 | `api_client.dart` | 共碼 | 共碼 | 一般使用者看不到入口 |

## 11. iOS 專屬新增功能

| 功能 | 來源 | 狀態 | 驗收重點 |
| --- | --- | --- | --- |
| WidgetKit 快速記帳 | `ios/AssetPilotWidget/AssetPilotQuickTransactionWidget.swift` | 等效 | 點擊開啟記帳表單；未登入時不顯示金額 |
| WidgetKit 本月收支摘要 | `ios/AssetPilotWidget/AssetPilotMonthlyOverviewWidget.swift` | 等效 | 數字與 App 一致；過期有提示；鎖定時遮蔽 |
| App Intent 記帳 | `ios/Runner/RecordTransactionIntent.swift` | 等效 | 帶金額與分類開啟 App，**不直接入帳**；置於主 App target（非擴充） |
| App Group 快照 | `lib/platform/app_group_store.dart` | 等效 | 兩端欄位一致；僅最小摘要；切換帳本即清除 |
| WidgetKit 重載 | `lib/platform/widget_snapshot_service.dart` | 等效 | 寫入後請系統重載；失敗不影響主流程 |
| Widget 金額遮蔽 | `lib/platform/widget_snapshot_service.dart`、設定頁 | 等效 | **預設遮蔽**；使用者可在設定開啟；舊版快照缺欄位也視為遮蔽 |
| 逐 App 語言 | `ios/Runner/LocaleChannel.swift`、`Info.plist` `CFBundleLocalizations` | 等效 | 與 iOS 設定 App 的語言選擇一致；10 種語系皆宣告 |
| Keychain 憑證 | `lib/platform/secure_store.dart` | 等效 | iOS 走 Keychain（首次解鎖後可用） |
| 離線草稿 | `lib/offline/` | 等效 | 見第 12 節 |
| iOS 登入頁副標 | `lib/screens/login_screen.dart`、`shared/i18n/app_*.arb` | 等效 | 顯示「資產管理 · **iOS** 客戶端」，不沿用 Android 字串 |

## 12. 離線草稿

| 情境 | 預期行為 | 狀態 | 驗收重點 |
| --- | --- | --- | --- |
| 斷網時記帳 | 儲存為草稿，不報錯 | 等效 | 草稿內容完整 |
| 重啟 App | 草稿仍在 | 等效 | 存在受保護儲存（非明文偏好） |
| 恢復連線 | **只提示**，不自動入帳 | 等效 | 需使用者按送出 |
| 送出成功 | 後端確認後才移除本地草稿 | 等效 | 不重複入帳 |
| 送出逾時／結果不明 | 保留草稿，可用同一 `clientRef` 重試 | 等效 | 後端依 `(user_id, client_ref)` 去重 |
| 送出失敗（4xx） | 不自動重試，交由使用者決定 | 等效 | 重試／修改／捨棄 |
| 交易建立成功、照片上傳失敗 | 保留已建立交易 ID 與本地照片，只重試附件 | 等效 | 重試不得建立第二筆交易 |
| 切換帳號 | 只看得到自己的草稿 | 等效 | 分檔隔離 |
| 切換帳本 | 草稿不跨帳本送出 | 等效 | 分檔隔離 |
| 登出前提示 | 明確告知尚有草稿，草稿保留不自動入帳 | 等效 | 登出對話框顯示筆數 |
| 登出後停止自動重試 | 未登入狀態不送出草稿 | 等效 | 監聽登入狀態 |
| 照片附件 | 暫行保留照片副本於 App 私有目錄 | 待決（待維護者確認） | 交易建立但照片上傳失敗時保留草稿與照片；重試只補上附件，不重複建立交易 |

## 13. 共通品質

| 面向 | 狀態 | 驗收重點 |
| --- | --- | --- |
| 金額精度 | 共碼 | 小數、幣別、月界線與後端一致 |
| 時區與日期 | 共碼 | 跨時區顯示正確 |
| 多語系 | 共碼 | 10 種語系皆不退步 |
| 深淺色 | 共碼 | 所有畫面可讀 |
| 錯誤／空資料／載入 | 共碼 | 各狀態皆有對應畫面 |
| 返回與鍵盤 | 共碼 | 鍵盤不遮住輸入框 |
| 安全區 | 等效 | iPhone 瀏海與底部 home 指示條不遮內容 |
| VoiceOver | 待補 | 所有可互動元件有語意標籤 |
| 放大字級 | 待補 | 大字級下版面不破版 |
| **獨立 App 鎖（Face ID）** | 不適用 | 計畫書 4.3 明確排除，未承諾交付 |

## 14. 待決事項（阻擋上架或影響範圍）

| 項目 | 狀態 | 影響 | 需要誰決定 |
| --- | --- | --- | --- |
| 最低 iOS 版本 | 已定案 iOS 16.0 | App Intents 需 iOS 16+；鎖定較舊裝置 | 已定（實作採用 16.0） |
| Widget 尺寸與金額遮蔽 | **部分定案** | 金額遮蔽已實作且預設開啟；尺寸（僅小／中）已實作 | 尺寸是否再加大型待維護者確認 |
| 離線草稿的照片處理 | 待決 | 暫行實作保留照片副本、上傳失敗可補傳，且避免重複建立交易；與「僅文字草稿」建議不同 | 維護者 |
| 草稿保留期限與登出行為 | **部分定案** | 登出前已提示、草稿保留於加密儲存；**保留期限天數**未定 | 維護者 |
| 語言與上架地區 | 待決 | 10 種語系已宣告；商店上架地區未選 | 維護者 |
| 個人開發者身份是否適用金融類 App | 待決 | **可能阻擋上架** | 維護者 + 法務 |
| AGPL-3.0 與 App Store 條款相容性 | 待決 | **可能阻擋上架** | 維護者 + 法務 |
| 獨立 App 鎖（Face ID／Touch ID） | 不納入首版 | 已在 4.3 排除 | 已定 |
| `apple-app-site-association` 缺漏 | **待補（阻擋 Universal Links）** | `Runner.entitlements` 已宣告 `applinks:asset.shao.one`，但沒有對應的 AASA 檔，`https://asset.shao.one/…` 不會開啟 App；自訂 scheme 不受影響 | 維護者（見發佈檢查表第 5.3 節） |

## 15. 本矩陣的證據來源

| 檢查 | 指令 | 狀態 |
| --- | --- | --- |
| Dart 靜態分析 | `cd mobile && flutter analyze` | 退出碼 1（4 項既有提示：2 warning、2 info；本次變更無新增分析提示） |
| Dart 單元測試 | `cd mobile && flutter test` | 通過（127 項） |
| iOS 原生單元測試 | `cd mobile && xcodebuild test -project ios/Runner.xcodeproj -scheme Runner -destination 'id=<UDID>' -only-testing:RunnerTests` | 通過（33 項） |
| iOS 整合測試 | `cd mobile && flutter test integration_test -d <simulator-udid>` | 通過（10 項） |
| 後端型別檢查 | `npm run typecheck` | 通過 |
| Apple 身分驗證 | `npm run test:apple-auth` | 通過（10 項） |
| Apple 連結流程 | `npm run test:apple-link` | 通過（6 項；路由層需 PostgreSQL） |
| i18n 一致性 | `npm run check:i18n` | 通過（10 種語系、2044 鍵） |
| iOS target 設定 | `cd mobile && ruby tool/setup_ios_targets.rb` | 通過（腳本自我驗證；4 個 target） |
| iOS 編譯 | `cd mobile && flutter build ios --simulator --debug --no-codesign` | **通過**（Xcode 27.1／iOS 27.1 SDK） |
| 擴充嵌入 | 檢查 `Runner.app/PlugIns/AssetPilotWidget.appex` | 通過（存在） |
| App Intents metadata | 檢查 `Runner.app/Metadata.appintents/` | 通過（Siri 可索引） |
| 實機驗收 | 人工（`docs/ios-release-checklist.md` 第 1.2 節） | **待維護者執行** |
