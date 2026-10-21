# AssetPilot iPhone App 開發計畫書

> - 版本：v0.1 規劃草案
> - 日期：2026-10-21
> - 程式盤點基準：`ae124f37`
> - 狀態：主要產品決策已確認；技術設計為建議方案，尚未開始實作或完成上架資格確認。

## 1. 計畫摘要

以既有 `mobile/` Flutter Android 專案為基礎，增加可公開發佈的 iPhone App。首版必須對齊 Android 的 App 內功能，另外提供 Apple 登入、指定的 iOS Widget、Siri／捷徑記帳入口及離線記帳草稿。

由專案維護者搭配 AI 開發，沒有另外的工程團隊；以完整功能與品質驗收為優先，不設定尚無依據的上架日期。先經 TestFlight 測試，再申請 App Store 公開上架，首版免費。

**本計畫不是精簡 MVP。不能為了趕上架，擅自刪除 Android 已有的 App 內功能。** 若技術或審核限制導致範圍不可行，必須列出差異，由維護者重新決定。

## 2. 已確認的產品決策

以下內容來自本次逐項選擇，不是尚未核准的建議。

| 編號 | 決策 | 已選定方案 | 對計畫的影響 |
| --- | --- | --- | --- |
| D01 | 發佈目標 | 公開 App Store 上架，先經 TestFlight 驗證 | 納入簽署、審核素材、隱私與商店合規工作 |
| D02 | 開發技術 | 沿用 Flutter，增加 iOS 支援 | 共用 Dart 業務程式，不另起 SwiftUI 或 React Native 主 App |
| D03 | 首版功能 | Android App 內全功能對齊，再加入指定 iOS 功能 | 以完整功能驗收為上架門檻，不以核心記帳完成代替全功能完成 |
| D04 | Siri／捷徑 | 語音帶入金額與類別，開啟 App 確認後儲存 | 不允許在背景無確認直接入帳 |
| D05 | Widget | 快速記帳入口＋本月收支摘要 | 不移植 Android 的投資、預算、提醒等其他 Widget |
| D06 | 後端與資料 | 與 Web／Android 共用現有後端、帳號與帳本 | 沿用既有 API 與資料，不另建 iCloud 帳本或可自訂伺服器模式 |
| D07 | 登入 | 新增 Apple，保留 Google／LINE／Passkey | 需要後端身份整合及 iOS 登入回呼驗證 |
| D08 | 離線 | 離線記帳草稿，恢復連線後確認送出 | 不把恢復連線視為使用者同意入帳；不降低 Android 原有能力 |
| D09 | 收費 | 首版免費，不加入買斷或訂閱 | 首版不新增內購與訂閱管理 |
| D10 | 開發者身份 | 尚未加入 Apple Developer Program，預計個人申請 | 先確認服務定位與個人身份是否適用，再完成申請 |
| D11 | 人力 | 維護者一人搭配 AI | 必須預留人工設定、實機驗收與審核溝通時間 |
| D12 | 時程 | 無硬性日期，完整功能與品質優先 | 以里程碑與驗收關卡控管，不承諾尚未估算的交付日 |
| D13 | 全功能對齊的邊界 | App 內功能全對齊，桌面 Widget 依 D05 | Android 的平台專屬實作改用 iOS 等效方式，不要求照搬其底層機制 |

## 3. 現有專案盤點與限制

這是規劃所需的初步盤點，不是已完成的 iOS 相容性認證。完整逐頁驗收矩陣須在 M0 建立。

| 項目 | 已觀察到的現況 | 規劃含意 |
| --- | --- | --- |
| 行動端 | [mobile/README.md](../mobile/README.md)、[pubspec.yaml](../mobile/pubspec.yaml) 顯示既有 Flutter App 與 REST API 整合 | 可沿用畫面、模型與多數 API 呼叫，但不能保證所有套件直接相容 |
| iOS 工程 | 本次盤點未找到 `mobile/ios/`；圖示設定目前為 `ios: false` | 需要建立 iOS 工程、Target、簽署、圖示與權限設定 |
| 功能清單 | [screens/](../mobile/lib/screens/) 已有帳本、記帳、股票、報表、設定、安全與管理員等畫面 | 不可僅依可能落後的 README 決定移植範圍 |
| 登入回呼 | [Google](../app/app/google-callback/page.tsx)、[LINE](../app/app/line-callback/page.tsx)、[Passkey](../app/app/passkey-login/page.tsx) 已有 App 交接路徑 | iOS 要驗證系統瀏覽器、URL 回呼、冷啟動與登入票據交換 |
| Apple 登入 | 初步盤點未見專用行動端整合或 Apple API 路由 | 視為新增整合工作，不是假設打開開關即可使用 |
| 桌面 Widget | [app_widget_sync.dart](../mobile/lib/app_widget_sync.dart) 使用 Android 平台判斷與 MethodChannel | 可參考摘要資料契約，但需另做 WidgetKit 擴充 |
| 裝置驗證 | [play_integrity.dart](../mobile/lib/play_integrity.dart) 是 Android 專屬呼叫 | 驗證 iOS 不會被 Android-only 流程阻擋；不可直接關閉後端防護來繞過 |
| 刪除帳號 | [settings_screen.dart](../mobile/lib/screens/settings_screen.dart) 已有刪除個人帳號入口 | 保留並驗證完整刪除流程，新增 Apple 授權撤銷處理 |
| 離線 | Web/PWA 有相關測試與共用翻譯；本次 Flutter 盤點未確認完整離線持久化流程 | 共用文案不等於功能已實作；iOS 離線草稿需獨立驗證 |
| 建置與測試 | 已有 [Android 發佈流程](../.github/workflows/android-apk.yml) 與 [Flutter 測試](../mobile/test/)；未見 iOS 發佈工作流程 | 增加 macOS／Xcode 建置與原生擴充測試，保留 Android 回歸驗證 |
| 授權 | 根目錄 [LICENSE](../LICENSE) 為 AGPL-3.0 | App Store 發佈與所有相依套件、素材授權需先確認，不能自行移除授權義務 |

## 4. 首版交付範圍

### 4.1 Android App 內功能對齊

M0 逐頁盤點時，每一功能都必須記錄：Android 基準行為、角色權限、相關 API、iOS 對應方式、測試案例及驗收結果。以下是盤點入口，不是可任意刪減的白名單。

| 模組 | 對齊內容與驗收重點 |
| --- | --- |
| 啟動與登入 | 啟動畫面、導覽、既有登入與登出、重新登入、取消登入、錯誤提示 |
| 儀表板 | 月份切換、收支、帳戶餘額、資產／股票摘要、圖表與現有快捷入口 |
| 帳本與協作 | 帳本選擇、切換、既有成員管理與權限；只讀使用者不得透過任何入口寫入 |
| 記帳 | 現有新增／編輯／刪除、轉帳、篩選與其他交易操作；包含照片附件、OCR 預填等已實作流程 |
| 帳戶與分類 | 多幣別、分類階層、帳戶類型、信用卡與還款等現有行為 |
| 預算與固定收支 | 預算進度、分類預算、固定收支及既有啟用／停用操作 |
| 股票 | 持股、交易紀錄、股利、損益、股票設定與定期定額等既有功能 |
| 報表 | 日期區間、分類彙總、現有圖表、報表排程與相關設定 |
| 個人設定與整合 | 名稱、主題、語言、幣別、安全設定、既有整合入口、帳號刪除與版本資訊 |
| 管理員 | Android 已提供的管理操作與權限控制；不得因 iOS 移植而省略或開放給一般使用者 |
| 共通品質 | 金額精度、時區與日期、多語系、深淺色、錯誤／空資料／載入狀態、返回與鍵盤行為 |

若 Android 實作多於上表，仍須補入功能矩陣；若文件宣稱有功能但實際未實作，標記為差異，不冒充已存在。

以基準版本建立首版清單；開發期間 Android 新增功能須另外評估，不默默擴大首版範圍。Android 的 Play 商店連結、裝置驗證與更新方式，以 iOS 適用機制替代，不照搬 APK／Play 專屬行為。

### 4.2 iOS 新增交付

- Apple 登入及與既有 AssetPilot 帳號的安全連結。
- Widget：快速記帳入口、本月收支摘要。
- Siri／捷徑：帶入金額與類別，開啟 App 供使用者確認。
- 離線新增記帳草稿，連線後由使用者確認送出。
- iOS 工程、權限說明、簽署、實機測試、TestFlight 與 App Store 發佈準備。

### 4.3 不自動納入的項目

- Android 既有投資／預算／提醒 Widget 的全面移植。
- Siri 無確認直接入帳、完整離線修改／刪除／自動合併。
- 新增 Apple Watch App、Live Activities、全新遠端推播系統、iCloud 帳本或自訂後端。
- 付費訂閱、買斷與內購。
- 純 Web 才有、Android 尚未提供的功能；是否新增需另行決策。
- iPad 專用版與獨立 Face ID／Touch ID App 鎖尚未決定，不能當作已承諾交付。Passkey 使用系統生物辨識不等於已做 App 鎖。

## 5. 建議技術架構

本節為可供實作驗證的方案，不代表已經建置完成；套件與最低系統版本在 M1 定案。

### 5.1 分層與責任

| 層級 | 建議做法 | 原因 |
| --- | --- | --- |
| 主 App | 沿用 Flutter 畫面、模型、API client 與多語系 | 降低重寫及雙平台功能分歧 |
| iOS 主工程 | 在既有專案增加 `mobile/ios/`，管理簽署、能力與生命週期 | 不另起不相容的行動專案 |
| Widget | SwiftUI＋WidgetKit Extension | 符合 iOS Widget 的原生執行方式 |
| Siri／捷徑 | Swift App Intents，將參數交給 Flutter 記帳表單 | 原生系統整合與既有記帳規則分工 |
| 共用摘要 | 透過 App Group 儲存最小化 Widget 快照 | 擴充不需要登入憑證或完整帳本資料 |
| 登入憑證 | 使用既有安全儲存抽象，驗證 iOS Keychain 行為 | 不把長效憑證寫入偏好設定或 Widget 快照 |
| 離線草稿 | App 私有、受保護的持久化儲存，以帳號／帳本隔離 | 可處理重啟、斷線與帳號切換，不靠記憶體暫存 |
| 後端 | 共用既有服務，按需求擴充 Apple 身份與冪等寫入契約 | 維持 Web、Android、iOS 資料與權限一致 |

測試環境與正式環境須隔離，不能拿正式帳本執行破壞性測試。若需設定測試 API 位址，使用建置環境設定，不擴張成使用者可自訂伺服器的產品功能。

### 5.2 登入與帳號整合

1. 設定 Bundle ID、Sign in with Apple、Associated Domains 與所需回呼；確認／補齊網域關聯檔案。
2. Google／LINE／Passkey 先保留既有產品流程，驗證 iOS 系統授權視窗、冷／熱啟動及取消、逾時、重複回呼。
3. 後端驗證 Apple 身份資料的簽章、發行者、受眾、期限與 nonce／state 等適用參數；私鑰不放進 App 或版本庫。
4. 以經驗證的提供者身份識別碼連結帳號，不只依 email 自動合併；既有帳號綁定須重新驗證。
5. 處理 Apple 隱藏電子郵件、只在初次授權取得姓名等情形，避免產生重複帳號或遺失舊帳本。
6. 刪除帳號時，驗證後端資料刪除／保留政策、Apple 授權撤銷、憑證失效與本機資料清除。
7. 登出、切換帳號、權限失效時，同步清除或隔離 Widget 快照、離線草稿與待處理的捷徑輸入。

### 5.3 Widget 行為與驗收

- 快速記帳入口只開啟記帳流程，不直接寫入資料。
- 本月收支摘要使用後端或主 App 已確認的統計結果，不在擴充另算一套財務邏輯。
- 快照包含帳本識別、月份、幣別、資料時間與必要摘要；不包含 token、附件、交易備註或完整明細。
- 主 App 取得新資料後更新快照並要求重載；實際畫面刷新仍由 iOS 排程，**不保證即時更新或固定每幾分鐘刷新**。
- 顯示資料月份與更新時間；跨月、無網路、未登入、沒有快照時須有明確狀態，不能把舊月份金額冒充本月資料。
- 切換帳號／帳本及登出後不得顯示另一帳號的快照；測試系統快取與重載延遲下的隱私行為。
- 建議金額預設遮蔽、由使用者主動開啟顯示，並驗證鎖定狀態；此預設與 Widget 尺寸仍待決定。

### 5.4 Siri／捷徑行為與驗收

- 定義結構化的「新增記帳草稿」動作：帶入金額與類別，開啟 App 的確認表單。
- 不承諾任意自然語句都能完整解析；先驗證支援的 Siri 語言、參數詢問與捷徑操作。
- 帳本、帳戶、幣別、日期及收支類型須在表單明確呈現；無法判斷時由使用者選擇，不猜測後直接儲存。
- 未登入、裝置鎖定、類別不存在、只讀帳本、金額無效時不得入帳。
- 冷啟動／重新登入後仍可安全接續確認；相同呼叫不可因重複交接產生兩筆交易。
- 離線時導向同一套草稿流程，不另造一套同步機制。
- 首版不自行錄音，也不為此新增外部 AI 服務；Siri 的語音處理由 Apple 系統服務負責，不宣稱所有語音都只在本機處理。

### 5.5 離線草稿行為與驗收

建議狀態為：編輯中、已保存待確認、送出中、已確認入帳、失敗待處理。恢復連線只提示有待處理草稿，不直接跳到入帳。

- 草稿保存金額、幣別、日期、分類、帳戶、帳本與必要備註，明確標示尚未入帳；不計入正式餘額或 Widget 收支。
- App 關閉、重啟或網路切換後，已成功保存的草稿仍存在。
- 送出前重新驗證登入、帳本權限及帳戶／分類是否仍有效。
- 確認後送出使用穩定的冪等識別；逾時而結果不明時，查詢或以相同識別重試，不能換識別再新增。
- 只在後端確認成功後移除待送狀態；失敗可重試、修改或捨棄，不顯示虛假的成功訊息。
- 切換帳號不得送出前一帳號的草稿；保留期限、登出是否刪除與提醒方式須在 M0 決定。
- 照片附件政策尚待維護者確認。暫行實作會將照片副本存於 App 私有目錄；交易已建立但照片上傳失敗時保留草稿與照片，後續只重試附件、不重複建立交易，並在 UI 明確標示已入帳與待補照片。
- 若後續盤點確認 Android 已有不同的離線同步行為，必須保留其行為並列出平台差異，不直接套用到 Android 造成退步。

## 6. 開發里程碑與進出條件

以下排的是依賴與驗收，不是已承諾工期。一人開發以循序推進為主，不預設有多名工程師平行施工。

| 階段 | 工作與交付物 | 必要前置 | 完成門檻 |
| --- | --- | --- | --- |
| M0：範圍與上架可行性 | Android 逐頁功能矩陣、未決事項、身份與授權評估、設備／預算盤點 | 已確認的產品決策 | 主要阻礙有處置方案；不把尚未核准事項當作已通過 |
| M1：iOS 技術驗證 | iOS 工程、工具鏈／套件相容矩陣、最小 Widget／Intent 原型、建置檢查 | M0 功能邊界確認 | 模擬器可建置啟動；具簽署條件後可實機執行；定案最低 iOS 與測試機型 |
| M2：身份與共用資料 | Apple 登入、既有登入移植、帳號連結／刪除、回呼與資料隔離 | M1、所需 Apple／OAuth 設定 | 各登入方式與帳號生命週期通過實機測試，不影響 Web／Android |
| M3：App 內全功能對齊 | 按 M0 矩陣逐項移植，補平台差異、權限、介面與回歸測試 | M1、可用的 M2 登入流程 | 清單每項有結果；任何缺項需重新取得範圍決策 |
| M4：離線草稿 | 受保護儲存、待確認流程、冪等送出與失敗恢復 | M2、M3 的記帳流程、後端寫入契約 | 斷線／重啟／逾時測試無資料遺失或重複入帳 |
| M5：正式 Widget | 快速記帳、本月收支快照、隱私與過期狀態 | M1、M2 帳號生命週期、M3 統計與入口 | 未登入與跨帳號安全，摘要數字一致，刷新限制有正確提示 |
| M6：正式 Siri／捷徑 | 參數接收、開啟表單、使用者確認與離線交接 | M1、M2、M3 記帳表單、M4 | 冷啟動與權限邊界通過；未確認不入帳 |
| M7：完整驗收 | 功能回歸、VoiceOver／字級、效能、隱私、復原與 Android 回歸 | M2 至 M6 完成 | 必達案例全數通過；無登入阻斷、越權、資料遺失、重複入帳或敏感資料外露缺陷 |
| M8：TestFlight | 簽署封存、測試版、測試說明、回饋與修正 | 會員／App Store Connect 可用、M7 | 完成約定的內外部測試；外部測試依 Apple 要求完成 Beta 審核 |
| M9：App Store | 商店資料、截圖、隱私標籤、審核帳號、送審與人工發佈 | M8、上架前置檢核通過 | Apple 核准並由維護者確認發佈；上線後實機冒煙測試通過 |

M1 的模擬器原型可在會員申請期間準備，但這不表示個人身份或授權已獲准上架。若 M0 發現實質發佈阻礙，應先由維護者決定是否繼續投入。

**估工方式：** M0／M1 完成後，依實際功能矩陣、套件相容性及一人每週可投入時間，提出各階段的人日區間與預算；每一里程碑結束重新估算。Apple 身份核驗、外部測試審核、正式審核與補件等待時間另列，不保證固定天數。

## 7. 測試與品質標準

### 7.1 必須覆蓋的情境

| 測試面向 | 最低驗收內容 |
| --- | --- |
| 金額與資料 | 與既有 API 規則一致；小數、幣別、月界線、時區、帳本及財務彙總正確 |
| 身份與權限 | Apple／Google／LINE／Passkey、取消／失效／重複回呼、只讀角色、帳號刪除與授權撤銷 |
| 網路與生命週期 | 斷線、慢網路、逾時、前後景切換、冷啟動、重啟、登入過期 |
| 草稿與冪等 | 重啟仍可找回、跨帳號隔離、結果不明的重試不重複入帳 |
| Widget／捷徑 | 真實 iPhone 操作、未登入／鎖定、過期快照、帳本切換、重複呼叫、開啟後確認 |
| 相片與權限 | 相機／照片授權、有限存取或拒絕權限、上傳失敗與重新選擇 |
| 介面與可用性 | 安全區、鍵盤、返回手勢、深淺色、VoiceOver、放大字級及所有原有語系不退步 |
| 回歸 | 同一份 Flutter 修改不破壞 Android；後端擴充不破壞 Web／Android API |
| 發佈 | Release 建置、正確環境與版本號、無測試入口／測試憑證、可用的隱私及支援連結 |

### 7.2 驗證方式

- 先使用現有 `flutter analyze`、`flutter test`，針對新增資料流程補單元／Widget 測試。
- WidgetKit、App Intents、Keychain 與登入回呼需增加適當的原生／整合測試，不能只靠 Flutter 畫面測試。
- 後端只先執行變更所涵蓋的既有測試與新增案例，必要時再擴大回歸範圍。
- 建立 iOS 建置檢查；簽署與上傳工作使用受控密鑰，與不需密鑰的 PR 檢查分開。
- 模擬器不能替代相機、Siri、真實帳號授權、憑證與 TestFlight 的實機驗收。
- 保留測試結果、機型／系統版本與建置號；不將正式財務資料或憑證放入測試證據。

本次僅建立計畫書，以上命令與 iOS 驗證尚未執行。

## 8. 上架前置與合規關卡

### 8.1 個人開發者身份：目前是計畫，不是資格保證

Apple 支援個人申請，商店賣家名稱會顯示個人法定姓名。官方列示 Apple Developer Program 為每會員年度 99 美元，實際費用依申請地區與付款頁面為準。[1]

但 App Review Guidelines 3.2.1(viii) 對金融交易、投資或資金管理服務提出提交主體與許可要求；5.1.1(ix) 亦對高度監管服務或需要敏感資訊的 App 提出法律實體要求。[2]

因此必須按**實際功能與資料處理**評估本產品屬於個人記帳／投資紀錄工具，或涉及受規範的金融服務。不能僅靠改商店描述或加免責聲明解決，也不能宣稱「記帳 App 一定可以個人上架」或「所有財務 App 一定禁止個人上架」。必要時向 Apple 詢問並取得適當的法律意見；最終仍以審核與適用法律為準。

### 8.2 授權相容性

- 專案採 AGPL-3.0，需確認 App Store 發佈條款與對使用者授予權利、提供對應原始碼等義務的相容性。
- 確認自有程式、歷史貢獻、第三方套件、字型、圖示與品牌素材的權利。
- 若評估需要其他授權安排，須取得有權授權者同意；不能只改 LICENSE 檔案或忽略第三方義務。
- 此項列為發佈前置關卡，不以本計畫代替法律判斷。

### 8.3 商店與隱私檢核

- 依 4.8 登入服務規範實作適用的等效登入選項；本案已選擇新增 Apple 登入。[2]
- 支援建立帳號時，App 內提供適當帳號刪除流程，並完成提供者授權撤銷與相關資料處理。
- App 內及商店均提供可公開讀取的隱私政策與支援資訊。
- 盤點財務資訊、照片、登入識別、診斷資訊及既有 Sentry／OCR／其他整合的實際資料流，再填寫 App Privacy；不可僅因自托管就宣稱沒有第三方處理。
- 確認套件的 Privacy Manifest、Required Reason API、權限用途說明及加密出口合規申報。
- 若實際存在跨 App／網站追蹤，另依規範處理；不為不存在的追蹤用途新增不必要權限。
- 準備可供審核使用的測試帳號與無真實個資的示範資料，確保審核地區可連接後端；不全域關閉正式安全機制。
- 檢核適用的 App Store 類別、年齡分級、發佈國家／地區與各地要求。
- 送審時重新確認 Apple 最新規範、可接受的 Xcode／SDK 版本與畫面素材規格。

## 9. 人力、成本與營運

### 9.1 分工

| 工作 | 維護者 | AI 協助 |
| --- | --- | --- |
| 需求與範圍 | 最終決定與變更核准 | 整理選項、差異與驗收案例 |
| 程式與測試 | 審查、必要操作與真實裝置驗收 | 產生與修改程式、測試、文件，分析失敗原因 |
| Apple 帳號與法務 | 身份核驗、費用、條款、授權及法律意見 | 整理官方資料與檢核清單，不代替資格判定 |
| 憑證與服務設定 | 管理帳號、密鑰、權限與正式環境 | 提供設定步驟與不含秘密的配置 |
| 上架與維運 | 送審決策、審核溝通、發佈、使用者支援 | 準備素材文案、診斷問題與修正版 |

### 9.2 預算項目

| 項目 | 規劃方式 |
| --- | --- |
| Apple Developer Program | 官方基準每年 99 美元；以實際地區價格為準 |
| Mac／Xcode | 確認現有設備是否支援所需工具鏈；不假設一定要購新機 |
| iPhone 實機 | 至少有可用的實機驗收條件；另以借測或測試人員覆蓋支援範圍 |
| 建置與 AI | 盤點 macOS CI 執行額度、AI 使用費與人工時間，先設可接受上限 |
| 後端與監控 | 沿用現有服務，評估測試環境、容量、監控與備份的增量成本 |
| 法務／授權 | 若身份定位或 AGPL 相容性無法自行釐清，另列諮詢成本 |

預算上限與每週可投入時間尚未提供，故本版不編造總價或完工日。不得在未取得同意前購買設備、申請付費服務或擴大雲端支出。

### 9.3 上線與故障處理

- 後端變更需相容仍在使用的 Web、Android 與舊版 iOS；資料遷移先有備份及復原方式。
- 測試版與正式版可追蹤到相同的原始碼版本與建置設定，版本號及建置號可識別。
- 上線後驗證登入、記帳、資料一致性、Widget 及捷徑；監控資料須去識別與遮蔽財務內容。
- 發現重大問題時可暫停發佈／新增下載、依預先設計的方式停用故障功能並送出修正版；不能假設可遠端讓已安裝的 App 即刻降版。
- 持續追蹤 iOS／Flutter／套件更新與 Apple 規範，安排相容性回歸，而不是上架後停止維護。

## 10. 尚待決定：選項、建議與原因

下列項目**尚未獲得使用者選定**。建議不是授權，不可直接寫成已確認需求。

| 待決事項 | 選項 | 建議與原因 | 定案時點 |
| --- | --- | --- | --- |
| 最低 iOS | 較廣機型覆蓋／只支援較新系統 | 以完成全部首版功能所需的最低版本為起點，再按實機與套件收斂；App Intents 基礎框架自 iOS 16 提供，但使用的個別 API／套件可能要求更高版本 [5] | M1 結束前 |
| 裝置範圍 | iPhone 優先／增加 iPad 專用介面 | iPhone 優先，符合本次手機版需求；另確認實際支援裝置設定與必要相容測試 | M0／M1 |
| Widget 尺寸與隱私 | 小／中／多尺寸；預設顯示或遮蔽金額 | 先小與中尺寸、預設遮蔽金額；控制測試量並降低財務資訊曝光 | M5 前 |
| 獨立 App 鎖 | 不新增／提供 Face ID 或 Touch ID 解鎖 | 建議可選的生物辨識 App 鎖；需補回復與失敗流程，不能與 Passkey 混為一談 | M0 |
| 離線照片 | 僅文字草稿並清楚提示／連照片一併保存 | 先文字草稿，照片在線上補附；降低私密檔案儲存與上傳復原複雜度 | M4 前 |
| 草稿保留與登出 | 提醒後清除／加密保留供同帳號返回 | 建議登出前明確提示未送草稿，不自動替使用者入帳；實際保留期限需定案 | M4 前 |
| 語言與地區 | 原有語系維持；單一／多地區上架 | 不刪除既有 App 語系；商店可先選熟悉的地區，降低法規與支援負擔，Siri 語言另外驗證 | M0、送審前 |
| 每週投入與預算 | 兼職／固定時段；有上限／先估再核准 | 先提供可投入時間及預算上限，再依 M1 結果估算，避免把 AI 視為無限人力 | M0／M1 |
| TestFlight 驗收配置 | 自測／邀請小群外部測試者 | 自測後邀請外部測試者，補足單一維護者的機型與操作盲點 | M8 前 |

## 11. 主要風險與處置

| 風險 | 影響 | 應對 |
| --- | --- | --- |
| 個人身份與金融服務定位不符 | 無法按原身份上架 | M0 先評估，必要時改由合格主體發佈或重新決策，不以文案掩蓋實際功能 |
| AGPL／第三方授權與發佈條件有衝突 | 無法合法依原方案發佈 | 先釐清權利與授權安排，再承諾發佈方式 |
| Flutter 套件或 Android 假設不相容 | 登入、圖片、儲存或原生功能失效 | M1 做最小實機驗證，列出替代實作與測試成本 |
| 全功能首發工作量超出一人負荷 | 工期拉長 | 凍結基準、逐模組驗收；如需降範圍，回到使用者決策 |
| 離線送出重複或跨帳號混用 | 財務紀錄錯誤 | 冪等鍵、帳號／帳本隔離、結果不明時可恢復的狀態設計 |
| Widget／Siri 暴露敏感資訊 | 隱私損害 | 最小摘要、裝置鎖定測試、帳號切換清理、確認後才寫入 |
| 把模擬器成功當作實機成功 | TestFlight 或正式版才發現阻斷 | 將實機授權、冷啟動、簽署及 Release 版列為獨立關卡 |
| 第三方與 Apple 規範變動 | 臨近送審需補工 | 里程碑與送審前重新核對，不保證審核日期 |

## 12. 下一步

先執行 M0：確認上架身份／授權可行性、逐頁 Android 功能矩陣，以及設備與投入條件。再以 M1 的最小 iOS 原型驗證工具鏈與關鍵整合，據此定案最低 iOS、完整工作量與費用。

本文件只新增規劃，不代表已獲准申請會員、支付費用、修改正式後端或發佈 App。進入實作時，仍須依已確認的範圍與前置條件執行。

## 13. 實作進度（進行中更新）

本節記錄依本計畫撰寫程式碼的實際進度。**「程式已完成」不等於「已通過驗收」**：
實機驗收、App Store 審核與法務判定仍待維護者執行。

| 里程碑 | 狀態 | 主要產出 | 證據 |
| --- | --- | --- | --- |
| M0 範圍與可行性 | 部分完成 | `docs/ios-feature-matrix.md`（逐頁功能矩陣） | 矩陣以 `mobile/lib/` 現況盤點；身份／授權判定仍待維護者 |
| M1 iOS 工程 | 程式完成 | `mobile/ios/`（3 個 target）、`mobile/lib/platform/` | Xcode 專案結構已驗證；**Swift 已實際編譯通過**（Xcode 27.1／iOS 27.1 SDK 模擬器建置成功） |
| M2 Apple 登入 | 程式完成 | `app/api/auth/apple/*`、`app/api/account/{link,unlink}-apple/`、`mobile/lib/apple_auth.dart` | `npm run test:apple-auth`（10 項）、`npm run test:apple-link`（6 項）通過 |
| M3 App 內對齊 | 程式完成 | 共用既有 Dart 畫面，無需移植 | 逐頁對照見功能矩陣；**實機逐頁驗收待執行** |
| M4 離線草稿 | 程式完成 | `mobile/lib/offline/`、`mobile/lib/screens/offline_drafts_screen.dart` | `mobile/test/offline_draft_core_test.dart`、`offline_draft_store_test.dart` 通過 |
| M5 Widget | 程式完成 | `mobile/ios/AssetPilotWidget/`、`mobile/lib/platform/app_group_store.dart` | 兩端欄位契約測試通過（`platform_contract_test.dart`） |
| M6 Siri／捷徑 | 程式完成 | `mobile/ios/Runner/RecordTransactionIntent.swift`、`DeepLinkChannel.swift`、`DeepLinkQueue.swift` | 深層連結契約測試通過（`siri_deep_link_test.dart`／`app_link_service_test.dart`）；原生 XCTest 33 項通過；**整合測試在模擬器上驗證連結真的回到 Dart 層**；App Intents metadata 已產出 |
| M7 完整驗收 | 進行中 | 自動化檢查 + `docs/ios-release-checklist.md` 第 1.2 節 33 項實機清單 | XCTest、整合／Dart 測試及模擬器建置通過；`flutter analyze` 有 4 項既有提示（2 warning、2 info）並以退出碼 1 結束；**實機 33 項待維護者執行** |
| M8 TestFlight | 待辦 | `.github/workflows/ios-build.yml` 的 `archive` 工作 | 需 Apple 憑證與會員 |
| M9 App Store | 待辦 | `docs/ios-release-checklist.md` | 需 M8 完成 |

### 13.1 已完成的驗證

| 檢查 | 指令 | 結果 |
| --- | --- | --- |
| Dart 靜態分析 | `cd mobile && flutter analyze` | **退出碼 1**：4 項既有提示（2 warning、2 info）；本次離線草稿服務／帳號清理變更無新增分析提示 |
| Dart 單元測試 | `cd mobile && flutter test` | **127 項通過** |
| 後端型別檢查 | `npm run typecheck` | 通過 |
| Apple 身分驗證測試 | `npm run test:apple-auth` | 10 項通過 |
| Apple 連結流程測試 | `npm run test:apple-link` | 6 項通過（路由層需 PostgreSQL） |
| i18n 一致性 | `npm run check:i18n` | 通過（10 種語系、2044 鍵對齊） |
| **iOS 原生單元測試** | `cd mobile && xcodebuild test -project ios/Runner.xcodeproj -scheme Runner -destination 'id=<UDID>' -only-testing:RunnerTests` | **33 項通過**（深層連結佇列 12、連結投遞 9、Apple 授權 5、登出佇列 6、樣板 1） |
| **iOS 整合測試** | `cd mobile && flutter test integration_test -d <simulator-udid>` | **10 項通過**（在 iOS 27.0 模擬器上執行） |
| **一次跑完 iOS 三層測試** | `cd mobile && tool/test_ios.sh [simulator-udid]` | **通過**（原生 → 整合 → Dart，含 `FLUTTER_TARGET` 還原） |
| iOS target 設定 | `ruby tool/setup_ios_targets.rb` | 4 個 target、deployment target 16.0、擴充已嵌入（腳本自我驗證） |
| **iOS 模擬器建置** | `cd mobile && flutter build ios --simulator --debug --no-codesign` | **成功**（Xcode 27.1／iOS 27.1 SDK）；輸出 `build/ios/iphonesimulator/Runner.app` |
| 擴充嵌入驗證 | 檢查 `Runner.app/PlugIns/AssetPilotWidget.appex` | 存在 |
| App Intents metadata | 檢查 `Runner.app/Metadata.appintents/` | 存在（`extract.actionsdata`／`nlu`／`root.ssu.yaml`），Siri 可索引 |

> **關於「Swift 語法檢查」**
>
> 原先的 `swiftc -parse ios/**/*.swift` 只能確認語法，無法確認**型別**
> 與**跨語言契約**。該檢查已由下列三項取代：
>
> - `xcodebuild test`（原生 XCTest，33 項）：會真正編譯並連結，
>   驗證深層連結佇列的規則與 Apple 授權的 nonce 雜湊方向。
> - `flutter test`（Dart 單元測試，127 項）：其中 `app_link_service_test.dart`
>   直接比對 Swift 與 Dart 的通道名稱、場景入口與 host 過濾名稱。
> - `flutter test integration_test`（整合測試，10 項）：在真實模擬器上
>   驗證 Dart 與原生通道的實際往返。
>
> `swiftc -parse` 仍可作為語法層的快速檢查，但它不再是主要防線。

> **建置期發現的架構事實（已修正）**
>
> 1. **App Intent 必須放在主 App target，不能放在 App Extension。**
>    `openAppWhenRun = true` 的 Intent 需要用 `UIApplication.shared` 開啟 App，
>    但該 API 對擴充是 `NS_EXTENSION_UNAVAILABLE_IOS`；Apple 官方亦註明
>    `openAppWhenRun` 在擴充中執行「generates an error」。因此
>    `RecordTransactionIntent.swift`／`AssetPilotShortcuts.swift` 已移至
>    `mobile/ios/Runner/`，並刪除原 `AssetPilotIntents` 擴充 target。
>    主 App 連結 `AppIntents.framework` 後，Xcode 會自動加入
>    `ExtractAppIntentsMetadata` 階段並產出 Siri 索引資料。
> 2. **WidgetKit 擴充需要 iOS 17 API，但專案最低支援 iOS 16。**
>    `.containerBackground(_:for:)`／`.fill.tertiary` 為 iOS 17.0+，
>    以 `if #available(iOS 17.0, *)` 保留 16.0 的退化路徑
>    （`ios/AssetPilotWidget/WidgetBackground.swift`）。
> 3. **擴充嵌入階段必須排在「Thin Binary」之前。**
>    「Thin Binary」腳本以 `${TARGET_BUILD_DIR}/${INFOPLIST_PATH}` 為輸入，
>    而 `ProcessInfoPlistFile` 佔用整個 `Runner.app` bundle；若嵌入階段排在
>    之後會形成 `Copy(appex) → Thin Binary → ProcessInfoPlistFile → Copy(appex)`
>    的建置循環。腳本會自動校正順序並自我驗證。

> **模擬器實測發現的架構事實（已修正）**
>
> 4. **`app_links` 套件在 iOS 上收不到冷啟動的深層連結。**
>    兩個原因：其一，套件透過 `registrar.addSceneDelegate(...)` 註冊自己的
>    場景代理，而本專案使用 `FlutterImplicitEngineDelegate`，插件是在
>    `didInitializeImplicitFlutterEngine` 才註冊的——那時場景早已連線完成，
>    冷啟動時帶在 `connectionOptions.urlContexts` 的連結不會被套件看見；
>    其二，套件的 `handleLink(url:)` 在 Dart 端尚未訂閱事件通道時直接
>    丟棄連結。
>    因此 iOS 改以自訂原生通道接收（`ios/Runner/DeepLinkChannel.swift`），
>    由 `SceneDelegate` 的三個入口與 `AppDelegate` 的回呼統一收斂。
>    Android 仍沿用 `app_links`，兩者由 `lib/platform/app_link_service.dart`
>    包成同一個 API。
> 5. **Flutter 的方法通道與事件通道不可同名。**
>    兩者底層都用 `setMessageHandlerOnChannel:` 註冊處理器，Flutter 官方
>    文件明載「identically named channels interfere with each other's
>    communication」。同名時後註冊的事件通道會覆蓋方法通道的處理器，
>    `takePendingLink` 將永遠收不到回應。因此原生層刻意拆成
>    `assetpilot/deep_link`（方法）與 `assetpilot/deep_link/events`（事件）。
> 6. **待處理連結必須能「依 host 分取」。**
>    本 App 有兩類互不相干的連結消費者：記帳入口
>    （`transaction`／`ledger`）與登入回呼
>    （`google-callback`／`line-callback`／`auth-ticket`）。
>    若待處理連結只有一格，任一方先取走就會讓另一方永遠收不到冷啟動連結。
>    原生層的 `takePendingLink`／`getInitialLink` 因此都接受
>    `{"hosts": [...]}` 參數。
> 7. **iOS 登入頁不可沿用 Android 字串。**
>    登入頁副標原本寫死為「安卓客戶端」，iOS 版會讓使用者誤以為裝錯版本。
>    已新增 `mobileLegacyPersonalFinanceIosApp` 語系鍵（10 種語系），
>    依 `PlatformInfo.isIOS` 切換。
> 8. **Universal Links 尚缺 `apple-app-site-association`。**
>    `Runner.entitlements` 宣告了 `applinks:asset.shao.one`，原先版本控制中
>    **沒有**對應的驗證檔（Android 的 `public/.well-known/assetlinks.json`
>    存在，iOS 對應檔缺漏）。已補上
>    `public/.well-known/apple-app-site-association`，並在 `next.config.ts`
>    設定 `Content-Type: application/json` 與不快取（Apple 要求此檔不得
>    轉址、不可長期快取）。
>    **但 `appID` 的 Team ID 仍是 `TEAM_ID` 佔位符**——它屬於 Apple
>    Developer 帳號資訊，需維護者替換。在替換之前，
>    `https://asset.shao.one/…` 的 Universal Links 不會開啟 App；
>    自訂 scheme（`assetpilot://`）不受影響。
>    `npm run test:universal-links` 會把「仍是佔位符」這件事顯性化。

### 13.2 本次實作涵蓋的計畫書條目

| 計畫書條目 | 實作位置 | 說明 |
| --- | --- | --- |
| 5.2 步驟 3、4（Apple 身分驗證與帳號連結） | `lib/appleOAuth.ts`、`app/api/account/{link,unlink}-apple/` | 簽章／iss／aud／exp／iat／nonce 驗證；以 `sub` 為準，不以 email 合併 |
| 5.2 步驟 7（登出清除快照與草稿） | `ApiClient._clearAuth`、`OfflineDraftService` | 登出時清除 Widget 快照、停止草稿自動重試 |
| 5.3（Widget 最小摘要與清除） | `lib/platform/app_group_store.dart`、`WidgetSnapshotService` | 僅最小摘要；切換帳本／登出即清除 |
| 5.3（金額預設遮蔽） | `WidgetSnapshotService.setHideAmounts`、設定頁開關 | 預設遮蔽；舊版快照缺欄位時也視為遮蔽 |
| 5.4（Siri 開啟 App 由使用者確認） | `ios/Runner/RecordTransactionIntent.swift`、`app.dart` | `openAppWhenRun = true`；Intent 不呼叫後端；**置於主 App target**（見上方註記 1） |
| 5.4（深層連結冷啟動交接） | `ios/Runner/DeepLinkChannel.swift`、`ios/Runner/DeepLinkQueue.swift`、`ios/Runner/SceneDelegate.swift`、`lib/platform/app_link_service.dart`、`lib/platform/deep_link_service.dart` | 自訂原生通道取代 `app_links` 的 iOS 路徑（見上方註記 4–6）；待處理連結依 host 分取；2 秒去重窗避免重複交接產生兩筆交易 |
| 5.4（未登入時不丟棄連結） | `lib/platform/deep_link_service.dart`、`lib/app.dart` | 監聽在 `AuthGate` 啟動（早於 `HomeShell`），連結暫存至登入後接續處理 |
| 5.5（草稿狀態、冪等、隔離） | `lib/offline/` | 五種狀態；`clientRef` 冪等；依使用者／帳本分檔 |
| 5.5（草稿保留與登出提示） | `settings_screen.dart` `_logout` | 登出前明確告知，草稿保留不自動入帳 |
| 7.2（iOS 建置檢查與簽署分離） | `.github/workflows/ios-build.yml` | `verify`（免憑證）與 `archive`（需憑證）兩條路徑 |
| 10（離線照片待決） | `OfflineDraftStore.persistPhotos` | 實作為保留副本 + UI 提示「N 張照片待補上傳」，**待維護者定案** |

### 13.3 尚未完成且需維護者處理

- 依 8.1 判定個人開發者身份是否適用本產品（**可能阻擋上架**）。
- 依 8.2 釐清 AGPL-3.0 與 App Store 條款的相容性（**可能阻擋上架**）。
- 第 10 節的待決事項：Widget 尺寸、離線草稿的照片處理、草稿保留期限、
  語言與上架地區、每週投入與預算、TestFlight 驗收配置。
- 依 `docs/ios-release-checklist.md` 第 1.2 節完成 33 項實機驗收。
- 加入 Apple Developer Program、匯出憑證與描述檔、設定 App Store Connect。
- VoiceOver 與放大字級的完整驗收（見功能矩陣第 13 節，標記為「待補」）。
- **補上 `apple-app-site-association` 的 Team ID**
  （見上方註記 8）。驗證檔已建立，但 `appID` 的 Team ID 仍是 `TEAM_ID`
  佔位符，需在加入 Apple Developer Program 後替換。
  另需確認 `asset.shao.one` 的部署環境能提供 `Content-Type:
  application/json` 且不經轉址。

### 13.4 模擬器驗收的環境限制

本節記錄**在無 GUI 的 macOS 環境**（無 `Simulator.app`）下能驗收到什麼、
不能驗收到什麼，避免把「已驗證」誤讀成「已通過實機驗收」。

| 項目 | 狀態 | 說明 |
| --- | --- | --- |
| App 啟動、UI 繪製 | ✅ 已驗證 | App 可安裝、啟動，Dart VM 服務啟動，畫面以 Impeller Metal 繪製（像素分析確認非空白） |
| 登入頁 iOS 副標 | ✅ 已驗證 | 顯示「資產管理 · iOS 客戶端」，不再顯示「安卓客戶端」 |
| 深層連結的 Dart↔原生往返 | ✅ 已驗證 | 整合測試由 App 開啟自己的 URL scheme，確認連結經 `SceneDelegate` → `DeepLinkChannel` → 事件通道回到 Dart 層（`integration_test/deep_link_e2e_test.dart`） |
| 深層連結的佇列規則 | ✅ 已驗證 | 原生 XCTest 33 項涵蓋依 host 分取、去重、取出即移除、補送，以及 Apple 授權 nonce 的雜湊方向 |
| **由「外部」注入連結** | ⚠️ 受環境限制 | `xcrun simctl openurl` 會觸發 SpringBoard 的「要在『AssetPilot』中打開嗎？」確認提示；headless 環境沒有 UI 宿主可點「打開」，連結因此送不到 App。**需在有 `Simulator.app` 的環境或實機上驗收**。 |
| Widget 實際出現在主畫面 | ⚠️ 受環境限制 | 擴充已正確嵌入（`Runner.app/PlugIns/AssetPilotWidget.appex`），但 Widget 的呈現、尺寸與互動需在有 GUI 的環境確認 |
| Siri／語音捷徑 | ⚠️ 受環境限制 | App Intents metadata 已產出（可被索引），但實際叫喚 Siri 需實機 |
| Apple 登入 | ⚠️ 受環境限制 | 需要真實的 Apple 帳號與有效的 App ID；模擬器上的 ASAuthorization 流程不完整 |
| 推播通知、遠端設定 | ⚠️ 未實作 | 本計畫範圍外 |

> **建議的實機驗收順序**：先在有 `Simulator.app` 的 macOS 上跑
> `flutter test integration_test -d <udid>`，再用實機確認
> Widget、Siri 與 Apple 登入。

## 14. 官方參考資料

以下資料於本次規劃時查閱；送審時需再次核對最新版本。政策與授權段落是開發規劃提示，不是法律意見或 Apple 預先核准。

1. [Apple Developer Program：申請身份、個人賣家名稱與費用](https://developer.apple.com/programs/enroll/)
2. [App Review Guidelines：3.2.1(viii)、4.8、5.1.1、5.1.2](https://developer.apple.com/app-store/review/guidelines/)
3. [Flutter：發佈 iOS App 至 TestFlight／App Store](https://docs.flutter.dev/deployment/ios)
4. [Apple WidgetKit：Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
5. [Apple App Intents](https://developer.apple.com/documentation/appintents)
