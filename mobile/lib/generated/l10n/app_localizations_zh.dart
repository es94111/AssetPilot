// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get commonSave => '儲存';

  @override
  String get commonCancel => '取消';

  @override
  String get commonDelete => '刪除';

  @override
  String get commonEdit => '編輯';

  @override
  String get commonConfirm => '確認';

  @override
  String get commonClose => '關閉';

  @override
  String get commonLoading => '載入中…';

  @override
  String get commonAdd => '新增';

  @override
  String get commonBack => '返回';

  @override
  String get commonSearch => '搜尋';

  @override
  String get commonLanguage => '語言';

  @override
  String get commonClear => '清除';

  @override
  String get commonSaving => '儲存中...';

  @override
  String get commonConfirmDelete => '確認刪除';

  @override
  String get commonPreviousPage => '上一頁';

  @override
  String get commonNextPage => '下一頁';

  @override
  String commonTotalRecords(Object count) {
    return '共 $count 筆';
  }

  @override
  String get commonPerPage => '每頁';

  @override
  String commonRecordsUnit(Object count) {
    return '$count 筆';
  }

  @override
  String get commonNoData => '尚無資料';

  @override
  String get navSectionsFinance => '財務管理';

  @override
  String get navSectionsStocks => '股票投資';

  @override
  String get navSectionsSystem => '系統設定';

  @override
  String get navDashboard => '儀表板';

  @override
  String get navTransactions => '交易記錄';

  @override
  String get navReports => '統計報表';

  @override
  String get navBudget => '預算管理';

  @override
  String get navInfoBoard => '資訊版';

  @override
  String get navAccounts => '帳戶管理';

  @override
  String get navCategories => '分類管理';

  @override
  String get navRecurring => '固定收支';

  @override
  String get navStocksPortfolio => '持股總覽';

  @override
  String get navStocksTransactions => '股票交易紀錄';

  @override
  String get navStocksDividends => '股利紀錄';

  @override
  String get navStocksRealized => '實現損益';

  @override
  String get navStocksSettings => '股票設定';

  @override
  String get navExportImport => '資料匯出匯入';

  @override
  String get navAccount => '帳號設定';

  @override
  String get navApiCredits => 'API 授權';

  @override
  String get navAdmin => '管理員';

  @override
  String get navTitleStocks => '持股總覽';

  @override
  String get navTitleStockTransactions => '股票交易紀錄';

  @override
  String get navTitleStockDividends => '股票股利紀錄';

  @override
  String get navTitleStockRealized => '股票實現損益';

  @override
  String get navTitleStockSettings => '股票交易設定';

  @override
  String get navTitleApiCredits => 'API 使用與授權';

  @override
  String get shellFallbackUser => '使用者';

  @override
  String get shellLogout => '登出';

  @override
  String get shellVersionInfo => '版本資訊';

  @override
  String get shellOpenMenu => '開啟選單';

  @override
  String get shellSkipToContent => '跳至主要內容';

  @override
  String get shellThemeLight => '亮色';

  @override
  String get shellThemeSystem => '系統';

  @override
  String get shellThemeDark => '暗色';

  @override
  String get shellChangelogLoading => '正在讀取版本資訊...';

  @override
  String get shellChangelogLoadFailed => '讀取版本資訊失敗';

  @override
  String get shellChangelogUnknownVersion => '未知';

  @override
  String get shellChangelogCurrentVersion => '目前版本';

  @override
  String get shellChangelogUpdatableVersion => '可更新版本';

  @override
  String get shellChangelogUpToDate => '已是最新版本';

  @override
  String get shellChangelogUpdatableContent => '可更新內容';

  @override
  String get shellChangelogRecentContent => '最近更新內容';

  @override
  String get authLoginTab => '登入';

  @override
  String get authRegisterTab => '註冊';

  @override
  String get authSubtitleLogin => '歡迎回來，請登入您的帳號';

  @override
  String get authSubtitleRegister => '建立您的帳號，開始記帳';

  @override
  String get authEmailLabel => '電子信箱';

  @override
  String get authPasswordLabel => '密碼';

  @override
  String get authPasswordPlaceholder => '請輸入密碼';

  @override
  String get authDisplayNameLabel => '顯示名稱';

  @override
  String get authDisplayNamePlaceholder => '您的暱稱';

  @override
  String get authRegisterPasswordPlaceholder => '至少 8 位，含大小寫英文與數字';

  @override
  String get authTogglePassword => '切換密碼顯示';

  @override
  String get authTurnstileAria => 'Cloudflare Turnstile 真人驗證';

  @override
  String get authLoginButton => '登入';

  @override
  String get authLoggingIn => '登入中…';

  @override
  String get authPasskeyButton => '使用 Passkey 登入';

  @override
  String get authPasskeyVerifying => 'Passkey 驗證中…';

  @override
  String get authGoogleButton => '使用 Google 登入';

  @override
  String get authGoogleVerifying => 'Google 驗證中…';

  @override
  String get authLineButton => '使用 LINE 登入';

  @override
  String get authLineVerifying => 'LINE 驗證中…';

  @override
  String get authRegisterSubmit => '立即註冊';

  @override
  String get authRegistering => '註冊中…';

  @override
  String get authLineCallbackCompleting => '正在完成 LINE 驗證...';

  @override
  String get authLineCallbackMissingCode => 'LINE 未回傳授權碼，請重新操作';

  @override
  String get authLineCallbackLinkFailed => 'LINE 綁定失敗';

  @override
  String get authLineCallbackLoginFailed => 'LINE 登入失敗';

  @override
  String get authLineCallbackVerifyFailed => 'LINE 驗證失敗';

  @override
  String get authErrorsTurnstileRequired => '請先完成真人驗證';

  @override
  String get authErrorsLoginFailed => '登入失敗';

  @override
  String get authErrorsRegisterFailed => '註冊失敗';

  @override
  String get authErrorsGoogleNotConfigured => 'Google 登入尚未設定完成';

  @override
  String get authErrorsGoogleComponentNotLoaded => 'Google 登入元件尚未載入';

  @override
  String get authErrorsGoogleStateFailed => '無法建立 Google 登入狀態';

  @override
  String get authErrorsGoogleNoCode => '未收到 Google 授權碼';

  @override
  String get authErrorsGoogleFailed => 'Google 登入失敗';

  @override
  String get authErrorsGoogleCancelled => 'Google 登入已取消';

  @override
  String get authErrorsPasskeyUnsupported => '此瀏覽器不支援 Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed => '無法建立 Passkey 登入挑戰';

  @override
  String get authErrorsPasskeyFailed => 'Passkey 登入失敗';

  @override
  String get authErrorsLineNotConfigured => 'LINE 登入尚未設定完成';

  @override
  String get authErrorsLineFailed => 'LINE 登入失敗';

  @override
  String get settingsTitle => '設定';

  @override
  String get settingsLanguageTitle => '語言';

  @override
  String get settingsLanguageDescription => '選擇介面與通知（Email／LINE）使用的語言。';

  @override
  String get settingsLanguageSaved => '語言偏好已更新';

  @override
  String get settingsAccountTitle => '帳號設定';

  @override
  String get settingsAccountProfileInfo => '帳號資訊';

  @override
  String get settingsAccountEmail => '電子郵件';

  @override
  String get settingsAccountDisplayName => '顯示名稱';

  @override
  String get settingsAccountEditDisplayName => '修改顯示名稱';

  @override
  String get settingsAccountUpdateName => '更新名稱';

  @override
  String get settingsAccountSaving => '儲存中...';

  @override
  String get settingsAccountSetLocalPassword => '設定本機密碼';

  @override
  String get settingsAccountChangePassword => '修改密碼';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      '目前帳號僅支援第三方登入。設定本機密碼後，即可使用電子信箱與密碼登入。';

  @override
  String get settingsAccountCurrentPassword => '目前密碼';

  @override
  String get settingsAccountNewPassword => '新密碼';

  @override
  String get settingsAccountConfirmNewPassword => '確認新密碼';

  @override
  String get settingsAccountPasswordPlaceholder => '至少8碼，含大小寫英文、數字、特殊符號';

  @override
  String get settingsAccountUpdating => '更新中...';

  @override
  String get settingsAccountSetPassword => '設定密碼';

  @override
  String get settingsAccountUpdatePassword => '更新密碼';

  @override
  String get settingsAccountThemeTitle => '顯示主題';

  @override
  String get settingsAccountThemeSystem => '跟隨系統';

  @override
  String get settingsAccountThemeLight => '淺色模式';

  @override
  String get settingsAccountThemeDark => '深色模式';

  @override
  String get settingsAccountDefaultCurrency => '預設貨幣';

  @override
  String get settingsAccountCurrencyCode => '幣別代碼';

  @override
  String get settingsAccountUpdateDefaultCurrency => '更新預設貨幣';

  @override
  String get settingsAccountPasskeyTitle => 'Passkey 管理';

  @override
  String get settingsAccountNoPasskeys => '尚未註冊任何 Passkey';

  @override
  String get settingsAccountAddPasskey => '+ 新增 Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Google 綁定';

  @override
  String get settingsAccountLineTitle => 'LINE 綁定';

  @override
  String get settingsAccountStatusPrefix => '目前狀態：';

  @override
  String get settingsAccountLinkedGoogle => '已綁定 Google 帳號';

  @override
  String get settingsAccountNotLinkedGoogle => '尚未綁定 Google 帳號';

  @override
  String get settingsAccountLinkGoogle => '綁定 Google 帳號';

  @override
  String get settingsAccountUnlink => '解除綁定';

  @override
  String get settingsAccountLinkedLine => '已綁定 LINE 帳號';

  @override
  String get settingsAccountNotLinkedLine => '尚未綁定 LINE 帳號';

  @override
  String get settingsAccountLinkLine => '綁定 LINE 帳號';

  @override
  String get settingsAccountLineVerifying => 'LINE 驗證中…';

  @override
  String get settingsAccountSessionsTitle => '目前登入裝置';

  @override
  String get settingsAccountRefresh => '重新整理';

  @override
  String get settingsAccountDeviceName => '裝置名稱';

  @override
  String get settingsAccountLoginTime => '登入時間';

  @override
  String get settingsAccountLoginIp => '登入 IP';

  @override
  String get settingsAccountActions => '操作';

  @override
  String get settingsAccountUnknownDevice => '未知裝置';

  @override
  String get settingsAccountCurrentDeviceSuffix => '（目前裝置）';

  @override
  String get settingsAccountSignOut => '登出';

  @override
  String get settingsAccountNoSessions => '尚無登入裝置紀錄';

  @override
  String get settingsAccountAuditTitle => '登入稽核紀錄';

  @override
  String get settingsAccountCountry => '國家';

  @override
  String get settingsAccountMethod => '方式';

  @override
  String get settingsAccountDevice => '裝置';

  @override
  String get settingsAccountAdminLogin => '管理員登入';

  @override
  String get settingsAccountYes => '是';

  @override
  String get settingsAccountNo => '否';

  @override
  String get settingsAccountDeleteTitle => '刪除帳號';

  @override
  String get settingsAccountDeleteDescription =>
      '刪除帳號後，您的交易、帳戶、股票、Passkey 與設定資料都會永久移除，且無法復原。';

  @override
  String get settingsAccountDeleteButton => '刪除我的帳號';

  @override
  String get settingsAccountDeleteModalTitle => '確認刪除帳號';

  @override
  String get settingsAccountDeleteModalWarning =>
      '此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票、Passkey 與設定），且無法復原。';

  @override
  String get settingsAccountDeletePasswordLabel => '請輸入密碼以確認刪除';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return '請輸入您的帳號電子信箱「$email」以確認刪除';
  }

  @override
  String get settingsAccountDeleting => '刪除中…';

  @override
  String get settingsAccountDeletePermanently => '永久刪除帳號';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired => '請輸入目前密碼';

  @override
  String get settingsAccountMessagesNewPasswordRequired => '請輸入新密碼';

  @override
  String get settingsAccountMessagesPasswordTooShort => '新密碼長度至少 8 字元';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      '新密碼需包含大寫字母、小寫字母、數字與特殊符號';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch => '兩次輸入的新密碼不一致';

  @override
  String get settingsAccountMessagesLocalPasswordSet => '密碼已設定，現在可使用密碼登入';

  @override
  String get settingsAccountMessagesPasswordUpdated => '密碼已更新';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed => '更新密碼失敗';

  @override
  String get settingsAccountMessagesDisplayNameRequired => '顯示名稱不可空白';

  @override
  String get settingsAccountMessagesDisplayNameUpdated => '顯示名稱已更新';

  @override
  String get settingsAccountMessagesUpdateFailed => '更新失敗';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm => '確定要刪除此 Passkey 嗎？';

  @override
  String get settingsAccountMessagesCurrencyInvalid => '幣別格式需為 3 碼英文字母';

  @override
  String get settingsAccountMessagesCurrencyUpdated => '預設貨幣已更新';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed => '更新預設貨幣失敗';

  @override
  String get settingsAccountMessagesSessionLoggedOut => '已登出該裝置';

  @override
  String get settingsAccountMessagesSessionLogoutFailed => '登出裝置失敗';

  @override
  String get settingsAccountMessagesPasskeyUnsupported => '此瀏覽器不支援 Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Android 裝置';

  @override
  String get settingsAccountMessagesComputerDevice => '電腦';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed => 'Passkey 註冊失敗';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      '請貼上 Google ID Token 以模擬綁定流程';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Google 帳號已綁定';

  @override
  String get settingsAccountMessagesGoogleLinkFailed => 'Google 綁定失敗';

  @override
  String get settingsAccountMessagesGoogleUnlinked => 'Google 帳號已解除綁定';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed => 'Google 解除綁定失敗';

  @override
  String get settingsAccountMessagesLineNotConfigured => 'LINE 登入尚未設定完成';

  @override
  String get settingsAccountMessagesLineLinkFailed => 'LINE 綁定失敗';

  @override
  String get settingsAccountMessagesLineUnlinked => 'LINE 帳號已解除綁定';

  @override
  String get settingsAccountMessagesLineUnlinkFailed => 'LINE 解除綁定失敗';

  @override
  String get settingsAccountMessagesDeletePasswordRequired => '請輸入密碼以確認刪除';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch => '請輸入正確的帳號電子信箱以確認刪除';

  @override
  String get settingsAccountMessagesDeleteFailed => '刪除帳號失敗';

  @override
  String get dashboardTitle => '儀表板';

  @override
  String dashboardSubtitle(Object month) {
    return '$month 的收支摘要、分類分布與最近交易。';
  }

  @override
  String get dashboardUncategorized => '未分類';

  @override
  String get dashboardKpiTotalIncome => '總收入';

  @override
  String get dashboardKpiTotalExpense => '總支出';

  @override
  String get dashboardKpiNet => '淨額';

  @override
  String get dashboardKpiTodayExpense => '今日支出';

  @override
  String get dashboardKpiBankAccounts => '銀行帳戶';

  @override
  String get dashboardKpiStockMarketValue => '股票總市值';

  @override
  String get dashboardOverviewTitle => '本月收支概覽';

  @override
  String get dashboardOverviewBalance => '本月結餘';

  @override
  String get dashboardOverviewDeficit => '本月赤字';

  @override
  String get dashboardOverviewIncome => '收入';

  @override
  String get dashboardOverviewExpense => '支出';

  @override
  String get dashboardOverviewNet => '淨額';

  @override
  String get dashboardRatioTitle => '收支比例';

  @override
  String get dashboardRatioIncomeShare => '收入佔比';

  @override
  String get dashboardRatioExpenseShare => '支出佔比';

  @override
  String get dashboardSectionsExpenseCategories => '支出分類';

  @override
  String get dashboardSectionsIncomeCategories => '收入分類';

  @override
  String get dashboardSectionsRecentTransactions => '最近交易';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return '最近 $count 筆';
  }

  @override
  String get dashboardEmptyNoExpense => '本月尚無支出資料';

  @override
  String get dashboardEmptyNoIncome => '本月尚無收入資料';

  @override
  String get dashboardEmptyNoTransactions => '本月尚無交易資料';

  @override
  String get dashboardTableDate => '日期';

  @override
  String get dashboardTableCategory => '分類';

  @override
  String get dashboardTableNote => '備註';

  @override
  String get dashboardTableAmount => '金額';

  @override
  String get dashboardFiltersPreviousMonth => '上一月';

  @override
  String get dashboardFiltersNextMonth => '下一月';

  @override
  String get dashboardFiltersCurrentMonth => '本月';

  @override
  String get publicCommonBackHome => '返回首頁';

  @override
  String get publicCommonPrivacy => '隱私權政策';

  @override
  String get publicCommonTerms => '服務條款';

  @override
  String get publicCommonApiCredits => 'API 使用與授權';

  @override
  String publicCommonLastUpdated(Object date) {
    return '最後更新日期：$date';
  }

  @override
  String get publicCommonMetadataTitle => 'AssetPilot - 個人財務指揮中心';

  @override
  String get publicCommonMetadataDescription =>
      '自架、加密的個人財務管理工具，整合記帳、預算、台股投資與報表分析。';

  @override
  String get publicCommonDatesApiCredits => '2026 年 6 月 11 日';

  @override
  String get publicCommonDatesPrivacy => '2026 年 6 月 17 日';

  @override
  String get publicCommonDatesTerms => '2026 年 6 月 11 日';

  @override
  String get publicHomeTagline => '個人財務指揮中心';

  @override
  String get publicHomeLogin => '立即登入';

  @override
  String get publicHomeRegister => '建立帳號';

  @override
  String get publicHomeBadge => '自托管、資料加密、AGPL v3';

  @override
  String get publicHomeHeadline1 => '你的財務指揮中心';

  @override
  String get publicHomeHeadline2 => '從首頁就能先看清楚';

  @override
  String get publicHomeLeadBefore => '整合台股投資、收支記帳、預算追蹤、報表分析與資料稽核。所有財務資料以';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter => '加密落地，不綁雲端、不靠訂閱，先理解產品，再決定是否登入。';

  @override
  String get publicHomeStartUsing => '開始使用';

  @override
  String get publicHomeCreateFirst => '先建立帳號';

  @override
  String get publicHomeChipsOpenSource => '開源 AGPL v3';

  @override
  String get publicHomeChipsEncrypted => '本地加密儲存';

  @override
  String get publicHomeChipsNoCloudLock => '不綁外部雲端';

  @override
  String get publicHomeChipsDocker => 'Docker 一行部署';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => '核心模組';

  @override
  String get publicHomeStatsModulesSublabel => '記帳、股票、報表、治理';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => '資料加密';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => '股價來源';

  @override
  String get publicHomeStatsStockSourceSublabel => '盤中、盤後、備援策略';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => '精度計算';

  @override
  String get publicHomeStatsPrecisionSublabel => 'decimal.js 逐筆損益';

  @override
  String get publicHomePreLoginNote =>
      '未登入也能先了解 AssetPilot 的功能、資料處理方式與部署特性，再選擇登入或建立帳號。';

  @override
  String get publicHomeWhyLabel => 'Why AssetPilot';

  @override
  String get publicHomeWhyTitle => '把日常記帳、投資追蹤與資料掌控放在同一個地方';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot 專為自主管理個人財務而設計，從收支、預算到台股投資都能集中整理，並保留資料匯出、稽核與自架部署的彈性。';

  @override
  String get publicHomePillarsFinanceTitle => '收支與預算管理';

  @override
  String get publicHomePillarsFinanceTag => '記帳核心';

  @override
  String get publicHomePillarsFinanceItemsOne => '多帳戶餘額追蹤與跨帳戶轉帳';

  @override
  String get publicHomePillarsFinanceItemsTwo => '月度與分類預算進度條控管';

  @override
  String get publicHomePillarsFinanceItemsThree => '固定收支自動產生交易';

  @override
  String get publicHomePillarsFinanceItemsFour => '批次調整分類、日期與刪除';

  @override
  String get publicHomePillarsStocksTitle => '台股投資追蹤';

  @override
  String get publicHomePillarsStocksTag => '股票模組';

  @override
  String get publicHomePillarsStocksItemsOne => 'TWSE 股價查詢與除權息同步';

  @override
  String get publicHomePillarsStocksItemsTwo => 'FIFO 全精度實現損益計算';

  @override
  String get publicHomePillarsStocksItemsThree => '股利紀錄與帳戶入款追蹤';

  @override
  String get publicHomePillarsStocksItemsFour => '定期定額與下市標記管理';

  @override
  String get publicHomePillarsSecurityTitle => '安全與資料治理';

  @override
  String get publicHomePillarsSecurityTag => '治理能力';

  @override
  String get publicHomePillarsSecurityItemsOne => 'ChaCha20-Poly1305 落地加密';

  @override
  String get publicHomePillarsSecurityItemsTwo => '帳密、Google、Passkey 三種登入';

  @override
  String get publicHomePillarsSecurityItemsThree => '匯出匯入、備份還原與稽核日誌';

  @override
  String get publicHomePillarsSecurityItemsFour => 'Rate limit、CSP 與 CSV 防注入保護';

  @override
  String get publicHomePillarsSelfHostedTitle => '自架部署與契約';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne => 'Docker 一行啟動';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => '支援 amd64 與 arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree => 'OpenAPI 3.2 契約文件';

  @override
  String get publicHomePillarsSelfHostedItemsFour => 'URL-first 路由，可直接書籤與重整';

  @override
  String get publicHomeQuickStartLabel => 'Quick Start';

  @override
  String get publicHomeQuickStartTitle => '60 秒跑在你自己的伺服器';

  @override
  String get publicHomeQuickStartDescription =>
      '使用 Docker 快速啟動，首次執行會自動產生 JWT 與資料庫加密金鑰。支援 amd64、arm64，適合部署在 NAS、VPS 或自己的 Docker 主機上。';

  @override
  String get publicHomeQuickStartChipsImage => '約 180 MB 映像';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => '內建健康檢查';

  @override
  String get publicHomeQuickStartChipsKeys => '金鑰首次啟動自動產生';

  @override
  String get publicHomeTechLabel => 'Tech Stack';

  @override
  String get publicHomeTechTitle => '技術堆疊與公開資訊入口';

  @override
  String get publicHomeTechDescription =>
      '清楚列出主要技術、外部資料來源與授權資訊，讓使用者在開始使用前就能掌握服務如何運作。';

  @override
  String get publicHomeFooter => 'GNU AGPL v3，個人資產管理，自架、自控、自備份。';

  @override
  String get publicApiCreditsPageTitle => 'API 使用與授權';

  @override
  String get publicApiCreditsPageMetadataTitle => 'API 使用與授權 — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => '外部 API 透明揭露';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot 僅在功能需要時連線至外部資料來源。這裡列出各項 API 的用途、授權資訊與資料傳送範圍，方便自行部署時確認合規狀態。';

  @override
  String get publicApiCreditsPageStatsExternalServices => '外部服務';

  @override
  String get publicApiCreditsPageStatsFreeSupported => '支援免費';

  @override
  String get publicApiCreditsPageStatsAttributionRequired => '需標示來源';

  @override
  String get publicApiCreditsPageServiceKindsData => '資料查詢';

  @override
  String get publicApiCreditsPageServiceKindsAuth => '身份驗證';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Email 通道';

  @override
  String get publicApiCreditsPageServiceKindsBackup => '雲端備份';

  @override
  String get publicApiCreditsPageTransparencyTitle => '資料透明度';

  @override
  String get publicApiCreditsPageTransparencyText =>
      '下列情境只傳送完成該功能所需的最小資料，不會把你的財務明細交給第三方服務。';

  @override
  String get publicApiCreditsPageMinNecessary => '最小必要資料原則';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => '匯率同步';

  @override
  String get publicApiCreditsPageUsageNotesFxText => '只查詢公開匯率資料，不會送出個人財務明細。';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle => '台股資料';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      '僅帶股票代號與市場資料，不包含帳戶、持股成本或交易紀錄。';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => '登入稽核';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo 僅用於登入紀錄中的國家資訊顯示。';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => '第三方登入';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google、LINE 登入僅在主動登入或綁定時啟用。';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => '雲端備份';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4 僅在管理員主動上傳備份時接收整檔資料庫檔案。';

  @override
  String get publicApiCreditsPageServiceListTitle => '外部服務清單';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return '共 $total 項服務，其中 $free 項支援免費方案，$paid 項可使用付費方案。';
  }

  @override
  String get publicApiCreditsPageOfficialSite => '官方網站';

  @override
  String get publicApiCreditsPageFreePlan => '免費方案';

  @override
  String get publicApiCreditsPagePaidPlan => '付費方案';

  @override
  String get publicApiCreditsPageSupported => '支援';

  @override
  String get publicApiCreditsPageUnavailable => '未提供';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate => '全球即時匯率（基礎貨幣 TWD）';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo => 'IP 位址地理位置查詢（登入稽核國家欄位）';

  @override
  String get publicApiCreditsPageDescriptionsTwse => '股票即時報價、除權息資料、股票名稱查詢';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Google SSO 登入';

  @override
  String get publicApiCreditsPageDescriptionsLine => 'LINE 登入與帳號綁定';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Email 寄送通道（管理員資產統計報表，搭配 Gmail / Outlook 等 SMTP server）';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Email 寄送通道（管理員資產統計報表，HTTP REST API）';

  @override
  String get publicApiCreditsPageDescriptionsResend => 'Email 寄送通道（管理員資產統計報表）';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      '管理員整檔 PostgreSQL SQL 備份的 S3 相容物件儲存目的地';

  @override
  String get publicAppCallbackReturningTitle => '正在返回 AssetPilot App...';

  @override
  String get publicAppCallbackReturningBody =>
      '如果沒有自動返回，請確認已安裝最新版 AssetPilot Android App。';

  @override
  String get publicAppCallbackPasskeyTitle => 'AssetPilot Passkey 登入';

  @override
  String get publicAppCallbackPasskeyStarting => '正在啟動 Passkey 登入...';

  @override
  String get publicAppCallbackPasskeyUnsupported => '此瀏覽器不支援 Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed => '無法建立 Passkey 登入挑戰';

  @override
  String get publicAppCallbackPasskeyVerify => '請完成裝置上的 Passkey 驗證...';

  @override
  String get publicAppCallbackPasskeyLoginFailed => 'Passkey 登入失敗';

  @override
  String get publicAppCallbackReturningApp => '正在返回 App...';

  @override
  String get publicAppCallbackAppTicketFailed => '無法建立 App 登入憑證';

  @override
  String get featuresCommonActions => '操作';

  @override
  String get featuresCommonAccount => '帳戶';

  @override
  String get featuresCommonAmount => '金額';

  @override
  String get featuresCommonDate => '日期';

  @override
  String get featuresCommonEndDate => '結束';

  @override
  String get featuresCommonNote => '備註';

  @override
  String get featuresCommonStartDate => '起始';

  @override
  String get featuresCommonStatus => '狀態';

  @override
  String get featuresCommonStock => '股票';

  @override
  String get featuresCommonType => '類型';

  @override
  String get featuresCommonName => '名稱';

  @override
  String get featuresCommonCurrency => '幣別';

  @override
  String get featuresCommonExchangeRate => '匯率';

  @override
  String get featuresCommonIncome => '收入';

  @override
  String get featuresCommonExpense => '支出';

  @override
  String get featuresCommonUncategorized => '未分類';

  @override
  String get featuresCommonUnspecified => '未指定';

  @override
  String get featuresCommonAutoCalculate => '自動計算';

  @override
  String get featuresCommonExcludeFromStats => '不計入統計';

  @override
  String get featuresCommonTopLevelCategory => '— 頂層分類 —';

  @override
  String get featuresCommonNotRecorded => '—';

  @override
  String get featuresCategoriesTitle => '分類管理';

  @override
  String get featuresCategoriesExpenseTab => '支出分類';

  @override
  String get featuresCategoriesIncomeTab => '收入分類';

  @override
  String get featuresCategoriesAddCategory => '新增分類';

  @override
  String get featuresCategoriesEditCategory => '編輯分類';

  @override
  String get featuresCategoriesNewCategory => '新增分類';

  @override
  String get featuresCategoriesNameLabel => '名稱 *';

  @override
  String get featuresCategoriesTypeLabel => '類型';

  @override
  String get featuresCategoriesParentLabel => '父分類';

  @override
  String get featuresCategoriesColorLabel => '顏色';

  @override
  String get featuresCategoriesExpense => '支出';

  @override
  String get featuresCategoriesIncome => '收入';

  @override
  String get featuresCategoriesDeleteMessage => '確定要刪除此分類嗎？其子分類也將一併刪除。';

  @override
  String get featuresCategoriesMessagesNameRequired => '請輸入分類名稱';

  @override
  String get featuresCategoriesMessagesDeleteFailed => '刪除失敗';

  @override
  String get featuresBudgetTitle => '預算管理';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$year 年 $month 月';
  }

  @override
  String get featuresBudgetTotalBudget => '本月總預算';

  @override
  String get featuresBudgetSpent => '已使用';

  @override
  String get featuresBudgetAddBudget => '新增預算';

  @override
  String get featuresBudgetEditBudget => '編輯預算';

  @override
  String get featuresBudgetNewBudget => '新增預算';

  @override
  String get featuresBudgetCategoryLabel => '分類（留空為總預算）';

  @override
  String get featuresBudgetTotalBudgetOption => '— 總預算 —';

  @override
  String get featuresBudgetAmountLabel => '預算金額 *';

  @override
  String get featuresBudgetTotalBudgetName => '（總預算）';

  @override
  String get featuresBudgetOverBudget => '超出預算';

  @override
  String get featuresBudgetDeleteMessage => '確定要刪除此預算設定嗎？';

  @override
  String get featuresBudgetMessagesAmountRequired => '請輸入有效預算金額';

  @override
  String get featuresReportsTitle => '統計報表';

  @override
  String get featuresReportsTabsCategory => '分類統計';

  @override
  String get featuresReportsTabsTrend => '趨勢分析';

  @override
  String get featuresReportsTabsDaily => '每日消費';

  @override
  String get featuresReportsPeriodsThisMonth => '本月';

  @override
  String get featuresReportsPeriodsLastMonth => '上月';

  @override
  String get featuresReportsPeriodsLast3 => '近3個月';

  @override
  String get featuresReportsPeriodsLast6 => '近6個月';

  @override
  String get featuresReportsPeriodsThisYear => '今年';

  @override
  String get featuresReportsPeriodsCustom => '自訂';

  @override
  String get featuresReportsPeriodLabel => '期間';

  @override
  String get featuresReportsStart => '開始';

  @override
  String get featuresReportsEnd => '結束';

  @override
  String get featuresReportsCurrentTotal => '本期合計';

  @override
  String get featuresReportsComparedPrevious => '相較前期';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta，前期無資料';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return '$type明細';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return '合計：$amount';
  }

  @override
  String get featuresReportsSelectedCategory => '已選取分類：';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return '，金額 $amount';
  }

  @override
  String get featuresReportsViewTransactions => '查看對應交易';

  @override
  String get featuresRecurringTitle => '固定收支';

  @override
  String get featuresRecurringAdd => '新增固定收支';

  @override
  String get featuresRecurringEdit => '編輯固定收支';

  @override
  String get featuresRecurringCreate => '新增固定收支';

  @override
  String get featuresRecurringAmountLabel => '金額 *';

  @override
  String get featuresRecurringFxFeeLabel => '海外手續費（TWD）';

  @override
  String get featuresRecurringFxFeePlaceholder => '留空則由系統依卡片費率自動計算';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return '卡片海外手續費率 $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return '，建議值 NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading => '查詢最新匯率中...';

  @override
  String get featuresRecurringCategory => '分類';

  @override
  String get featuresRecurringFrequency => '頻率';

  @override
  String get featuresRecurringStartDate => '起始日期';

  @override
  String featuresRecurringNextRun(Object date) {
    return '下次執行：$date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return '分類：$name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return '帳戶：$name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return '海外手續費：NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => '確定要刪除此固定收支設定嗎？';

  @override
  String get featuresRecurringCreatingTransfer => '建立中...';

  @override
  String get featuresRecurringConfirmTransfer => '確認轉帳';

  @override
  String get featuresRecurringFrequencyLabelsDaily => '每日';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => '每週';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => '每月';

  @override
  String get featuresRecurringFrequencyLabelsYearly => '每年';

  @override
  String get featuresRecurringMessagesAmountRequired => '請輸入有效金額';

  @override
  String get featuresDataTransferTitle => '資料匯出匯入';

  @override
  String get featuresDataTransferExportStartDate => '匯出起始日';

  @override
  String get featuresDataTransferExportEndDate => '匯出結束日';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return '支援 CSV 匯出與匯入。欄位：$columns';
  }

  @override
  String get featuresDataTransferExportCsv => '匯出 CSV';

  @override
  String get featuresDataTransferExporting => '匯出中...';

  @override
  String get featuresDataTransferChooseCsv => '選擇 CSV 匯入';

  @override
  String get featuresDataTransferImporting => '匯入中...';

  @override
  String featuresDataTransferImported(Object count) {
    return '匯入成功：$count 筆';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return '略過：$count 筆';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return '自動建立分類：$items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return '自動建立帳戶：$items';
  }

  @override
  String get featuresDataTransferWarning => '警告';

  @override
  String get featuresDataTransferError => '錯誤';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return '第 $row 列：$reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => '帳戶';

  @override
  String get featuresDataTransferModulesTransactions => '交易記錄';

  @override
  String get featuresDataTransferModulesCategories => '分類';

  @override
  String get featuresDataTransferModulesStockTransactions => '股票交易';

  @override
  String get featuresDataTransferModulesStockDividends => '股利紀錄';

  @override
  String get featuresDataTransferMessagesExportSuccess => '匯出成功';

  @override
  String get featuresDataTransferMessagesExportFailed => '匯出失敗';

  @override
  String get featuresDataTransferMessagesEmptyCsv => 'CSV 沒有可匯入資料';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return '$name 匯入完成';
  }

  @override
  String get featuresDataTransferMessagesImportFailed => '匯入失敗';

  @override
  String get featuresDataTransferMessagesBundleExportDone => '完整備份下載完成';

  @override
  String get featuresDataTransferMessagesBundleExportFailed => '完整備份下載失敗';

  @override
  String get featuresDataTransferMessagesRestoreDone => '還原完成';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed => '備份還原失敗';

  @override
  String get featuresDataTransferMessagesDbExportDone => '資料庫備份下載完成';

  @override
  String get featuresDataTransferMessagesDbExportFailed => '資料庫備份失敗';

  @override
  String get featuresDataTransferMessagesDbRestoreDone => '資料庫還原成功';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed => '資料庫還原失敗';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return '已上傳至 $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed => 'MEGA S4 備份失敗';

  @override
  String get featuresDataTransferMessagesRequireOneField => '請至少填寫一個欄位';

  @override
  String get featuresDataTransferMessagesSaved => '設定已儲存';

  @override
  String get featuresDataTransferMessagesSaveFailed => '設定儲存失敗';

  @override
  String get featuresDataTransferBundleTitle => '完整資料備份（含圖片）';

  @override
  String get featuresDataTransferBundleDescription1 =>
      '一鍵打包下載你個人的全部資料（交易、帳戶、分類、預算、週期、匯率、股票，以及交易憑證圖片）為單一 ZIP。';

  @override
  String get featuresDataTransferBundleDescription2 => '上傳同一份 ZIP 即可還原。';

  @override
  String get featuresDataTransferBundleRestorePrefix => '還原採';

  @override
  String get featuresDataTransferBundleMergeMode => '合併方式';

  @override
  String get featuresDataTransferBundleRestoreMiddle => '：已存在的資料會自動略過，只補回缺少的；';

  @override
  String get featuresDataTransferBundleNoOverwrite => '不會刪除或覆蓋你現有的資料';

  @override
  String get featuresDataTransferBundleDownload => '下載完整備份';

  @override
  String get featuresDataTransferBundleDownloading => '打包下載中...';

  @override
  String get featuresDataTransferBundleRestore => '上傳備份還原';

  @override
  String get featuresDataTransferBundleRestoring => '還原中...';

  @override
  String get featuresDataTransferDatabaseTitle => '整檔備份 / 還原';

  @override
  String get featuresDataTransferDatabaseDescription =>
      '僅管理員可操作。SQLite 模式下載 `.db` 備份；PostgreSQL 模式下載 `.sql` 備份，還原時請上傳對應格式。';

  @override
  String get featuresDataTransferDatabaseDownload => '下載資料庫備份';

  @override
  String get featuresDataTransferDatabaseDownloading => '下載中...';

  @override
  String get featuresDataTransferDatabaseRestore => '選擇備份還原';

  @override
  String get featuresDataTransferDatabaseRestoring => '還原中...';

  @override
  String get featuresDataTransferMegaTitle => 'MEGA S4 雲端備份';

  @override
  String get featuresDataTransferMegaDescription =>
      '將目前完整 SQLite 備份以上傳物件方式存入 MEGA S4 bucket。連線資訊由伺服器環境變數設定，不會在瀏覽器輸入或顯示金鑰。';

  @override
  String get featuresDataTransferMegaState => '狀態：';

  @override
  String get featuresDataTransferMegaConfigured => '已設定';

  @override
  String get featuresDataTransferMegaNotConfigured => '尚未完整設定';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket：';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return '缺少環境變數：$items';
  }

  @override
  String get featuresDataTransferMegaUpload => '上傳備份到 MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => '上傳中...';

  @override
  String get featuresDataTransferMegaConfigure => '設定';

  @override
  String get featuresDataTransferMegaCancelConfigure => '取消設定';

  @override
  String get featuresDataTransferMegaFormHelp =>
      '設定寫入伺服器持久化設定檔，立即生效。金鑰欄位請重新輸入，不會預填。';

  @override
  String get featuresDataTransferMegaBucketName => 'Bucket 名稱';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefix（選填）';

  @override
  String get featuresDataTransferMegaEndpoint => 'Endpoint（選填，留空自動推算）';

  @override
  String get featuresDataTransferMegaSaveSettings => '儲存設定';

  @override
  String get featuresAccountsTitle => '帳戶管理';

  @override
  String get featuresAccountsTypeLabelsBank => '銀行帳戶';

  @override
  String get featuresAccountsTypeLabelsCredit_card => '信用卡';

  @override
  String get featuresAccountsTypeLabelsCash => '現金';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => '電子錢包';

  @override
  String get featuresAccountsTypeLabelsOther => '其他';

  @override
  String get featuresAccountsTotalAssets => '總資產';

  @override
  String get featuresAccountsCreditOutstanding => '信用卡待還總額';

  @override
  String get featuresAccountsAddAccount => '新增帳戶';

  @override
  String get featuresAccountsEditAccount => '編輯帳戶';

  @override
  String get featuresAccountsNewAccount => '新增帳戶';

  @override
  String get featuresAccountsAccountName => '帳戶名稱 *';

  @override
  String get featuresAccountsInitialBalance => '初始餘額';

  @override
  String get featuresAccountsInitialBalanceEdit => '初始餘額 / 目前設定';

  @override
  String get featuresAccountsLinkedBank => '所屬銀行';

  @override
  String get featuresAccountsUngrouped => '不分組';

  @override
  String get featuresAccountsOverseasFeeRate => '海外手續費率（%）';

  @override
  String get featuresAccountsStatementClosingDay => '結帳日（每月幾號，1~31）';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      '例如 15，留空則不統計本期消費';

  @override
  String get featuresAccountsExcludeFromTotal => '不計入總資產';

  @override
  String get featuresAccountsOtherAccounts => '其他帳戶';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return '折算總額：$amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return '關聯銀行：$name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return '海外手續費率：$rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return '每月結帳日：$day 號';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return '本期消費：$amount';
  }

  @override
  String get featuresAccountsLastCycleBill => '上期帳單：';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return '消費 $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return '已繳 $amount';
  }

  @override
  String get featuresAccountsViewCycles => '查看每期明細 ›';

  @override
  String get featuresAccountsRepaymentTitle => '信用卡還款';

  @override
  String get featuresAccountsRepaymentPaymentAccount => '付款帳戶';

  @override
  String get featuresAccountsRepaymentPaymentDate => '還款日期';

  @override
  String get featuresAccountsRepaymentNoLinkedCards => '此銀行沒有關聯的信用卡';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return '目前餘額：$amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => '還款金額';

  @override
  String get featuresAccountsRepaymentConfirm => '確認還款';

  @override
  String get featuresAccountsDeleteMessage => '確定要刪除此帳戶嗎？';

  @override
  String get featuresAccountsCyclesTitle => '每期帳單明細';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name　每月結帳日 $day 號';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      '「繳款」已對應回它所清償的帳單（結帳後下一期繳清的金額算回該期帳單）。';

  @override
  String get featuresAccountsCyclesPeriod => '期間';

  @override
  String get featuresAccountsCyclesSpending => '消費';

  @override
  String get featuresAccountsCyclesPayment => '實際繳款';

  @override
  String get featuresAccountsCyclesCurrent => '本期';

  @override
  String get featuresAccountsFxTitle => '匯率管理';

  @override
  String get featuresAccountsFxAutoUpdate => '自動更新匯率';

  @override
  String get featuresAccountsFxSyncNow => '立即同步';

  @override
  String get featuresAccountsFxSyncing => '同步中...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return '上次同步：$date';
  }

  @override
  String get featuresAccountsFxCurrency => '幣別';

  @override
  String get featuresAccountsFxUnitToTwd => '1 單位 = TWD';

  @override
  String get featuresAccountsFxEmpty => '尚未設定任何外幣匯率';

  @override
  String get featuresAccountsFxCurrencyLabel => '幣別（如 USD）';

  @override
  String get featuresAccountsFxRateToTwd => '對 TWD 匯率';

  @override
  String get featuresAccountsFxAddOrUpdate => '新增 / 更新';

  @override
  String get featuresAccountsMessagesNameRequired => '請輸入帳戶名稱';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired => '請選擇付款帳戶';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      '請至少輸入一張信用卡的還款金額';

  @override
  String get featuresAccountsMessagesCurrencyInvalid => '幣別格式錯誤（需為 3 碼英文字母）';

  @override
  String get featuresAccountsMessagesRateInvalid => '請輸入有效匯率';

  @override
  String get featuresAccountsMessagesSaved => '已儲存';

  @override
  String get featuresAccountsMessagesSaveFailed => '儲存失敗';

  @override
  String get featuresAccountsMessagesDeleteFailed => '刪除失敗';

  @override
  String get featuresAccountsMessagesRatesUpdated => '匯率已更新';

  @override
  String get featuresAccountsMessagesSyncFailed => '同步失敗';

  @override
  String get featuresAccountsMessagesLoadFailed => '載入失敗';

  @override
  String get featuresTransactionsTitle => '交易記錄';

  @override
  String get featuresTransactionsSearchPlaceholder => '搜尋備註...';

  @override
  String get featuresTransactionsAllTypes => '所有類型';

  @override
  String get featuresTransactionsAllAccounts => '所有帳戶';

  @override
  String get featuresTransactionsAllCategories => '所有分類';

  @override
  String get featuresTransactionsTransfer => '轉帳';

  @override
  String get featuresTransactionsFuture => '未來交易';

  @override
  String get featuresTransactionsExcludeTransfer => '排除轉帳';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name（全部）';
  }

  @override
  String get featuresTransactionsStartDateTitle => '開始日期';

  @override
  String get featuresTransactionsEndDateTitle => '結束日期';

  @override
  String get featuresTransactionsAdd => '新增交易';

  @override
  String get featuresTransactionsEdit => '編輯交易';

  @override
  String get featuresTransactionsCreate => '新增交易';

  @override
  String get featuresTransactionsAccountTransfer => '帳戶轉帳';

  @override
  String get featuresTransactionsBatchCategory => '批次改分類';

  @override
  String get featuresTransactionsBatchDate => '批次改日期';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return '刪除選取 ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => '當頁收入';

  @override
  String get featuresTransactionsPageExpense => '當頁支出';

  @override
  String get featuresTransactionsPageTotal => '當頁合計';

  @override
  String get featuresTransactionsPageSummaryAria => '當頁交易統計';

  @override
  String get featuresTransactionsEmpty => '尚無符合條件的交易記錄';

  @override
  String featuresTransactionsSource(Object name) {
    return '來源：$name';
  }

  @override
  String get featuresTransactionsFxFee => '國外刷卡手續費';

  @override
  String get featuresTransactionsPhotoOne => '照片 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '照片 $count';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => '日期 *';

  @override
  String get featuresTransactionsAmountRequiredLabel => '金額 *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return '匯率（1 $currency = ? TWD）';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder => '留空則使用系統匯率';

  @override
  String get featuresTransactionsLatestRateLoading => '查詢最新匯率中...';

  @override
  String get featuresTransactionsFxFeePlaceholder => '留空則由系統依卡片費率自動計算';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return '卡片海外手續費率 $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return '，建議值 NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => '照片';

  @override
  String get featuresTransactionsLoadingPhotos => '載入照片中...';

  @override
  String get featuresTransactionsTakePhoto => '拍照';

  @override
  String get featuresTransactionsChooseImage => '選擇圖片';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return '手機可直接拍照或從相簿選圖。最多 5 張，每張上限 $maxMb MB。';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return '新增照片 $count';
  }

  @override
  String get featuresTransactionsRemove => '移除';

  @override
  String get featuresTransactionsChoosePhoto => '選擇照片';

  @override
  String get featuresTransactionsTransferOut => '轉出帳戶 *';

  @override
  String get featuresTransactionsTransferIn => '轉入帳戶 *';

  @override
  String get featuresTransactionsSelectPlaceholder => '請選擇';

  @override
  String get featuresTransactionsCreating => '建立中...';

  @override
  String get featuresTransactionsConfirmTransfer => '確認轉帳';

  @override
  String get featuresTransactionsBatchCategoryTitle => '批次變更分類';

  @override
  String get featuresTransactionsBatchDateTitle => '批次變更日期';

  @override
  String get featuresTransactionsNewCategory => '新分類';

  @override
  String get featuresTransactionsNewDate => '新日期';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return '套用到 $count 筆';
  }

  @override
  String get featuresTransactionsDeleteMessage => '確定要刪除這筆交易記錄嗎？此操作無法復原。';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return '確定要刪除選取的 $count 筆交易嗎？';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return '交易已更新，但$message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return '交易已建立，但$message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked => '轉帳交易請改用刪除後重建';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      '國外刷卡手續費為自動產生，請編輯對應的國外交易（修改後手續費會自動同步）';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed => '照片上傳失敗';

  @override
  String get featuresTransactionsMessagesDateRequired => '請選擇日期';

  @override
  String get featuresTransactionsMessagesAmountRequired => '請輸入有效金額';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      '請選擇轉出與轉入帳戶';

  @override
  String get featuresTransactionsMessagesTransferSameAccount => '轉出與轉入帳戶不可相同';

  @override
  String get featuresTransactionsTypeLabelsIncome => '收入';

  @override
  String get featuresTransactionsTypeLabelsExpense => '支出';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => '轉入';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => '轉出';

  @override
  String get featuresStocksTabsPortfolio => '持股總覽';

  @override
  String get featuresStocksTabsTransactions => '交易紀錄';

  @override
  String get featuresStocksTabsDividends => '股利紀錄';

  @override
  String get featuresStocksTabsRealized => '實現損益';

  @override
  String get featuresStocksTabsSettings => '交易設定';

  @override
  String get featuresStocksCommonStockLabel => '股票';

  @override
  String get featuresStocksCommonStockRequired => '股票 *';

  @override
  String get featuresStocksCommonStockTypeStock => '股票';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => '權證';

  @override
  String get featuresStocksCommonDate => '日期';

  @override
  String get featuresStocksCommonShares => '股數';

  @override
  String get featuresStocksCommonPrice => '價格';

  @override
  String get featuresStocksCommonTotal => '合計';

  @override
  String get featuresStocksCommonReturnRate => '報酬率';

  @override
  String get featuresStocksCommonOverallReturnRate => '整體報酬率';

  @override
  String get featuresStocksCommonEstimatedPL => '預估損益';

  @override
  String get featuresStocksCommonRealizedPL => '實現損益';

  @override
  String get featuresStocksCommonTotalRealizedPL => '總實現損益';

  @override
  String get featuresStocksCommonYearRealizedPL => '今年實現損益';

  @override
  String get featuresStocksCommonRealizedCount => '已實現筆數';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count 筆';
  }

  @override
  String get featuresStocksCommonSellAverage => '賣出均價';

  @override
  String get featuresStocksCommonCostAverage => '成本均價';

  @override
  String get featuresStocksCommonFeeAndTax => '手續費+稅';

  @override
  String get featuresStocksCommonCashDividend => '現金股利';

  @override
  String get featuresStocksCommonStockDividend => '股票股利';

  @override
  String get featuresStocksCommonStockSymbol => '股票代碼 *';

  @override
  String get featuresStocksCommonStockName => '股票名稱';

  @override
  String get featuresStocksCommonSearching => '查詢中...';

  @override
  String get featuresStocksCommonCancelAccounting => '— 不入帳（純股票股利）—';

  @override
  String get featuresStocksCommonAutoCalculate => '自動計算';

  @override
  String get featuresStocksCommonBuy => '買進';

  @override
  String get featuresStocksCommonSell => '賣出';

  @override
  String get featuresStocksPortfolioTitle => '持股總覽';

  @override
  String get featuresStocksPortfolioTotalMarketValue => '股票總市值';

  @override
  String get featuresStocksPortfolioTotalCost => '總投入成本';

  @override
  String get featuresStocksPortfolioTotalDividend => '累計股利';

  @override
  String get featuresStocksPortfolioAddStock => '新增股票';

  @override
  String get featuresStocksPortfolioEditStock => '編輯股票';

  @override
  String get featuresStocksPortfolioNewStock => '新增股票';

  @override
  String get featuresStocksPortfolioUpdatePrices => '更新股價';

  @override
  String get featuresStocksPortfolioBatchUpdate => '批次自動更新';

  @override
  String get featuresStocksPortfolioUpdating => '更新中...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      '優先由瀏覽器端向台灣證交所公開 API 查詢；若瀏覽器被擋，會改用登入後的 user API 代理查詢並更新持股。';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return '更新完成：$updated 支成功。';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return '更新完成：$updated 支成功，$failed 支失敗。';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      '瀏覽器端無法取得台灣證交所行情資料';

  @override
  String get featuresStocksPortfolioHeldShares => '持有股數';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count 股';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => '目前股價';

  @override
  String get featuresStocksPortfolioMarketValue => '市值';

  @override
  String featuresStocksPortfolioDividendMonths(Object months) {
    return '配息月份：$months';
  }

  @override
  String get featuresStocksPortfolioDividendMonthsEmpty => '尚無配息紀錄';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired => '請輸入股票代碼';

  @override
  String get featuresStocksTransactionsTitle => '股票交易紀錄';

  @override
  String get featuresStocksTransactionsAddTransaction => '新增交易';

  @override
  String get featuresStocksTransactionsEditTransaction => '編輯交易';

  @override
  String get featuresStocksTransactionsNewTransaction => '新增交易';

  @override
  String get featuresStocksTransactionsTypeLabel => '類型';

  @override
  String get featuresStocksTransactionsDateLabel => '日期 *';

  @override
  String get featuresStocksTransactionsSharesLabel => '股數 *';

  @override
  String get featuresStocksTransactionsPriceLabel => '單價 *';

  @override
  String get featuresStocksTransactionsFeeLabel => '手續費';

  @override
  String get featuresStocksTransactionsTaxLabel => '交易稅';

  @override
  String get featuresStocksTransactionsDeleteMessage => '確定要刪除此交易記錄嗎？';

  @override
  String get featuresStocksTransactionsMessagesStockRequired => '請選擇股票';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired => '請輸入有效股數';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired => '請輸入有效價格';

  @override
  String get featuresStocksDividendsTitle => '股利紀錄';

  @override
  String get featuresStocksDividendsAddDividend => '新增股利';

  @override
  String get featuresStocksDividendsEditDividend => '編輯股利';

  @override
  String get featuresStocksDividendsNewDividend => '新增股利';

  @override
  String get featuresStocksDividendsSyncExDividends => '同步除權息';

  @override
  String get featuresStocksDividendsSyncDescription =>
      '依照您的持股紀錄，從台灣證交所自動同步歷年除權息資料。';

  @override
  String get featuresStocksDividendsSyncStart => '開始同步';

  @override
  String get featuresStocksDividendsSyncing => '同步中...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return '新增 $synced 筆，跳過 $skipped 筆。';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return '新增 $synced 筆，跳過 $skipped 筆，$failed 筆失敗。';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel => '現金股利 (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel => '股票股利 (股)';

  @override
  String get featuresStocksDividendsDepositAccount => '入款帳戶';

  @override
  String get featuresStocksDividendsDeleteMessage => '確定要刪除此股利記錄嗎？';

  @override
  String get featuresStocksDividendsMessagesStockRequired => '請選擇股票';

  @override
  String get featuresStocksDividendsMessagesDividendRequired => '請輸入現金股利或股票股利';

  @override
  String get featuresStocksRealizedTitle => '實現損益';

  @override
  String get featuresStocksSettingsTitle => '交易設定';

  @override
  String get featuresStocksSettingsFeeTitle => '手續費 / 交易稅設定';

  @override
  String get featuresStocksSettingsFeeRate => '手續費率';

  @override
  String get featuresStocksSettingsFeeDiscount => '折扣 (0~1)';

  @override
  String get featuresStocksSettingsFeeMinLot => '最低手續費（整股）';

  @override
  String get featuresStocksSettingsFeeMinOdd => '最低手續費（零股）';

  @override
  String get featuresStocksSettingsSellTaxRateStock => '賣出稅率（股票）';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => '賣出稅率（ETF）';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant => '賣出稅率（權證）';

  @override
  String get featuresStocksSettingsSellTaxMin => '最低交易稅';

  @override
  String get featuresStocksSettingsSaveSettings => '儲存設定';

  @override
  String get featuresStocksSettingsStockStatusTitle => '股票狀態管理';

  @override
  String get featuresStocksSettingsCurrentPrice => '目前價格';

  @override
  String get featuresStocksSettingsNormalTracking => '正常追蹤';

  @override
  String get featuresStocksSettingsDelisted => '已下市';

  @override
  String get featuresStocksSettingsRestoreTracking => '恢復追蹤';

  @override
  String get featuresStocksSettingsMarkDelisted => '標記下市';

  @override
  String get featuresStocksSettingsRecurringTitle => '股票定期定額';

  @override
  String get featuresStocksSettingsAddRecurringShort => '新增';

  @override
  String get featuresStocksSettingsEditRecurring => '編輯定期定額';

  @override
  String get featuresStocksSettingsNewRecurring => '新增定期定額';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => '金額 (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => '頻率';

  @override
  String get featuresStocksSettingsStartDate => '起始日期';

  @override
  String get featuresStocksSettingsLastGenerated => '上次產生';

  @override
  String get featuresStocksSettingsActive => '啟用中';

  @override
  String get featuresStocksSettingsInactive => '已停用';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm => '確定要刪除此定期定額設定嗎？';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => '每日';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => '每週';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => '每月';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => '每年';

  @override
  String get featuresStocksSettingsMessagesSaved => '設定已儲存';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return '儲存失敗：$message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired => '請選擇股票';

  @override
  String get featuresStocksSettingsMessagesAmountRequired => '請輸入有效金額';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol 已$status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus => '恢復為正常追蹤';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus => '標記為下市';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed => '更新下市狀態失敗';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => '每日收支報表';

  @override
  String get notificationsReportTypeWeekly => '每週收支報表';

  @override
  String get notificationsReportTypeMonthly => '每月收支報表';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return '每日收支報表｜$date（週$weekday）';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return '每週收支報表｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return '每月收支報表｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name，$date（週$weekday）的收支';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name，$start ~ $end 的收支';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name，$month 月的收支';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 報表日 $date　·　寄送日 $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 報表區間 $start ~ $end　·　寄送日 $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 報表月 $month　·　寄送日 $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return '統計昨日（$date 週$weekday）整日收支，今日（$sendDate）寄出';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return '統計過去 7 日（$start ~ $end，共 7 天）收支，今日（$sendDate）寄出';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '統計上月（$month，$start ~ $end）整月收支，本月（$sendDate）寄出';
  }

  @override
  String get notificationsLeadDaily => '昨日';

  @override
  String get notificationsLeadWeekly => '本週';

  @override
  String get notificationsLeadMonthly => '上月';

  @override
  String notificationsKpiIncome(Object lead) {
    return '$lead收入';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return '$lead支出';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return '$lead淨額';
  }

  @override
  String get notificationsCompareLabelDaily => '對比前日';

  @override
  String get notificationsCompareLabelWeekly => '對比上週';

  @override
  String get notificationsCompareLabelMonthly => '對比上月';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return '昨日（$date）';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return '過去 7 日（$start ~ $end）';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return '上月（$month）';
  }

  @override
  String get notificationsSectionsBalance => '帳戶餘額';

  @override
  String get notificationsSectionsTopCategories => '本月支出 Top 5';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return '$month 月支出 Top 5';
  }

  @override
  String get notificationsSectionsDailyDetail => '每日明細';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return '本月累計（$month）';
  }

  @override
  String get notificationsSectionsStock => '股票投資';

  @override
  String get notificationsSectionsRecentDaily => '昨日交易';

  @override
  String get notificationsSectionsRecentWeekly => '本週交易';

  @override
  String get notificationsSectionsRecentMonthly => '上月交易';

  @override
  String get notificationsLabelsIncome => '收入';

  @override
  String get notificationsLabelsExpense => '支出';

  @override
  String get notificationsLabelsNet => '淨額';

  @override
  String get notificationsLabelsCost => '總成本';

  @override
  String get notificationsLabelsMarketValue => '市值';

  @override
  String get notificationsLabelsUnrealizedPL => '未實現損益';

  @override
  String get notificationsLabelsReturnRate => '報酬率';

  @override
  String get notificationsLabelsUncategorized => '未分類';

  @override
  String get notificationsTableDate => '日期';

  @override
  String get notificationsEmptyNoAccount => '尚無帳戶';

  @override
  String get notificationsEmptyNoExpense => '尚無支出紀錄';

  @override
  String notificationsEmptyNoTx(Object label) {
    return '$label沒有交易';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return '股票投資：市值 $marketValue，未實現損益 $pl';
  }

  @override
  String get notificationsCtaViewFullReport => '查看完整報表';

  @override
  String get notificationsCtaViewLineRecord => '查看 LINE 紀錄';

  @override
  String get notificationsReminderAltText => '記錄支出提醒';

  @override
  String get notificationsReminderTitle => '記得記錄今天的支出';

  @override
  String notificationsReminderBody(Object name) {
    return '$name，花 10 秒把今天的支出補上，月底比較不會漏帳。';
  }

  @override
  String get notificationsReminderHint => '按下新增支出後，直接輸入：金額 備註 日期（日期可省略）';

  @override
  String get notificationsReminderFallbackName => '你';

  @override
  String get notificationsReminderAddExpense => '新增支出';

  @override
  String get notificationsReminderViewToday => '查看今天紀錄';

  @override
  String get notificationsFallbackUser => '使用者';

  @override
  String get mobileLegacyMessagebde18a20 => '・不計入總資產';

  @override
  String get mobileLegacyNoneCreateAsParent => '（無，作為父分類）';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      '「首頁」依月份顯示收入、支出、淨額與支出分類圓餅圖，左右切換月份，一眼看懂錢花到哪裡。';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      '「繳款」已對應回它所清償的帳單（結帳後下一期繳清的金額算回該期）。';

  @override
  String get mobileLegacy0NoPayment => '0＝不還';

  @override
  String get mobileLegacyMon => '一';

  @override
  String get mobileLegacyStock => '一般股票';

  @override
  String get mobileLegacyStocks => '一般股票（%）';

  @override
  String get mobileLegacyTue => '二';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      '入款帳戶（含現金股利時必填）';

  @override
  String get mobileLegacyWed => '三';

  @override
  String get mobileLegacyPreviousStatement => '上期帳單 ';

  @override
  String get mobileLegacyNext => '下一步';

  @override
  String get mobileLegacyDelisted => '下市';

  @override
  String get mobileLegacySubcategory => '子分類';

  @override
  String get mobileLegacyDeleted => '已刪除';

  @override
  String get mobileLegacyUpdated => '已更新';

  @override
  String get mobileLegacyLinked => '已綁定';

  @override
  String get mobileLegacyUnlinked => '已解除綁定';

  @override
  String get mobileLegacyTotalRealizedPL => '已實現損益合計';

  @override
  String get mobileLegacyFri => '五';

  @override
  String get mobileLegacyStandardRate01 => '公定 0.1%';

  @override
  String get mobileLegacyStandardRate03 => '公定 0.3%';

  @override
  String get mobileLegacySat => '六';

  @override
  String get mobileLegacyCategoryName => '分類名稱';

  @override
  String get mobileLegacyFeeOptional => '手續費（選填）';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      '手續費／證交稅留空則由後端自動計算';

  @override
  String get mobileLegacyCommissionRate => '手續費率（%）';

  @override
  String get mobileLegacyDay => '日';

  @override
  String get mobileLegacyMonthlyBudget => '月度總預算';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent => '父分類（不選＝建立父分類）';

  @override
  String get mobileLegacyTheme => '主題';

  @override
  String get mobileLegacyThu => '四';

  @override
  String get mobileLegacyUnnamedPasskey => '未命名 Passkey';

  @override
  String get mobileLegacyUnknownCategory => '未知分類';

  @override
  String get mobileLegacyNotLinked => '未綁定';

  @override
  String get mobileLegacyNoTransactionsThisMonth => '本月尚無交易';

  @override
  String get mobileLegacyNoBudgetThisMonth => '本月尚無預算';

  @override
  String get mobileLegacyNetThisMonth => '本月淨額';

  @override
  String get mobileLegacyPositiveWholeNumber => '正整數';

  @override
  String get mobileLegacyDeletePermanently => '永久刪除';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      '永久刪除帳號與所有資料，無法復原';

  @override
  String get mobileLegacyNoReleaseNotesAvailable => '目前沒有更新內容';

  @override
  String get mobileLegacyCurrentDevice => '目前裝置';

  @override
  String get mobileLegacyTransactions => '交易';

  @override
  String get mobileLegacyAll => '全部';

  @override
  String get mobileLegacyAllCategories => '全部分類';

  @override
  String get mobileLegacyAllAccounts => '全部帳戶';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      '各卡還款金額（以卡片幣別計）';

  @override
  String get mobileLegacySyncDividends => '同步股利';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically => '名稱（選填，留空自動帶入）';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      '在「股票」分頁輸入股票代號（例如 2330）即可追蹤即時股價、未實現與已實現損益，系統還會自動同步除權息。';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      '在底部「記帳」分頁點右下角的「＋」即可新增收入或支出，支援多幣別與帳戶轉帳。交易往左滑可刪除、點一下可編輯。';

  @override
  String get mobileLegacyNoDataForThisPeriod => '此區間無資料';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      '此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票與設定），且無法復原。';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports => '自訂定期收支報表寄送時間';

  @override
  String get mobileLegacyAutomatic => '自動';

  @override
  String get mobileLegacyAtLeast8Characters => '至少 8 字元';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      '至少 8 字元，含大小寫、數字與特殊符號';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      '你的個人資產管家——記帳、預算、台股投資與統計報表，一個 App 全部搞定。花一分鐘快速認識主要功能。';

  @override
  String get mobileLegacyDeletePasskey => '刪除 Passkey';

  @override
  String get mobileLegacyDeleteCategory => '刪除分類';

  @override
  String get mobileLegacyDeleteTransaction => '刪除交易';

  @override
  String get mobileLegacyDeleteDividend => '刪除股利';

  @override
  String get mobileLegacyDeleteStock => '刪除股票';

  @override
  String get mobileLegacyDeleteAccount => '刪除帳戶';

  @override
  String get mobileLegacyDeleteSchedule => '刪除排程';

  @override
  String get mobileLegacyDeletePhoto => '刪除照片';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      '含現金股利時，入款帳戶為必填';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters => '找不到符合篩選的交易';

  @override
  String get mobileLegacyDiscount01 => '折讓（0~1）';

  @override
  String get mobileLegacyImproved => '改進';

  @override
  String get mobileLegacyMore => '更多';

  @override
  String get mobileLegacyUpdatedd9db02d0 => '更新';

  @override
  String get mobileLegacyLastDayOfEachMonth => '每月最後一天';

  @override
  String get mobileLegacyNoPricesToUpdate => '沒有可更新的股價';

  @override
  String get mobileLegacyNoNewDividendsToSync => '沒有新的股利可同步';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession => '使用者登出，已清除本機登入';

  @override
  String get mobileLegacyGettingStarted => '使用教學';

  @override
  String get mobileLegacyExample06MeansA40Discount => '例：0.6 代表 6 折';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      '例：1.5 代表 1.5%，外幣刷卡時自動計算手續費';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      '到「更多」設定每月預算、查看統計報表、管理帳戶與分類，還能設定固定收支與報表通知。準備好了，開始記錄吧！';

  @override
  String get mobileLegacyStandardBrokerageRate01425 => '券商公定 0.1425%';

  @override
  String get mobileLegacyNotSentYet => '尚未寄送';

  @override
  String get mobileLegacyNoRealizedReturns => '尚無已實現損益';

  @override
  String get mobileLegacyNoCategoriesYet => '尚無分類';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      '尚無交易，點右下角記一筆';

  @override
  String get mobileLegacyNoRecurringTransactions => '尚無固定收支';

  @override
  String get mobileLegacyNoDividendRecords => '尚無股利紀錄';

  @override
  String get mobileLegacyNoStockTransactions => '尚無股票交易';

  @override
  String get mobileLegacyNoHoldingsYet => '尚無持股';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => '尚無登入紀錄';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      '於瀏覽器完成註冊（需裝置生物辨識）';

  @override
  String get mobileLegacyNotice => '注意';

  @override
  String get mobileLegacyDividends => '股利';

  @override
  String get mobileLegacyDividendSyncCompleted => '股利同步完成';

  @override
  String get mobileLegacyTickerEG2330 => '股票代號（如 2330）';

  @override
  String get mobileLegacyStockMarketValue => '股票市值';

  @override
  String get mobileLegacyHoldings => '持股';

  @override
  String get mobileLegacyDayOfWeek => '星期';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes => '查看目前版本與更新內容';

  @override
  String get mobileLegacyRename => '重新命名';

  @override
  String get mobileLegacyCheckAgain => '重新檢查';

  @override
  String get mobileLegacyRetry => '重試';

  @override
  String get mobileLegacyHome => '首頁';

  @override
  String get mobileLegacyFixed => '修正';

  @override
  String get mobileLegacyApply => '套用';

  @override
  String get mobileLegacyTime => '時間';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional => '海外手續費 TWD（選填）';

  @override
  String get mobileLegacyAddTransaction => '記一筆';

  @override
  String get mobileLegacyTransactions8084a8ea => '記帳';

  @override
  String get mobileLegacyStartDate => '起始日';

  @override
  String get mobileLegacyTrackTaiwanStocks => '追蹤台股投資';

  @override
  String get mobileLegacyStockDividendSharesOptional => '配股股數（選填）';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      '國外刷卡手續費由原交易自動產生，請編輯對應的國外交易';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters => '密碼長度至少 8 字元';

  @override
  String get mobileLegacyAccountName => '帳戶名稱';

  @override
  String get mobileLegacyAccountDeleted => '帳號已刪除';

  @override
  String get mobileLegacyAccountSecurity => '帳號安全';

  @override
  String get mobileLegacyLinkedAccounts => '帳號綁定';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => '常用幣別';

  @override
  String get mobileLegacyChooseFromGallery => '從相簿選擇';

  @override
  String get mobileLegacyEnabled => '啟用';

  @override
  String get mobileLegacyDark => '深色';

  @override
  String get mobileLegacyLight => '淺色';

  @override
  String get mobileLegacyClearDates => '清除日期';

  @override
  String get mobileLegacyClearFilters => '清除篩選';

  @override
  String get mobileLegacyCashDividendTotalOptional => '現金股利（總額，選填）';

  @override
  String get mobileLegacyEnterACashOrStockDividend => '現金股利與配股至少填一項';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      '設定後帳戶卡片會顯示本期帳單消費，留空則不統計';

  @override
  String get mobileLegacyNoteOptional => '備註（選填）';

  @override
  String get mobileLegacyNoteKeyword => '備註關鍵字';

  @override
  String get mobileLegacyMinimumTransactionTax => '最低證交稅';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction => '單筆交易最多上傳 5 張照片';

  @override
  String get mobileLegacyReportNotifications => '報表通知';

  @override
  String get mobileLegacySeeYourCompleteCashFlow => '掌握收支全貌';

  @override
  String get mobileLegacyUnableToCreateLineSignInState => '無法建立 LINE 登入狀態';

  @override
  String get mobileLegacyUnableToOpenBrowser => '無法開啟瀏覽器';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForGoogleSign =>
      '無法開啟瀏覽器進行 Google 登入';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForLineSign =>
      '無法開啟瀏覽器進行 LINE 登入';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForPasskeySign =>
      '無法開啟瀏覽器進行 Passkey 登入';

  @override
  String get mobileLegacyYourSessionExpiredSignInAgain => '登入已過期，請重新登入';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      '登入回應未包含認證 Cookie，請確認後端設定';

  @override
  String get mobileLegacySignedIn => '登入成功';

  @override
  String get mobileLegacySignInHistory => '登入紀錄';

  @override
  String get mobileLegacySignedInDevices => '登入裝置';

  @override
  String get mobileLegacySignInRequestConnectionFailed => '登入請求連線失敗';

  @override
  String get mobileLegacyEndDate => '結束日';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      '註冊回應未包含認證 Cookie，請確認後端設定';

  @override
  String get mobileLegacySignUpAndSignIn => '註冊並登入';

  @override
  String get mobileLegacyBuy => '買';

  @override
  String get mobileLegacyFrequency => '週期';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 => '匯率須大於 0';

  @override
  String get mobileLegacyReturns => '損益';

  @override
  String get mobileLegacyAddPasskey => '新增 Passkey';

  @override
  String get mobileLegacyAddStockTransaction => '新增股票交易';

  @override
  String get mobileLegacyAddSchedule => '新增排程';

  @override
  String get mobileLegacyAddReportSchedule => '新增報表排程';

  @override
  String get mobileLegacyAddPhotosOptional => '新增照片（選填）';

  @override
  String get mobileLegacyFailedToLoadPhoto => '照片載入失敗';

  @override
  String get mobileLegacyLink => '綁定';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      '綁定需於瀏覽器完成授權；解除綁定前請確認仍可用其他方式登入。';

  @override
  String get mobileLegacyUnlink => '解除';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp => '資產管理 · 安卓客戶端';

  @override
  String get mobileLegacySkip => '跳過';

  @override
  String get mobileLegacyMinimumOddLotCommission => '零股最低手續費';

  @override
  String get mobileLegacyIncorrectEmailOrPassword => '電子郵件或密碼錯誤';

  @override
  String get mobileLegacyDefaultCurrency => '預設幣別';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies => '預設幣別與常用幣別';

  @override
  String get mobileLegacyBudgets => '預算';

  @override
  String get mobileLegacyBudgetsReportsAndMore => '預算、報表與更多';

  @override
  String get mobileLegacyBudgetAmount => '預算金額';

  @override
  String get mobileLegacyCurrencySettings => '幣別設定';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage => '語言（APP、通知與網頁版）';

  @override
  String get mobileLegacyBank => '銀行';

  @override
  String get mobileLegacyBankBalance => '銀行餘額';

  @override
  String get mobileLegacyRequiresALinkedLineAccount => '需已綁定 LINE';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      '需至少一張信用卡與一個非信用卡帳戶才能還款';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      '需含大小寫、數字與特殊符號';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      '需含大寫、小寫、數字與特殊符號';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule => '確定刪除此報表通知排程？';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      '確定要刪除這張已上傳的照片嗎？此動作無法復原。';

  @override
  String get mobileLegacyEditStockTransaction => '編輯股票交易';

  @override
  String get mobileLegacyEditReportSchedule => '編輯報表排程';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst => '請先完成下方的真人驗證';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst => '請先到「持股」分頁新增股票';

  @override
  String get mobileLegacySelectAParentCategoryFirst => '請先選擇父分類';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard => '請至少填一張卡的還款金額';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod => '請至少選擇一種通知方式';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo => '請輸入 ≥ 0 的數字';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => '請輸入 1~31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 => '請輸入大於 0 的金額';

  @override
  String get mobileLegacyEnterATicker => '請輸入代號';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber => '請輸入正整數';

  @override
  String get mobileLegacyEnterAName => '請輸入名稱';

  @override
  String get mobileLegacyEnterAValidEmailAddress => '請輸入有效的電子郵件';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm => '請輸入密碼以確認';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm => '請輸入帳號電子信箱以確認';

  @override
  String get mobileLegacyEnterADisplayName => '請輸入顯示名稱';

  @override
  String get mobileLegacySelectASubcategory => '請選擇子分類';

  @override
  String get mobileLegacySelectACategory => '請選擇分類';

  @override
  String get mobileLegacySelectAParentCategory => '請選擇父分類';

  @override
  String get mobileLegacySelectAnAccount => '請選擇帳戶';

  @override
  String get mobileLegacySelectADestinationAccount => '請選擇轉入帳戶';

  @override
  String get mobileLegacySell => '賣';

  @override
  String get mobileLegacyMinimumBoardLotCommission => '整股最低手續費';

  @override
  String get mobileLegacyFilter => '篩選';

  @override
  String get mobileLegacyFilterTransactions => '篩選交易';

  @override
  String get mobileLegacyChooseTheme => '選擇主題';

  @override
  String get mobileLegacyLogTransactionsInSeconds => '隨手記一筆';

  @override
  String get mobileLegacyMarketValue => '總市值';

  @override
  String get mobileLegacyTotalAssetsInTwd => '總資產（換算 TWD）';

  @override
  String get mobileLegacyTraditionalChineseEnglish => '繁體中文 / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp => '還沒有帳號？註冊';

  @override
  String get mobileLegacyPaymentRecorded => '還款已記錄';

  @override
  String get mobileLegacyToAccount => '轉入帳戶';

  @override
  String get mobileLegacyFromAccount => '轉出帳戶';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      '轉出與轉入不可相同';

  @override
  String get mobileLegacyEditTransfersInTheWebApp => '轉帳請於網頁版編輯';

  @override
  String get mobileLegacyTransactionTaxSell => '證交稅（賣出）';

  @override
  String get mobileLegacyTransactionTaxOptional => '證交稅（選填）';

  @override
  String get mobileLegacyTypeAffectsTransactionTax => '類型（影響證交稅率）';

  @override
  String get mobileLegacyWarrants => '權證（%）';

  @override
  String get mobileLegacyWelcomeToAssetpilot => '歡迎使用 AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis => '變更後其他裝置將被登出。';

  @override
  String get mobileLegacyTestSentryConfiguration => '驗證 Sentry 設定（測試用）';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'API 回應 401，工作階段已過期並清除本機登入';

  @override
  String get mobileLegacyApiRequestFailed => 'API 請求失敗';

  @override
  String get mobileLegacyApiRequestConnectionFailed => 'API 請求連線失敗';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'App 登入回應未包含認證 Cookie';

  @override
  String get mobileLegacyEmailNotifications => 'Email 通知';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'Google 登入回應未包含認證 Cookie';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google 登入狀態不符，請重試';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google 登入逾時或已取消';

  @override
  String get mobileLegacyLineNotifications => 'LINE 通知';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'LINE 登入回應未包含認證 Cookie';

  @override
  String get mobileLegacyLineSignInStateMismatchTryAgain => 'LINE 登入狀態不符，請重試';

  @override
  String get mobileLegacyLineSignInTimedOutOrWasCancelled => 'LINE 登入逾時或已取消';

  @override
  String get mobileLegacyPasskeySignInTimedOutOrWasCancelled =>
      'Passkey 登入逾時或已取消';

  @override
  String get mobileLegacyTwdIsAlwaysIncludedSelectedCurrenciesAppearFirst =>
      'TWD 一律包含。勾選的幣別會出現在交易/固定收支的幣別清單前段。';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return '$day 號';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return '上次寄送 $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return '目前版本 v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return '有新版本 v$version 可更新';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return '每月 $day 號';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return '每週$weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '星期$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return '建立於 $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return '已更新語言：$value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return '載入失敗：$value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return '發生未預期的錯誤：$value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return '$provider 登入失敗：$error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return '更新股價失敗：$value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return '同步股利失敗：$value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return '照片上傳失敗：$value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return '請求失敗（HTTP $code）';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return '登入失敗（HTTP $code）';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return '無法連線到後端（$target）：$error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return '確定刪除「$name」？';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return '解除 $provider 綁定';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return '確定解除與 $provider 的綁定？';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return '$provider 綁定';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name（全部）';
  }

  @override
  String mobileDynamicUnknownHttpMethod(Object method) {
    return '未知的 HTTP method: $method';
  }

  @override
  String mobileDynamicDeleteAccountName(Object name) {
    return '確定刪除「$name」？相關交易可能一併受影響。';
  }

  @override
  String mobileDynamicCurrentSpending(Object amount, Object range) {
    return '本期消費 $amount$range';
  }

  @override
  String mobileDynamicSpentAmount(Object amount) {
    return '消費 $amount';
  }

  @override
  String mobileDynamicPaidAmount(Object amount) {
    return '已繳 $amount';
  }

  @override
  String mobileDynamicStatementCloses(Object name, Object day) {
    return '$name　每月結帳日 $day 號';
  }

  @override
  String mobileDynamicAddBudgetForMonth(Object month) {
    return '新增預算（$month）';
  }

  @override
  String mobileDynamicRecurringSubtitle(
    Object frequency,
    Object account,
    Object startDate,
  ) {
    return '$frequency・$account・自 $startDate';
  }

  @override
  String mobileDynamicReportTotalExpense(Object total) {
    return '總支出：$total';
  }

  @override
  String mobileDynamicReportTotalIncome(Object total) {
    return '總收入：$total';
  }

  @override
  String mobileDynamicDeleteTransactionDate(Object date) {
    return '確定刪除這筆 $date 的交易？此動作無法復原。';
  }

  @override
  String mobileDynamicDeleteTransactionCompact(Object date) {
    return '確定刪除這筆$date的交易？';
  }

  @override
  String mobileDynamicExchangeRateForCurrency(Object currency) {
    return '匯率（1 $currency = ? TWD）';
  }

  @override
  String mobileDynamicCardRateAutoFee(Object rate) {
    return '此卡費率 $rate%，留空將自動計算';
  }

  @override
  String mobileDynamicUploadedPhotosCount(Object count) {
    return '已上傳照片（$count）';
  }

  @override
  String mobileDynamicAddPhotosCount(Object count) {
    return '新增照片（$count/5）';
  }

  @override
  String mobileDynamicStockPricesUpdated(Object count) {
    return '已更新 $count 檔股價';
  }

  @override
  String mobileDynamicStockPricesUpdatedWithFailed(
    Object count,
    Object failed,
  ) {
    return '已更新 $count 檔股價，$failed 檔查詢失敗';
  }

  @override
  String mobileDynamicDeleteStock(Object symbol, Object name) {
    return '確定刪除「$symbol $name」？其所有交易與股利紀錄將一併刪除，無法復原。';
  }

  @override
  String mobileDynamicStockHoldingSubtitle(
    Object shares,
    Object avgCost,
    Object currentPrice,
  ) {
    return '$shares 股・均價 $avgCost・現價 $currentPrice';
  }

  @override
  String mobileDynamicStockTransactionSubtitle(
    Object date,
    Object shares,
    Object price,
  ) {
    return '$date・$shares 股 @ $price';
  }

  @override
  String mobileDynamicDeleteDividend(Object symbol, Object date) {
    return '確定刪除 $symbol 於 $date 的股利紀錄？';
  }

  @override
  String mobileDynamicDividendsSynced(Object count) {
    return '已同步 $count 筆股利';
  }

  @override
  String mobileDynamicDividendsSyncedWithSkipped(Object count, Object skipped) {
    return '已同步 $count 筆股利，略過 $skipped 筆';
  }

  @override
  String mobileDynamicCashDividend(Object amount) {
    return '現金 $amount';
  }

  @override
  String mobileDynamicStockDividendShares(Object shares) {
    return '配股 $shares 股';
  }

  @override
  String mobileDynamicRealizedTransactionSubtitle(Object date, Object shares) {
    return '$date・賣 $shares 股';
  }

  @override
  String dashboardDataStatusQueriedAt(Object time) {
    return '資料查詢時間 $time';
  }

  @override
  String get dashboardAttentionTitle => '待處理';

  @override
  String get dashboardAttentionAllClear => '目前沒有需要處理的事項';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count 筆固定收支需要檢查';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count 筆未分類交易 · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count 檔持倉尚無價格';
  }

  @override
  String get dashboardDriversTitle => '本月 Top 3 驅動因素';

  @override
  String dashboardDriversSubtitle(Object month) {
    return '$month 金額最高的收入與支出項目';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '占此類型 $share%';
  }

  @override
  String get dashboardPersonalizeTrigger => '自訂首頁';

  @override
  String get dashboardPersonalizeTitle => '自訂首頁';

  @override
  String get dashboardPersonalizeDescription => '選擇要顯示的模組，並依你的使用順序排列。';

  @override
  String get dashboardPersonalizeModulesAssets => '資產概覽';

  @override
  String get dashboardPersonalizeModulesAttention => '需要處理';

  @override
  String get dashboardPersonalizeModulesWhyChanged => '現金流為何變動';

  @override
  String get dashboardPersonalizeModulesSpending => '支出分類';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => '投資組合健檢';

  @override
  String get dashboardPersonalizeModulesIncomeRecent => '收入與近期交易';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return '將「$module」上移';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return '將「$module」下移';
  }

  @override
  String get dashboardPersonalizeSaved => '首頁配置已儲存';

  @override
  String get dashboardPersonalizeSaveError => '無法儲存首頁配置';

  @override
  String get dashboardPersonalizeReset => '重設';

  @override
  String get dashboardPersonalizeApply => '套用';

  @override
  String get dashboardComparisonTitle => '現金流為何變動';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart～$currentEnd，對比 $previousStart～$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return '完整月份，對比 $previousStart～$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable => '這個月份沒有可比較的上一期間。';

  @override
  String get dashboardComparisonNoChanges => '已記錄的現金流與可比期間相同。';

  @override
  String get dashboardComparisonPreviousNet => '上期淨現金流';

  @override
  String get dashboardComparisonNetChange => '淨現金流變動';

  @override
  String get dashboardComparisonNewThisPeriod => '本期新增';

  @override
  String get dashboardComparisonIncreased => '金額增加';

  @override
  String get dashboardComparisonDecreased => '金額減少';

  @override
  String get dashboardPortfolioHealthTitle => '投資成本基礎健檢';

  @override
  String get dashboardPortfolioHealthSubtitle => '目前市值與 FIFO 剩餘成本比較';

  @override
  String get dashboardPortfolioHealthNoHoldings => '新增持股後即可查看成本基礎洞察。';

  @override
  String get dashboardPortfolioHealthMissingPrices => '需要目前價格才能提供這項比較。';

  @override
  String get dashboardPortfolioHealthMixedCurrencies => '持股包含多種幣別，暫不提供合併百分比。';

  @override
  String get dashboardPortfolioHealthMarketValue => '已有價格的市值';

  @override
  String get dashboardPortfolioHealthCost => '已有價格持股成本';

  @override
  String get dashboardPortfolioHealthUnrealizedGross => '未實現毛損益';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return '最大持股：$name · 佔已有價格市值 $share%';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      '這裡比較目前價格與已記錄的 FIFO 成本，不是市場指數基準或時間加權績效。';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return '價格涵蓋：$total 檔持股中有 $priced 檔';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook => '排程現金展望';

  @override
  String get dashboardPersonalizeModulesSavingsScenario => '儲蓄情境';

  @override
  String get dashboardCashOutlookTitle => '未來 30 天・排程現金';

  @override
  String get dashboardCashOutlookSubtitle => '依已確認的固定收支估算';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start～$end・排程估算';
  }

  @override
  String get dashboardCashOutlookInvalidDate => '無法計算估算期間。';

  @override
  String get dashboardCashOutlookNoBankAccounts => '請先新增並納入銀行帳戶，才能估算排程現金。';

  @override
  String get dashboardCashOutlookNoSchedules => '建立固定收入或支出後，即可查看即將發生的排程現金。';

  @override
  String get dashboardCashOutlookNoCoveredSchedules => '請檢查固定收支，並連結至已納入的銀行帳戶。';

  @override
  String get dashboardCashOutlookStartingBalance => '截至今日的銀行餘額';

  @override
  String get dashboardCashOutlookScheduledNet => '排程淨變動';

  @override
  String get dashboardCashOutlookClosingBalance => '30 天後估算現金';

  @override
  String get dashboardCashOutlookLowestBalance => '最低估算現金';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count 筆排程・收入 $income・支出 $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle => '合併估算現金可能低於零';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return '約在 $date，估算可能低於零 $amount。採取行動前請先檢查日期與金額。';
  }

  @override
  String get dashboardCashOutlookUpcoming => '即將發生的排程';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return '顯示 $shown／$total 筆';
  }

  @override
  String get dashboardCashOutlookNoUpcoming => '這個 30 天期間內沒有排程項目。';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return '已涵蓋 $included／$total 筆固定收支；請檢查其餘 $uncovered 筆。';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      '估算合併所有已納入銀行帳戶，採用截至今日的餘額與已確認連結固定收支。它不會顯示單一帳戶可能透支，也不會改變實際餘額；到期交易會在服務下次處理時建立。TWD 估算一致使用目前匯率。';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return '約在 $date，排程現金可能短缺 $amount';
  }

  @override
  String get dashboardScenarioTitle => '儲蓄情境試算';

  @override
  String get dashboardScenarioSubtitle => '試算一項每月調整的累積影響';

  @override
  String get dashboardScenarioMonthlyAdjustment => '每月儲蓄調整（TWD）';

  @override
  String get dashboardScenarioDecrease => '每月調整減少 500';

  @override
  String get dashboardScenarioIncrease => '每月調整增加 500';

  @override
  String get dashboardScenarioHorizon => '試算期間';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count 個月';
  }

  @override
  String get dashboardScenarioDifference => '累積差額';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return '每月調整 $monthly，持續 $months 個月，累積差額為 $difference。';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      '簡易情境：每月調整 × 月數。不包含利息、市場報酬、通膨與稅務，也不保證未來結果。';

  @override
  String get navMcp => 'MCP 連線';

  @override
  String get settingsMcpTitle => 'MCP 連線設定';

  @override
  String get settingsMcpDescription =>
      '透過 OAuth 連接支援 MCP 的 AI 工具，或為需要手動憑證的 client 建立個人化存取權杖。';

  @override
  String get settingsMcpOauthTitle => '使用 OAuth 連線';

  @override
  String get settingsMcpOauthDescription =>
      '在支援 MCP OAuth 的 AI 工具中輸入下方連線位址，AssetPilot 會開啟安全的登入與授權頁，不需手動建立權杖。';

  @override
  String get settingsMcpCreateNew => '建立新憑證';

  @override
  String get settingsMcpNameLabel => '名稱';

  @override
  String get settingsMcpNamePlaceholder => '例如：我的 ChatGPT';

  @override
  String get settingsMcpExpiresAtLabel => '到期時間（選填）';

  @override
  String get settingsMcpCreateButton => '建立憑證';

  @override
  String get settingsMcpCreating => '建立中…';

  @override
  String get settingsMcpCreateFailed => '建立憑證失敗';

  @override
  String get settingsMcpNameRequired => '請輸入名稱';

  @override
  String get settingsMcpNameTooLong => '名稱不可超過 100 字元';

  @override
  String get settingsMcpListTitle => '我的 MCP 憑證';

  @override
  String get settingsMcpRefresh => '重新整理';

  @override
  String get settingsMcpNoCredentials => '尚未建立任何憑證';

  @override
  String get settingsMcpLoadFailed => '載入憑證清單失敗';

  @override
  String get settingsMcpColName => '名稱';

  @override
  String get settingsMcpColCreatedAt => '建立時間';

  @override
  String get settingsMcpColLastUsedAt => '最後使用時間';

  @override
  String get settingsMcpColStatus => '狀態';

  @override
  String get settingsMcpColActions => '操作';

  @override
  String get settingsMcpNeverUsed => '尚未使用';

  @override
  String get settingsMcpStatusActive => '啟用中';

  @override
  String get settingsMcpStatusExpired => '已過期';

  @override
  String get settingsMcpStatusRevoked => '已撤銷';

  @override
  String get settingsMcpRevokeButton => '撤銷';

  @override
  String get settingsMcpRevokeConfirm => '確定要撤銷這組憑證嗎？撤銷後所有使用此憑證的查詢將立即被拒絕。';

  @override
  String get settingsMcpRevokeFailed => '撤銷憑證失敗';

  @override
  String get settingsMcpTokenModalTitle => 'MCP 存取權杖';

  @override
  String get settingsMcpTokenWarning => '此權杖僅顯示這一次，請立即複製並妥善保存；關閉後將無法再次查看明文。';

  @override
  String get settingsMcpTokenLabel => '存取權杖';

  @override
  String get settingsMcpConnectionUrlLabel => 'MCP 連線位址';

  @override
  String get settingsMcpCopyButton => '複製';

  @override
  String get settingsMcpCopied => '已複製！';

  @override
  String get settingsMcpCloseConfirm => '我已複製，關閉視窗';
}

/// The translations for Chinese, as used in China, using the Han script (`zh_Hans_CN`).
class AppLocalizationsZhHansCn extends AppLocalizationsZh {
  AppLocalizationsZhHansCn() : super('zh_Hans_CN');

  @override
  String get commonSave => '保存';

  @override
  String get commonCancel => '取消';

  @override
  String get commonDelete => '删除';

  @override
  String get commonEdit => '编辑';

  @override
  String get commonConfirm => '确认';

  @override
  String get commonClose => '关闭';

  @override
  String get commonLoading => '加载中…';

  @override
  String get commonAdd => '新增';

  @override
  String get commonBack => '返回';

  @override
  String get commonSearch => '搜索';

  @override
  String get commonLanguage => '语言';

  @override
  String get commonClear => '清除';

  @override
  String get commonSaving => '保存中...';

  @override
  String get commonConfirmDelete => '确认删除';

  @override
  String get commonPreviousPage => '上一页';

  @override
  String get commonNextPage => '下一页';

  @override
  String commonTotalRecords(Object count) {
    return '共 $count 条';
  }

  @override
  String get commonPerPage => '每页';

  @override
  String commonRecordsUnit(Object count) {
    return '$count 条';
  }

  @override
  String get commonNoData => '暂无数据';

  @override
  String get navSectionsFinance => '财务';

  @override
  String get navSectionsStocks => '股票';

  @override
  String get navSectionsSystem => '系统';

  @override
  String get navDashboard => '仪表盘';

  @override
  String get navTransactions => '交易记录';

  @override
  String get navReports => '报表';

  @override
  String get navBudget => '预算';

  @override
  String get navInfoBoard => '信息版';

  @override
  String get navAccounts => '账户';

  @override
  String get navCategories => '分类';

  @override
  String get navRecurring => '固定收支';

  @override
  String get navStocksPortfolio => '持仓总览';

  @override
  String get navStocksTransactions => '股票交易';

  @override
  String get navStocksDividends => '股利';

  @override
  String get navStocksRealized => '已实现盈亏';

  @override
  String get navStocksSettings => '股票设置';

  @override
  String get navExportImport => '导入 / 导出';

  @override
  String get navAccount => '账号';

  @override
  String get navApiCredits => 'API 访问';

  @override
  String get navAdmin => '管理';

  @override
  String get navTitleStocks => '持仓总览';

  @override
  String get navTitleStockTransactions => '股票交易';

  @override
  String get navTitleStockDividends => '股票股利';

  @override
  String get navTitleStockRealized => '已实现盈亏';

  @override
  String get navTitleStockSettings => '股票交易设置';

  @override
  String get navTitleApiCredits => 'API 使用与访问';

  @override
  String get shellFallbackUser => '用户';

  @override
  String get shellLogout => '退出登录';

  @override
  String get shellVersionInfo => '版本信息';

  @override
  String get shellOpenMenu => '打开菜单';

  @override
  String get shellSkipToContent => '跳到主要内容';

  @override
  String get shellThemeLight => '浅色';

  @override
  String get shellThemeSystem => '系统';

  @override
  String get shellThemeDark => '深色';

  @override
  String get shellChangelogLoading => '正在加载版本信息…';

  @override
  String get shellChangelogLoadFailed => '版本信息加载失败';

  @override
  String get shellChangelogUnknownVersion => '未知';

  @override
  String get shellChangelogCurrentVersion => '当前版本';

  @override
  String get shellChangelogUpdatableVersion => '可用版本';

  @override
  String get shellChangelogUpToDate => '已是最新版本';

  @override
  String get shellChangelogUpdatableContent => '更新内容';

  @override
  String get shellChangelogRecentContent => '最近更新';

  @override
  String get authLoginTab => '登录';

  @override
  String get authRegisterTab => '注册';

  @override
  String get authSubtitleLogin => '欢迎回来，请登录你的账号';

  @override
  String get authSubtitleRegister => '创建账号，开始记录你的财务';

  @override
  String get authEmailLabel => '电子邮箱';

  @override
  String get authPasswordLabel => '密码';

  @override
  String get authPasswordPlaceholder => '请输入密码';

  @override
  String get authDisplayNameLabel => '显示名称';

  @override
  String get authDisplayNamePlaceholder => '你的昵称';

  @override
  String get authRegisterPasswordPlaceholder => '至少 8 位，包含大小写字母和数字';

  @override
  String get authTogglePassword => '显示或隐藏密码';

  @override
  String get authTurnstileAria => 'Cloudflare Turnstile 真人验证';

  @override
  String get authLoginButton => '登录';

  @override
  String get authLoggingIn => '登录中…';

  @override
  String get authPasskeyButton => '使用 Passkey 登录';

  @override
  String get authPasskeyVerifying => '正在验证 Passkey…';

  @override
  String get authGoogleButton => '使用 Google 登录';

  @override
  String get authGoogleVerifying => '正在验证 Google…';

  @override
  String get authLineButton => '使用 LINE 登录';

  @override
  String get authLineVerifying => '正在验证 LINE…';

  @override
  String get authRegisterSubmit => '立即注册';

  @override
  String get authRegistering => '注册中…';

  @override
  String get authLineCallbackCompleting => '正在完成 LINE 验证...';

  @override
  String get authLineCallbackMissingCode => 'LINE 未返回授权码，请重新操作。';

  @override
  String get authLineCallbackLinkFailed => 'LINE 账号绑定失败';

  @override
  String get authLineCallbackLoginFailed => 'LINE 登录失败';

  @override
  String get authLineCallbackVerifyFailed => 'LINE 验证失败';

  @override
  String get authErrorsTurnstileRequired => '请先完成真人验证';

  @override
  String get authErrorsLoginFailed => '登录失败';

  @override
  String get authErrorsRegisterFailed => '注册失败';

  @override
  String get authErrorsGoogleNotConfigured => 'Google 登录尚未配置';

  @override
  String get authErrorsGoogleComponentNotLoaded => 'Google 登录组件尚未加载';

  @override
  String get authErrorsGoogleStateFailed => '无法创建 Google 登录状态';

  @override
  String get authErrorsGoogleNoCode => '未收到 Google 授权码';

  @override
  String get authErrorsGoogleFailed => 'Google 登录失败';

  @override
  String get authErrorsGoogleCancelled => 'Google 登录已取消';

  @override
  String get authErrorsPasskeyUnsupported => '当前浏览器不支持 Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed => '无法创建 Passkey 登录挑战';

  @override
  String get authErrorsPasskeyFailed => 'Passkey 登录失败';

  @override
  String get authErrorsLineNotConfigured => 'LINE 登录尚未配置';

  @override
  String get authErrorsLineFailed => 'LINE 登录失败';

  @override
  String get settingsTitle => '设置';

  @override
  String get settingsLanguageTitle => '语言';

  @override
  String get settingsLanguageDescription => '选择界面与通知（Email / LINE）使用的语言。';

  @override
  String get settingsLanguageSaved => '语言偏好已更新';

  @override
  String get settingsAccountTitle => '账号设置';

  @override
  String get settingsAccountProfileInfo => '账号信息';

  @override
  String get settingsAccountEmail => '电子邮箱';

  @override
  String get settingsAccountDisplayName => '显示名称';

  @override
  String get settingsAccountEditDisplayName => '修改显示名称';

  @override
  String get settingsAccountUpdateName => '更新名称';

  @override
  String get settingsAccountSaving => '保存中...';

  @override
  String get settingsAccountSetLocalPassword => '设置本地密码';

  @override
  String get settingsAccountChangePassword => '修改密码';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      '当前账号仅使用第三方登录。设置本地密码后，就可以用邮箱和密码登录。';

  @override
  String get settingsAccountCurrentPassword => '当前密码';

  @override
  String get settingsAccountNewPassword => '新密码';

  @override
  String get settingsAccountConfirmNewPassword => '确认新密码';

  @override
  String get settingsAccountPasswordPlaceholder => '至少 8 位，包含大小写字母、数字和特殊符号';

  @override
  String get settingsAccountUpdating => '更新中...';

  @override
  String get settingsAccountSetPassword => '设置密码';

  @override
  String get settingsAccountUpdatePassword => '更新密码';

  @override
  String get settingsAccountThemeTitle => '显示主题';

  @override
  String get settingsAccountThemeSystem => '跟随系统';

  @override
  String get settingsAccountThemeLight => '浅色模式';

  @override
  String get settingsAccountThemeDark => '深色模式';

  @override
  String get settingsAccountDefaultCurrency => '默认货币';

  @override
  String get settingsAccountCurrencyCode => '货币代码';

  @override
  String get settingsAccountUpdateDefaultCurrency => '更新默认货币';

  @override
  String get settingsAccountPasskeyTitle => 'Passkey 管理';

  @override
  String get settingsAccountNoPasskeys => '尚未注册任何 Passkey';

  @override
  String get settingsAccountAddPasskey => '+ 新增 Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Google 绑定';

  @override
  String get settingsAccountLineTitle => 'LINE 绑定';

  @override
  String get settingsAccountStatusPrefix => '当前状态：';

  @override
  String get settingsAccountLinkedGoogle => '已绑定 Google 账号';

  @override
  String get settingsAccountNotLinkedGoogle => '尚未绑定 Google 账号';

  @override
  String get settingsAccountLinkGoogle => '绑定 Google 账号';

  @override
  String get settingsAccountUnlink => '解除绑定';

  @override
  String get settingsAccountLinkedLine => '已绑定 LINE 账号';

  @override
  String get settingsAccountNotLinkedLine => '尚未绑定 LINE 账号';

  @override
  String get settingsAccountLinkLine => '绑定 LINE 账号';

  @override
  String get settingsAccountLineVerifying => '正在验证 LINE...';

  @override
  String get settingsAccountSessionsTitle => '已登录设备';

  @override
  String get settingsAccountRefresh => '刷新';

  @override
  String get settingsAccountDeviceName => '设备名称';

  @override
  String get settingsAccountLoginTime => '登录时间';

  @override
  String get settingsAccountLoginIp => '登录 IP';

  @override
  String get settingsAccountActions => '操作';

  @override
  String get settingsAccountUnknownDevice => '未知设备';

  @override
  String get settingsAccountCurrentDeviceSuffix => '（当前设备）';

  @override
  String get settingsAccountSignOut => '退出登录';

  @override
  String get settingsAccountNoSessions => '暂无已登录设备记录';

  @override
  String get settingsAccountAuditTitle => '登录审计记录';

  @override
  String get settingsAccountCountry => '国家或地区';

  @override
  String get settingsAccountMethod => '方式';

  @override
  String get settingsAccountDevice => '设备';

  @override
  String get settingsAccountAdminLogin => '管理员登录';

  @override
  String get settingsAccountYes => '是';

  @override
  String get settingsAccountNo => '否';

  @override
  String get settingsAccountDeleteTitle => '删除账号';

  @override
  String get settingsAccountDeleteDescription =>
      '删除账号后，你的交易、账户、股票、Passkey 和设置都会被永久移除，无法恢复。';

  @override
  String get settingsAccountDeleteButton => '删除我的账号';

  @override
  String get settingsAccountDeleteModalTitle => '确认删除账号';

  @override
  String get settingsAccountDeleteModalWarning =>
      '此操作会永久删除你的账号和全部数据，包括交易、账户、股票、Passkey 与设置，且无法恢复。';

  @override
  String get settingsAccountDeletePasswordLabel => '请输入密码以确认删除';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return '请输入账号邮箱“$email”以确认删除';
  }

  @override
  String get settingsAccountDeleting => '删除中…';

  @override
  String get settingsAccountDeletePermanently => '永久删除账号';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired => '请输入当前密码';

  @override
  String get settingsAccountMessagesNewPasswordRequired => '请输入新密码';

  @override
  String get settingsAccountMessagesPasswordTooShort => '新密码至少 8 个字符';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      '新密码需包含大写字母、小写字母、数字和特殊符号';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch => '两次输入的新密码不一致';

  @override
  String get settingsAccountMessagesLocalPasswordSet => '密码已设置，现在可以用密码登录';

  @override
  String get settingsAccountMessagesPasswordUpdated => '密码已更新';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed => '更新密码失败';

  @override
  String get settingsAccountMessagesDisplayNameRequired => '显示名称不能为空';

  @override
  String get settingsAccountMessagesDisplayNameUpdated => '显示名称已更新';

  @override
  String get settingsAccountMessagesUpdateFailed => '更新失败';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      '确定要删除这个 Passkey 吗？';

  @override
  String get settingsAccountMessagesCurrencyInvalid => '货币代码必须为 3 个字母';

  @override
  String get settingsAccountMessagesCurrencyUpdated => '默认货币已更新';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed => '默认货币更新失败';

  @override
  String get settingsAccountMessagesSessionLoggedOut => '该设备已退出登录';

  @override
  String get settingsAccountMessagesSessionLogoutFailed => '设备退出登录失败';

  @override
  String get settingsAccountMessagesPasskeyUnsupported => '当前浏览器不支持 Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Android 设备';

  @override
  String get settingsAccountMessagesComputerDevice => '电脑';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed => 'Passkey 注册失败';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      '粘贴 Google ID Token 以模拟绑定流程';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Google 账号已绑定';

  @override
  String get settingsAccountMessagesGoogleLinkFailed => 'Google 绑定失败';

  @override
  String get settingsAccountMessagesGoogleUnlinked => 'Google 账号已解除绑定';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed => 'Google 解除绑定失败';

  @override
  String get settingsAccountMessagesLineNotConfigured => 'LINE 登录尚未配置';

  @override
  String get settingsAccountMessagesLineLinkFailed => 'LINE 绑定失败';

  @override
  String get settingsAccountMessagesLineUnlinked => 'LINE 账号已解除绑定';

  @override
  String get settingsAccountMessagesLineUnlinkFailed => 'LINE 解除绑定失败';

  @override
  String get settingsAccountMessagesDeletePasswordRequired => '请输入密码以确认删除';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch => '请输入正确的账号邮箱以确认删除';

  @override
  String get settingsAccountMessagesDeleteFailed => '删除账号失败';

  @override
  String get dashboardTitle => '仪表盘';

  @override
  String dashboardSubtitle(Object month) {
    return '$month 的收入、支出、分类分布和最近交易。';
  }

  @override
  String get dashboardUncategorized => '未分类';

  @override
  String get dashboardKpiTotalIncome => '总收入';

  @override
  String get dashboardKpiTotalExpense => '总支出';

  @override
  String get dashboardKpiNet => '净额';

  @override
  String get dashboardKpiTodayExpense => '今日支出';

  @override
  String get dashboardKpiBankAccounts => '银行账户';

  @override
  String get dashboardKpiStockMarketValue => '股票总市值';

  @override
  String get dashboardOverviewTitle => '本月现金流概览';

  @override
  String get dashboardOverviewBalance => '本月结余';

  @override
  String get dashboardOverviewDeficit => '本月赤字';

  @override
  String get dashboardOverviewIncome => '收入';

  @override
  String get dashboardOverviewExpense => '支出';

  @override
  String get dashboardOverviewNet => '净额';

  @override
  String get dashboardRatioTitle => '收支比例';

  @override
  String get dashboardRatioIncomeShare => '收入占比';

  @override
  String get dashboardRatioExpenseShare => '支出占比';

  @override
  String get dashboardSectionsExpenseCategories => '支出分类';

  @override
  String get dashboardSectionsIncomeCategories => '收入分类';

  @override
  String get dashboardSectionsRecentTransactions => '最近交易';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return '最近 $count 条';
  }

  @override
  String get dashboardEmptyNoExpense => '本月暂无支出';

  @override
  String get dashboardEmptyNoIncome => '本月暂无收入';

  @override
  String get dashboardEmptyNoTransactions => '本月暂无交易';

  @override
  String get dashboardTableDate => '日期';

  @override
  String get dashboardTableCategory => '分类';

  @override
  String get dashboardTableNote => '备注';

  @override
  String get dashboardTableAmount => '金额';

  @override
  String get dashboardFiltersPreviousMonth => '上个月';

  @override
  String get dashboardFiltersNextMonth => '下个月';

  @override
  String get dashboardFiltersCurrentMonth => '本月';

  @override
  String get publicCommonBackHome => '返回首页';

  @override
  String get publicCommonPrivacy => '隐私政策';

  @override
  String get publicCommonTerms => '服务条款';

  @override
  String get publicCommonApiCredits => 'API 使用与致谢';

  @override
  String publicCommonLastUpdated(Object date) {
    return '最后更新：$date';
  }

  @override
  String get publicCommonMetadataTitle => 'AssetPilot - 个人财务控制中心';

  @override
  String get publicCommonMetadataDescription =>
      '可自托管、加密的个人财务管理工具，用于记账、预算、台股投资与分析。';

  @override
  String get publicCommonDatesApiCredits => '2026 年 6 月 11 日';

  @override
  String get publicCommonDatesPrivacy => '2026 年 6 月 17 日';

  @override
  String get publicCommonDatesTerms => '2026 年 6 月 11 日';

  @override
  String get publicHomeTagline => '个人财务控制中心';

  @override
  String get publicHomeLogin => '登录';

  @override
  String get publicHomeRegister => '创建账号';

  @override
  String get publicHomeBadge => '自托管、数据加密、AGPL v3';

  @override
  String get publicHomeHeadline1 => '你的财务控制中心';

  @override
  String get publicHomeHeadline2 => '登录前就能看清楚';

  @override
  String get publicHomeLeadBefore => '集中追踪台股、收入支出、预算、报表和审计记录。财务数据落地时使用';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter => '加密，不绑定云服务，也不依赖订阅，让你先了解产品，再决定是否登录。';

  @override
  String get publicHomeStartUsing => '开始使用';

  @override
  String get publicHomeCreateFirst => '先创建账号';

  @override
  String get publicHomeChipsOpenSource => '开源 AGPL v3';

  @override
  String get publicHomeChipsEncrypted => '本地加密存储';

  @override
  String get publicHomeChipsNoCloudLock => '不绑定外部云';

  @override
  String get publicHomeChipsDocker => 'Docker 一行部署';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => '核心模块';

  @override
  String get publicHomeStatsModulesSublabel => '记账、股票、报表、治理';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => '数据加密';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => '股价来源';

  @override
  String get publicHomeStatsStockSourceSublabel => '盘中、盘后、备用策略';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => '精确计算';

  @override
  String get publicHomeStatsPrecisionSublabel => 'decimal.js 逐笔盈亏';

  @override
  String get publicHomePreLoginNote =>
      '未登录也可以先了解 AssetPilot 的功能、数据处理方式与部署特性，再决定登录或创建账号。';

  @override
  String get publicHomeWhyLabel => '为什么选择 AssetPilot';

  @override
  String get publicHomeWhyTitle => '把日常记账、投资追踪和数据掌控放在同一个地方';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot 面向自主打理个人财务的用户，把收支、预算与台股投资集中整理，同时保留数据导出、审计和自托管部署的弹性。';

  @override
  String get publicHomePillarsFinanceTitle => '收支与预算管理';

  @override
  String get publicHomePillarsFinanceTag => '记账核心';

  @override
  String get publicHomePillarsFinanceItemsOne => '多账户余额追踪与跨账户转账';

  @override
  String get publicHomePillarsFinanceItemsTwo => '月度与分类预算进度管理';

  @override
  String get publicHomePillarsFinanceItemsThree => '固定收支自动生成交易';

  @override
  String get publicHomePillarsFinanceItemsFour => '批量调整分类、日期与删除';

  @override
  String get publicHomePillarsStocksTitle => '台股投资追踪';

  @override
  String get publicHomePillarsStocksTag => '股票模块';

  @override
  String get publicHomePillarsStocksItemsOne => 'TWSE 股价查询与除权息同步';

  @override
  String get publicHomePillarsStocksItemsTwo => 'FIFO 全精度已实现盈亏计算';

  @override
  String get publicHomePillarsStocksItemsThree => '股利记录与账户入款追踪';

  @override
  String get publicHomePillarsStocksItemsFour => '定期投资与退市标记管理';

  @override
  String get publicHomePillarsSecurityTitle => '安全与数据治理';

  @override
  String get publicHomePillarsSecurityTag => '治理能力';

  @override
  String get publicHomePillarsSecurityItemsOne => 'ChaCha20-Poly1305 落地加密';

  @override
  String get publicHomePillarsSecurityItemsTwo => '密码、Google、Passkey 三种登录方式';

  @override
  String get publicHomePillarsSecurityItemsThree => '导出导入、备份还原与审计日志';

  @override
  String get publicHomePillarsSecurityItemsFour => 'Rate limit、CSP 与 CSV 防注入保护';

  @override
  String get publicHomePillarsSelfHostedTitle => '自托管部署与契约';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne => 'Docker 一行启动';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => '支持 amd64 与 arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree => 'OpenAPI 3.2 契约文档';

  @override
  String get publicHomePillarsSelfHostedItemsFour => 'URL 优先路由，可直接收藏和刷新';

  @override
  String get publicHomeQuickStartLabel => '快速开始';

  @override
  String get publicHomeQuickStartTitle => '60 秒跑在你自己的服务器上';

  @override
  String get publicHomeQuickStartDescription =>
      '使用 Docker 快速启动，首次运行会自动生成 JWT 与数据库加密密钥。支持 amd64、arm64，适合部署在 NAS、VPS 或自己的 Docker 主机上。';

  @override
  String get publicHomeQuickStartChipsImage => '约 180 MB 镜像';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => '内置健康检查';

  @override
  String get publicHomeQuickStartChipsKeys => '密钥首次启动自动生成';

  @override
  String get publicHomeTechLabel => '技术栈';

  @override
  String get publicHomeTechTitle => '技术栈与公开信息入口';

  @override
  String get publicHomeTechDescription =>
      '清楚列出主要技术、外部数据来源和授权信息，让用户开始使用前就能了解服务如何运作。';

  @override
  String get publicHomeFooter => 'GNU AGPL v3。个人资产管理，由你自托管、掌控和备份。';

  @override
  String get publicApiCreditsPageTitle => 'API 使用与授权';

  @override
  String get publicApiCreditsPageMetadataTitle => 'API 使用与授权 — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => '外部 API 透明披露';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot 只会在功能需要时连接外部数据源。这里列出各项 API 的用途、授权信息与数据传输范围，方便自部署时确认合规状态。';

  @override
  String get publicApiCreditsPageStatsExternalServices => '外部服务';

  @override
  String get publicApiCreditsPageStatsFreeSupported => '支持免费';

  @override
  String get publicApiCreditsPageStatsAttributionRequired => '需注明来源';

  @override
  String get publicApiCreditsPageServiceKindsData => '数据查询';

  @override
  String get publicApiCreditsPageServiceKindsAuth => '身份验证';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Email 通道';

  @override
  String get publicApiCreditsPageServiceKindsBackup => '云端备份';

  @override
  String get publicApiCreditsPageTransparencyTitle => '数据透明度';

  @override
  String get publicApiCreditsPageTransparencyText =>
      '以下场景只传送完成对应功能所需的最小数据，不会把你的财务明细交给第三方服务。';

  @override
  String get publicApiCreditsPageMinNecessary => '最小必要数据原则';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => '汇率同步';

  @override
  String get publicApiCreditsPageUsageNotesFxText => '只查询公开汇率数据，不会传送个人财务明细。';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle => '台股数据';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      '只带股票代码与市场数据，不包含账户、持仓成本或交易记录。';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => '登录审计';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo 仅用于显示登录记录中的国家或地区信息。';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => '第三方登录';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google、LINE 登录只会在你主动登录或绑定时启用。';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => '云端备份';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4 只会在管理员主动上传备份时接收完整数据库备份文件。';

  @override
  String get publicApiCreditsPageServiceListTitle => '外部服务清单';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return '共 $total 项服务，其中 $free 项支持免费方案，$paid 项可使用付费方案。';
  }

  @override
  String get publicApiCreditsPageOfficialSite => '官方网站';

  @override
  String get publicApiCreditsPageFreePlan => '免费方案';

  @override
  String get publicApiCreditsPagePaidPlan => '付费方案';

  @override
  String get publicApiCreditsPageSupported => '支持';

  @override
  String get publicApiCreditsPageUnavailable => '未提供';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate => '全球实时汇率（基础货币 TWD）';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'IP 地址地理位置查询（登录审计国家或地区字段）';

  @override
  String get publicApiCreditsPageDescriptionsTwse => '股票实时报价、除权息数据、股票名称查询';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Google SSO 登录';

  @override
  String get publicApiCreditsPageDescriptionsLine => 'LINE 登录与账号绑定';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Email 发送通道（管理员资产统计报表，搭配 Gmail / Outlook 等 SMTP server）';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Email 发送通道（管理员资产统计报表，HTTP REST API）';

  @override
  String get publicApiCreditsPageDescriptionsResend => 'Email 发送通道（管理员资产统计报表）';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      '管理员整份 PostgreSQL SQL 备份的 S3 兼容对象存储目的地';

  @override
  String get publicAppCallbackReturningTitle => '正在返回 AssetPilot App...';

  @override
  String get publicAppCallbackReturningBody =>
      '如果没有自动返回，请确认已安装最新版 AssetPilot Android App。';

  @override
  String get publicAppCallbackPasskeyTitle => 'AssetPilot Passkey 登录';

  @override
  String get publicAppCallbackPasskeyStarting => '正在启动 Passkey 登录...';

  @override
  String get publicAppCallbackPasskeyUnsupported => '当前浏览器不支持 Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed => '无法创建 Passkey 登录挑战';

  @override
  String get publicAppCallbackPasskeyVerify => '请在设备上完成 Passkey 验证...';

  @override
  String get publicAppCallbackPasskeyLoginFailed => 'Passkey 登录失败';

  @override
  String get publicAppCallbackReturningApp => '正在返回 App...';

  @override
  String get publicAppCallbackAppTicketFailed => '无法创建 App 登录凭证';

  @override
  String get featuresCommonActions => '操作';

  @override
  String get featuresCommonAccount => '账户';

  @override
  String get featuresCommonAmount => '金额';

  @override
  String get featuresCommonDate => '日期';

  @override
  String get featuresCommonEndDate => '结束';

  @override
  String get featuresCommonNote => '备注';

  @override
  String get featuresCommonStartDate => '开始';

  @override
  String get featuresCommonStatus => '状态';

  @override
  String get featuresCommonStock => '股票';

  @override
  String get featuresCommonType => '类型';

  @override
  String get featuresCommonName => '名称';

  @override
  String get featuresCommonCurrency => '货币';

  @override
  String get featuresCommonExchangeRate => '汇率';

  @override
  String get featuresCommonIncome => '收入';

  @override
  String get featuresCommonExpense => '支出';

  @override
  String get featuresCommonUncategorized => '未分类';

  @override
  String get featuresCommonUnspecified => '未指定';

  @override
  String get featuresCommonAutoCalculate => '自动计算';

  @override
  String get featuresCommonExcludeFromStats => '不计入统计';

  @override
  String get featuresCommonTopLevelCategory => '— 顶层分类 —';

  @override
  String get featuresCommonNotRecorded => '—';

  @override
  String get featuresCategoriesTitle => '分类管理';

  @override
  String get featuresCategoriesExpenseTab => '支出分类';

  @override
  String get featuresCategoriesIncomeTab => '收入分类';

  @override
  String get featuresCategoriesAddCategory => '新增分类';

  @override
  String get featuresCategoriesEditCategory => '编辑分类';

  @override
  String get featuresCategoriesNewCategory => '新增分类';

  @override
  String get featuresCategoriesNameLabel => '名称 *';

  @override
  String get featuresCategoriesTypeLabel => '类型';

  @override
  String get featuresCategoriesParentLabel => '父分类';

  @override
  String get featuresCategoriesColorLabel => '颜色';

  @override
  String get featuresCategoriesExpense => '支出';

  @override
  String get featuresCategoriesIncome => '收入';

  @override
  String get featuresCategoriesDeleteMessage => '删除这个分类？子分类也会一并删除。';

  @override
  String get featuresCategoriesMessagesNameRequired => '请输入分类名称';

  @override
  String get featuresCategoriesMessagesDeleteFailed => '删除失败';

  @override
  String get featuresBudgetTitle => '预算管理';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$year 年 $month 月';
  }

  @override
  String get featuresBudgetTotalBudget => '本月总预算';

  @override
  String get featuresBudgetSpent => '已支出';

  @override
  String get featuresBudgetAddBudget => '新增预算';

  @override
  String get featuresBudgetEditBudget => '编辑预算';

  @override
  String get featuresBudgetNewBudget => '新增预算';

  @override
  String get featuresBudgetCategoryLabel => '分类（留空表示总预算）';

  @override
  String get featuresBudgetTotalBudgetOption => '— 总预算 —';

  @override
  String get featuresBudgetAmountLabel => '预算金额 *';

  @override
  String get featuresBudgetTotalBudgetName => '（总预算）';

  @override
  String get featuresBudgetOverBudget => '已超预算';

  @override
  String get featuresBudgetDeleteMessage => '删除这个预算设置？';

  @override
  String get featuresBudgetMessagesAmountRequired => '请输入有效的预算金额';

  @override
  String get featuresReportsTitle => '报表';

  @override
  String get featuresReportsTabsCategory => '分类分析';

  @override
  String get featuresReportsTabsTrend => '趋势分析';

  @override
  String get featuresReportsTabsDaily => '每日支出';

  @override
  String get featuresReportsPeriodsThisMonth => '本月';

  @override
  String get featuresReportsPeriodsLastMonth => '上月';

  @override
  String get featuresReportsPeriodsLast3 => '近 3 个月';

  @override
  String get featuresReportsPeriodsLast6 => '近 6 个月';

  @override
  String get featuresReportsPeriodsThisYear => '今年';

  @override
  String get featuresReportsPeriodsCustom => '自定义';

  @override
  String get featuresReportsPeriodLabel => '期间';

  @override
  String get featuresReportsStart => '开始';

  @override
  String get featuresReportsEnd => '结束';

  @override
  String get featuresReportsCurrentTotal => '本期合计';

  @override
  String get featuresReportsComparedPrevious => '与上一期相比';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta，上一期无数据';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta（$rate%）';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return '$type明细';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return '合计：$amount';
  }

  @override
  String get featuresReportsSelectedCategory => '已选分类：';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return '，金额 $amount';
  }

  @override
  String get featuresReportsViewTransactions => '查看相关交易';

  @override
  String get featuresRecurringTitle => '固定收支';

  @override
  String get featuresRecurringAdd => '新增固定项目';

  @override
  String get featuresRecurringEdit => '编辑固定项目';

  @override
  String get featuresRecurringCreate => '新增固定项目';

  @override
  String get featuresRecurringAmountLabel => '金额 *';

  @override
  String get featuresRecurringFxFeeLabel => '海外手续费（TWD）';

  @override
  String get featuresRecurringFxFeePlaceholder => '留空则由系统按卡片费率自动计算';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return '卡片海外手续费率 $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return '，建议 NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading => '正在查询最新汇率...';

  @override
  String get featuresRecurringCategory => '分类';

  @override
  String get featuresRecurringFrequency => '频率';

  @override
  String get featuresRecurringStartDate => '开始日期';

  @override
  String featuresRecurringNextRun(Object date) {
    return '下次执行：$date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return '分类：$name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return '账户：$name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return '海外手续费：NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => '删除这个固定收支设置？';

  @override
  String get featuresRecurringCreatingTransfer => '创建中...';

  @override
  String get featuresRecurringConfirmTransfer => '确认转账';

  @override
  String get featuresRecurringFrequencyLabelsDaily => '每天';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => '每周';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => '每月';

  @override
  String get featuresRecurringFrequencyLabelsYearly => '每年';

  @override
  String get featuresRecurringMessagesAmountRequired => '请输入有效金额';

  @override
  String get featuresDataTransferTitle => '数据导入导出';

  @override
  String get featuresDataTransferExportStartDate => '导出开始日期';

  @override
  String get featuresDataTransferExportEndDate => '导出结束日期';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return '支持 CSV 导出与导入。字段：$columns';
  }

  @override
  String get featuresDataTransferExportCsv => '导出 CSV';

  @override
  String get featuresDataTransferExporting => '导出中...';

  @override
  String get featuresDataTransferChooseCsv => '选择 CSV 导入';

  @override
  String get featuresDataTransferImporting => '导入中...';

  @override
  String featuresDataTransferImported(Object count) {
    return '导入成功：$count 条';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return '跳过：$count 条';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return '自动创建分类：$items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return '自动创建账户：$items';
  }

  @override
  String get featuresDataTransferWarning => '警告';

  @override
  String get featuresDataTransferError => '错误';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return '第 $row 行：$reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => '账户';

  @override
  String get featuresDataTransferModulesTransactions => '交易记录';

  @override
  String get featuresDataTransferModulesCategories => '分类';

  @override
  String get featuresDataTransferModulesStockTransactions => '股票交易';

  @override
  String get featuresDataTransferModulesStockDividends => '股利记录';

  @override
  String get featuresDataTransferMessagesExportSuccess => '导出成功';

  @override
  String get featuresDataTransferMessagesExportFailed => '导出失败';

  @override
  String get featuresDataTransferMessagesEmptyCsv => 'CSV 没有可导入数据';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return '$name 导入完成';
  }

  @override
  String get featuresDataTransferMessagesImportFailed => '导入失败';

  @override
  String get featuresDataTransferMessagesBundleExportDone => '完整备份下载完成';

  @override
  String get featuresDataTransferMessagesBundleExportFailed => '完整备份下载失败';

  @override
  String get featuresDataTransferMessagesRestoreDone => '还原完成';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed => '备份还原失败';

  @override
  String get featuresDataTransferMessagesDbExportDone => '数据库备份下载完成';

  @override
  String get featuresDataTransferMessagesDbExportFailed => '数据库备份失败';

  @override
  String get featuresDataTransferMessagesDbRestoreDone => '数据库还原成功';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed => '数据库还原失败';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return '已上传到 $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed => 'MEGA S4 备份失败';

  @override
  String get featuresDataTransferMessagesRequireOneField => '请至少填写一个字段';

  @override
  String get featuresDataTransferMessagesSaved => '设置已保存';

  @override
  String get featuresDataTransferMessagesSaveFailed => '设置保存失败';

  @override
  String get featuresDataTransferBundleTitle => '完整数据备份（含图片）';

  @override
  String get featuresDataTransferBundleDescription1 =>
      '一键打包下载你的全部个人数据（交易、账户、分类、预算、账期、汇率、股票，以及交易凭证图片）为单一 ZIP。';

  @override
  String get featuresDataTransferBundleDescription2 => '上传同一份 ZIP 即可还原。';

  @override
  String get featuresDataTransferBundleRestorePrefix => '还原采用';

  @override
  String get featuresDataTransferBundleMergeMode => '合并方式';

  @override
  String get featuresDataTransferBundleRestoreMiddle => '：已存在的数据会自动跳过，只补回缺少的；';

  @override
  String get featuresDataTransferBundleNoOverwrite => '不会删除或覆盖你现有的数据';

  @override
  String get featuresDataTransferBundleDownload => '下载完整备份';

  @override
  String get featuresDataTransferBundleDownloading => '正在打包下载...';

  @override
  String get featuresDataTransferBundleRestore => '上传备份还原';

  @override
  String get featuresDataTransferBundleRestoring => '还原中...';

  @override
  String get featuresDataTransferDatabaseTitle => '整库备份 / 还原';

  @override
  String get featuresDataTransferDatabaseDescription =>
      '仅管理员可操作。SQLite 模式下载 `.db` 备份；PostgreSQL 模式下载 `.sql` 备份，还原时请上传对应格式。';

  @override
  String get featuresDataTransferDatabaseDownload => '下载数据库备份';

  @override
  String get featuresDataTransferDatabaseDownloading => '下载中...';

  @override
  String get featuresDataTransferDatabaseRestore => '选择备份还原';

  @override
  String get featuresDataTransferDatabaseRestoring => '还原中...';

  @override
  String get featuresDataTransferMegaTitle => 'MEGA S4 云端备份';

  @override
  String get featuresDataTransferMegaDescription =>
      '将当前完整 SQLite 备份以对象上传方式存入 MEGA S4 bucket。连接信息由服务器环境变量设置，不会在浏览器输入或显示密钥。';

  @override
  String get featuresDataTransferMegaState => '状态：';

  @override
  String get featuresDataTransferMegaConfigured => '已设置';

  @override
  String get featuresDataTransferMegaNotConfigured => '尚未完整设置';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket：';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return '缺少环境变量：$items';
  }

  @override
  String get featuresDataTransferMegaUpload => '上传备份到 MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => '上传中...';

  @override
  String get featuresDataTransferMegaConfigure => '设置';

  @override
  String get featuresDataTransferMegaCancelConfigure => '取消设置';

  @override
  String get featuresDataTransferMegaFormHelp =>
      '设置会写入服务器持久化配置文件并立即生效。密钥字段请重新输入，不会预填。';

  @override
  String get featuresDataTransferMegaBucketName => 'Bucket 名称';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefix（可选）';

  @override
  String get featuresDataTransferMegaEndpoint => 'Endpoint（可选，留空自动推算）';

  @override
  String get featuresDataTransferMegaSaveSettings => '保存设置';

  @override
  String get featuresAccountsTitle => '账户管理';

  @override
  String get featuresAccountsTypeLabelsBank => '银行账户';

  @override
  String get featuresAccountsTypeLabelsCredit_card => '信用卡';

  @override
  String get featuresAccountsTypeLabelsCash => '现金';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => '电子钱包';

  @override
  String get featuresAccountsTypeLabelsOther => '其他';

  @override
  String get featuresAccountsTotalAssets => '总资产';

  @override
  String get featuresAccountsCreditOutstanding => '信用卡待还款';

  @override
  String get featuresAccountsAddAccount => '新增账户';

  @override
  String get featuresAccountsEditAccount => '编辑账户';

  @override
  String get featuresAccountsNewAccount => '新增账户';

  @override
  String get featuresAccountsAccountName => '账户名称 *';

  @override
  String get featuresAccountsInitialBalance => '初始余额';

  @override
  String get featuresAccountsInitialBalanceEdit => '初始余额 / 当前设置';

  @override
  String get featuresAccountsLinkedBank => '所属银行';

  @override
  String get featuresAccountsUngrouped => '未分组';

  @override
  String get featuresAccountsOverseasFeeRate => '海外手续费率（%）';

  @override
  String get featuresAccountsStatementClosingDay => '账单日（每月 1-31 日）';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      '例如 15。留空则不统计本期消费。';

  @override
  String get featuresAccountsExcludeFromTotal => '不计入总资产';

  @override
  String get featuresAccountsOtherAccounts => '其他账户';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return '折算合计：$amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return '关联银行：$name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return '海外手续费率：$rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return '每月账单日：$day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return '本期消费：$amount';
  }

  @override
  String get featuresAccountsLastCycleBill => '上期账单：';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return '消费 $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return '已还 $amount';
  }

  @override
  String get featuresAccountsViewCycles => '查看账期明细 ›';

  @override
  String get featuresAccountsRepaymentTitle => '信用卡还款';

  @override
  String get featuresAccountsRepaymentPaymentAccount => '付款账户';

  @override
  String get featuresAccountsRepaymentPaymentDate => '还款日期';

  @override
  String get featuresAccountsRepaymentNoLinkedCards => '该银行没有关联信用卡';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return '当前余额：$amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => '还款金额';

  @override
  String get featuresAccountsRepaymentConfirm => '确认还款';

  @override
  String get featuresAccountsDeleteMessage => '删除这个账户？';

  @override
  String get featuresAccountsCyclesTitle => '每期账单明细';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name　每月账单日 $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      '“还款”会对应到它所清偿的账单（账单日后下一期还清的金额会计回该期账单）。';

  @override
  String get featuresAccountsCyclesPeriod => '期间';

  @override
  String get featuresAccountsCyclesSpending => '消费';

  @override
  String get featuresAccountsCyclesPayment => '实际还款';

  @override
  String get featuresAccountsCyclesCurrent => '本期';

  @override
  String get featuresAccountsFxTitle => '汇率管理';

  @override
  String get featuresAccountsFxAutoUpdate => '自动更新汇率';

  @override
  String get featuresAccountsFxSyncNow => '立即同步';

  @override
  String get featuresAccountsFxSyncing => '同步中...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return '上次同步：$date';
  }

  @override
  String get featuresAccountsFxCurrency => '货币';

  @override
  String get featuresAccountsFxUnitToTwd => '1 单位 = TWD';

  @override
  String get featuresAccountsFxEmpty => '尚未设置任何外币汇率';

  @override
  String get featuresAccountsFxCurrencyLabel => '货币（如 USD）';

  @override
  String get featuresAccountsFxRateToTwd => '对 TWD 汇率';

  @override
  String get featuresAccountsFxAddOrUpdate => '新增 / 更新';

  @override
  String get featuresAccountsMessagesNameRequired => '请输入账户名称';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired => '请选择付款账户';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      '请至少输入一张信用卡的还款金额';

  @override
  String get featuresAccountsMessagesCurrencyInvalid => '货币格式错误（需为 3 个英文字母）';

  @override
  String get featuresAccountsMessagesRateInvalid => '请输入有效汇率';

  @override
  String get featuresAccountsMessagesSaved => '已保存';

  @override
  String get featuresAccountsMessagesSaveFailed => '保存失败';

  @override
  String get featuresAccountsMessagesDeleteFailed => '删除失败';

  @override
  String get featuresAccountsMessagesRatesUpdated => '汇率已更新';

  @override
  String get featuresAccountsMessagesSyncFailed => '同步失败';

  @override
  String get featuresAccountsMessagesLoadFailed => '加载失败';

  @override
  String get featuresTransactionsTitle => '交易记录';

  @override
  String get featuresTransactionsSearchPlaceholder => '搜索备注...';

  @override
  String get featuresTransactionsAllTypes => '全部类型';

  @override
  String get featuresTransactionsAllAccounts => '全部账户';

  @override
  String get featuresTransactionsAllCategories => '全部分类';

  @override
  String get featuresTransactionsTransfer => '转账';

  @override
  String get featuresTransactionsFuture => '未来交易';

  @override
  String get featuresTransactionsExcludeTransfer => '排除转账';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name（全部）';
  }

  @override
  String get featuresTransactionsStartDateTitle => '开始日期';

  @override
  String get featuresTransactionsEndDateTitle => '结束日期';

  @override
  String get featuresTransactionsAdd => '新增交易';

  @override
  String get featuresTransactionsEdit => '编辑交易';

  @override
  String get featuresTransactionsCreate => '新增交易';

  @override
  String get featuresTransactionsAccountTransfer => '账户转账';

  @override
  String get featuresTransactionsBatchCategory => '批量修改分类';

  @override
  String get featuresTransactionsBatchDate => '批量修改日期';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return '删除所选（$count）';
  }

  @override
  String get featuresTransactionsPageIncome => '本页收入';

  @override
  String get featuresTransactionsPageExpense => '本页支出';

  @override
  String get featuresTransactionsPageTotal => '本页合计';

  @override
  String get featuresTransactionsPageSummaryAria => '本页交易统计';

  @override
  String get featuresTransactionsEmpty => '没有符合条件的交易';

  @override
  String featuresTransactionsSource(Object name) {
    return '来源：$name';
  }

  @override
  String get featuresTransactionsFxFee => '海外刷卡手续费';

  @override
  String get featuresTransactionsPhotoOne => '照片 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count 张照片';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => '日期 *';

  @override
  String get featuresTransactionsAmountRequiredLabel => '金额 *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return '汇率（1 $currency = ? TWD）';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder => '留空则使用系统汇率';

  @override
  String get featuresTransactionsLatestRateLoading => '正在查询最新汇率...';

  @override
  String get featuresTransactionsFxFeePlaceholder => '留空则由系统按卡片费率自动计算';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return '卡片海外手续费率 $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return '，建议 NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => '照片';

  @override
  String get featuresTransactionsLoadingPhotos => '正在加载照片...';

  @override
  String get featuresTransactionsTakePhoto => '拍照';

  @override
  String get featuresTransactionsChooseImage => '选择图片';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return '手机可直接拍照或从相册选择。最多 5 张，每张不超过 $maxMb MB。';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return '新增照片 $count';
  }

  @override
  String get featuresTransactionsRemove => '移除';

  @override
  String get featuresTransactionsChoosePhoto => '选择照片';

  @override
  String get featuresTransactionsTransferOut => '转出账户 *';

  @override
  String get featuresTransactionsTransferIn => '转入账户 *';

  @override
  String get featuresTransactionsSelectPlaceholder => '请选择';

  @override
  String get featuresTransactionsCreating => '创建中...';

  @override
  String get featuresTransactionsConfirmTransfer => '确认转账';

  @override
  String get featuresTransactionsBatchCategoryTitle => '批量修改分类';

  @override
  String get featuresTransactionsBatchDateTitle => '批量修改日期';

  @override
  String get featuresTransactionsNewCategory => '新分类';

  @override
  String get featuresTransactionsNewDate => '新日期';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return '应用到 $count 条';
  }

  @override
  String get featuresTransactionsDeleteMessage => '确定删除这条交易记录？此操作无法撤销。';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return '确定删除所选的 $count 条交易？';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return '交易已更新，但$message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return '交易已创建，但$message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked => '转账交易请删除后重新创建';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      '海外刷卡手续费为自动生成，请编辑对应的外币交易（修改后手续费会自动同步）';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed => '照片上传失败';

  @override
  String get featuresTransactionsMessagesDateRequired => '请选择日期';

  @override
  String get featuresTransactionsMessagesAmountRequired => '请输入有效金额';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      '请选择转出和转入账户';

  @override
  String get featuresTransactionsMessagesTransferSameAccount => '转出与转入账户不能相同';

  @override
  String get featuresTransactionsTypeLabelsIncome => '收入';

  @override
  String get featuresTransactionsTypeLabelsExpense => '支出';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => '转入';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => '转出';

  @override
  String get featuresStocksTabsPortfolio => '持仓总览';

  @override
  String get featuresStocksTabsTransactions => '交易记录';

  @override
  String get featuresStocksTabsDividends => '股利记录';

  @override
  String get featuresStocksTabsRealized => '已实现盈亏';

  @override
  String get featuresStocksTabsSettings => '交易设置';

  @override
  String get featuresStocksCommonStockLabel => '股票';

  @override
  String get featuresStocksCommonStockRequired => '股票 *';

  @override
  String get featuresStocksCommonStockTypeStock => '股票';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => '权证';

  @override
  String get featuresStocksCommonDate => '日期';

  @override
  String get featuresStocksCommonShares => '股数';

  @override
  String get featuresStocksCommonPrice => '价格';

  @override
  String get featuresStocksCommonTotal => '合计';

  @override
  String get featuresStocksCommonReturnRate => '收益率';

  @override
  String get featuresStocksCommonOverallReturnRate => '总体收益率';

  @override
  String get featuresStocksCommonEstimatedPL => '预估盈亏';

  @override
  String get featuresStocksCommonRealizedPL => '已实现盈亏';

  @override
  String get featuresStocksCommonTotalRealizedPL => '已实现盈亏合计';

  @override
  String get featuresStocksCommonYearRealizedPL => '今年已实现盈亏';

  @override
  String get featuresStocksCommonRealizedCount => '已实现记录';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count 条';
  }

  @override
  String get featuresStocksCommonSellAverage => '卖出均价';

  @override
  String get featuresStocksCommonCostAverage => '成本均价';

  @override
  String get featuresStocksCommonFeeAndTax => '手续费 + 税';

  @override
  String get featuresStocksCommonCashDividend => '现金股利';

  @override
  String get featuresStocksCommonStockDividend => '股票股利';

  @override
  String get featuresStocksCommonStockSymbol => '股票代码 *';

  @override
  String get featuresStocksCommonStockName => '股票名称';

  @override
  String get featuresStocksCommonSearching => '搜索中...';

  @override
  String get featuresStocksCommonCancelAccounting => '— 不入账（仅股票股利）—';

  @override
  String get featuresStocksCommonAutoCalculate => '自动计算';

  @override
  String get featuresStocksCommonBuy => '买入';

  @override
  String get featuresStocksCommonSell => '卖出';

  @override
  String get featuresStocksPortfolioTitle => '持仓总览';

  @override
  String get featuresStocksPortfolioTotalMarketValue => '总市值';

  @override
  String get featuresStocksPortfolioTotalCost => '总投入成本';

  @override
  String get featuresStocksPortfolioTotalDividend => '累计股利';

  @override
  String get featuresStocksPortfolioAddStock => '新增股票';

  @override
  String get featuresStocksPortfolioEditStock => '编辑股票';

  @override
  String get featuresStocksPortfolioNewStock => '新增股票';

  @override
  String get featuresStocksPortfolioUpdatePrices => '更新股价';

  @override
  String get featuresStocksPortfolioBatchUpdate => '批量自动更新';

  @override
  String get featuresStocksPortfolioUpdating => '更新中...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      '优先由浏览器端向台湾证券交易所公开 API 查询；如果浏览器请求被拦截，会改用登录后的用户 API 代理查询并更新持仓。';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return '更新完成：$updated 支成功。';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return '更新完成：$updated 支成功，$failed 支失败。';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      '浏览器端无法取得 TWSE 行情数据';

  @override
  String get featuresStocksPortfolioHeldShares => '持有股数';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count 股';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => '当前价格';

  @override
  String get featuresStocksPortfolioMarketValue => '市值';

  @override
  String featuresStocksPortfolioDividendMonths(Object months) {
    return '配息月份：$months';
  }

  @override
  String get featuresStocksPortfolioDividendMonthsEmpty => '尚无配息记录';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired => '请输入股票代码';

  @override
  String get featuresStocksTransactionsTitle => '股票交易记录';

  @override
  String get featuresStocksTransactionsAddTransaction => '新增交易';

  @override
  String get featuresStocksTransactionsEditTransaction => '编辑交易';

  @override
  String get featuresStocksTransactionsNewTransaction => '新增交易';

  @override
  String get featuresStocksTransactionsTypeLabel => '类型';

  @override
  String get featuresStocksTransactionsDateLabel => '日期 *';

  @override
  String get featuresStocksTransactionsSharesLabel => '股数 *';

  @override
  String get featuresStocksTransactionsPriceLabel => '价格 *';

  @override
  String get featuresStocksTransactionsFeeLabel => '手续费';

  @override
  String get featuresStocksTransactionsTaxLabel => '交易税';

  @override
  String get featuresStocksTransactionsDeleteMessage => '删除这条交易记录？';

  @override
  String get featuresStocksTransactionsMessagesStockRequired => '请选择股票';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired => '请输入有效股数';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired => '请输入有效价格';

  @override
  String get featuresStocksDividendsTitle => '股利';

  @override
  String get featuresStocksDividendsAddDividend => '新增股利';

  @override
  String get featuresStocksDividendsEditDividend => '编辑股利';

  @override
  String get featuresStocksDividendsNewDividend => '新增股利';

  @override
  String get featuresStocksDividendsSyncExDividends => '同步除权息';

  @override
  String get featuresStocksDividendsSyncDescription =>
      '根据持仓从 TWSE 自动同步历史除权息数据。';

  @override
  String get featuresStocksDividendsSyncStart => '开始同步';

  @override
  String get featuresStocksDividendsSyncing => '同步中...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return '新增 $synced 条，跳过 $skipped 条。';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return '新增 $synced 条，跳过 $skipped 条，$failed 条失败。';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel => '现金股利（NT\$）';

  @override
  String get featuresStocksDividendsStockDividendLabel => '股票股利（股）';

  @override
  String get featuresStocksDividendsDepositAccount => '入款账户';

  @override
  String get featuresStocksDividendsDeleteMessage => '删除这条股利记录？';

  @override
  String get featuresStocksDividendsMessagesStockRequired => '请选择股票';

  @override
  String get featuresStocksDividendsMessagesDividendRequired => '请输入现金股利或股票股利';

  @override
  String get featuresStocksRealizedTitle => '已实现盈亏';

  @override
  String get featuresStocksSettingsTitle => '交易设置';

  @override
  String get featuresStocksSettingsFeeTitle => '手续费 / 交易税设置';

  @override
  String get featuresStocksSettingsFeeRate => '手续费率';

  @override
  String get featuresStocksSettingsFeeDiscount => '折扣（0-1）';

  @override
  String get featuresStocksSettingsFeeMinLot => '最低手续费（整股）';

  @override
  String get featuresStocksSettingsFeeMinOdd => '最低手续费（零股）';

  @override
  String get featuresStocksSettingsSellTaxRateStock => '卖出税率（股票）';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => '卖出税率（ETF）';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant => '卖出税率（权证）';

  @override
  String get featuresStocksSettingsSellTaxMin => '最低交易税';

  @override
  String get featuresStocksSettingsSaveSettings => '保存设置';

  @override
  String get featuresStocksSettingsStockStatusTitle => '股票状态管理';

  @override
  String get featuresStocksSettingsCurrentPrice => '当前价格';

  @override
  String get featuresStocksSettingsNormalTracking => '跟踪中';

  @override
  String get featuresStocksSettingsDelisted => '已退市';

  @override
  String get featuresStocksSettingsRestoreTracking => '恢复跟踪';

  @override
  String get featuresStocksSettingsMarkDelisted => '标记退市';

  @override
  String get featuresStocksSettingsRecurringTitle => '股票定期投资';

  @override
  String get featuresStocksSettingsAddRecurringShort => '新增';

  @override
  String get featuresStocksSettingsEditRecurring => '编辑定期投资';

  @override
  String get featuresStocksSettingsNewRecurring => '新增定期投资';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => '金额（NT\$）*';

  @override
  String get featuresStocksSettingsFrequency => '频率';

  @override
  String get featuresStocksSettingsStartDate => '开始日期';

  @override
  String get featuresStocksSettingsLastGenerated => '上次生成';

  @override
  String get featuresStocksSettingsActive => '启用中';

  @override
  String get featuresStocksSettingsInactive => '已停用';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm => '删除这个定期投资设置？';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => '每天';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => '每周';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => '每月';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => '每年';

  @override
  String get featuresStocksSettingsMessagesSaved => '设置已保存';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return '保存失败：$message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired => '请选择股票';

  @override
  String get featuresStocksSettingsMessagesAmountRequired => '请输入有效金额';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol 已$status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus => '恢复为正常跟踪';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus => '标记为退市';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed => '更新退市状态失败';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => '每日现金流报表';

  @override
  String get notificationsReportTypeWeekly => '每周现金流报表';

  @override
  String get notificationsReportTypeMonthly => '每月现金流报表';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return '每日现金流报表｜$date（周$weekday）';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return '每周现金流报表｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return '每月现金流报表｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name，$date（周$weekday）的收支';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name，$start ~ $end 的收支';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name，$month 月的收支';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 报表日 $date　·　发送日 $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 报表区间 $start ~ $end　·　发送日 $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 报表月 $month　·　发送日 $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return '统计昨天（$date 周$weekday）整日收支，今天（$sendDate）发送';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return '统计过去 7 天（$start ~ $end，共 7 天）收支，今天（$sendDate）发送';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '统计上月（$month，$start ~ $end）整月收支，本月（$sendDate）发送';
  }

  @override
  String get notificationsLeadDaily => '昨天';

  @override
  String get notificationsLeadWeekly => '本周';

  @override
  String get notificationsLeadMonthly => '上月';

  @override
  String notificationsKpiIncome(Object lead) {
    return '$lead收入';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return '$lead支出';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return '$lead净额';
  }

  @override
  String get notificationsCompareLabelDaily => '较前一天';

  @override
  String get notificationsCompareLabelWeekly => '较上周';

  @override
  String get notificationsCompareLabelMonthly => '较上月';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return '昨天（$date）';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return '过去 7 天（$start ~ $end）';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return '上月（$month）';
  }

  @override
  String get notificationsSectionsBalance => '账户余额';

  @override
  String get notificationsSectionsTopCategories => '本月支出 Top 5';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return '$month 月支出 Top 5';
  }

  @override
  String get notificationsSectionsDailyDetail => '每日明细';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return '本月累计（$month）';
  }

  @override
  String get notificationsSectionsStock => '股票投资';

  @override
  String get notificationsSectionsRecentDaily => '昨天交易';

  @override
  String get notificationsSectionsRecentWeekly => '本周交易';

  @override
  String get notificationsSectionsRecentMonthly => '上月交易';

  @override
  String get notificationsLabelsIncome => '收入';

  @override
  String get notificationsLabelsExpense => '支出';

  @override
  String get notificationsLabelsNet => '净额';

  @override
  String get notificationsLabelsCost => '总成本';

  @override
  String get notificationsLabelsMarketValue => '市值';

  @override
  String get notificationsLabelsUnrealizedPL => '未实现盈亏';

  @override
  String get notificationsLabelsReturnRate => '收益率';

  @override
  String get notificationsLabelsUncategorized => '未分类';

  @override
  String get notificationsTableDate => '日期';

  @override
  String get notificationsEmptyNoAccount => '暂无账户';

  @override
  String get notificationsEmptyNoExpense => '暂无支出记录';

  @override
  String notificationsEmptyNoTx(Object label) {
    return '$label没有交易';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return '股票投资：市值 $marketValue，未实现盈亏 $pl';
  }

  @override
  String get notificationsCtaViewFullReport => '查看完整报表';

  @override
  String get notificationsCtaViewLineRecord => '查看 LINE 记录';

  @override
  String get notificationsReminderAltText => '记账提醒';

  @override
  String get notificationsReminderTitle => '别忘了记录今天的支出';

  @override
  String notificationsReminderBody(Object name) {
    return '$name，花 10 秒补上今天的支出，月底就不容易漏账。';
  }

  @override
  String get notificationsReminderHint => '点击新增支出，然后输入：金额 备注 日期（日期可省略）';

  @override
  String get notificationsReminderFallbackName => '你';

  @override
  String get notificationsReminderAddExpense => '新增支出';

  @override
  String get notificationsReminderViewToday => '查看今天记录';

  @override
  String get notificationsFallbackUser => '用户';

  @override
  String get mobileLegacyMessagebde18a20 => '・不计入总资产';

  @override
  String get mobileLegacyNoneCreateAsParent => '（无，作为父分类）';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      '“首页”按月份显示收入、支出、净额和支出分类饼图，左右切换月份，一眼看懂钱花到哪里。';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      '“还款”会对应到它所清偿的账单（账单日后下一期还清的金额会计回该期账单）。';

  @override
  String get mobileLegacy0NoPayment => '0＝不还';

  @override
  String get mobileLegacyMon => '一';

  @override
  String get mobileLegacyStock => '普通股票';

  @override
  String get mobileLegacyStocks => '普通股票（%）';

  @override
  String get mobileLegacyTue => '二';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      '入款账户（含现金股利时必填）';

  @override
  String get mobileLegacyWed => '三';

  @override
  String get mobileLegacyPreviousStatement => '上期账单 ';

  @override
  String get mobileLegacyNext => '下一步';

  @override
  String get mobileLegacyDelisted => '下市';

  @override
  String get mobileLegacySubcategory => '子分类';

  @override
  String get mobileLegacyDeleted => '已删除';

  @override
  String get mobileLegacyUpdated => '已更新';

  @override
  String get mobileLegacyLinked => '已绑定';

  @override
  String get mobileLegacyUnlinked => '已解除绑定';

  @override
  String get mobileLegacyTotalRealizedPL => '已实现损益合计';

  @override
  String get mobileLegacyFri => '五';

  @override
  String get mobileLegacyStandardRate01 => '公定 0.1%';

  @override
  String get mobileLegacyStandardRate03 => '公定 0.3%';

  @override
  String get mobileLegacySat => '六';

  @override
  String get mobileLegacyCategoryName => '分类名称';

  @override
  String get mobileLegacyFeeOptional => '手续费（选填）';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      '手续费／证券交易税留空则由后端自动计算';

  @override
  String get mobileLegacyCommissionRate => '手续费率（%）';

  @override
  String get mobileLegacyDay => '日';

  @override
  String get mobileLegacyMonthlyBudget => '月度总预算';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent => '父分类（不选＝建立父分类）';

  @override
  String get mobileLegacyTheme => '主题';

  @override
  String get mobileLegacyThu => '四';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => '未知分类';

  @override
  String get mobileLegacyNotLinked => '未绑定';

  @override
  String get mobileLegacyNoTransactionsThisMonth => '本月暂无交易';

  @override
  String get mobileLegacyNoBudgetThisMonth => '本月暂无预算';

  @override
  String get mobileLegacyNetThisMonth => '本月净额';

  @override
  String get mobileLegacyPositiveWholeNumber => '正整数';

  @override
  String get mobileLegacyDeletePermanently => '永久删除';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      '永久删除账号与所有数据，无法恢复';

  @override
  String get mobileLegacyNoReleaseNotesAvailable => '目前没有更新内容';

  @override
  String get mobileLegacyCurrentDevice => '当前设备';

  @override
  String get mobileLegacyTransactions => '交易';

  @override
  String get mobileLegacyAll => '全部';

  @override
  String get mobileLegacyAllCategories => '全部分类';

  @override
  String get mobileLegacyAllAccounts => '全部账户';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      '各卡还款金额（按卡片货币）';

  @override
  String get mobileLegacySyncDividends => '同步股利';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically => '名称（选填，留空自动带入）';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      '在“股票”页输入股票代码（例如 2330）即可跟踪实时股价、未实现和已实现损益，系统还会自动同步除权息。';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      '在底部“记账”页点击右下角“＋”即可新增收入或支出，支持多币种和账户转账。交易左滑可删除，点一下可编辑。';

  @override
  String get mobileLegacyNoDataForThisPeriod => '此区间无数据';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      '此操作将永久删除你的账号与所有数据（交易、账户、股票与设置），且无法恢复。';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports => '自定义定期收支报表发送时间';

  @override
  String get mobileLegacyAutomatic => '自动';

  @override
  String get mobileLegacyAtLeast8Characters => '至少 8 个字符';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      '至少 8 个字符，包含大小写字母、数字与特殊符号';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      '你的个人资产管家：记账、预算、台股投资和统计报表，一个 App 全部搞定。花一分钟快速了解主要功能。';

  @override
  String get mobileLegacyDeletePasskey => '删除 Passkey';

  @override
  String get mobileLegacyDeleteCategory => '删除分类';

  @override
  String get mobileLegacyDeleteTransaction => '删除交易';

  @override
  String get mobileLegacyDeleteDividend => '删除股利';

  @override
  String get mobileLegacyDeleteStock => '删除股票';

  @override
  String get mobileLegacyDeleteAccount => '删除账户';

  @override
  String get mobileLegacyDeleteSchedule => '删除计划';

  @override
  String get mobileLegacyDeletePhoto => '删除照片';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      '含现金股利时，入款账户必填';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters => '找不到符合筛选的交易';

  @override
  String get mobileLegacyDiscount01 => '折扣（0~1）';

  @override
  String get mobileLegacyImproved => '改进';

  @override
  String get mobileLegacyMore => '更多';

  @override
  String get mobileLegacyUpdatedd9db02d0 => '更新';

  @override
  String get mobileLegacyLastDayOfEachMonth => '每月最后一天';

  @override
  String get mobileLegacyNoPricesToUpdate => '没有可更新的股价';

  @override
  String get mobileLegacyNoNewDividendsToSync => '没有新的股利可同步';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession => '用户已退出，本机登录已清除';

  @override
  String get mobileLegacyGettingStarted => '使用教程';

  @override
  String get mobileLegacyExample06MeansA40Discount => '例：0.6 代表 6 折';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      '例：1.5 表示 1.5%，外币刷卡时会自动计算手续费';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      '到“更多”设置每月预算、查看统计报表、管理账户和分类，还能设置固定收支与报表通知。准备好了，就开始记录吧！';

  @override
  String get mobileLegacyStandardBrokerageRate01425 => '券商公定 0.1425%';

  @override
  String get mobileLegacyNotSentYet => '尚未发送';

  @override
  String get mobileLegacyNoRealizedReturns => '暂无已实现损益';

  @override
  String get mobileLegacyNoCategoriesYet => '暂无分类';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      '暂无交易，点击右下角记一笔';

  @override
  String get mobileLegacyNoRecurringTransactions => '暂无固定收支';

  @override
  String get mobileLegacyNoDividendRecords => '暂无股利记录';

  @override
  String get mobileLegacyNoStockTransactions => '暂无股票交易';

  @override
  String get mobileLegacyNoHoldingsYet => '暂无持仓';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => '暂无登录记录';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      '在浏览器完成注册（需要设备生物识别）';

  @override
  String get mobileLegacyNotice => '注意';

  @override
  String get mobileLegacyDividends => '股利';

  @override
  String get mobileLegacyDividendSyncCompleted => '股利同步完成';

  @override
  String get mobileLegacyTickerEG2330 => '股票代码（如 2330）';

  @override
  String get mobileLegacyStockMarketValue => '股票市值';

  @override
  String get mobileLegacyHoldings => '持仓';

  @override
  String get mobileLegacyDayOfWeek => '星期';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes => '查看当前版本与更新内容';

  @override
  String get mobileLegacyRename => '重命名';

  @override
  String get mobileLegacyCheckAgain => '重新检查';

  @override
  String get mobileLegacyRetry => '重试';

  @override
  String get mobileLegacyHome => '首页';

  @override
  String get mobileLegacyFixed => '修复';

  @override
  String get mobileLegacyApply => '应用';

  @override
  String get mobileLegacyTime => '时间';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional => '境外手续费 TWD（选填）';

  @override
  String get mobileLegacyAddTransaction => '记一笔';

  @override
  String get mobileLegacyTransactions8084a8ea => '记账';

  @override
  String get mobileLegacyStartDate => '开始日期';

  @override
  String get mobileLegacyTrackTaiwanStocks => '跟踪台股投资';

  @override
  String get mobileLegacyStockDividendSharesOptional => '配股股数（选填）';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      '境外刷卡手续费由原交易自动产生，请编辑对应的外币交易';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters => '密码长度至少 8 个字符';

  @override
  String get mobileLegacyAccountName => '账户名称';

  @override
  String get mobileLegacyAccountDeleted => '账号已删除';

  @override
  String get mobileLegacyAccountSecurity => '账号安全';

  @override
  String get mobileLegacyLinkedAccounts => '账号绑定';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => '常用币种';

  @override
  String get mobileLegacyChooseFromGallery => '从相册选择';

  @override
  String get mobileLegacyEnabled => '启用';

  @override
  String get mobileLegacyDark => '深色';

  @override
  String get mobileLegacyLight => '浅色';

  @override
  String get mobileLegacyClearDates => '清除日期';

  @override
  String get mobileLegacyClearFilters => '清除筛选';

  @override
  String get mobileLegacyCashDividendTotalOptional => '现金股利（总额，选填）';

  @override
  String get mobileLegacyEnterACashOrStockDividend => '现金股利与配股至少填写一项';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      '设置后账户卡片会显示本期账单消费；留空则不统计';

  @override
  String get mobileLegacyNoteOptional => '备注（选填）';

  @override
  String get mobileLegacyNoteKeyword => '备注关键字';

  @override
  String get mobileLegacyMinimumTransactionTax => '最低证券交易税';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction => '单笔交易最多上传 5 张照片';

  @override
  String get mobileLegacyReportNotifications => '报表通知';

  @override
  String get mobileLegacySeeYourCompleteCashFlow => '掌握收支全貌';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser => '无法打开浏览器';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForGoogleSign =>
      'Unable to open the browser for Google sign-in';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForLineSign =>
      'Unable to open the browser for LINE sign-in';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForPasskeySign =>
      'Unable to open the browser for passkey sign-in';

  @override
  String get mobileLegacyYourSessionExpiredSignInAgain => '登录已过期，请重新登录';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      '登录响应未包含认证 Cookie，请检查后端设置';

  @override
  String get mobileLegacySignedIn => '登录成功';

  @override
  String get mobileLegacySignInHistory => '登录记录';

  @override
  String get mobileLegacySignedInDevices => '登录设备';

  @override
  String get mobileLegacySignInRequestConnectionFailed => '登录请求连接失败';

  @override
  String get mobileLegacyEndDate => '结束日期';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      '注册响应未包含认证 Cookie，请检查后端设置';

  @override
  String get mobileLegacySignUpAndSignIn => '注册并登录';

  @override
  String get mobileLegacyBuy => '买';

  @override
  String get mobileLegacyFrequency => '周期';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 => '汇率必须大于 0';

  @override
  String get mobileLegacyReturns => '盈亏';

  @override
  String get mobileLegacyAddPasskey => '新增 Passkey';

  @override
  String get mobileLegacyAddStockTransaction => '新增股票交易';

  @override
  String get mobileLegacyAddSchedule => '新增计划';

  @override
  String get mobileLegacyAddReportSchedule => '新增报表计划';

  @override
  String get mobileLegacyAddPhotosOptional => '新增照片（选填）';

  @override
  String get mobileLegacyFailedToLoadPhoto => '照片加载失败';

  @override
  String get mobileLegacyLink => '绑定';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      '绑定需要在浏览器完成授权；解除绑定前请确认仍可使用其他方式登录。';

  @override
  String get mobileLegacyUnlink => '解除';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp => '资产管理 · Android 客户端';

  @override
  String get mobileLegacySkip => '跳过';

  @override
  String get mobileLegacyMinimumOddLotCommission => '零股最低手续费';

  @override
  String get mobileLegacyIncorrectEmailOrPassword => '邮箱或密码错误';

  @override
  String get mobileLegacyDefaultCurrency => '默认币种';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies => '默认币种与常用币种';

  @override
  String get mobileLegacyBudgets => '预算';

  @override
  String get mobileLegacyBudgetsReportsAndMore => '预算、报表与更多';

  @override
  String get mobileLegacyBudgetAmount => '预算金额';

  @override
  String get mobileLegacyCurrencySettings => '币种设置';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage => '语言（APP、通知与网页版）';

  @override
  String get mobileLegacyBank => '银行';

  @override
  String get mobileLegacyBankBalance => '银行余额';

  @override
  String get mobileLegacyRequiresALinkedLineAccount => '需要已绑定 LINE';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      '至少需要一张信用卡和一个非信用卡账户才能还款';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      '需包含大小写字母、数字与特殊符号';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      '需包含大写字母、小写字母、数字与特殊符号';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule => '确定删除此报表通知计划？';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      '确定要删除这张已上传的照片吗？此操作无法恢复。';

  @override
  String get mobileLegacyEditStockTransaction => '编辑股票交易';

  @override
  String get mobileLegacyEditReportSchedule => '编辑报表计划';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst => '请先完成下方的人机验证';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst => '请先到“持仓”页新增股票';

  @override
  String get mobileLegacySelectAParentCategoryFirst => '请先选择父分类';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard => '请至少填写一张卡的还款金额';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod => '请至少选择一种通知方式';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo => '请输入 ≥ 0 的数字';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => '请输入 1~31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 => '请输入大于 0 的金额';

  @override
  String get mobileLegacyEnterATicker => '请输入代码';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber => '请输入正整数';

  @override
  String get mobileLegacyEnterAName => '请输入名称';

  @override
  String get mobileLegacyEnterAValidEmailAddress => '请输入有效的电子邮箱';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm => '请输入密码以确认';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm => '请输入账号电子邮箱以确认';

  @override
  String get mobileLegacyEnterADisplayName => '请输入显示名称';

  @override
  String get mobileLegacySelectASubcategory => '请选择子分类';

  @override
  String get mobileLegacySelectACategory => '请选择分类';

  @override
  String get mobileLegacySelectAParentCategory => '请选择父分类';

  @override
  String get mobileLegacySelectAnAccount => '请选择账户';

  @override
  String get mobileLegacySelectADestinationAccount => '请选择转入账户';

  @override
  String get mobileLegacySell => '卖';

  @override
  String get mobileLegacyMinimumBoardLotCommission => '整股最低手续费';

  @override
  String get mobileLegacyFilter => '筛选';

  @override
  String get mobileLegacyFilterTransactions => '筛选交易';

  @override
  String get mobileLegacyChooseTheme => '选择主题';

  @override
  String get mobileLegacyLogTransactionsInSeconds => '随手记一笔';

  @override
  String get mobileLegacyMarketValue => '总市值';

  @override
  String get mobileLegacyTotalAssetsInTwd => '总资产（折算 TWD）';

  @override
  String get mobileLegacyTraditionalChineseEnglish => '繁体中文 / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp => '还没有账号？注册';

  @override
  String get mobileLegacyPaymentRecorded => '还款已记录';

  @override
  String get mobileLegacyToAccount => '转入账户';

  @override
  String get mobileLegacyFromAccount => '转出账户';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      '转出与转入账户不能相同';

  @override
  String get mobileLegacyEditTransfersInTheWebApp => '转账请在网页版编辑';

  @override
  String get mobileLegacyTransactionTaxSell => '证券交易税（卖出）';

  @override
  String get mobileLegacyTransactionTaxOptional => '证券交易税（选填）';

  @override
  String get mobileLegacyTypeAffectsTransactionTax => '类型（影响证券交易税率）';

  @override
  String get mobileLegacyWarrants => '权证（%）';

  @override
  String get mobileLegacyWelcomeToAssetpilot => '欢迎使用 AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis => '变更后其他设备将被登出。';

  @override
  String get mobileLegacyTestSentryConfiguration => '验证 Sentry 设置（测试用）';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'API 返回 401，会话已过期，本机登录已清除';

  @override
  String get mobileLegacyApiRequestFailed => 'API 请求失败';

  @override
  String get mobileLegacyApiRequestConnectionFailed => 'API 请求连接失败';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'App 登录响应未包含认证 Cookie';

  @override
  String get mobileLegacyEmailNotifications => 'Email 通知';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'Google 登录响应未包含认证 Cookie';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'LINE 通知';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'LINE 登录响应未包含认证 Cookie';

  @override
  String get mobileLegacyLineSignInStateMismatchTryAgain =>
      'LINE sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyLineSignInTimedOutOrWasCancelled =>
      'LINE sign-in timed out or was cancelled';

  @override
  String get mobileLegacyPasskeySignInTimedOutOrWasCancelled =>
      'Passkey sign-in timed out or was cancelled';

  @override
  String get mobileLegacyTwdIsAlwaysIncludedSelectedCurrenciesAppearFirst =>
      'TWD 会始终包含。勾选的币种会显示在交易/固定收支币种列表前段。';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return '$day 日';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return '上次发送 $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return '当前版本 v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return '有新版本 v$version 可更新';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return '每月 $day 日';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return '每周$weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '星期$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return '创建于 $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return '语言已更新：$value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return '加载失败：$value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return '发生意外错误：$value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return '$provider 登录失败：$error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return '更新股价失败：$value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return '同步股利失败：$value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return '照片上传失败：$value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return '请求失败（HTTP $code）';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return '登录失败（HTTP $code）';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return '无法连接到后端（$target）：$error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return '确定删除“$name”？';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return '解除 $provider 绑定';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return '确定解除与 $provider 的绑定？';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return '$provider 绑定';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name（全部）';
  }

  @override
  String mobileDynamicUnknownHttpMethod(Object method) {
    return '未知的 HTTP method: $method';
  }

  @override
  String mobileDynamicDeleteAccountName(Object name) {
    return '確定刪除「$name」？相關交易可能一併受影響。';
  }

  @override
  String mobileDynamicCurrentSpending(Object amount, Object range) {
    return '本期消費 $amount$range';
  }

  @override
  String mobileDynamicSpentAmount(Object amount) {
    return '消費 $amount';
  }

  @override
  String mobileDynamicPaidAmount(Object amount) {
    return '已繳 $amount';
  }

  @override
  String mobileDynamicStatementCloses(Object name, Object day) {
    return '$name　每月結帳日 $day 號';
  }

  @override
  String mobileDynamicAddBudgetForMonth(Object month) {
    return '新增預算（$month）';
  }

  @override
  String mobileDynamicRecurringSubtitle(
    Object frequency,
    Object account,
    Object startDate,
  ) {
    return '$frequency・$account・自 $startDate';
  }

  @override
  String mobileDynamicReportTotalExpense(Object total) {
    return '總支出：$total';
  }

  @override
  String mobileDynamicReportTotalIncome(Object total) {
    return '總收入：$total';
  }

  @override
  String mobileDynamicDeleteTransactionDate(Object date) {
    return '確定刪除這筆 $date 的交易？此動作無法復原。';
  }

  @override
  String mobileDynamicDeleteTransactionCompact(Object date) {
    return '確定刪除這筆$date的交易？';
  }

  @override
  String mobileDynamicExchangeRateForCurrency(Object currency) {
    return '匯率（1 $currency = ? TWD）';
  }

  @override
  String mobileDynamicCardRateAutoFee(Object rate) {
    return '此卡費率 $rate%，留空將自動計算';
  }

  @override
  String mobileDynamicUploadedPhotosCount(Object count) {
    return '已上傳照片（$count）';
  }

  @override
  String mobileDynamicAddPhotosCount(Object count) {
    return '新增照片（$count/5）';
  }

  @override
  String mobileDynamicStockPricesUpdated(Object count) {
    return '已更新 $count 檔股價';
  }

  @override
  String mobileDynamicStockPricesUpdatedWithFailed(
    Object count,
    Object failed,
  ) {
    return '已更新 $count 檔股價，$failed 檔查詢失敗';
  }

  @override
  String mobileDynamicDeleteStock(Object symbol, Object name) {
    return '確定刪除「$symbol $name」？其所有交易與股利紀錄將一併刪除，無法復原。';
  }

  @override
  String mobileDynamicStockHoldingSubtitle(
    Object shares,
    Object avgCost,
    Object currentPrice,
  ) {
    return '$shares 股・均價 $avgCost・現價 $currentPrice';
  }

  @override
  String mobileDynamicStockTransactionSubtitle(
    Object date,
    Object shares,
    Object price,
  ) {
    return '$date・$shares 股 @ $price';
  }

  @override
  String mobileDynamicDeleteDividend(Object symbol, Object date) {
    return '確定刪除 $symbol 於 $date 的股利紀錄？';
  }

  @override
  String mobileDynamicDividendsSynced(Object count) {
    return '已同步 $count 筆股利';
  }

  @override
  String mobileDynamicDividendsSyncedWithSkipped(Object count, Object skipped) {
    return '已同步 $count 筆股利，略過 $skipped 筆';
  }

  @override
  String mobileDynamicCashDividend(Object amount) {
    return '現金 $amount';
  }

  @override
  String mobileDynamicStockDividendShares(Object shares) {
    return '配股 $shares 股';
  }

  @override
  String mobileDynamicRealizedTransactionSubtitle(Object date, Object shares) {
    return '$date・賣 $shares 股';
  }

  @override
  String dashboardDataStatusQueriedAt(Object time) {
    return '资料查询时间 $time';
  }

  @override
  String get dashboardAttentionTitle => '待处理';

  @override
  String get dashboardAttentionAllClear => '目前没有需要处理的事项';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count 笔固定收支需要检查';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count 笔未分类交易 · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count 档持仓尚无价格';
  }

  @override
  String get dashboardDriversTitle => '本月 Top 3 驱动因素';

  @override
  String dashboardDriversSubtitle(Object month) {
    return '$month 金额最高的收入与支出项目';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '占此类型 $share%';
  }

  @override
  String get dashboardPersonalizeTrigger => '自定义首页';

  @override
  String get dashboardPersonalizeTitle => '自定义首页';

  @override
  String get dashboardPersonalizeDescription => '选择要显示的模块，并按照你的使用顺序排列。';

  @override
  String get dashboardPersonalizeModulesAssets => '资产概览';

  @override
  String get dashboardPersonalizeModulesAttention => '需要处理';

  @override
  String get dashboardPersonalizeModulesWhyChanged => '现金流为何变动';

  @override
  String get dashboardPersonalizeModulesSpending => '支出分类';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => '投资组合检查';

  @override
  String get dashboardPersonalizeModulesIncomeRecent => '收入与近期交易';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return '将“$module”上移';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return '将“$module”下移';
  }

  @override
  String get dashboardPersonalizeSaved => '首页配置已保存';

  @override
  String get dashboardPersonalizeSaveError => '无法保存首页配置';

  @override
  String get dashboardPersonalizeReset => '重置';

  @override
  String get dashboardPersonalizeApply => '应用';

  @override
  String get dashboardComparisonTitle => '现金流为何变动';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart～$currentEnd，对比 $previousStart～$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return '完整月份，对比 $previousStart～$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable => '这个月份没有可比较的上一期间。';

  @override
  String get dashboardComparisonNoChanges => '已记录的现金流与可比期间相同。';

  @override
  String get dashboardComparisonPreviousNet => '上期净现金流';

  @override
  String get dashboardComparisonNetChange => '净现金流变动';

  @override
  String get dashboardComparisonNewThisPeriod => '本期新增';

  @override
  String get dashboardComparisonIncreased => '金额增加';

  @override
  String get dashboardComparisonDecreased => '金额减少';

  @override
  String get dashboardPortfolioHealthTitle => '投资成本基础检查';

  @override
  String get dashboardPortfolioHealthSubtitle => '当前市值与 FIFO 剩余成本比较';

  @override
  String get dashboardPortfolioHealthNoHoldings => '新增持仓后即可查看成本基础分析。';

  @override
  String get dashboardPortfolioHealthMissingPrices => '需要当前价格才能提供这项比较。';

  @override
  String get dashboardPortfolioHealthMixedCurrencies => '持仓包含多种币种，暂不提供合并百分比。';

  @override
  String get dashboardPortfolioHealthMarketValue => '已有价格的市值';

  @override
  String get dashboardPortfolioHealthCost => '已有价格持仓成本';

  @override
  String get dashboardPortfolioHealthUnrealizedGross => '未实现毛损益';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return '最大持仓：$name · 占已有价格市值 $share%';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      '这里比较当前价格与已记录的 FIFO 成本，不是市场指数基准或时间加权绩效。';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return '价格覆盖：$total 项持仓中有 $priced 项';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook => '计划现金展望';

  @override
  String get dashboardPersonalizeModulesSavingsScenario => '储蓄情境';

  @override
  String get dashboardCashOutlookTitle => '未来 30 天・计划现金';

  @override
  String get dashboardCashOutlookSubtitle => '根据已确认的固定收支估算';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start～$end・计划估算';
  }

  @override
  String get dashboardCashOutlookInvalidDate => '无法计算估算期间。';

  @override
  String get dashboardCashOutlookNoBankAccounts => '请先新增并纳入银行账户，才能估算计划现金。';

  @override
  String get dashboardCashOutlookNoSchedules => '创建固定收入或支出后，即可查看即将发生的计划现金。';

  @override
  String get dashboardCashOutlookNoCoveredSchedules => '请检查固定收支，并关联至已纳入的银行账户。';

  @override
  String get dashboardCashOutlookStartingBalance => '截至今天的银行余额';

  @override
  String get dashboardCashOutlookScheduledNet => '计划净变动';

  @override
  String get dashboardCashOutlookClosingBalance => '30 天后估算现金';

  @override
  String get dashboardCashOutlookLowestBalance => '最低估算现金';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count 笔计划・收入 $income・支出 $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle => '合并估算现金可能低于零';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return '约在 $date，估算可能低于零 $amount。采取行动前请先检查日期和金额。';
  }

  @override
  String get dashboardCashOutlookUpcoming => '即将发生的计划';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return '显示 $shown／$total 笔';
  }

  @override
  String get dashboardCashOutlookNoUpcoming => '这个 30 天期间内没有计划项目。';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return '已覆盖 $included／$total 笔固定收支；请检查其余 $uncovered 笔。';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      '估算合并所有已纳入银行账户，采用截至今天的余额与已确认关联固定收支。它不会显示单个账户可能透支，也不会改变实际余额；到期交易会在服务下次处理时创建。TWD 估算一致使用当前汇率。';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return '约在 $date，计划现金可能短缺 $amount';
  }

  @override
  String get dashboardScenarioTitle => '储蓄情境试算';

  @override
  String get dashboardScenarioSubtitle => '试算一项每月调整的累计影响';

  @override
  String get dashboardScenarioMonthlyAdjustment => '每月储蓄调整（TWD）';

  @override
  String get dashboardScenarioDecrease => '每月调整减少 500';

  @override
  String get dashboardScenarioIncrease => '每月调整增加 500';

  @override
  String get dashboardScenarioHorizon => '试算期间';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count 个月';
  }

  @override
  String get dashboardScenarioDifference => '累计差额';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return '每月调整 $monthly，持续 $months 个月，累计差额为 $difference。';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      '简单情境：每月调整 × 月数。不包含利息、市场回报、通胀和税务，也不保证未来结果。';

  @override
  String get navMcp => 'MCP 连接';

  @override
  String get settingsMcpTitle => 'MCP 连接设置';

  @override
  String get settingsMcpDescription =>
      '通过 OAuth 连接支持 MCP 的 AI 工具，或为需要手动凭证的客户端创建个人访问令牌。';

  @override
  String get settingsMcpOauthTitle => '使用 OAuth 连接';

  @override
  String get settingsMcpOauthDescription =>
      '在支持 MCP OAuth 的 AI 工具中输入下方连接地址，AssetPilot 会打开安全的登录和授权页面，无需手动创建令牌。';

  @override
  String get settingsMcpCreateNew => '创建新凭证';

  @override
  String get settingsMcpNameLabel => '名称';

  @override
  String get settingsMcpNamePlaceholder => '例如：我的 ChatGPT';

  @override
  String get settingsMcpExpiresAtLabel => '到期时间（选填）';

  @override
  String get settingsMcpCreateButton => '创建凭证';

  @override
  String get settingsMcpCreating => '创建中…';

  @override
  String get settingsMcpCreateFailed => '创建凭证失败';

  @override
  String get settingsMcpNameRequired => '请输入名称';

  @override
  String get settingsMcpNameTooLong => '名称不可超过 100 个字符';

  @override
  String get settingsMcpListTitle => '我的 MCP 凭证';

  @override
  String get settingsMcpRefresh => '刷新';

  @override
  String get settingsMcpNoCredentials => '尚未创建任何凭证';

  @override
  String get settingsMcpLoadFailed => '加载凭证列表失败';

  @override
  String get settingsMcpColName => '名称';

  @override
  String get settingsMcpColCreatedAt => '创建时间';

  @override
  String get settingsMcpColLastUsedAt => '最后使用时间';

  @override
  String get settingsMcpColStatus => '状态';

  @override
  String get settingsMcpColActions => '操作';

  @override
  String get settingsMcpNeverUsed => '尚未使用';

  @override
  String get settingsMcpStatusActive => '启用中';

  @override
  String get settingsMcpStatusExpired => '已过期';

  @override
  String get settingsMcpStatusRevoked => '已撤销';

  @override
  String get settingsMcpRevokeButton => '撤销';

  @override
  String get settingsMcpRevokeConfirm => '确定要撤销此凭证吗？撤销后所有使用此凭证的查询将立即被拒绝。';

  @override
  String get settingsMcpRevokeFailed => '撤销凭证失败';

  @override
  String get settingsMcpTokenModalTitle => 'MCP 访问令牌';

  @override
  String get settingsMcpTokenWarning => '此令牌仅显示这一次，请立即复制并妥善保存；关闭后将无法再次查看明文。';

  @override
  String get settingsMcpTokenLabel => '访问令牌';

  @override
  String get settingsMcpConnectionUrlLabel => 'MCP 连接地址';

  @override
  String get settingsMcpCopyButton => '复制';

  @override
  String get settingsMcpCopied => '已复制！';

  @override
  String get settingsMcpCloseConfirm => '我已复制，关闭窗口';
}

/// The translations for Chinese, as used in Taiwan, using the Han script (`zh_Hant_TW`).
class AppLocalizationsZhHantTw extends AppLocalizationsZh {
  AppLocalizationsZhHantTw() : super('zh_Hant_TW');

  @override
  String get commonSave => '儲存';

  @override
  String get commonCancel => '取消';

  @override
  String get commonDelete => '刪除';

  @override
  String get commonEdit => '編輯';

  @override
  String get commonConfirm => '確認';

  @override
  String get commonClose => '關閉';

  @override
  String get commonLoading => '載入中…';

  @override
  String get commonAdd => '新增';

  @override
  String get commonBack => '返回';

  @override
  String get commonSearch => '搜尋';

  @override
  String get commonLanguage => '語言';

  @override
  String get commonClear => '清除';

  @override
  String get commonSaving => '儲存中...';

  @override
  String get commonConfirmDelete => '確認刪除';

  @override
  String get commonPreviousPage => '上一頁';

  @override
  String get commonNextPage => '下一頁';

  @override
  String commonTotalRecords(Object count) {
    return '共 $count 筆';
  }

  @override
  String get commonPerPage => '每頁';

  @override
  String commonRecordsUnit(Object count) {
    return '$count 筆';
  }

  @override
  String get commonNoData => '尚無資料';

  @override
  String get navSectionsFinance => '財務管理';

  @override
  String get navSectionsStocks => '股票投資';

  @override
  String get navSectionsSystem => '系統設定';

  @override
  String get navDashboard => '儀表板';

  @override
  String get navTransactions => '交易記錄';

  @override
  String get navReports => '統計報表';

  @override
  String get navBudget => '預算管理';

  @override
  String get navInfoBoard => '資訊版';

  @override
  String get navAccounts => '帳戶管理';

  @override
  String get navCategories => '分類管理';

  @override
  String get navRecurring => '固定收支';

  @override
  String get navStocksPortfolio => '持股總覽';

  @override
  String get navStocksTransactions => '股票交易紀錄';

  @override
  String get navStocksDividends => '股利紀錄';

  @override
  String get navStocksRealized => '實現損益';

  @override
  String get navStocksSettings => '股票設定';

  @override
  String get navExportImport => '資料匯出匯入';

  @override
  String get navAccount => '帳號設定';

  @override
  String get navApiCredits => 'API 授權';

  @override
  String get navAdmin => '管理員';

  @override
  String get navTitleStocks => '持股總覽';

  @override
  String get navTitleStockTransactions => '股票交易紀錄';

  @override
  String get navTitleStockDividends => '股票股利紀錄';

  @override
  String get navTitleStockRealized => '股票實現損益';

  @override
  String get navTitleStockSettings => '股票交易設定';

  @override
  String get navTitleApiCredits => 'API 使用與授權';

  @override
  String get shellFallbackUser => '使用者';

  @override
  String get shellLogout => '登出';

  @override
  String get shellVersionInfo => '版本資訊';

  @override
  String get shellOpenMenu => '開啟選單';

  @override
  String get shellSkipToContent => '跳至主要內容';

  @override
  String get shellThemeLight => '亮色';

  @override
  String get shellThemeSystem => '系統';

  @override
  String get shellThemeDark => '暗色';

  @override
  String get shellChangelogLoading => '正在讀取版本資訊...';

  @override
  String get shellChangelogLoadFailed => '讀取版本資訊失敗';

  @override
  String get shellChangelogUnknownVersion => '未知';

  @override
  String get shellChangelogCurrentVersion => '目前版本';

  @override
  String get shellChangelogUpdatableVersion => '可更新版本';

  @override
  String get shellChangelogUpToDate => '已是最新版本';

  @override
  String get shellChangelogUpdatableContent => '可更新內容';

  @override
  String get shellChangelogRecentContent => '最近更新內容';

  @override
  String get authLoginTab => '登入';

  @override
  String get authRegisterTab => '註冊';

  @override
  String get authSubtitleLogin => '歡迎回來，請登入您的帳號';

  @override
  String get authSubtitleRegister => '建立您的帳號，開始記帳';

  @override
  String get authEmailLabel => '電子信箱';

  @override
  String get authPasswordLabel => '密碼';

  @override
  String get authPasswordPlaceholder => '請輸入密碼';

  @override
  String get authDisplayNameLabel => '顯示名稱';

  @override
  String get authDisplayNamePlaceholder => '您的暱稱';

  @override
  String get authRegisterPasswordPlaceholder => '至少 8 位，含大小寫英文與數字';

  @override
  String get authTogglePassword => '切換密碼顯示';

  @override
  String get authTurnstileAria => 'Cloudflare Turnstile 真人驗證';

  @override
  String get authLoginButton => '登入';

  @override
  String get authLoggingIn => '登入中…';

  @override
  String get authPasskeyButton => '使用 Passkey 登入';

  @override
  String get authPasskeyVerifying => 'Passkey 驗證中…';

  @override
  String get authGoogleButton => '使用 Google 登入';

  @override
  String get authGoogleVerifying => 'Google 驗證中…';

  @override
  String get authLineButton => '使用 LINE 登入';

  @override
  String get authLineVerifying => 'LINE 驗證中…';

  @override
  String get authRegisterSubmit => '立即註冊';

  @override
  String get authRegistering => '註冊中…';

  @override
  String get authLineCallbackCompleting => '正在完成 LINE 驗證...';

  @override
  String get authLineCallbackMissingCode => 'LINE 未回傳授權碼，請重新操作';

  @override
  String get authLineCallbackLinkFailed => 'LINE 綁定失敗';

  @override
  String get authLineCallbackLoginFailed => 'LINE 登入失敗';

  @override
  String get authLineCallbackVerifyFailed => 'LINE 驗證失敗';

  @override
  String get authErrorsTurnstileRequired => '請先完成真人驗證';

  @override
  String get authErrorsLoginFailed => '登入失敗';

  @override
  String get authErrorsRegisterFailed => '註冊失敗';

  @override
  String get authErrorsGoogleNotConfigured => 'Google 登入尚未設定完成';

  @override
  String get authErrorsGoogleComponentNotLoaded => 'Google 登入元件尚未載入';

  @override
  String get authErrorsGoogleStateFailed => '無法建立 Google 登入狀態';

  @override
  String get authErrorsGoogleNoCode => '未收到 Google 授權碼';

  @override
  String get authErrorsGoogleFailed => 'Google 登入失敗';

  @override
  String get authErrorsGoogleCancelled => 'Google 登入已取消';

  @override
  String get authErrorsPasskeyUnsupported => '此瀏覽器不支援 Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed => '無法建立 Passkey 登入挑戰';

  @override
  String get authErrorsPasskeyFailed => 'Passkey 登入失敗';

  @override
  String get authErrorsLineNotConfigured => 'LINE 登入尚未設定完成';

  @override
  String get authErrorsLineFailed => 'LINE 登入失敗';

  @override
  String get settingsTitle => '設定';

  @override
  String get settingsLanguageTitle => '語言';

  @override
  String get settingsLanguageDescription => '選擇介面與通知（Email／LINE）使用的語言。';

  @override
  String get settingsLanguageSaved => '語言偏好已更新';

  @override
  String get settingsAccountTitle => '帳號設定';

  @override
  String get settingsAccountProfileInfo => '帳號資訊';

  @override
  String get settingsAccountEmail => '電子郵件';

  @override
  String get settingsAccountDisplayName => '顯示名稱';

  @override
  String get settingsAccountEditDisplayName => '修改顯示名稱';

  @override
  String get settingsAccountUpdateName => '更新名稱';

  @override
  String get settingsAccountSaving => '儲存中...';

  @override
  String get settingsAccountSetLocalPassword => '設定本機密碼';

  @override
  String get settingsAccountChangePassword => '修改密碼';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      '目前帳號僅支援第三方登入。設定本機密碼後，即可使用電子信箱與密碼登入。';

  @override
  String get settingsAccountCurrentPassword => '目前密碼';

  @override
  String get settingsAccountNewPassword => '新密碼';

  @override
  String get settingsAccountConfirmNewPassword => '確認新密碼';

  @override
  String get settingsAccountPasswordPlaceholder => '至少8碼，含大小寫英文、數字、特殊符號';

  @override
  String get settingsAccountUpdating => '更新中...';

  @override
  String get settingsAccountSetPassword => '設定密碼';

  @override
  String get settingsAccountUpdatePassword => '更新密碼';

  @override
  String get settingsAccountThemeTitle => '顯示主題';

  @override
  String get settingsAccountThemeSystem => '跟隨系統';

  @override
  String get settingsAccountThemeLight => '淺色模式';

  @override
  String get settingsAccountThemeDark => '深色模式';

  @override
  String get settingsAccountDefaultCurrency => '預設貨幣';

  @override
  String get settingsAccountCurrencyCode => '幣別代碼';

  @override
  String get settingsAccountUpdateDefaultCurrency => '更新預設貨幣';

  @override
  String get settingsAccountPasskeyTitle => 'Passkey 管理';

  @override
  String get settingsAccountNoPasskeys => '尚未註冊任何 Passkey';

  @override
  String get settingsAccountAddPasskey => '+ 新增 Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Google 綁定';

  @override
  String get settingsAccountLineTitle => 'LINE 綁定';

  @override
  String get settingsAccountStatusPrefix => '目前狀態：';

  @override
  String get settingsAccountLinkedGoogle => '已綁定 Google 帳號';

  @override
  String get settingsAccountNotLinkedGoogle => '尚未綁定 Google 帳號';

  @override
  String get settingsAccountLinkGoogle => '綁定 Google 帳號';

  @override
  String get settingsAccountUnlink => '解除綁定';

  @override
  String get settingsAccountLinkedLine => '已綁定 LINE 帳號';

  @override
  String get settingsAccountNotLinkedLine => '尚未綁定 LINE 帳號';

  @override
  String get settingsAccountLinkLine => '綁定 LINE 帳號';

  @override
  String get settingsAccountLineVerifying => 'LINE 驗證中…';

  @override
  String get settingsAccountSessionsTitle => '目前登入裝置';

  @override
  String get settingsAccountRefresh => '重新整理';

  @override
  String get settingsAccountDeviceName => '裝置名稱';

  @override
  String get settingsAccountLoginTime => '登入時間';

  @override
  String get settingsAccountLoginIp => '登入 IP';

  @override
  String get settingsAccountActions => '操作';

  @override
  String get settingsAccountUnknownDevice => '未知裝置';

  @override
  String get settingsAccountCurrentDeviceSuffix => '（目前裝置）';

  @override
  String get settingsAccountSignOut => '登出';

  @override
  String get settingsAccountNoSessions => '尚無登入裝置紀錄';

  @override
  String get settingsAccountAuditTitle => '登入稽核紀錄';

  @override
  String get settingsAccountCountry => '國家';

  @override
  String get settingsAccountMethod => '方式';

  @override
  String get settingsAccountDevice => '裝置';

  @override
  String get settingsAccountAdminLogin => '管理員登入';

  @override
  String get settingsAccountYes => '是';

  @override
  String get settingsAccountNo => '否';

  @override
  String get settingsAccountDeleteTitle => '刪除帳號';

  @override
  String get settingsAccountDeleteDescription =>
      '刪除帳號後，您的交易、帳戶、股票、Passkey 與設定資料都會永久移除，且無法復原。';

  @override
  String get settingsAccountDeleteButton => '刪除我的帳號';

  @override
  String get settingsAccountDeleteModalTitle => '確認刪除帳號';

  @override
  String get settingsAccountDeleteModalWarning =>
      '此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票、Passkey 與設定），且無法復原。';

  @override
  String get settingsAccountDeletePasswordLabel => '請輸入密碼以確認刪除';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return '請輸入您的帳號電子信箱「$email」以確認刪除';
  }

  @override
  String get settingsAccountDeleting => '刪除中…';

  @override
  String get settingsAccountDeletePermanently => '永久刪除帳號';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired => '請輸入目前密碼';

  @override
  String get settingsAccountMessagesNewPasswordRequired => '請輸入新密碼';

  @override
  String get settingsAccountMessagesPasswordTooShort => '新密碼長度至少 8 字元';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      '新密碼需包含大寫字母、小寫字母、數字與特殊符號';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch => '兩次輸入的新密碼不一致';

  @override
  String get settingsAccountMessagesLocalPasswordSet => '密碼已設定，現在可使用密碼登入';

  @override
  String get settingsAccountMessagesPasswordUpdated => '密碼已更新';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed => '更新密碼失敗';

  @override
  String get settingsAccountMessagesDisplayNameRequired => '顯示名稱不可空白';

  @override
  String get settingsAccountMessagesDisplayNameUpdated => '顯示名稱已更新';

  @override
  String get settingsAccountMessagesUpdateFailed => '更新失敗';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm => '確定要刪除此 Passkey 嗎？';

  @override
  String get settingsAccountMessagesCurrencyInvalid => '幣別格式需為 3 碼英文字母';

  @override
  String get settingsAccountMessagesCurrencyUpdated => '預設貨幣已更新';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed => '更新預設貨幣失敗';

  @override
  String get settingsAccountMessagesSessionLoggedOut => '已登出該裝置';

  @override
  String get settingsAccountMessagesSessionLogoutFailed => '登出裝置失敗';

  @override
  String get settingsAccountMessagesPasskeyUnsupported => '此瀏覽器不支援 Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Android 裝置';

  @override
  String get settingsAccountMessagesComputerDevice => '電腦';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed => 'Passkey 註冊失敗';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      '請貼上 Google ID Token 以模擬綁定流程';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Google 帳號已綁定';

  @override
  String get settingsAccountMessagesGoogleLinkFailed => 'Google 綁定失敗';

  @override
  String get settingsAccountMessagesGoogleUnlinked => 'Google 帳號已解除綁定';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed => 'Google 解除綁定失敗';

  @override
  String get settingsAccountMessagesLineNotConfigured => 'LINE 登入尚未設定完成';

  @override
  String get settingsAccountMessagesLineLinkFailed => 'LINE 綁定失敗';

  @override
  String get settingsAccountMessagesLineUnlinked => 'LINE 帳號已解除綁定';

  @override
  String get settingsAccountMessagesLineUnlinkFailed => 'LINE 解除綁定失敗';

  @override
  String get settingsAccountMessagesDeletePasswordRequired => '請輸入密碼以確認刪除';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch => '請輸入正確的帳號電子信箱以確認刪除';

  @override
  String get settingsAccountMessagesDeleteFailed => '刪除帳號失敗';

  @override
  String get dashboardTitle => '儀表板';

  @override
  String dashboardSubtitle(Object month) {
    return '$month 的收支摘要、分類分布與最近交易。';
  }

  @override
  String get dashboardUncategorized => '未分類';

  @override
  String get dashboardKpiTotalIncome => '總收入';

  @override
  String get dashboardKpiTotalExpense => '總支出';

  @override
  String get dashboardKpiNet => '淨額';

  @override
  String get dashboardKpiTodayExpense => '今日支出';

  @override
  String get dashboardKpiBankAccounts => '銀行帳戶';

  @override
  String get dashboardKpiStockMarketValue => '股票總市值';

  @override
  String get dashboardOverviewTitle => '本月收支概覽';

  @override
  String get dashboardOverviewBalance => '本月結餘';

  @override
  String get dashboardOverviewDeficit => '本月赤字';

  @override
  String get dashboardOverviewIncome => '收入';

  @override
  String get dashboardOverviewExpense => '支出';

  @override
  String get dashboardOverviewNet => '淨額';

  @override
  String get dashboardRatioTitle => '收支比例';

  @override
  String get dashboardRatioIncomeShare => '收入佔比';

  @override
  String get dashboardRatioExpenseShare => '支出佔比';

  @override
  String get dashboardSectionsExpenseCategories => '支出分類';

  @override
  String get dashboardSectionsIncomeCategories => '收入分類';

  @override
  String get dashboardSectionsRecentTransactions => '最近交易';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return '最近 $count 筆';
  }

  @override
  String get dashboardEmptyNoExpense => '本月尚無支出資料';

  @override
  String get dashboardEmptyNoIncome => '本月尚無收入資料';

  @override
  String get dashboardEmptyNoTransactions => '本月尚無交易資料';

  @override
  String get dashboardTableDate => '日期';

  @override
  String get dashboardTableCategory => '分類';

  @override
  String get dashboardTableNote => '備註';

  @override
  String get dashboardTableAmount => '金額';

  @override
  String get dashboardFiltersPreviousMonth => '上一月';

  @override
  String get dashboardFiltersNextMonth => '下一月';

  @override
  String get dashboardFiltersCurrentMonth => '本月';

  @override
  String get publicCommonBackHome => '返回首頁';

  @override
  String get publicCommonPrivacy => '隱私權政策';

  @override
  String get publicCommonTerms => '服務條款';

  @override
  String get publicCommonApiCredits => 'API 使用與授權';

  @override
  String publicCommonLastUpdated(Object date) {
    return '最後更新日期：$date';
  }

  @override
  String get publicCommonMetadataTitle => 'AssetPilot - 個人財務指揮中心';

  @override
  String get publicCommonMetadataDescription =>
      '自架、加密的個人財務管理工具，整合記帳、預算、台股投資與報表分析。';

  @override
  String get publicCommonDatesApiCredits => '2026 年 6 月 11 日';

  @override
  String get publicCommonDatesPrivacy => '2026 年 6 月 17 日';

  @override
  String get publicCommonDatesTerms => '2026 年 6 月 11 日';

  @override
  String get publicHomeTagline => '個人財務指揮中心';

  @override
  String get publicHomeLogin => '立即登入';

  @override
  String get publicHomeRegister => '建立帳號';

  @override
  String get publicHomeBadge => '自托管、資料加密、AGPL v3';

  @override
  String get publicHomeHeadline1 => '你的財務指揮中心';

  @override
  String get publicHomeHeadline2 => '從首頁就能先看清楚';

  @override
  String get publicHomeLeadBefore => '整合台股投資、收支記帳、預算追蹤、報表分析與資料稽核。所有財務資料以';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter => '加密落地，不綁雲端、不靠訂閱，先理解產品，再決定是否登入。';

  @override
  String get publicHomeStartUsing => '開始使用';

  @override
  String get publicHomeCreateFirst => '先建立帳號';

  @override
  String get publicHomeChipsOpenSource => '開源 AGPL v3';

  @override
  String get publicHomeChipsEncrypted => '本地加密儲存';

  @override
  String get publicHomeChipsNoCloudLock => '不綁外部雲端';

  @override
  String get publicHomeChipsDocker => 'Docker 一行部署';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => '核心模組';

  @override
  String get publicHomeStatsModulesSublabel => '記帳、股票、報表、治理';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => '資料加密';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => '股價來源';

  @override
  String get publicHomeStatsStockSourceSublabel => '盤中、盤後、備援策略';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => '精度計算';

  @override
  String get publicHomeStatsPrecisionSublabel => 'decimal.js 逐筆損益';

  @override
  String get publicHomePreLoginNote =>
      '未登入也能先了解 AssetPilot 的功能、資料處理方式與部署特性，再選擇登入或建立帳號。';

  @override
  String get publicHomeWhyLabel => 'Why AssetPilot';

  @override
  String get publicHomeWhyTitle => '把日常記帳、投資追蹤與資料掌控放在同一個地方';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot 專為自主管理個人財務而設計，從收支、預算到台股投資都能集中整理，並保留資料匯出、稽核與自架部署的彈性。';

  @override
  String get publicHomePillarsFinanceTitle => '收支與預算管理';

  @override
  String get publicHomePillarsFinanceTag => '記帳核心';

  @override
  String get publicHomePillarsFinanceItemsOne => '多帳戶餘額追蹤與跨帳戶轉帳';

  @override
  String get publicHomePillarsFinanceItemsTwo => '月度與分類預算進度條控管';

  @override
  String get publicHomePillarsFinanceItemsThree => '固定收支自動產生交易';

  @override
  String get publicHomePillarsFinanceItemsFour => '批次調整分類、日期與刪除';

  @override
  String get publicHomePillarsStocksTitle => '台股投資追蹤';

  @override
  String get publicHomePillarsStocksTag => '股票模組';

  @override
  String get publicHomePillarsStocksItemsOne => 'TWSE 股價查詢與除權息同步';

  @override
  String get publicHomePillarsStocksItemsTwo => 'FIFO 全精度實現損益計算';

  @override
  String get publicHomePillarsStocksItemsThree => '股利紀錄與帳戶入款追蹤';

  @override
  String get publicHomePillarsStocksItemsFour => '定期定額與下市標記管理';

  @override
  String get publicHomePillarsSecurityTitle => '安全與資料治理';

  @override
  String get publicHomePillarsSecurityTag => '治理能力';

  @override
  String get publicHomePillarsSecurityItemsOne => 'ChaCha20-Poly1305 落地加密';

  @override
  String get publicHomePillarsSecurityItemsTwo => '帳密、Google、Passkey 三種登入';

  @override
  String get publicHomePillarsSecurityItemsThree => '匯出匯入、備份還原與稽核日誌';

  @override
  String get publicHomePillarsSecurityItemsFour => 'Rate limit、CSP 與 CSV 防注入保護';

  @override
  String get publicHomePillarsSelfHostedTitle => '自架部署與契約';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne => 'Docker 一行啟動';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => '支援 amd64 與 arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree => 'OpenAPI 3.2 契約文件';

  @override
  String get publicHomePillarsSelfHostedItemsFour => 'URL-first 路由，可直接書籤與重整';

  @override
  String get publicHomeQuickStartLabel => 'Quick Start';

  @override
  String get publicHomeQuickStartTitle => '60 秒跑在你自己的伺服器';

  @override
  String get publicHomeQuickStartDescription =>
      '使用 Docker 快速啟動，首次執行會自動產生 JWT 與資料庫加密金鑰。支援 amd64、arm64，適合部署在 NAS、VPS 或自己的 Docker 主機上。';

  @override
  String get publicHomeQuickStartChipsImage => '約 180 MB 映像';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => '內建健康檢查';

  @override
  String get publicHomeQuickStartChipsKeys => '金鑰首次啟動自動產生';

  @override
  String get publicHomeTechLabel => 'Tech Stack';

  @override
  String get publicHomeTechTitle => '技術堆疊與公開資訊入口';

  @override
  String get publicHomeTechDescription =>
      '清楚列出主要技術、外部資料來源與授權資訊，讓使用者在開始使用前就能掌握服務如何運作。';

  @override
  String get publicHomeFooter => 'GNU AGPL v3，個人資產管理，自架、自控、自備份。';

  @override
  String get publicApiCreditsPageTitle => 'API 使用與授權';

  @override
  String get publicApiCreditsPageMetadataTitle => 'API 使用與授權 — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => '外部 API 透明揭露';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot 僅在功能需要時連線至外部資料來源。這裡列出各項 API 的用途、授權資訊與資料傳送範圍，方便自行部署時確認合規狀態。';

  @override
  String get publicApiCreditsPageStatsExternalServices => '外部服務';

  @override
  String get publicApiCreditsPageStatsFreeSupported => '支援免費';

  @override
  String get publicApiCreditsPageStatsAttributionRequired => '需標示來源';

  @override
  String get publicApiCreditsPageServiceKindsData => '資料查詢';

  @override
  String get publicApiCreditsPageServiceKindsAuth => '身份驗證';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Email 通道';

  @override
  String get publicApiCreditsPageServiceKindsBackup => '雲端備份';

  @override
  String get publicApiCreditsPageTransparencyTitle => '資料透明度';

  @override
  String get publicApiCreditsPageTransparencyText =>
      '下列情境只傳送完成該功能所需的最小資料，不會把你的財務明細交給第三方服務。';

  @override
  String get publicApiCreditsPageMinNecessary => '最小必要資料原則';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => '匯率同步';

  @override
  String get publicApiCreditsPageUsageNotesFxText => '只查詢公開匯率資料，不會送出個人財務明細。';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle => '台股資料';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      '僅帶股票代號與市場資料，不包含帳戶、持股成本或交易紀錄。';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => '登入稽核';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo 僅用於登入紀錄中的國家資訊顯示。';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => '第三方登入';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google、LINE 登入僅在主動登入或綁定時啟用。';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => '雲端備份';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4 僅在管理員主動上傳備份時接收整檔資料庫檔案。';

  @override
  String get publicApiCreditsPageServiceListTitle => '外部服務清單';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return '共 $total 項服務，其中 $free 項支援免費方案，$paid 項可使用付費方案。';
  }

  @override
  String get publicApiCreditsPageOfficialSite => '官方網站';

  @override
  String get publicApiCreditsPageFreePlan => '免費方案';

  @override
  String get publicApiCreditsPagePaidPlan => '付費方案';

  @override
  String get publicApiCreditsPageSupported => '支援';

  @override
  String get publicApiCreditsPageUnavailable => '未提供';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate => '全球即時匯率（基礎貨幣 TWD）';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo => 'IP 位址地理位置查詢（登入稽核國家欄位）';

  @override
  String get publicApiCreditsPageDescriptionsTwse => '股票即時報價、除權息資料、股票名稱查詢';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Google SSO 登入';

  @override
  String get publicApiCreditsPageDescriptionsLine => 'LINE 登入與帳號綁定';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Email 寄送通道（管理員資產統計報表，搭配 Gmail / Outlook 等 SMTP server）';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Email 寄送通道（管理員資產統計報表，HTTP REST API）';

  @override
  String get publicApiCreditsPageDescriptionsResend => 'Email 寄送通道（管理員資產統計報表）';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      '管理員整檔 PostgreSQL SQL 備份的 S3 相容物件儲存目的地';

  @override
  String get publicAppCallbackReturningTitle => '正在返回 AssetPilot App...';

  @override
  String get publicAppCallbackReturningBody =>
      '如果沒有自動返回，請確認已安裝最新版 AssetPilot Android App。';

  @override
  String get publicAppCallbackPasskeyTitle => 'AssetPilot Passkey 登入';

  @override
  String get publicAppCallbackPasskeyStarting => '正在啟動 Passkey 登入...';

  @override
  String get publicAppCallbackPasskeyUnsupported => '此瀏覽器不支援 Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed => '無法建立 Passkey 登入挑戰';

  @override
  String get publicAppCallbackPasskeyVerify => '請完成裝置上的 Passkey 驗證...';

  @override
  String get publicAppCallbackPasskeyLoginFailed => 'Passkey 登入失敗';

  @override
  String get publicAppCallbackReturningApp => '正在返回 App...';

  @override
  String get publicAppCallbackAppTicketFailed => '無法建立 App 登入憑證';

  @override
  String get featuresCommonActions => '操作';

  @override
  String get featuresCommonAccount => '帳戶';

  @override
  String get featuresCommonAmount => '金額';

  @override
  String get featuresCommonDate => '日期';

  @override
  String get featuresCommonEndDate => '結束';

  @override
  String get featuresCommonNote => '備註';

  @override
  String get featuresCommonStartDate => '起始';

  @override
  String get featuresCommonStatus => '狀態';

  @override
  String get featuresCommonStock => '股票';

  @override
  String get featuresCommonType => '類型';

  @override
  String get featuresCommonName => '名稱';

  @override
  String get featuresCommonCurrency => '幣別';

  @override
  String get featuresCommonExchangeRate => '匯率';

  @override
  String get featuresCommonIncome => '收入';

  @override
  String get featuresCommonExpense => '支出';

  @override
  String get featuresCommonUncategorized => '未分類';

  @override
  String get featuresCommonUnspecified => '未指定';

  @override
  String get featuresCommonAutoCalculate => '自動計算';

  @override
  String get featuresCommonExcludeFromStats => '不計入統計';

  @override
  String get featuresCommonTopLevelCategory => '— 頂層分類 —';

  @override
  String get featuresCommonNotRecorded => '—';

  @override
  String get featuresCategoriesTitle => '分類管理';

  @override
  String get featuresCategoriesExpenseTab => '支出分類';

  @override
  String get featuresCategoriesIncomeTab => '收入分類';

  @override
  String get featuresCategoriesAddCategory => '新增分類';

  @override
  String get featuresCategoriesEditCategory => '編輯分類';

  @override
  String get featuresCategoriesNewCategory => '新增分類';

  @override
  String get featuresCategoriesNameLabel => '名稱 *';

  @override
  String get featuresCategoriesTypeLabel => '類型';

  @override
  String get featuresCategoriesParentLabel => '父分類';

  @override
  String get featuresCategoriesColorLabel => '顏色';

  @override
  String get featuresCategoriesExpense => '支出';

  @override
  String get featuresCategoriesIncome => '收入';

  @override
  String get featuresCategoriesDeleteMessage => '確定要刪除此分類嗎？其子分類也將一併刪除。';

  @override
  String get featuresCategoriesMessagesNameRequired => '請輸入分類名稱';

  @override
  String get featuresCategoriesMessagesDeleteFailed => '刪除失敗';

  @override
  String get featuresBudgetTitle => '預算管理';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$year 年 $month 月';
  }

  @override
  String get featuresBudgetTotalBudget => '本月總預算';

  @override
  String get featuresBudgetSpent => '已使用';

  @override
  String get featuresBudgetAddBudget => '新增預算';

  @override
  String get featuresBudgetEditBudget => '編輯預算';

  @override
  String get featuresBudgetNewBudget => '新增預算';

  @override
  String get featuresBudgetCategoryLabel => '分類（留空為總預算）';

  @override
  String get featuresBudgetTotalBudgetOption => '— 總預算 —';

  @override
  String get featuresBudgetAmountLabel => '預算金額 *';

  @override
  String get featuresBudgetTotalBudgetName => '（總預算）';

  @override
  String get featuresBudgetOverBudget => '超出預算';

  @override
  String get featuresBudgetDeleteMessage => '確定要刪除此預算設定嗎？';

  @override
  String get featuresBudgetMessagesAmountRequired => '請輸入有效預算金額';

  @override
  String get featuresReportsTitle => '統計報表';

  @override
  String get featuresReportsTabsCategory => '分類統計';

  @override
  String get featuresReportsTabsTrend => '趨勢分析';

  @override
  String get featuresReportsTabsDaily => '每日消費';

  @override
  String get featuresReportsPeriodsThisMonth => '本月';

  @override
  String get featuresReportsPeriodsLastMonth => '上月';

  @override
  String get featuresReportsPeriodsLast3 => '近3個月';

  @override
  String get featuresReportsPeriodsLast6 => '近6個月';

  @override
  String get featuresReportsPeriodsThisYear => '今年';

  @override
  String get featuresReportsPeriodsCustom => '自訂';

  @override
  String get featuresReportsPeriodLabel => '期間';

  @override
  String get featuresReportsStart => '開始';

  @override
  String get featuresReportsEnd => '結束';

  @override
  String get featuresReportsCurrentTotal => '本期合計';

  @override
  String get featuresReportsComparedPrevious => '相較前期';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta，前期無資料';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return '$type明細';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return '合計：$amount';
  }

  @override
  String get featuresReportsSelectedCategory => '已選取分類：';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return '，金額 $amount';
  }

  @override
  String get featuresReportsViewTransactions => '查看對應交易';

  @override
  String get featuresRecurringTitle => '固定收支';

  @override
  String get featuresRecurringAdd => '新增固定收支';

  @override
  String get featuresRecurringEdit => '編輯固定收支';

  @override
  String get featuresRecurringCreate => '新增固定收支';

  @override
  String get featuresRecurringAmountLabel => '金額 *';

  @override
  String get featuresRecurringFxFeeLabel => '海外手續費（TWD）';

  @override
  String get featuresRecurringFxFeePlaceholder => '留空則由系統依卡片費率自動計算';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return '卡片海外手續費率 $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return '，建議值 NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading => '查詢最新匯率中...';

  @override
  String get featuresRecurringCategory => '分類';

  @override
  String get featuresRecurringFrequency => '頻率';

  @override
  String get featuresRecurringStartDate => '起始日期';

  @override
  String featuresRecurringNextRun(Object date) {
    return '下次執行：$date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return '分類：$name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return '帳戶：$name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return '海外手續費：NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => '確定要刪除此固定收支設定嗎？';

  @override
  String get featuresRecurringCreatingTransfer => '建立中...';

  @override
  String get featuresRecurringConfirmTransfer => '確認轉帳';

  @override
  String get featuresRecurringFrequencyLabelsDaily => '每日';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => '每週';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => '每月';

  @override
  String get featuresRecurringFrequencyLabelsYearly => '每年';

  @override
  String get featuresRecurringMessagesAmountRequired => '請輸入有效金額';

  @override
  String get featuresDataTransferTitle => '資料匯出匯入';

  @override
  String get featuresDataTransferExportStartDate => '匯出起始日';

  @override
  String get featuresDataTransferExportEndDate => '匯出結束日';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return '支援 CSV 匯出與匯入。欄位：$columns';
  }

  @override
  String get featuresDataTransferExportCsv => '匯出 CSV';

  @override
  String get featuresDataTransferExporting => '匯出中...';

  @override
  String get featuresDataTransferChooseCsv => '選擇 CSV 匯入';

  @override
  String get featuresDataTransferImporting => '匯入中...';

  @override
  String featuresDataTransferImported(Object count) {
    return '匯入成功：$count 筆';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return '略過：$count 筆';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return '自動建立分類：$items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return '自動建立帳戶：$items';
  }

  @override
  String get featuresDataTransferWarning => '警告';

  @override
  String get featuresDataTransferError => '錯誤';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return '第 $row 列：$reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => '帳戶';

  @override
  String get featuresDataTransferModulesTransactions => '交易記錄';

  @override
  String get featuresDataTransferModulesCategories => '分類';

  @override
  String get featuresDataTransferModulesStockTransactions => '股票交易';

  @override
  String get featuresDataTransferModulesStockDividends => '股利紀錄';

  @override
  String get featuresDataTransferMessagesExportSuccess => '匯出成功';

  @override
  String get featuresDataTransferMessagesExportFailed => '匯出失敗';

  @override
  String get featuresDataTransferMessagesEmptyCsv => 'CSV 沒有可匯入資料';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return '$name 匯入完成';
  }

  @override
  String get featuresDataTransferMessagesImportFailed => '匯入失敗';

  @override
  String get featuresDataTransferMessagesBundleExportDone => '完整備份下載完成';

  @override
  String get featuresDataTransferMessagesBundleExportFailed => '完整備份下載失敗';

  @override
  String get featuresDataTransferMessagesRestoreDone => '還原完成';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed => '備份還原失敗';

  @override
  String get featuresDataTransferMessagesDbExportDone => '資料庫備份下載完成';

  @override
  String get featuresDataTransferMessagesDbExportFailed => '資料庫備份失敗';

  @override
  String get featuresDataTransferMessagesDbRestoreDone => '資料庫還原成功';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed => '資料庫還原失敗';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return '已上傳至 $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed => 'MEGA S4 備份失敗';

  @override
  String get featuresDataTransferMessagesRequireOneField => '請至少填寫一個欄位';

  @override
  String get featuresDataTransferMessagesSaved => '設定已儲存';

  @override
  String get featuresDataTransferMessagesSaveFailed => '設定儲存失敗';

  @override
  String get featuresDataTransferBundleTitle => '完整資料備份（含圖片）';

  @override
  String get featuresDataTransferBundleDescription1 =>
      '一鍵打包下載你個人的全部資料（交易、帳戶、分類、預算、週期、匯率、股票，以及交易憑證圖片）為單一 ZIP。';

  @override
  String get featuresDataTransferBundleDescription2 => '上傳同一份 ZIP 即可還原。';

  @override
  String get featuresDataTransferBundleRestorePrefix => '還原採';

  @override
  String get featuresDataTransferBundleMergeMode => '合併方式';

  @override
  String get featuresDataTransferBundleRestoreMiddle => '：已存在的資料會自動略過，只補回缺少的；';

  @override
  String get featuresDataTransferBundleNoOverwrite => '不會刪除或覆蓋你現有的資料';

  @override
  String get featuresDataTransferBundleDownload => '下載完整備份';

  @override
  String get featuresDataTransferBundleDownloading => '打包下載中...';

  @override
  String get featuresDataTransferBundleRestore => '上傳備份還原';

  @override
  String get featuresDataTransferBundleRestoring => '還原中...';

  @override
  String get featuresDataTransferDatabaseTitle => '整檔備份 / 還原';

  @override
  String get featuresDataTransferDatabaseDescription =>
      '僅管理員可操作。SQLite 模式下載 `.db` 備份；PostgreSQL 模式下載 `.sql` 備份，還原時請上傳對應格式。';

  @override
  String get featuresDataTransferDatabaseDownload => '下載資料庫備份';

  @override
  String get featuresDataTransferDatabaseDownloading => '下載中...';

  @override
  String get featuresDataTransferDatabaseRestore => '選擇備份還原';

  @override
  String get featuresDataTransferDatabaseRestoring => '還原中...';

  @override
  String get featuresDataTransferMegaTitle => 'MEGA S4 雲端備份';

  @override
  String get featuresDataTransferMegaDescription =>
      '將目前完整 SQLite 備份以上傳物件方式存入 MEGA S4 bucket。連線資訊由伺服器環境變數設定，不會在瀏覽器輸入或顯示金鑰。';

  @override
  String get featuresDataTransferMegaState => '狀態：';

  @override
  String get featuresDataTransferMegaConfigured => '已設定';

  @override
  String get featuresDataTransferMegaNotConfigured => '尚未完整設定';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket：';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return '缺少環境變數：$items';
  }

  @override
  String get featuresDataTransferMegaUpload => '上傳備份到 MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => '上傳中...';

  @override
  String get featuresDataTransferMegaConfigure => '設定';

  @override
  String get featuresDataTransferMegaCancelConfigure => '取消設定';

  @override
  String get featuresDataTransferMegaFormHelp =>
      '設定寫入伺服器持久化設定檔，立即生效。金鑰欄位請重新輸入，不會預填。';

  @override
  String get featuresDataTransferMegaBucketName => 'Bucket 名稱';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefix（選填）';

  @override
  String get featuresDataTransferMegaEndpoint => 'Endpoint（選填，留空自動推算）';

  @override
  String get featuresDataTransferMegaSaveSettings => '儲存設定';

  @override
  String get featuresAccountsTitle => '帳戶管理';

  @override
  String get featuresAccountsTypeLabelsBank => '銀行帳戶';

  @override
  String get featuresAccountsTypeLabelsCredit_card => '信用卡';

  @override
  String get featuresAccountsTypeLabelsCash => '現金';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => '電子錢包';

  @override
  String get featuresAccountsTypeLabelsOther => '其他';

  @override
  String get featuresAccountsTotalAssets => '總資產';

  @override
  String get featuresAccountsCreditOutstanding => '信用卡待還總額';

  @override
  String get featuresAccountsAddAccount => '新增帳戶';

  @override
  String get featuresAccountsEditAccount => '編輯帳戶';

  @override
  String get featuresAccountsNewAccount => '新增帳戶';

  @override
  String get featuresAccountsAccountName => '帳戶名稱 *';

  @override
  String get featuresAccountsInitialBalance => '初始餘額';

  @override
  String get featuresAccountsInitialBalanceEdit => '初始餘額 / 目前設定';

  @override
  String get featuresAccountsLinkedBank => '所屬銀行';

  @override
  String get featuresAccountsUngrouped => '不分組';

  @override
  String get featuresAccountsOverseasFeeRate => '海外手續費率（%）';

  @override
  String get featuresAccountsStatementClosingDay => '結帳日（每月幾號，1~31）';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      '例如 15，留空則不統計本期消費';

  @override
  String get featuresAccountsExcludeFromTotal => '不計入總資產';

  @override
  String get featuresAccountsOtherAccounts => '其他帳戶';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return '折算總額：$amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return '關聯銀行：$name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return '海外手續費率：$rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return '每月結帳日：$day 號';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return '本期消費：$amount';
  }

  @override
  String get featuresAccountsLastCycleBill => '上期帳單：';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return '消費 $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return '已繳 $amount';
  }

  @override
  String get featuresAccountsViewCycles => '查看每期明細 ›';

  @override
  String get featuresAccountsRepaymentTitle => '信用卡還款';

  @override
  String get featuresAccountsRepaymentPaymentAccount => '付款帳戶';

  @override
  String get featuresAccountsRepaymentPaymentDate => '還款日期';

  @override
  String get featuresAccountsRepaymentNoLinkedCards => '此銀行沒有關聯的信用卡';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return '目前餘額：$amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => '還款金額';

  @override
  String get featuresAccountsRepaymentConfirm => '確認還款';

  @override
  String get featuresAccountsDeleteMessage => '確定要刪除此帳戶嗎？';

  @override
  String get featuresAccountsCyclesTitle => '每期帳單明細';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name　每月結帳日 $day 號';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      '「繳款」已對應回它所清償的帳單（結帳後下一期繳清的金額算回該期帳單）。';

  @override
  String get featuresAccountsCyclesPeriod => '期間';

  @override
  String get featuresAccountsCyclesSpending => '消費';

  @override
  String get featuresAccountsCyclesPayment => '實際繳款';

  @override
  String get featuresAccountsCyclesCurrent => '本期';

  @override
  String get featuresAccountsFxTitle => '匯率管理';

  @override
  String get featuresAccountsFxAutoUpdate => '自動更新匯率';

  @override
  String get featuresAccountsFxSyncNow => '立即同步';

  @override
  String get featuresAccountsFxSyncing => '同步中...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return '上次同步：$date';
  }

  @override
  String get featuresAccountsFxCurrency => '幣別';

  @override
  String get featuresAccountsFxUnitToTwd => '1 單位 = TWD';

  @override
  String get featuresAccountsFxEmpty => '尚未設定任何外幣匯率';

  @override
  String get featuresAccountsFxCurrencyLabel => '幣別（如 USD）';

  @override
  String get featuresAccountsFxRateToTwd => '對 TWD 匯率';

  @override
  String get featuresAccountsFxAddOrUpdate => '新增 / 更新';

  @override
  String get featuresAccountsMessagesNameRequired => '請輸入帳戶名稱';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired => '請選擇付款帳戶';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      '請至少輸入一張信用卡的還款金額';

  @override
  String get featuresAccountsMessagesCurrencyInvalid => '幣別格式錯誤（需為 3 碼英文字母）';

  @override
  String get featuresAccountsMessagesRateInvalid => '請輸入有效匯率';

  @override
  String get featuresAccountsMessagesSaved => '已儲存';

  @override
  String get featuresAccountsMessagesSaveFailed => '儲存失敗';

  @override
  String get featuresAccountsMessagesDeleteFailed => '刪除失敗';

  @override
  String get featuresAccountsMessagesRatesUpdated => '匯率已更新';

  @override
  String get featuresAccountsMessagesSyncFailed => '同步失敗';

  @override
  String get featuresAccountsMessagesLoadFailed => '載入失敗';

  @override
  String get featuresTransactionsTitle => '交易記錄';

  @override
  String get featuresTransactionsSearchPlaceholder => '搜尋備註...';

  @override
  String get featuresTransactionsAllTypes => '所有類型';

  @override
  String get featuresTransactionsAllAccounts => '所有帳戶';

  @override
  String get featuresTransactionsAllCategories => '所有分類';

  @override
  String get featuresTransactionsTransfer => '轉帳';

  @override
  String get featuresTransactionsFuture => '未來交易';

  @override
  String get featuresTransactionsExcludeTransfer => '排除轉帳';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name（全部）';
  }

  @override
  String get featuresTransactionsStartDateTitle => '開始日期';

  @override
  String get featuresTransactionsEndDateTitle => '結束日期';

  @override
  String get featuresTransactionsAdd => '新增交易';

  @override
  String get featuresTransactionsEdit => '編輯交易';

  @override
  String get featuresTransactionsCreate => '新增交易';

  @override
  String get featuresTransactionsAccountTransfer => '帳戶轉帳';

  @override
  String get featuresTransactionsBatchCategory => '批次改分類';

  @override
  String get featuresTransactionsBatchDate => '批次改日期';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return '刪除選取 ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => '當頁收入';

  @override
  String get featuresTransactionsPageExpense => '當頁支出';

  @override
  String get featuresTransactionsPageTotal => '當頁合計';

  @override
  String get featuresTransactionsPageSummaryAria => '當頁交易統計';

  @override
  String get featuresTransactionsEmpty => '尚無符合條件的交易記錄';

  @override
  String featuresTransactionsSource(Object name) {
    return '來源：$name';
  }

  @override
  String get featuresTransactionsFxFee => '國外刷卡手續費';

  @override
  String get featuresTransactionsPhotoOne => '照片 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '照片 $count';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => '日期 *';

  @override
  String get featuresTransactionsAmountRequiredLabel => '金額 *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return '匯率（1 $currency = ? TWD）';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder => '留空則使用系統匯率';

  @override
  String get featuresTransactionsLatestRateLoading => '查詢最新匯率中...';

  @override
  String get featuresTransactionsFxFeePlaceholder => '留空則由系統依卡片費率自動計算';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return '卡片海外手續費率 $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return '，建議值 NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => '照片';

  @override
  String get featuresTransactionsLoadingPhotos => '載入照片中...';

  @override
  String get featuresTransactionsTakePhoto => '拍照';

  @override
  String get featuresTransactionsChooseImage => '選擇圖片';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return '手機可直接拍照或從相簿選圖。最多 5 張，每張上限 $maxMb MB。';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return '新增照片 $count';
  }

  @override
  String get featuresTransactionsRemove => '移除';

  @override
  String get featuresTransactionsChoosePhoto => '選擇照片';

  @override
  String get featuresTransactionsTransferOut => '轉出帳戶 *';

  @override
  String get featuresTransactionsTransferIn => '轉入帳戶 *';

  @override
  String get featuresTransactionsSelectPlaceholder => '請選擇';

  @override
  String get featuresTransactionsCreating => '建立中...';

  @override
  String get featuresTransactionsConfirmTransfer => '確認轉帳';

  @override
  String get featuresTransactionsBatchCategoryTitle => '批次變更分類';

  @override
  String get featuresTransactionsBatchDateTitle => '批次變更日期';

  @override
  String get featuresTransactionsNewCategory => '新分類';

  @override
  String get featuresTransactionsNewDate => '新日期';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return '套用到 $count 筆';
  }

  @override
  String get featuresTransactionsDeleteMessage => '確定要刪除這筆交易記錄嗎？此操作無法復原。';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return '確定要刪除選取的 $count 筆交易嗎？';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return '交易已更新，但$message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return '交易已建立，但$message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked => '轉帳交易請改用刪除後重建';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      '國外刷卡手續費為自動產生，請編輯對應的國外交易（修改後手續費會自動同步）';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed => '照片上傳失敗';

  @override
  String get featuresTransactionsMessagesDateRequired => '請選擇日期';

  @override
  String get featuresTransactionsMessagesAmountRequired => '請輸入有效金額';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      '請選擇轉出與轉入帳戶';

  @override
  String get featuresTransactionsMessagesTransferSameAccount => '轉出與轉入帳戶不可相同';

  @override
  String get featuresTransactionsTypeLabelsIncome => '收入';

  @override
  String get featuresTransactionsTypeLabelsExpense => '支出';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => '轉入';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => '轉出';

  @override
  String get featuresStocksTabsPortfolio => '持股總覽';

  @override
  String get featuresStocksTabsTransactions => '交易紀錄';

  @override
  String get featuresStocksTabsDividends => '股利紀錄';

  @override
  String get featuresStocksTabsRealized => '實現損益';

  @override
  String get featuresStocksTabsSettings => '交易設定';

  @override
  String get featuresStocksCommonStockLabel => '股票';

  @override
  String get featuresStocksCommonStockRequired => '股票 *';

  @override
  String get featuresStocksCommonStockTypeStock => '股票';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => '權證';

  @override
  String get featuresStocksCommonDate => '日期';

  @override
  String get featuresStocksCommonShares => '股數';

  @override
  String get featuresStocksCommonPrice => '價格';

  @override
  String get featuresStocksCommonTotal => '合計';

  @override
  String get featuresStocksCommonReturnRate => '報酬率';

  @override
  String get featuresStocksCommonOverallReturnRate => '整體報酬率';

  @override
  String get featuresStocksCommonEstimatedPL => '預估損益';

  @override
  String get featuresStocksCommonRealizedPL => '實現損益';

  @override
  String get featuresStocksCommonTotalRealizedPL => '總實現損益';

  @override
  String get featuresStocksCommonYearRealizedPL => '今年實現損益';

  @override
  String get featuresStocksCommonRealizedCount => '已實現筆數';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count 筆';
  }

  @override
  String get featuresStocksCommonSellAverage => '賣出均價';

  @override
  String get featuresStocksCommonCostAverage => '成本均價';

  @override
  String get featuresStocksCommonFeeAndTax => '手續費+稅';

  @override
  String get featuresStocksCommonCashDividend => '現金股利';

  @override
  String get featuresStocksCommonStockDividend => '股票股利';

  @override
  String get featuresStocksCommonStockSymbol => '股票代碼 *';

  @override
  String get featuresStocksCommonStockName => '股票名稱';

  @override
  String get featuresStocksCommonSearching => '查詢中...';

  @override
  String get featuresStocksCommonCancelAccounting => '— 不入帳（純股票股利）—';

  @override
  String get featuresStocksCommonAutoCalculate => '自動計算';

  @override
  String get featuresStocksCommonBuy => '買進';

  @override
  String get featuresStocksCommonSell => '賣出';

  @override
  String get featuresStocksPortfolioTitle => '持股總覽';

  @override
  String get featuresStocksPortfolioTotalMarketValue => '股票總市值';

  @override
  String get featuresStocksPortfolioTotalCost => '總投入成本';

  @override
  String get featuresStocksPortfolioTotalDividend => '累計股利';

  @override
  String get featuresStocksPortfolioAddStock => '新增股票';

  @override
  String get featuresStocksPortfolioEditStock => '編輯股票';

  @override
  String get featuresStocksPortfolioNewStock => '新增股票';

  @override
  String get featuresStocksPortfolioUpdatePrices => '更新股價';

  @override
  String get featuresStocksPortfolioBatchUpdate => '批次自動更新';

  @override
  String get featuresStocksPortfolioUpdating => '更新中...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      '優先由瀏覽器端向台灣證交所公開 API 查詢；若瀏覽器被擋，會改用登入後的 user API 代理查詢並更新持股。';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return '更新完成：$updated 支成功。';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return '更新完成：$updated 支成功，$failed 支失敗。';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      '瀏覽器端無法取得台灣證交所行情資料';

  @override
  String get featuresStocksPortfolioHeldShares => '持有股數';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count 股';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => '目前股價';

  @override
  String get featuresStocksPortfolioMarketValue => '市值';

  @override
  String featuresStocksPortfolioDividendMonths(Object months) {
    return '配息月份：$months';
  }

  @override
  String get featuresStocksPortfolioDividendMonthsEmpty => '尚無配息紀錄';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired => '請輸入股票代碼';

  @override
  String get featuresStocksTransactionsTitle => '股票交易紀錄';

  @override
  String get featuresStocksTransactionsAddTransaction => '新增交易';

  @override
  String get featuresStocksTransactionsEditTransaction => '編輯交易';

  @override
  String get featuresStocksTransactionsNewTransaction => '新增交易';

  @override
  String get featuresStocksTransactionsTypeLabel => '類型';

  @override
  String get featuresStocksTransactionsDateLabel => '日期 *';

  @override
  String get featuresStocksTransactionsSharesLabel => '股數 *';

  @override
  String get featuresStocksTransactionsPriceLabel => '單價 *';

  @override
  String get featuresStocksTransactionsFeeLabel => '手續費';

  @override
  String get featuresStocksTransactionsTaxLabel => '交易稅';

  @override
  String get featuresStocksTransactionsDeleteMessage => '確定要刪除此交易記錄嗎？';

  @override
  String get featuresStocksTransactionsMessagesStockRequired => '請選擇股票';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired => '請輸入有效股數';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired => '請輸入有效價格';

  @override
  String get featuresStocksDividendsTitle => '股利紀錄';

  @override
  String get featuresStocksDividendsAddDividend => '新增股利';

  @override
  String get featuresStocksDividendsEditDividend => '編輯股利';

  @override
  String get featuresStocksDividendsNewDividend => '新增股利';

  @override
  String get featuresStocksDividendsSyncExDividends => '同步除權息';

  @override
  String get featuresStocksDividendsSyncDescription =>
      '依照您的持股紀錄，從台灣證交所自動同步歷年除權息資料。';

  @override
  String get featuresStocksDividendsSyncStart => '開始同步';

  @override
  String get featuresStocksDividendsSyncing => '同步中...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return '新增 $synced 筆，跳過 $skipped 筆。';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return '新增 $synced 筆，跳過 $skipped 筆，$failed 筆失敗。';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel => '現金股利 (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel => '股票股利 (股)';

  @override
  String get featuresStocksDividendsDepositAccount => '入款帳戶';

  @override
  String get featuresStocksDividendsDeleteMessage => '確定要刪除此股利記錄嗎？';

  @override
  String get featuresStocksDividendsMessagesStockRequired => '請選擇股票';

  @override
  String get featuresStocksDividendsMessagesDividendRequired => '請輸入現金股利或股票股利';

  @override
  String get featuresStocksRealizedTitle => '實現損益';

  @override
  String get featuresStocksSettingsTitle => '交易設定';

  @override
  String get featuresStocksSettingsFeeTitle => '手續費 / 交易稅設定';

  @override
  String get featuresStocksSettingsFeeRate => '手續費率';

  @override
  String get featuresStocksSettingsFeeDiscount => '折扣 (0~1)';

  @override
  String get featuresStocksSettingsFeeMinLot => '最低手續費（整股）';

  @override
  String get featuresStocksSettingsFeeMinOdd => '最低手續費（零股）';

  @override
  String get featuresStocksSettingsSellTaxRateStock => '賣出稅率（股票）';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => '賣出稅率（ETF）';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant => '賣出稅率（權證）';

  @override
  String get featuresStocksSettingsSellTaxMin => '最低交易稅';

  @override
  String get featuresStocksSettingsSaveSettings => '儲存設定';

  @override
  String get featuresStocksSettingsStockStatusTitle => '股票狀態管理';

  @override
  String get featuresStocksSettingsCurrentPrice => '目前價格';

  @override
  String get featuresStocksSettingsNormalTracking => '正常追蹤';

  @override
  String get featuresStocksSettingsDelisted => '已下市';

  @override
  String get featuresStocksSettingsRestoreTracking => '恢復追蹤';

  @override
  String get featuresStocksSettingsMarkDelisted => '標記下市';

  @override
  String get featuresStocksSettingsRecurringTitle => '股票定期定額';

  @override
  String get featuresStocksSettingsAddRecurringShort => '新增';

  @override
  String get featuresStocksSettingsEditRecurring => '編輯定期定額';

  @override
  String get featuresStocksSettingsNewRecurring => '新增定期定額';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => '金額 (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => '頻率';

  @override
  String get featuresStocksSettingsStartDate => '起始日期';

  @override
  String get featuresStocksSettingsLastGenerated => '上次產生';

  @override
  String get featuresStocksSettingsActive => '啟用中';

  @override
  String get featuresStocksSettingsInactive => '已停用';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm => '確定要刪除此定期定額設定嗎？';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => '每日';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => '每週';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => '每月';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => '每年';

  @override
  String get featuresStocksSettingsMessagesSaved => '設定已儲存';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return '儲存失敗：$message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired => '請選擇股票';

  @override
  String get featuresStocksSettingsMessagesAmountRequired => '請輸入有效金額';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol 已$status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus => '恢復為正常追蹤';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus => '標記為下市';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed => '更新下市狀態失敗';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => '每日收支報表';

  @override
  String get notificationsReportTypeWeekly => '每週收支報表';

  @override
  String get notificationsReportTypeMonthly => '每月收支報表';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return '每日收支報表｜$date（週$weekday）';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return '每週收支報表｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return '每月收支報表｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name，$date（週$weekday）的收支';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name，$start ~ $end 的收支';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name，$month 月的收支';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 報表日 $date　·　寄送日 $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 報表區間 $start ~ $end　·　寄送日 $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 報表月 $month　·　寄送日 $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return '統計昨日（$date 週$weekday）整日收支，今日（$sendDate）寄出';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return '統計過去 7 日（$start ~ $end，共 7 天）收支，今日（$sendDate）寄出';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '統計上月（$month，$start ~ $end）整月收支，本月（$sendDate）寄出';
  }

  @override
  String get notificationsLeadDaily => '昨日';

  @override
  String get notificationsLeadWeekly => '本週';

  @override
  String get notificationsLeadMonthly => '上月';

  @override
  String notificationsKpiIncome(Object lead) {
    return '$lead收入';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return '$lead支出';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return '$lead淨額';
  }

  @override
  String get notificationsCompareLabelDaily => '對比前日';

  @override
  String get notificationsCompareLabelWeekly => '對比上週';

  @override
  String get notificationsCompareLabelMonthly => '對比上月';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return '昨日（$date）';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return '過去 7 日（$start ~ $end）';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return '上月（$month）';
  }

  @override
  String get notificationsSectionsBalance => '帳戶餘額';

  @override
  String get notificationsSectionsTopCategories => '本月支出 Top 5';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return '$month 月支出 Top 5';
  }

  @override
  String get notificationsSectionsDailyDetail => '每日明細';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return '本月累計（$month）';
  }

  @override
  String get notificationsSectionsStock => '股票投資';

  @override
  String get notificationsSectionsRecentDaily => '昨日交易';

  @override
  String get notificationsSectionsRecentWeekly => '本週交易';

  @override
  String get notificationsSectionsRecentMonthly => '上月交易';

  @override
  String get notificationsLabelsIncome => '收入';

  @override
  String get notificationsLabelsExpense => '支出';

  @override
  String get notificationsLabelsNet => '淨額';

  @override
  String get notificationsLabelsCost => '總成本';

  @override
  String get notificationsLabelsMarketValue => '市值';

  @override
  String get notificationsLabelsUnrealizedPL => '未實現損益';

  @override
  String get notificationsLabelsReturnRate => '報酬率';

  @override
  String get notificationsLabelsUncategorized => '未分類';

  @override
  String get notificationsTableDate => '日期';

  @override
  String get notificationsEmptyNoAccount => '尚無帳戶';

  @override
  String get notificationsEmptyNoExpense => '尚無支出紀錄';

  @override
  String notificationsEmptyNoTx(Object label) {
    return '$label沒有交易';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return '股票投資：市值 $marketValue，未實現損益 $pl';
  }

  @override
  String get notificationsCtaViewFullReport => '查看完整報表';

  @override
  String get notificationsCtaViewLineRecord => '查看 LINE 紀錄';

  @override
  String get notificationsReminderAltText => '記錄支出提醒';

  @override
  String get notificationsReminderTitle => '記得記錄今天的支出';

  @override
  String notificationsReminderBody(Object name) {
    return '$name，花 10 秒把今天的支出補上，月底比較不會漏帳。';
  }

  @override
  String get notificationsReminderHint => '按下新增支出後，直接輸入：金額 備註 日期（日期可省略）';

  @override
  String get notificationsReminderFallbackName => '你';

  @override
  String get notificationsReminderAddExpense => '新增支出';

  @override
  String get notificationsReminderViewToday => '查看今天紀錄';

  @override
  String get notificationsFallbackUser => '使用者';

  @override
  String get mobileLegacyMessagebde18a20 => '・不計入總資產';

  @override
  String get mobileLegacyNoneCreateAsParent => '（無，作為父分類）';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      '「首頁」依月份顯示收入、支出、淨額與支出分類圓餅圖，左右切換月份，一眼看懂錢花到哪裡。';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      '「繳款」已對應回它所清償的帳單（結帳後下一期繳清的金額算回該期）。';

  @override
  String get mobileLegacy0NoPayment => '0＝不還';

  @override
  String get mobileLegacyMon => '一';

  @override
  String get mobileLegacyStock => '一般股票';

  @override
  String get mobileLegacyStocks => '一般股票（%）';

  @override
  String get mobileLegacyTue => '二';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      '入款帳戶（含現金股利時必填）';

  @override
  String get mobileLegacyWed => '三';

  @override
  String get mobileLegacyPreviousStatement => '上期帳單 ';

  @override
  String get mobileLegacyNext => '下一步';

  @override
  String get mobileLegacyDelisted => '下市';

  @override
  String get mobileLegacySubcategory => '子分類';

  @override
  String get mobileLegacyDeleted => '已刪除';

  @override
  String get mobileLegacyUpdated => '已更新';

  @override
  String get mobileLegacyLinked => '已綁定';

  @override
  String get mobileLegacyUnlinked => '已解除綁定';

  @override
  String get mobileLegacyTotalRealizedPL => '已實現損益合計';

  @override
  String get mobileLegacyFri => '五';

  @override
  String get mobileLegacyStandardRate01 => '公定 0.1%';

  @override
  String get mobileLegacyStandardRate03 => '公定 0.3%';

  @override
  String get mobileLegacySat => '六';

  @override
  String get mobileLegacyCategoryName => '分類名稱';

  @override
  String get mobileLegacyFeeOptional => '手續費（選填）';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      '手續費／證交稅留空則由後端自動計算';

  @override
  String get mobileLegacyCommissionRate => '手續費率（%）';

  @override
  String get mobileLegacyDay => '日';

  @override
  String get mobileLegacyMonthlyBudget => '月度總預算';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent => '父分類（不選＝建立父分類）';

  @override
  String get mobileLegacyTheme => '主題';

  @override
  String get mobileLegacyThu => '四';

  @override
  String get mobileLegacyUnnamedPasskey => '未命名 Passkey';

  @override
  String get mobileLegacyUnknownCategory => '未知分類';

  @override
  String get mobileLegacyNotLinked => '未綁定';

  @override
  String get mobileLegacyNoTransactionsThisMonth => '本月尚無交易';

  @override
  String get mobileLegacyNoBudgetThisMonth => '本月尚無預算';

  @override
  String get mobileLegacyNetThisMonth => '本月淨額';

  @override
  String get mobileLegacyPositiveWholeNumber => '正整數';

  @override
  String get mobileLegacyDeletePermanently => '永久刪除';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      '永久刪除帳號與所有資料，無法復原';

  @override
  String get mobileLegacyNoReleaseNotesAvailable => '目前沒有更新內容';

  @override
  String get mobileLegacyCurrentDevice => '目前裝置';

  @override
  String get mobileLegacyTransactions => '交易';

  @override
  String get mobileLegacyAll => '全部';

  @override
  String get mobileLegacyAllCategories => '全部分類';

  @override
  String get mobileLegacyAllAccounts => '全部帳戶';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      '各卡還款金額（以卡片幣別計）';

  @override
  String get mobileLegacySyncDividends => '同步股利';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically => '名稱（選填，留空自動帶入）';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      '在「股票」分頁輸入股票代號（例如 2330）即可追蹤即時股價、未實現與已實現損益，系統還會自動同步除權息。';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      '在底部「記帳」分頁點右下角的「＋」即可新增收入或支出，支援多幣別與帳戶轉帳。交易往左滑可刪除、點一下可編輯。';

  @override
  String get mobileLegacyNoDataForThisPeriod => '此區間無資料';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      '此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票與設定），且無法復原。';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports => '自訂定期收支報表寄送時間';

  @override
  String get mobileLegacyAutomatic => '自動';

  @override
  String get mobileLegacyAtLeast8Characters => '至少 8 字元';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      '至少 8 字元，含大小寫、數字與特殊符號';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      '你的個人資產管家——記帳、預算、台股投資與統計報表，一個 App 全部搞定。花一分鐘快速認識主要功能。';

  @override
  String get mobileLegacyDeletePasskey => '刪除 Passkey';

  @override
  String get mobileLegacyDeleteCategory => '刪除分類';

  @override
  String get mobileLegacyDeleteTransaction => '刪除交易';

  @override
  String get mobileLegacyDeleteDividend => '刪除股利';

  @override
  String get mobileLegacyDeleteStock => '刪除股票';

  @override
  String get mobileLegacyDeleteAccount => '刪除帳戶';

  @override
  String get mobileLegacyDeleteSchedule => '刪除排程';

  @override
  String get mobileLegacyDeletePhoto => '刪除照片';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      '含現金股利時，入款帳戶為必填';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters => '找不到符合篩選的交易';

  @override
  String get mobileLegacyDiscount01 => '折讓（0~1）';

  @override
  String get mobileLegacyImproved => '改進';

  @override
  String get mobileLegacyMore => '更多';

  @override
  String get mobileLegacyUpdatedd9db02d0 => '更新';

  @override
  String get mobileLegacyLastDayOfEachMonth => '每月最後一天';

  @override
  String get mobileLegacyNoPricesToUpdate => '沒有可更新的股價';

  @override
  String get mobileLegacyNoNewDividendsToSync => '沒有新的股利可同步';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession => '使用者登出，已清除本機登入';

  @override
  String get mobileLegacyGettingStarted => '使用教學';

  @override
  String get mobileLegacyExample06MeansA40Discount => '例：0.6 代表 6 折';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      '例：1.5 代表 1.5%，外幣刷卡時自動計算手續費';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      '到「更多」設定每月預算、查看統計報表、管理帳戶與分類，還能設定固定收支與報表通知。準備好了，開始記錄吧！';

  @override
  String get mobileLegacyStandardBrokerageRate01425 => '券商公定 0.1425%';

  @override
  String get mobileLegacyNotSentYet => '尚未寄送';

  @override
  String get mobileLegacyNoRealizedReturns => '尚無已實現損益';

  @override
  String get mobileLegacyNoCategoriesYet => '尚無分類';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      '尚無交易，點右下角記一筆';

  @override
  String get mobileLegacyNoRecurringTransactions => '尚無固定收支';

  @override
  String get mobileLegacyNoDividendRecords => '尚無股利紀錄';

  @override
  String get mobileLegacyNoStockTransactions => '尚無股票交易';

  @override
  String get mobileLegacyNoHoldingsYet => '尚無持股';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => '尚無登入紀錄';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      '於瀏覽器完成註冊（需裝置生物辨識）';

  @override
  String get mobileLegacyNotice => '注意';

  @override
  String get mobileLegacyDividends => '股利';

  @override
  String get mobileLegacyDividendSyncCompleted => '股利同步完成';

  @override
  String get mobileLegacyTickerEG2330 => '股票代號（如 2330）';

  @override
  String get mobileLegacyStockMarketValue => '股票市值';

  @override
  String get mobileLegacyHoldings => '持股';

  @override
  String get mobileLegacyDayOfWeek => '星期';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes => '查看目前版本與更新內容';

  @override
  String get mobileLegacyRename => '重新命名';

  @override
  String get mobileLegacyCheckAgain => '重新檢查';

  @override
  String get mobileLegacyRetry => '重試';

  @override
  String get mobileLegacyHome => '首頁';

  @override
  String get mobileLegacyFixed => '修正';

  @override
  String get mobileLegacyApply => '套用';

  @override
  String get mobileLegacyTime => '時間';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional => '海外手續費 TWD（選填）';

  @override
  String get mobileLegacyAddTransaction => '記一筆';

  @override
  String get mobileLegacyTransactions8084a8ea => '記帳';

  @override
  String get mobileLegacyStartDate => '起始日';

  @override
  String get mobileLegacyTrackTaiwanStocks => '追蹤台股投資';

  @override
  String get mobileLegacyStockDividendSharesOptional => '配股股數（選填）';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      '國外刷卡手續費由原交易自動產生，請編輯對應的國外交易';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters => '密碼長度至少 8 字元';

  @override
  String get mobileLegacyAccountName => '帳戶名稱';

  @override
  String get mobileLegacyAccountDeleted => '帳號已刪除';

  @override
  String get mobileLegacyAccountSecurity => '帳號安全';

  @override
  String get mobileLegacyLinkedAccounts => '帳號綁定';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => '常用幣別';

  @override
  String get mobileLegacyChooseFromGallery => '從相簿選擇';

  @override
  String get mobileLegacyEnabled => '啟用';

  @override
  String get mobileLegacyDark => '深色';

  @override
  String get mobileLegacyLight => '淺色';

  @override
  String get mobileLegacyClearDates => '清除日期';

  @override
  String get mobileLegacyClearFilters => '清除篩選';

  @override
  String get mobileLegacyCashDividendTotalOptional => '現金股利（總額，選填）';

  @override
  String get mobileLegacyEnterACashOrStockDividend => '現金股利與配股至少填一項';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      '設定後帳戶卡片會顯示本期帳單消費，留空則不統計';

  @override
  String get mobileLegacyNoteOptional => '備註（選填）';

  @override
  String get mobileLegacyNoteKeyword => '備註關鍵字';

  @override
  String get mobileLegacyMinimumTransactionTax => '最低證交稅';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction => '單筆交易最多上傳 5 張照片';

  @override
  String get mobileLegacyReportNotifications => '報表通知';

  @override
  String get mobileLegacySeeYourCompleteCashFlow => '掌握收支全貌';

  @override
  String get mobileLegacyUnableToCreateLineSignInState => '無法建立 LINE 登入狀態';

  @override
  String get mobileLegacyUnableToOpenBrowser => '無法開啟瀏覽器';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForGoogleSign =>
      '無法開啟瀏覽器進行 Google 登入';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForLineSign =>
      '無法開啟瀏覽器進行 LINE 登入';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForPasskeySign =>
      '無法開啟瀏覽器進行 Passkey 登入';

  @override
  String get mobileLegacyYourSessionExpiredSignInAgain => '登入已過期，請重新登入';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      '登入回應未包含認證 Cookie，請確認後端設定';

  @override
  String get mobileLegacySignedIn => '登入成功';

  @override
  String get mobileLegacySignInHistory => '登入紀錄';

  @override
  String get mobileLegacySignedInDevices => '登入裝置';

  @override
  String get mobileLegacySignInRequestConnectionFailed => '登入請求連線失敗';

  @override
  String get mobileLegacyEndDate => '結束日';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      '註冊回應未包含認證 Cookie，請確認後端設定';

  @override
  String get mobileLegacySignUpAndSignIn => '註冊並登入';

  @override
  String get mobileLegacyBuy => '買';

  @override
  String get mobileLegacyFrequency => '週期';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 => '匯率須大於 0';

  @override
  String get mobileLegacyReturns => '損益';

  @override
  String get mobileLegacyAddPasskey => '新增 Passkey';

  @override
  String get mobileLegacyAddStockTransaction => '新增股票交易';

  @override
  String get mobileLegacyAddSchedule => '新增排程';

  @override
  String get mobileLegacyAddReportSchedule => '新增報表排程';

  @override
  String get mobileLegacyAddPhotosOptional => '新增照片（選填）';

  @override
  String get mobileLegacyFailedToLoadPhoto => '照片載入失敗';

  @override
  String get mobileLegacyLink => '綁定';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      '綁定需於瀏覽器完成授權；解除綁定前請確認仍可用其他方式登入。';

  @override
  String get mobileLegacyUnlink => '解除';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp => '資產管理 · 安卓客戶端';

  @override
  String get mobileLegacySkip => '跳過';

  @override
  String get mobileLegacyMinimumOddLotCommission => '零股最低手續費';

  @override
  String get mobileLegacyIncorrectEmailOrPassword => '電子郵件或密碼錯誤';

  @override
  String get mobileLegacyDefaultCurrency => '預設幣別';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies => '預設幣別與常用幣別';

  @override
  String get mobileLegacyBudgets => '預算';

  @override
  String get mobileLegacyBudgetsReportsAndMore => '預算、報表與更多';

  @override
  String get mobileLegacyBudgetAmount => '預算金額';

  @override
  String get mobileLegacyCurrencySettings => '幣別設定';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage => '語言（APP、通知與網頁版）';

  @override
  String get mobileLegacyBank => '銀行';

  @override
  String get mobileLegacyBankBalance => '銀行餘額';

  @override
  String get mobileLegacyRequiresALinkedLineAccount => '需已綁定 LINE';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      '需至少一張信用卡與一個非信用卡帳戶才能還款';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      '需含大小寫、數字與特殊符號';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      '需含大寫、小寫、數字與特殊符號';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule => '確定刪除此報表通知排程？';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      '確定要刪除這張已上傳的照片嗎？此動作無法復原。';

  @override
  String get mobileLegacyEditStockTransaction => '編輯股票交易';

  @override
  String get mobileLegacyEditReportSchedule => '編輯報表排程';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst => '請先完成下方的真人驗證';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst => '請先到「持股」分頁新增股票';

  @override
  String get mobileLegacySelectAParentCategoryFirst => '請先選擇父分類';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard => '請至少填一張卡的還款金額';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod => '請至少選擇一種通知方式';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo => '請輸入 ≥ 0 的數字';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => '請輸入 1~31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 => '請輸入大於 0 的金額';

  @override
  String get mobileLegacyEnterATicker => '請輸入代號';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber => '請輸入正整數';

  @override
  String get mobileLegacyEnterAName => '請輸入名稱';

  @override
  String get mobileLegacyEnterAValidEmailAddress => '請輸入有效的電子郵件';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm => '請輸入密碼以確認';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm => '請輸入帳號電子信箱以確認';

  @override
  String get mobileLegacyEnterADisplayName => '請輸入顯示名稱';

  @override
  String get mobileLegacySelectASubcategory => '請選擇子分類';

  @override
  String get mobileLegacySelectACategory => '請選擇分類';

  @override
  String get mobileLegacySelectAParentCategory => '請選擇父分類';

  @override
  String get mobileLegacySelectAnAccount => '請選擇帳戶';

  @override
  String get mobileLegacySelectADestinationAccount => '請選擇轉入帳戶';

  @override
  String get mobileLegacySell => '賣';

  @override
  String get mobileLegacyMinimumBoardLotCommission => '整股最低手續費';

  @override
  String get mobileLegacyFilter => '篩選';

  @override
  String get mobileLegacyFilterTransactions => '篩選交易';

  @override
  String get mobileLegacyChooseTheme => '選擇主題';

  @override
  String get mobileLegacyLogTransactionsInSeconds => '隨手記一筆';

  @override
  String get mobileLegacyMarketValue => '總市值';

  @override
  String get mobileLegacyTotalAssetsInTwd => '總資產（換算 TWD）';

  @override
  String get mobileLegacyTraditionalChineseEnglish => '繁體中文 / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp => '還沒有帳號？註冊';

  @override
  String get mobileLegacyPaymentRecorded => '還款已記錄';

  @override
  String get mobileLegacyToAccount => '轉入帳戶';

  @override
  String get mobileLegacyFromAccount => '轉出帳戶';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      '轉出與轉入不可相同';

  @override
  String get mobileLegacyEditTransfersInTheWebApp => '轉帳請於網頁版編輯';

  @override
  String get mobileLegacyTransactionTaxSell => '證交稅（賣出）';

  @override
  String get mobileLegacyTransactionTaxOptional => '證交稅（選填）';

  @override
  String get mobileLegacyTypeAffectsTransactionTax => '類型（影響證交稅率）';

  @override
  String get mobileLegacyWarrants => '權證（%）';

  @override
  String get mobileLegacyWelcomeToAssetpilot => '歡迎使用 AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis => '變更後其他裝置將被登出。';

  @override
  String get mobileLegacyTestSentryConfiguration => '驗證 Sentry 設定（測試用）';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'API 回應 401，工作階段已過期並清除本機登入';

  @override
  String get mobileLegacyApiRequestFailed => 'API 請求失敗';

  @override
  String get mobileLegacyApiRequestConnectionFailed => 'API 請求連線失敗';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'App 登入回應未包含認證 Cookie';

  @override
  String get mobileLegacyEmailNotifications => 'Email 通知';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'Google 登入回應未包含認證 Cookie';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google 登入狀態不符，請重試';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google 登入逾時或已取消';

  @override
  String get mobileLegacyLineNotifications => 'LINE 通知';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'LINE 登入回應未包含認證 Cookie';

  @override
  String get mobileLegacyLineSignInStateMismatchTryAgain => 'LINE 登入狀態不符，請重試';

  @override
  String get mobileLegacyLineSignInTimedOutOrWasCancelled => 'LINE 登入逾時或已取消';

  @override
  String get mobileLegacyPasskeySignInTimedOutOrWasCancelled =>
      'Passkey 登入逾時或已取消';

  @override
  String get mobileLegacyTwdIsAlwaysIncludedSelectedCurrenciesAppearFirst =>
      'TWD 一律包含。勾選的幣別會出現在交易/固定收支的幣別清單前段。';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return '$day 號';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return '上次寄送 $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return '目前版本 v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return '有新版本 v$version 可更新';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return '每月 $day 號';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return '每週$weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '星期$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return '建立於 $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return '已更新語言：$value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return '載入失敗：$value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return '發生未預期的錯誤：$value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return '$provider 登入失敗：$error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return '更新股價失敗：$value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return '同步股利失敗：$value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return '照片上傳失敗：$value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return '請求失敗（HTTP $code）';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return '登入失敗（HTTP $code）';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return '無法連線到後端（$target）：$error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return '確定刪除「$name」？';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return '解除 $provider 綁定';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return '確定解除與 $provider 的綁定？';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return '$provider 綁定';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name（全部）';
  }

  @override
  String mobileDynamicUnknownHttpMethod(Object method) {
    return '未知的 HTTP method: $method';
  }

  @override
  String mobileDynamicDeleteAccountName(Object name) {
    return '確定刪除「$name」？相關交易可能一併受影響。';
  }

  @override
  String mobileDynamicCurrentSpending(Object amount, Object range) {
    return '本期消費 $amount$range';
  }

  @override
  String mobileDynamicSpentAmount(Object amount) {
    return '消費 $amount';
  }

  @override
  String mobileDynamicPaidAmount(Object amount) {
    return '已繳 $amount';
  }

  @override
  String mobileDynamicStatementCloses(Object name, Object day) {
    return '$name　每月結帳日 $day 號';
  }

  @override
  String mobileDynamicAddBudgetForMonth(Object month) {
    return '新增預算（$month）';
  }

  @override
  String mobileDynamicRecurringSubtitle(
    Object frequency,
    Object account,
    Object startDate,
  ) {
    return '$frequency・$account・自 $startDate';
  }

  @override
  String mobileDynamicReportTotalExpense(Object total) {
    return '總支出：$total';
  }

  @override
  String mobileDynamicReportTotalIncome(Object total) {
    return '總收入：$total';
  }

  @override
  String mobileDynamicDeleteTransactionDate(Object date) {
    return '確定刪除這筆 $date 的交易？此動作無法復原。';
  }

  @override
  String mobileDynamicDeleteTransactionCompact(Object date) {
    return '確定刪除這筆$date的交易？';
  }

  @override
  String mobileDynamicExchangeRateForCurrency(Object currency) {
    return '匯率（1 $currency = ? TWD）';
  }

  @override
  String mobileDynamicCardRateAutoFee(Object rate) {
    return '此卡費率 $rate%，留空將自動計算';
  }

  @override
  String mobileDynamicUploadedPhotosCount(Object count) {
    return '已上傳照片（$count）';
  }

  @override
  String mobileDynamicAddPhotosCount(Object count) {
    return '新增照片（$count/5）';
  }

  @override
  String mobileDynamicStockPricesUpdated(Object count) {
    return '已更新 $count 檔股價';
  }

  @override
  String mobileDynamicStockPricesUpdatedWithFailed(
    Object count,
    Object failed,
  ) {
    return '已更新 $count 檔股價，$failed 檔查詢失敗';
  }

  @override
  String mobileDynamicDeleteStock(Object symbol, Object name) {
    return '確定刪除「$symbol $name」？其所有交易與股利紀錄將一併刪除，無法復原。';
  }

  @override
  String mobileDynamicStockHoldingSubtitle(
    Object shares,
    Object avgCost,
    Object currentPrice,
  ) {
    return '$shares 股・均價 $avgCost・現價 $currentPrice';
  }

  @override
  String mobileDynamicStockTransactionSubtitle(
    Object date,
    Object shares,
    Object price,
  ) {
    return '$date・$shares 股 @ $price';
  }

  @override
  String mobileDynamicDeleteDividend(Object symbol, Object date) {
    return '確定刪除 $symbol 於 $date 的股利紀錄？';
  }

  @override
  String mobileDynamicDividendsSynced(Object count) {
    return '已同步 $count 筆股利';
  }

  @override
  String mobileDynamicDividendsSyncedWithSkipped(Object count, Object skipped) {
    return '已同步 $count 筆股利，略過 $skipped 筆';
  }

  @override
  String mobileDynamicCashDividend(Object amount) {
    return '現金 $amount';
  }

  @override
  String mobileDynamicStockDividendShares(Object shares) {
    return '配股 $shares 股';
  }

  @override
  String mobileDynamicRealizedTransactionSubtitle(Object date, Object shares) {
    return '$date・賣 $shares 股';
  }

  @override
  String dashboardDataStatusQueriedAt(Object time) {
    return '資料查詢時間 $time';
  }

  @override
  String get dashboardAttentionTitle => '待處理';

  @override
  String get dashboardAttentionAllClear => '目前沒有需要處理的事項';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count 筆固定收支需要檢查';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count 筆未分類交易 · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count 檔持倉尚無價格';
  }

  @override
  String get dashboardDriversTitle => '本月 Top 3 驅動因素';

  @override
  String dashboardDriversSubtitle(Object month) {
    return '$month 金額最高的收入與支出項目';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '占此類型 $share%';
  }

  @override
  String get dashboardPersonalizeTrigger => '自訂首頁';

  @override
  String get dashboardPersonalizeTitle => '自訂首頁';

  @override
  String get dashboardPersonalizeDescription => '選擇要顯示的模組，並依你的使用順序排列。';

  @override
  String get dashboardPersonalizeModulesAssets => '資產概覽';

  @override
  String get dashboardPersonalizeModulesAttention => '需要處理';

  @override
  String get dashboardPersonalizeModulesWhyChanged => '現金流為何變動';

  @override
  String get dashboardPersonalizeModulesSpending => '支出分類';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => '投資組合健檢';

  @override
  String get dashboardPersonalizeModulesIncomeRecent => '收入與近期交易';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return '將「$module」上移';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return '將「$module」下移';
  }

  @override
  String get dashboardPersonalizeSaved => '首頁配置已儲存';

  @override
  String get dashboardPersonalizeSaveError => '無法儲存首頁配置';

  @override
  String get dashboardPersonalizeReset => '重設';

  @override
  String get dashboardPersonalizeApply => '套用';

  @override
  String get dashboardComparisonTitle => '現金流為何變動';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart～$currentEnd，對比 $previousStart～$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return '完整月份，對比 $previousStart～$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable => '這個月份沒有可比較的上一期間。';

  @override
  String get dashboardComparisonNoChanges => '已記錄的現金流與可比期間相同。';

  @override
  String get dashboardComparisonPreviousNet => '上期淨現金流';

  @override
  String get dashboardComparisonNetChange => '淨現金流變動';

  @override
  String get dashboardComparisonNewThisPeriod => '本期新增';

  @override
  String get dashboardComparisonIncreased => '金額增加';

  @override
  String get dashboardComparisonDecreased => '金額減少';

  @override
  String get dashboardPortfolioHealthTitle => '投資成本基礎健檢';

  @override
  String get dashboardPortfolioHealthSubtitle => '目前市值與 FIFO 剩餘成本比較';

  @override
  String get dashboardPortfolioHealthNoHoldings => '新增持股後即可查看成本基礎洞察。';

  @override
  String get dashboardPortfolioHealthMissingPrices => '需要目前價格才能提供這項比較。';

  @override
  String get dashboardPortfolioHealthMixedCurrencies => '持股包含多種幣別，暫不提供合併百分比。';

  @override
  String get dashboardPortfolioHealthMarketValue => '已有價格的市值';

  @override
  String get dashboardPortfolioHealthCost => '已有價格持股成本';

  @override
  String get dashboardPortfolioHealthUnrealizedGross => '未實現毛損益';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return '最大持股：$name · 佔已有價格市值 $share%';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      '這裡比較目前價格與已記錄的 FIFO 成本，不是市場指數基準或時間加權績效。';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return '價格涵蓋：$total 檔持股中有 $priced 檔';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook => '排程現金展望';

  @override
  String get dashboardPersonalizeModulesSavingsScenario => '儲蓄情境';

  @override
  String get dashboardCashOutlookTitle => '未來 30 天・排程現金';

  @override
  String get dashboardCashOutlookSubtitle => '依已確認的固定收支估算';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start～$end・排程估算';
  }

  @override
  String get dashboardCashOutlookInvalidDate => '無法計算估算期間。';

  @override
  String get dashboardCashOutlookNoBankAccounts => '請先新增並納入銀行帳戶，才能估算排程現金。';

  @override
  String get dashboardCashOutlookNoSchedules => '建立固定收入或支出後，即可查看即將發生的排程現金。';

  @override
  String get dashboardCashOutlookNoCoveredSchedules => '請檢查固定收支，並連結至已納入的銀行帳戶。';

  @override
  String get dashboardCashOutlookStartingBalance => '截至今日的銀行餘額';

  @override
  String get dashboardCashOutlookScheduledNet => '排程淨變動';

  @override
  String get dashboardCashOutlookClosingBalance => '30 天後估算現金';

  @override
  String get dashboardCashOutlookLowestBalance => '最低估算現金';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count 筆排程・收入 $income・支出 $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle => '合併估算現金可能低於零';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return '約在 $date，估算可能低於零 $amount。採取行動前請先檢查日期與金額。';
  }

  @override
  String get dashboardCashOutlookUpcoming => '即將發生的排程';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return '顯示 $shown／$total 筆';
  }

  @override
  String get dashboardCashOutlookNoUpcoming => '這個 30 天期間內沒有排程項目。';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return '已涵蓋 $included／$total 筆固定收支；請檢查其餘 $uncovered 筆。';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      '估算合併所有已納入銀行帳戶，採用截至今日的餘額與已確認連結固定收支。它不會顯示單一帳戶可能透支，也不會改變實際餘額；到期交易會在服務下次處理時建立。TWD 估算一致使用目前匯率。';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return '約在 $date，排程現金可能短缺 $amount';
  }

  @override
  String get dashboardScenarioTitle => '儲蓄情境試算';

  @override
  String get dashboardScenarioSubtitle => '試算一項每月調整的累積影響';

  @override
  String get dashboardScenarioMonthlyAdjustment => '每月儲蓄調整（TWD）';

  @override
  String get dashboardScenarioDecrease => '每月調整減少 500';

  @override
  String get dashboardScenarioIncrease => '每月調整增加 500';

  @override
  String get dashboardScenarioHorizon => '試算期間';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count 個月';
  }

  @override
  String get dashboardScenarioDifference => '累積差額';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return '每月調整 $monthly，持續 $months 個月，累積差額為 $difference。';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      '簡易情境：每月調整 × 月數。不包含利息、市場報酬、通膨與稅務，也不保證未來結果。';

  @override
  String get navMcp => 'MCP 連線';

  @override
  String get settingsMcpTitle => 'MCP 連線設定';

  @override
  String get settingsMcpDescription =>
      '透過 OAuth 連接支援 MCP 的 AI 工具，或為需要手動憑證的 client 建立個人化存取權杖。';

  @override
  String get settingsMcpOauthTitle => '使用 OAuth 連線';

  @override
  String get settingsMcpOauthDescription =>
      '在支援 MCP OAuth 的 AI 工具中輸入下方連線位址，AssetPilot 會開啟安全的登入與授權頁，不需手動建立權杖。';

  @override
  String get settingsMcpCreateNew => '建立新憑證';

  @override
  String get settingsMcpNameLabel => '名稱';

  @override
  String get settingsMcpNamePlaceholder => '例如：我的 ChatGPT';

  @override
  String get settingsMcpExpiresAtLabel => '到期時間（選填）';

  @override
  String get settingsMcpCreateButton => '建立憑證';

  @override
  String get settingsMcpCreating => '建立中…';

  @override
  String get settingsMcpCreateFailed => '建立憑證失敗';

  @override
  String get settingsMcpNameRequired => '請輸入名稱';

  @override
  String get settingsMcpNameTooLong => '名稱不可超過 100 字元';

  @override
  String get settingsMcpListTitle => '我的 MCP 憑證';

  @override
  String get settingsMcpRefresh => '重新整理';

  @override
  String get settingsMcpNoCredentials => '尚未建立任何憑證';

  @override
  String get settingsMcpLoadFailed => '載入憑證清單失敗';

  @override
  String get settingsMcpColName => '名稱';

  @override
  String get settingsMcpColCreatedAt => '建立時間';

  @override
  String get settingsMcpColLastUsedAt => '最後使用時間';

  @override
  String get settingsMcpColStatus => '狀態';

  @override
  String get settingsMcpColActions => '操作';

  @override
  String get settingsMcpNeverUsed => '尚未使用';

  @override
  String get settingsMcpStatusActive => '啟用中';

  @override
  String get settingsMcpStatusExpired => '已過期';

  @override
  String get settingsMcpStatusRevoked => '已撤銷';

  @override
  String get settingsMcpRevokeButton => '撤銷';

  @override
  String get settingsMcpRevokeConfirm => '確定要撤銷這組憑證嗎？撤銷後所有使用此憑證的查詢將立即被拒絕。';

  @override
  String get settingsMcpRevokeFailed => '撤銷憑證失敗';

  @override
  String get settingsMcpTokenModalTitle => 'MCP 存取權杖';

  @override
  String get settingsMcpTokenWarning => '此權杖僅顯示這一次，請立即複製並妥善保存；關閉後將無法再次查看明文。';

  @override
  String get settingsMcpTokenLabel => '存取權杖';

  @override
  String get settingsMcpConnectionUrlLabel => 'MCP 連線位址';

  @override
  String get settingsMcpCopyButton => '複製';

  @override
  String get settingsMcpCopied => '已複製！';

  @override
  String get settingsMcpCloseConfirm => '我已複製，關閉視窗';
}
