import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_ko.dart';
import 'app_localizations_pt.dart';
import 'app_localizations_ru.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
    Locale('es'),
    Locale('fr'),
    Locale('hi'),
    Locale('ko'),
    Locale('pt'),
    Locale('pt', 'BR'),
    Locale('ru'),
    Locale('zh'),
    Locale.fromSubtags(
      languageCode: 'zh',
      countryCode: 'CN',
      scriptCode: 'Hans',
    ),
    Locale.fromSubtags(
      languageCode: 'zh',
      countryCode: 'TW',
      scriptCode: 'Hant',
    ),
  ];

  /// Web path: common.save
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲存'**
  String get commonSave;

  /// Web path: common.cancel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'取消'**
  String get commonCancel;

  /// Web path: common.delete
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除'**
  String get commonDelete;

  /// Web path: common.edit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯'**
  String get commonEdit;

  /// Web path: common.confirm
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確認'**
  String get commonConfirm;

  /// Web path: common.close
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'關閉'**
  String get commonClose;

  /// Web path: common.loading
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'載入中…'**
  String get commonLoading;

  /// Web path: common.add
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增'**
  String get commonAdd;

  /// Web path: common.back
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'返回'**
  String get commonBack;

  /// Web path: common.search
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'搜尋'**
  String get commonSearch;

  /// Web path: common.language
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'語言'**
  String get commonLanguage;

  /// Web path: common.clear
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'清除'**
  String get commonClear;

  /// Web path: common.saving
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲存中...'**
  String get commonSaving;

  /// Web path: common.confirmDelete
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確認刪除'**
  String get commonConfirmDelete;

  /// Web path: common.previousPage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上一頁'**
  String get commonPreviousPage;

  /// Web path: common.nextPage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下一頁'**
  String get commonNextPage;

  /// Web path: common.totalRecords
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'共 {count} 筆'**
  String commonTotalRecords(Object count);

  /// Web path: common.perPage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每頁'**
  String get commonPerPage;

  /// Web path: common.recordsUnit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{count} 筆'**
  String commonRecordsUnit(Object count);

  /// Web path: common.noData
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無資料'**
  String get commonNoData;

  /// Web path: nav.sections.finance
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'財務管理'**
  String get navSectionsFinance;

  /// Web path: nav.sections.stocks
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票投資'**
  String get navSectionsStocks;

  /// Web path: nav.sections.system
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'系統設定'**
  String get navSectionsSystem;

  /// Web path: nav.dashboard
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儀表板'**
  String get navDashboard;

  /// Web path: nav.transactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易記錄'**
  String get navTransactions;

  /// Web path: nav.reports
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'統計報表'**
  String get navReports;

  /// Web path: nav.budget
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預算管理'**
  String get navBudget;

  /// Web path: nav.infoBoard
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資訊版'**
  String get navInfoBoard;

  /// Web path: nav.accounts
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶管理'**
  String get navAccounts;

  /// Web path: nav.categories
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類管理'**
  String get navCategories;

  /// Web path: nav.recurring
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'固定收支'**
  String get navRecurring;

  /// Web path: nav.stocksPortfolio
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'持股總覽'**
  String get navStocksPortfolio;

  /// Web path: nav.stocksTransactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票交易紀錄'**
  String get navStocksTransactions;

  /// Web path: nav.stocksDividends
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股利紀錄'**
  String get navStocksDividends;

  /// Web path: nav.stocksRealized
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'實現損益'**
  String get navStocksRealized;

  /// Web path: nav.stocksSettings
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票設定'**
  String get navStocksSettings;

  /// Web path: nav.exportImport
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料匯出匯入'**
  String get navExportImport;

  /// Web path: nav.account
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳號設定'**
  String get navAccount;

  /// Web path: nav.apiCredits
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'API 授權'**
  String get navApiCredits;

  /// Web path: nav.admin
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'管理員'**
  String get navAdmin;

  /// Web path: nav.titleStocks
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'持股總覽'**
  String get navTitleStocks;

  /// Web path: nav.titleStockTransactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票交易紀錄'**
  String get navTitleStockTransactions;

  /// Web path: nav.titleStockDividends
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票股利紀錄'**
  String get navTitleStockDividends;

  /// Web path: nav.titleStockRealized
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票實現損益'**
  String get navTitleStockRealized;

  /// Web path: nav.titleStockSettings
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票交易設定'**
  String get navTitleStockSettings;

  /// Web path: nav.titleApiCredits
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'API 使用與授權'**
  String get navTitleApiCredits;

  /// Web path: shell.fallbackUser
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用者'**
  String get shellFallbackUser;

  /// Web path: shell.logout
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登出'**
  String get shellLogout;

  /// Web path: shell.versionInfo
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'版本資訊'**
  String get shellVersionInfo;

  /// Web path: shell.openMenu
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'開啟選單'**
  String get shellOpenMenu;

  /// Web path: shell.skipToContent
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'跳至主要內容'**
  String get shellSkipToContent;

  /// Web path: shell.theme.light
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'亮色'**
  String get shellThemeLight;

  /// Web path: shell.theme.system
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'系統'**
  String get shellThemeSystem;

  /// Web path: shell.theme.dark
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'暗色'**
  String get shellThemeDark;

  /// Web path: shell.changelog.loading
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'正在讀取版本資訊...'**
  String get shellChangelogLoading;

  /// Web path: shell.changelog.loadFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'讀取版本資訊失敗'**
  String get shellChangelogLoadFailed;

  /// Web path: shell.changelog.unknownVersion
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未知'**
  String get shellChangelogUnknownVersion;

  /// Web path: shell.changelog.currentVersion
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前版本'**
  String get shellChangelogCurrentVersion;

  /// Web path: shell.changelog.updatableVersion
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'可更新版本'**
  String get shellChangelogUpdatableVersion;

  /// Web path: shell.changelog.upToDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已是最新版本'**
  String get shellChangelogUpToDate;

  /// Web path: shell.changelog.updatableContent
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'可更新內容'**
  String get shellChangelogUpdatableContent;

  /// Web path: shell.changelog.recentContent
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最近更新內容'**
  String get shellChangelogRecentContent;

  /// Web path: auth.loginTab
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入'**
  String get authLoginTab;

  /// Web path: auth.registerTab
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'註冊'**
  String get authRegisterTab;

  /// Web path: auth.subtitleLogin
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'歡迎回來，請登入您的帳號'**
  String get authSubtitleLogin;

  /// Web path: auth.subtitleRegister
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立您的帳號，開始記帳'**
  String get authSubtitleRegister;

  /// Web path: auth.emailLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'電子信箱'**
  String get authEmailLabel;

  /// Web path: auth.passwordLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'密碼'**
  String get authPasswordLabel;

  /// Web path: auth.passwordPlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入密碼'**
  String get authPasswordPlaceholder;

  /// Web path: auth.displayNameLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'顯示名稱'**
  String get authDisplayNameLabel;

  /// Web path: auth.displayNamePlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'您的暱稱'**
  String get authDisplayNamePlaceholder;

  /// Web path: auth.registerPasswordPlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'至少 8 位，含大小寫英文與數字'**
  String get authRegisterPasswordPlaceholder;

  /// Web path: auth.togglePassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'切換密碼顯示'**
  String get authTogglePassword;

  /// Web path: auth.turnstileAria
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Cloudflare Turnstile 真人驗證'**
  String get authTurnstileAria;

  /// Web path: auth.loginButton
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入'**
  String get authLoginButton;

  /// Web path: auth.loggingIn
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入中…'**
  String get authLoggingIn;

  /// Web path: auth.passkeyButton
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用 Passkey 登入'**
  String get authPasskeyButton;

  /// Web path: auth.passkeyVerifying
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Passkey 驗證中…'**
  String get authPasskeyVerifying;

  /// Web path: auth.googleButton
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用 Google 登入'**
  String get authGoogleButton;

  /// Web path: auth.googleVerifying
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 驗證中…'**
  String get authGoogleVerifying;

  /// Web path: auth.lineButton
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用 LINE 登入'**
  String get authLineButton;

  /// Web path: auth.lineVerifying
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 驗證中…'**
  String get authLineVerifying;

  /// Web path: auth.registerSubmit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'立即註冊'**
  String get authRegisterSubmit;

  /// Web path: auth.registering
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'註冊中…'**
  String get authRegistering;

  /// Web path: auth.lineCallback.completing
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'正在完成 LINE 驗證...'**
  String get authLineCallbackCompleting;

  /// Web path: auth.lineCallback.missingCode
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 未回傳授權碼，請重新操作'**
  String get authLineCallbackMissingCode;

  /// Web path: auth.lineCallback.linkFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 綁定失敗'**
  String get authLineCallbackLinkFailed;

  /// Web path: auth.lineCallback.loginFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入失敗'**
  String get authLineCallbackLoginFailed;

  /// Web path: auth.lineCallback.verifyFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 驗證失敗'**
  String get authLineCallbackVerifyFailed;

  /// Web path: auth.errors.turnstileRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請先完成真人驗證'**
  String get authErrorsTurnstileRequired;

  /// Web path: auth.errors.loginFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入失敗'**
  String get authErrorsLoginFailed;

  /// Web path: auth.errors.registerFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'註冊失敗'**
  String get authErrorsRegisterFailed;

  /// Web path: auth.errors.googleNotConfigured
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 登入尚未設定完成'**
  String get authErrorsGoogleNotConfigured;

  /// Web path: auth.errors.googleComponentNotLoaded
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 登入元件尚未載入'**
  String get authErrorsGoogleComponentNotLoaded;

  /// Web path: auth.errors.googleStateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法建立 Google 登入狀態'**
  String get authErrorsGoogleStateFailed;

  /// Web path: auth.errors.googleNoCode
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未收到 Google 授權碼'**
  String get authErrorsGoogleNoCode;

  /// Web path: auth.errors.googleFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 登入失敗'**
  String get authErrorsGoogleFailed;

  /// Web path: auth.errors.googleCancelled
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 登入已取消'**
  String get authErrorsGoogleCancelled;

  /// Web path: auth.errors.passkeyUnsupported
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此瀏覽器不支援 Passkey'**
  String get authErrorsPasskeyUnsupported;

  /// Web path: auth.errors.passkeyChallengeFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法建立 Passkey 登入挑戰'**
  String get authErrorsPasskeyChallengeFailed;

  /// Web path: auth.errors.passkeyFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Passkey 登入失敗'**
  String get authErrorsPasskeyFailed;

  /// Web path: auth.errors.lineNotConfigured
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入尚未設定完成'**
  String get authErrorsLineNotConfigured;

  /// Web path: auth.errors.lineFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入失敗'**
  String get authErrorsLineFailed;

  /// Web path: settings.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定'**
  String get settingsTitle;

  /// Web path: settings.language.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'語言'**
  String get settingsLanguageTitle;

  /// Web path: settings.language.description
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'選擇介面與通知（Email／LINE）使用的語言。'**
  String get settingsLanguageDescription;

  /// Web path: settings.language.saved
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'語言偏好已更新'**
  String get settingsLanguageSaved;

  /// Web path: settings.account.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳號設定'**
  String get settingsAccountTitle;

  /// Web path: settings.account.profileInfo
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳號資訊'**
  String get settingsAccountProfileInfo;

  /// Web path: settings.account.email
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'電子郵件'**
  String get settingsAccountEmail;

  /// Web path: settings.account.displayName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'顯示名稱'**
  String get settingsAccountDisplayName;

  /// Web path: settings.account.editDisplayName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'修改顯示名稱'**
  String get settingsAccountEditDisplayName;

  /// Web path: settings.account.updateName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新名稱'**
  String get settingsAccountUpdateName;

  /// Web path: settings.account.saving
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲存中...'**
  String get settingsAccountSaving;

  /// Web path: settings.account.setLocalPassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定本機密碼'**
  String get settingsAccountSetLocalPassword;

  /// Web path: settings.account.changePassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'修改密碼'**
  String get settingsAccountChangePassword;

  /// Web path: settings.account.oauthOnlyPasswordHelp
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前帳號僅支援第三方登入。設定本機密碼後，即可使用電子信箱與密碼登入。'**
  String get settingsAccountOauthOnlyPasswordHelp;

  /// Web path: settings.account.currentPassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前密碼'**
  String get settingsAccountCurrentPassword;

  /// Web path: settings.account.newPassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新密碼'**
  String get settingsAccountNewPassword;

  /// Web path: settings.account.confirmNewPassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確認新密碼'**
  String get settingsAccountConfirmNewPassword;

  /// Web path: settings.account.passwordPlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'至少8碼，含大小寫英文、數字、特殊符號'**
  String get settingsAccountPasswordPlaceholder;

  /// Web path: settings.account.updating
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新中...'**
  String get settingsAccountUpdating;

  /// Web path: settings.account.setPassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定密碼'**
  String get settingsAccountSetPassword;

  /// Web path: settings.account.updatePassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新密碼'**
  String get settingsAccountUpdatePassword;

  /// Web path: settings.account.themeTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'顯示主題'**
  String get settingsAccountThemeTitle;

  /// Web path: settings.account.theme.system
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'跟隨系統'**
  String get settingsAccountThemeSystem;

  /// Web path: settings.account.theme.light
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'淺色模式'**
  String get settingsAccountThemeLight;

  /// Web path: settings.account.theme.dark
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'深色模式'**
  String get settingsAccountThemeDark;

  /// Web path: settings.account.defaultCurrency
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預設貨幣'**
  String get settingsAccountDefaultCurrency;

  /// Web path: settings.account.currencyCode
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'幣別代碼'**
  String get settingsAccountCurrencyCode;

  /// Web path: settings.account.updateDefaultCurrency
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新預設貨幣'**
  String get settingsAccountUpdateDefaultCurrency;

  /// Web path: settings.account.passkeyTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Passkey 管理'**
  String get settingsAccountPasskeyTitle;

  /// Web path: settings.account.noPasskeys
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未註冊任何 Passkey'**
  String get settingsAccountNoPasskeys;

  /// Web path: settings.account.addPasskey
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'+ 新增 Passkey'**
  String get settingsAccountAddPasskey;

  /// Web path: settings.account.googleTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 綁定'**
  String get settingsAccountGoogleTitle;

  /// Web path: settings.account.lineTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 綁定'**
  String get settingsAccountLineTitle;

  /// Web path: settings.account.statusPrefix
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前狀態：'**
  String get settingsAccountStatusPrefix;

  /// Web path: settings.account.linkedGoogle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已綁定 Google 帳號'**
  String get settingsAccountLinkedGoogle;

  /// Web path: settings.account.notLinkedGoogle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未綁定 Google 帳號'**
  String get settingsAccountNotLinkedGoogle;

  /// Web path: settings.account.linkGoogle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'綁定 Google 帳號'**
  String get settingsAccountLinkGoogle;

  /// Web path: settings.account.unlink
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'解除綁定'**
  String get settingsAccountUnlink;

  /// Web path: settings.account.linkedLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已綁定 LINE 帳號'**
  String get settingsAccountLinkedLine;

  /// Web path: settings.account.notLinkedLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未綁定 LINE 帳號'**
  String get settingsAccountNotLinkedLine;

  /// Web path: settings.account.linkLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'綁定 LINE 帳號'**
  String get settingsAccountLinkLine;

  /// Web path: settings.account.lineVerifying
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 驗證中…'**
  String get settingsAccountLineVerifying;

  /// Web path: settings.account.sessionsTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前登入裝置'**
  String get settingsAccountSessionsTitle;

  /// Web path: settings.account.refresh
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'重新整理'**
  String get settingsAccountRefresh;

  /// Web path: settings.account.deviceName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'裝置名稱'**
  String get settingsAccountDeviceName;

  /// Web path: settings.account.loginTime
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入時間'**
  String get settingsAccountLoginTime;

  /// Web path: settings.account.loginIp
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入 IP'**
  String get settingsAccountLoginIp;

  /// Web path: settings.account.actions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'操作'**
  String get settingsAccountActions;

  /// Web path: settings.account.unknownDevice
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未知裝置'**
  String get settingsAccountUnknownDevice;

  /// Web path: settings.account.currentDeviceSuffix
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'（目前裝置）'**
  String get settingsAccountCurrentDeviceSuffix;

  /// Web path: settings.account.signOut
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登出'**
  String get settingsAccountSignOut;

  /// Web path: settings.account.noSessions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無登入裝置紀錄'**
  String get settingsAccountNoSessions;

  /// Web path: settings.account.auditTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入稽核紀錄'**
  String get settingsAccountAuditTitle;

  /// Web path: settings.account.country
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'國家'**
  String get settingsAccountCountry;

  /// Web path: settings.account.method
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'方式'**
  String get settingsAccountMethod;

  /// Web path: settings.account.device
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'裝置'**
  String get settingsAccountDevice;

  /// Web path: settings.account.adminLogin
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'管理員登入'**
  String get settingsAccountAdminLogin;

  /// Web path: settings.account.yes
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'是'**
  String get settingsAccountYes;

  /// Web path: settings.account.no
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'否'**
  String get settingsAccountNo;

  /// Web path: settings.account.deleteTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除帳號'**
  String get settingsAccountDeleteTitle;

  /// Web path: settings.account.deleteDescription
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除帳號後，您的交易、帳戶、股票、Passkey 與設定資料都會永久移除，且無法復原。'**
  String get settingsAccountDeleteDescription;

  /// Web path: settings.account.deleteButton
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除我的帳號'**
  String get settingsAccountDeleteButton;

  /// Web path: settings.account.deleteModalTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確認刪除帳號'**
  String get settingsAccountDeleteModalTitle;

  /// Web path: settings.account.deleteModalWarning
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票、Passkey 與設定），且無法復原。'**
  String get settingsAccountDeleteModalWarning;

  /// Web path: settings.account.deletePasswordLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入密碼以確認刪除'**
  String get settingsAccountDeletePasswordLabel;

  /// Web path: settings.account.deleteEmailLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入您的帳號電子信箱「{email}」以確認刪除'**
  String settingsAccountDeleteEmailLabel(Object email);

  /// Web path: settings.account.deleting
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除中…'**
  String get settingsAccountDeleting;

  /// Web path: settings.account.deletePermanently
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'永久刪除帳號'**
  String get settingsAccountDeletePermanently;

  /// Web path: settings.account.messages.currentPasswordRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入目前密碼'**
  String get settingsAccountMessagesCurrentPasswordRequired;

  /// Web path: settings.account.messages.newPasswordRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入新密碼'**
  String get settingsAccountMessagesNewPasswordRequired;

  /// Web path: settings.account.messages.passwordTooShort
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新密碼長度至少 8 字元'**
  String get settingsAccountMessagesPasswordTooShort;

  /// Web path: settings.account.messages.passwordComplexity
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新密碼需包含大寫字母、小寫字母、數字與特殊符號'**
  String get settingsAccountMessagesPasswordComplexity;

  /// Web path: settings.account.messages.confirmPasswordMismatch
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'兩次輸入的新密碼不一致'**
  String get settingsAccountMessagesConfirmPasswordMismatch;

  /// Web path: settings.account.messages.localPasswordSet
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'密碼已設定，現在可使用密碼登入'**
  String get settingsAccountMessagesLocalPasswordSet;

  /// Web path: settings.account.messages.passwordUpdated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'密碼已更新'**
  String get settingsAccountMessagesPasswordUpdated;

  /// Web path: settings.account.messages.passwordUpdateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新密碼失敗'**
  String get settingsAccountMessagesPasswordUpdateFailed;

  /// Web path: settings.account.messages.displayNameRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'顯示名稱不可空白'**
  String get settingsAccountMessagesDisplayNameRequired;

  /// Web path: settings.account.messages.displayNameUpdated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'顯示名稱已更新'**
  String get settingsAccountMessagesDisplayNameUpdated;

  /// Web path: settings.account.messages.updateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新失敗'**
  String get settingsAccountMessagesUpdateFailed;

  /// Web path: settings.account.messages.deletePasskeyConfirm
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除此 Passkey 嗎？'**
  String get settingsAccountMessagesDeletePasskeyConfirm;

  /// Web path: settings.account.messages.currencyInvalid
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'幣別格式需為 3 碼英文字母'**
  String get settingsAccountMessagesCurrencyInvalid;

  /// Web path: settings.account.messages.currencyUpdated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預設貨幣已更新'**
  String get settingsAccountMessagesCurrencyUpdated;

  /// Web path: settings.account.messages.currencyUpdateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新預設貨幣失敗'**
  String get settingsAccountMessagesCurrencyUpdateFailed;

  /// Web path: settings.account.messages.sessionLoggedOut
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已登出該裝置'**
  String get settingsAccountMessagesSessionLoggedOut;

  /// Web path: settings.account.messages.sessionLogoutFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登出裝置失敗'**
  String get settingsAccountMessagesSessionLogoutFailed;

  /// Web path: settings.account.messages.passkeyUnsupported
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此瀏覽器不支援 Passkey'**
  String get settingsAccountMessagesPasskeyUnsupported;

  /// Web path: settings.account.messages.androidDevice
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Android 裝置'**
  String get settingsAccountMessagesAndroidDevice;

  /// Web path: settings.account.messages.computerDevice
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'電腦'**
  String get settingsAccountMessagesComputerDevice;

  /// Web path: settings.account.messages.passkeyRegisterFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Passkey 註冊失敗'**
  String get settingsAccountMessagesPasskeyRegisterFailed;

  /// Web path: settings.account.messages.googleTokenPrompt
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請貼上 Google ID Token 以模擬綁定流程'**
  String get settingsAccountMessagesGoogleTokenPrompt;

  /// Web path: settings.account.messages.googleLinked
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 帳號已綁定'**
  String get settingsAccountMessagesGoogleLinked;

  /// Web path: settings.account.messages.googleLinkFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 綁定失敗'**
  String get settingsAccountMessagesGoogleLinkFailed;

  /// Web path: settings.account.messages.googleUnlinked
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 帳號已解除綁定'**
  String get settingsAccountMessagesGoogleUnlinked;

  /// Web path: settings.account.messages.googleUnlinkFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 解除綁定失敗'**
  String get settingsAccountMessagesGoogleUnlinkFailed;

  /// Web path: settings.account.messages.lineNotConfigured
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入尚未設定完成'**
  String get settingsAccountMessagesLineNotConfigured;

  /// Web path: settings.account.messages.lineLinkFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 綁定失敗'**
  String get settingsAccountMessagesLineLinkFailed;

  /// Web path: settings.account.messages.lineUnlinked
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 帳號已解除綁定'**
  String get settingsAccountMessagesLineUnlinked;

  /// Web path: settings.account.messages.lineUnlinkFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 解除綁定失敗'**
  String get settingsAccountMessagesLineUnlinkFailed;

  /// Web path: settings.account.messages.deletePasswordRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入密碼以確認刪除'**
  String get settingsAccountMessagesDeletePasswordRequired;

  /// Web path: settings.account.messages.deleteEmailMismatch
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入正確的帳號電子信箱以確認刪除'**
  String get settingsAccountMessagesDeleteEmailMismatch;

  /// Web path: settings.account.messages.deleteFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除帳號失敗'**
  String get settingsAccountMessagesDeleteFailed;

  /// Web path: dashboard.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儀表板'**
  String get dashboardTitle;

  /// Web path: dashboard.subtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{month} 的收支摘要、分類分布與最近交易。'**
  String dashboardSubtitle(Object month);

  /// Web path: dashboard.uncategorized
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未分類'**
  String get dashboardUncategorized;

  /// Web path: dashboard.kpi.totalIncome
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總收入'**
  String get dashboardKpiTotalIncome;

  /// Web path: dashboard.kpi.totalExpense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總支出'**
  String get dashboardKpiTotalExpense;

  /// Web path: dashboard.kpi.net
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'淨額'**
  String get dashboardKpiNet;

  /// Web path: dashboard.kpi.todayExpense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'今日支出'**
  String get dashboardKpiTodayExpense;

  /// Web path: dashboard.kpi.bankAccounts
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'銀行帳戶'**
  String get dashboardKpiBankAccounts;

  /// Web path: dashboard.kpi.stockMarketValue
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票總市值'**
  String get dashboardKpiStockMarketValue;

  /// Web path: dashboard.overview.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月收支概覽'**
  String get dashboardOverviewTitle;

  /// Web path: dashboard.overview.balance
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月結餘'**
  String get dashboardOverviewBalance;

  /// Web path: dashboard.overview.deficit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月赤字'**
  String get dashboardOverviewDeficit;

  /// Web path: dashboard.overview.income
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入'**
  String get dashboardOverviewIncome;

  /// Web path: dashboard.overview.expense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出'**
  String get dashboardOverviewExpense;

  /// Web path: dashboard.overview.net
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'淨額'**
  String get dashboardOverviewNet;

  /// Web path: dashboard.ratio.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收支比例'**
  String get dashboardRatioTitle;

  /// Web path: dashboard.ratio.incomeShare
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入佔比'**
  String get dashboardRatioIncomeShare;

  /// Web path: dashboard.ratio.expenseShare
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出佔比'**
  String get dashboardRatioExpenseShare;

  /// Web path: dashboard.sections.expenseCategories
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出分類'**
  String get dashboardSectionsExpenseCategories;

  /// Web path: dashboard.sections.incomeCategories
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入分類'**
  String get dashboardSectionsIncomeCategories;

  /// Web path: dashboard.sections.recentTransactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最近交易'**
  String get dashboardSectionsRecentTransactions;

  /// Web path: dashboard.sections.recentCount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最近 {count} 筆'**
  String dashboardSectionsRecentCount(Object count);

  /// Web path: dashboard.empty.noExpense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月尚無支出資料'**
  String get dashboardEmptyNoExpense;

  /// Web path: dashboard.empty.noIncome
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月尚無收入資料'**
  String get dashboardEmptyNoIncome;

  /// Web path: dashboard.empty.noTransactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月尚無交易資料'**
  String get dashboardEmptyNoTransactions;

  /// Web path: dashboard.table.date
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'日期'**
  String get dashboardTableDate;

  /// Web path: dashboard.table.category
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類'**
  String get dashboardTableCategory;

  /// Web path: dashboard.table.note
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'備註'**
  String get dashboardTableNote;

  /// Web path: dashboard.table.amount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金額'**
  String get dashboardTableAmount;

  /// Web path: dashboard.filters.previousMonth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上一月'**
  String get dashboardFiltersPreviousMonth;

  /// Web path: dashboard.filters.nextMonth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下一月'**
  String get dashboardFiltersNextMonth;

  /// Web path: dashboard.filters.currentMonth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月'**
  String get dashboardFiltersCurrentMonth;

  /// Web path: public.common.backHome
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'返回首頁'**
  String get publicCommonBackHome;

  /// Web path: public.common.privacy
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'隱私權政策'**
  String get publicCommonPrivacy;

  /// Web path: public.common.terms
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'服務條款'**
  String get publicCommonTerms;

  /// Web path: public.common.apiCredits
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'API 使用與授權'**
  String get publicCommonApiCredits;

  /// Web path: public.common.lastUpdated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最後更新日期：{date}'**
  String publicCommonLastUpdated(Object date);

  /// Web path: public.common.metadataTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'AssetPilot - 個人財務指揮中心'**
  String get publicCommonMetadataTitle;

  /// Web path: public.common.metadataDescription
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自架、加密的個人財務管理工具，整合記帳、預算、台股投資與報表分析。'**
  String get publicCommonMetadataDescription;

  /// Web path: public.common.dates.apiCredits
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'2026 年 6 月 11 日'**
  String get publicCommonDatesApiCredits;

  /// Web path: public.common.dates.privacy
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'2026 年 6 月 17 日'**
  String get publicCommonDatesPrivacy;

  /// Web path: public.common.dates.terms
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'2026 年 6 月 11 日'**
  String get publicCommonDatesTerms;

  /// Web path: public.home.tagline
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'個人財務指揮中心'**
  String get publicHomeTagline;

  /// Web path: public.home.login
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'立即登入'**
  String get publicHomeLogin;

  /// Web path: public.home.register
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立帳號'**
  String get publicHomeRegister;

  /// Web path: public.home.badge
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自托管、資料加密、AGPL v3'**
  String get publicHomeBadge;

  /// Web path: public.home.headline1
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'你的財務指揮中心'**
  String get publicHomeHeadline1;

  /// Web path: public.home.headline2
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'從首頁就能先看清楚'**
  String get publicHomeHeadline2;

  /// Web path: public.home.leadBefore
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'整合台股投資、收支記帳、預算追蹤、報表分析與資料稽核。所有財務資料以'**
  String get publicHomeLeadBefore;

  /// Web path: public.home.leadStrong
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **' ChaCha20-Poly1305 '**
  String get publicHomeLeadStrong;

  /// Web path: public.home.leadAfter
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'加密落地，不綁雲端、不靠訂閱，先理解產品，再決定是否登入。'**
  String get publicHomeLeadAfter;

  /// Web path: public.home.startUsing
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'開始使用'**
  String get publicHomeStartUsing;

  /// Web path: public.home.createFirst
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'先建立帳號'**
  String get publicHomeCreateFirst;

  /// Web path: public.home.chips.openSource
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'開源 AGPL v3'**
  String get publicHomeChipsOpenSource;

  /// Web path: public.home.chips.encrypted
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本地加密儲存'**
  String get publicHomeChipsEncrypted;

  /// Web path: public.home.chips.noCloudLock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'不綁外部雲端'**
  String get publicHomeChipsNoCloudLock;

  /// Web path: public.home.chips.docker
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Docker 一行部署'**
  String get publicHomeChipsDocker;

  /// Web path: public.home.chips.openapi
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'OpenAPI 3.2'**
  String get publicHomeChipsOpenapi;

  /// Web path: public.home.stats.modules.value
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'6+'**
  String get publicHomeStatsModulesValue;

  /// Web path: public.home.stats.modules.label
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'核心模組'**
  String get publicHomeStatsModulesLabel;

  /// Web path: public.home.stats.modules.sublabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'記帳、股票、報表、治理'**
  String get publicHomeStatsModulesSublabel;

  /// Web path: public.home.stats.encryption.value
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'ChaCha20'**
  String get publicHomeStatsEncryptionValue;

  /// Web path: public.home.stats.encryption.label
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料加密'**
  String get publicHomeStatsEncryptionLabel;

  /// Web path: public.home.stats.encryption.sublabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Poly1305 AEAD + PBKDF2'**
  String get publicHomeStatsEncryptionSublabel;

  /// Web path: public.home.stats.stockSource.value
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'TWSE'**
  String get publicHomeStatsStockSourceValue;

  /// Web path: public.home.stats.stockSource.label
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股價來源'**
  String get publicHomeStatsStockSourceLabel;

  /// Web path: public.home.stats.stockSource.sublabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'盤中、盤後、備援策略'**
  String get publicHomeStatsStockSourceSublabel;

  /// Web path: public.home.stats.precision.value
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'FIFO'**
  String get publicHomeStatsPrecisionValue;

  /// Web path: public.home.stats.precision.label
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'精度計算'**
  String get publicHomeStatsPrecisionLabel;

  /// Web path: public.home.stats.precision.sublabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'decimal.js 逐筆損益'**
  String get publicHomeStatsPrecisionSublabel;

  /// Web path: public.home.preLoginNote
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未登入也能先了解 AssetPilot 的功能、資料處理方式與部署特性，再選擇登入或建立帳號。'**
  String get publicHomePreLoginNote;

  /// Web path: public.home.whyLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Why AssetPilot'**
  String get publicHomeWhyLabel;

  /// Web path: public.home.whyTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'把日常記帳、投資追蹤與資料掌控放在同一個地方'**
  String get publicHomeWhyTitle;

  /// Web path: public.home.whyDescription
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'AssetPilot 專為自主管理個人財務而設計，從收支、預算到台股投資都能集中整理，並保留資料匯出、稽核與自架部署的彈性。'**
  String get publicHomeWhyDescription;

  /// Web path: public.home.pillars.finance.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收支與預算管理'**
  String get publicHomePillarsFinanceTitle;

  /// Web path: public.home.pillars.finance.tag
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'記帳核心'**
  String get publicHomePillarsFinanceTag;

  /// Web path: public.home.pillars.finance.items.one
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'多帳戶餘額追蹤與跨帳戶轉帳'**
  String get publicHomePillarsFinanceItemsOne;

  /// Web path: public.home.pillars.finance.items.two
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'月度與分類預算進度條控管'**
  String get publicHomePillarsFinanceItemsTwo;

  /// Web path: public.home.pillars.finance.items.three
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'固定收支自動產生交易'**
  String get publicHomePillarsFinanceItemsThree;

  /// Web path: public.home.pillars.finance.items.four
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'批次調整分類、日期與刪除'**
  String get publicHomePillarsFinanceItemsFour;

  /// Web path: public.home.pillars.stocks.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'台股投資追蹤'**
  String get publicHomePillarsStocksTitle;

  /// Web path: public.home.pillars.stocks.tag
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票模組'**
  String get publicHomePillarsStocksTag;

  /// Web path: public.home.pillars.stocks.items.one
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'TWSE 股價查詢與除權息同步'**
  String get publicHomePillarsStocksItemsOne;

  /// Web path: public.home.pillars.stocks.items.two
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'FIFO 全精度實現損益計算'**
  String get publicHomePillarsStocksItemsTwo;

  /// Web path: public.home.pillars.stocks.items.three
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股利紀錄與帳戶入款追蹤'**
  String get publicHomePillarsStocksItemsThree;

  /// Web path: public.home.pillars.stocks.items.four
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'定期定額與下市標記管理'**
  String get publicHomePillarsStocksItemsFour;

  /// Web path: public.home.pillars.security.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'安全與資料治理'**
  String get publicHomePillarsSecurityTitle;

  /// Web path: public.home.pillars.security.tag
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'治理能力'**
  String get publicHomePillarsSecurityTag;

  /// Web path: public.home.pillars.security.items.one
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'ChaCha20-Poly1305 落地加密'**
  String get publicHomePillarsSecurityItemsOne;

  /// Web path: public.home.pillars.security.items.two
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳密、Google、Passkey 三種登入'**
  String get publicHomePillarsSecurityItemsTwo;

  /// Web path: public.home.pillars.security.items.three
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯出匯入、備份還原與稽核日誌'**
  String get publicHomePillarsSecurityItemsThree;

  /// Web path: public.home.pillars.security.items.four
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Rate limit、CSP 與 CSV 防注入保護'**
  String get publicHomePillarsSecurityItemsFour;

  /// Web path: public.home.pillars.selfHosted.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自架部署與契約'**
  String get publicHomePillarsSelfHostedTitle;

  /// Web path: public.home.pillars.selfHosted.tag
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Self-hosted'**
  String get publicHomePillarsSelfHostedTag;

  /// Web path: public.home.pillars.selfHosted.items.one
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Docker 一行啟動'**
  String get publicHomePillarsSelfHostedItemsOne;

  /// Web path: public.home.pillars.selfHosted.items.two
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支援 amd64 與 arm64'**
  String get publicHomePillarsSelfHostedItemsTwo;

  /// Web path: public.home.pillars.selfHosted.items.three
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'OpenAPI 3.2 契約文件'**
  String get publicHomePillarsSelfHostedItemsThree;

  /// Web path: public.home.pillars.selfHosted.items.four
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'URL-first 路由，可直接書籤與重整'**
  String get publicHomePillarsSelfHostedItemsFour;

  /// Web path: public.home.quickStartLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Quick Start'**
  String get publicHomeQuickStartLabel;

  /// Web path: public.home.quickStartTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'60 秒跑在你自己的伺服器'**
  String get publicHomeQuickStartTitle;

  /// Web path: public.home.quickStartDescription
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用 Docker 快速啟動，首次執行會自動產生 JWT 與資料庫加密金鑰。支援 amd64、arm64，適合部署在 NAS、VPS 或自己的 Docker 主機上。'**
  String get publicHomeQuickStartDescription;

  /// Web path: public.home.quickStartChips.image
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'約 180 MB 映像'**
  String get publicHomeQuickStartChipsImage;

  /// Web path: public.home.quickStartChips.arch
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'amd64 + arm64'**
  String get publicHomeQuickStartChipsArch;

  /// Web path: public.home.quickStartChips.health
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'內建健康檢查'**
  String get publicHomeQuickStartChipsHealth;

  /// Web path: public.home.quickStartChips.keys
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金鑰首次啟動自動產生'**
  String get publicHomeQuickStartChipsKeys;

  /// Web path: public.home.techLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Tech Stack'**
  String get publicHomeTechLabel;

  /// Web path: public.home.techTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'技術堆疊與公開資訊入口'**
  String get publicHomeTechTitle;

  /// Web path: public.home.techDescription
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'清楚列出主要技術、外部資料來源與授權資訊，讓使用者在開始使用前就能掌握服務如何運作。'**
  String get publicHomeTechDescription;

  /// Web path: public.home.footer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'GNU AGPL v3，個人資產管理，自架、自控、自備份。'**
  String get publicHomeFooter;

  /// Web path: public.apiCreditsPage.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'API 使用與授權'**
  String get publicApiCreditsPageTitle;

  /// Web path: public.apiCreditsPage.metadataTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'API 使用與授權 — AssetPilot'**
  String get publicApiCreditsPageMetadataTitle;

  /// Web path: public.apiCreditsPage.badge
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'外部 API 透明揭露'**
  String get publicApiCreditsPageBadge;

  /// Web path: public.apiCreditsPage.description
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'AssetPilot 僅在功能需要時連線至外部資料來源。這裡列出各項 API 的用途、授權資訊與資料傳送範圍，方便自行部署時確認合規狀態。'**
  String get publicApiCreditsPageDescription;

  /// Web path: public.apiCreditsPage.stats.externalServices
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'外部服務'**
  String get publicApiCreditsPageStatsExternalServices;

  /// Web path: public.apiCreditsPage.stats.freeSupported
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支援免費'**
  String get publicApiCreditsPageStatsFreeSupported;

  /// Web path: public.apiCreditsPage.stats.attributionRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'需標示來源'**
  String get publicApiCreditsPageStatsAttributionRequired;

  /// Web path: public.apiCreditsPage.serviceKinds.data
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料查詢'**
  String get publicApiCreditsPageServiceKindsData;

  /// Web path: public.apiCreditsPage.serviceKinds.auth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'身份驗證'**
  String get publicApiCreditsPageServiceKindsAuth;

  /// Web path: public.apiCreditsPage.serviceKinds.email
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Email 通道'**
  String get publicApiCreditsPageServiceKindsEmail;

  /// Web path: public.apiCreditsPage.serviceKinds.backup
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'雲端備份'**
  String get publicApiCreditsPageServiceKindsBackup;

  /// Web path: public.apiCreditsPage.transparencyTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料透明度'**
  String get publicApiCreditsPageTransparencyTitle;

  /// Web path: public.apiCreditsPage.transparencyText
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下列情境只傳送完成該功能所需的最小資料，不會把你的財務明細交給第三方服務。'**
  String get publicApiCreditsPageTransparencyText;

  /// Web path: public.apiCreditsPage.minNecessary
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最小必要資料原則'**
  String get publicApiCreditsPageMinNecessary;

  /// Web path: public.apiCreditsPage.usageNotes.fx.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯率同步'**
  String get publicApiCreditsPageUsageNotesFxTitle;

  /// Web path: public.apiCreditsPage.usageNotes.fx.text
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'只查詢公開匯率資料，不會送出個人財務明細。'**
  String get publicApiCreditsPageUsageNotesFxText;

  /// Web path: public.apiCreditsPage.usageNotes.stock.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'台股資料'**
  String get publicApiCreditsPageUsageNotesStockTitle;

  /// Web path: public.apiCreditsPage.usageNotes.stock.text
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'僅帶股票代號與市場資料，不包含帳戶、持股成本或交易紀錄。'**
  String get publicApiCreditsPageUsageNotesStockText;

  /// Web path: public.apiCreditsPage.usageNotes.audit.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入稽核'**
  String get publicApiCreditsPageUsageNotesAuditTitle;

  /// Web path: public.apiCreditsPage.usageNotes.audit.text
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'IPinfo 僅用於登入紀錄中的國家資訊顯示。'**
  String get publicApiCreditsPageUsageNotesAuditText;

  /// Web path: public.apiCreditsPage.usageNotes.login.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'第三方登入'**
  String get publicApiCreditsPageUsageNotesLoginTitle;

  /// Web path: public.apiCreditsPage.usageNotes.login.text
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google、LINE 登入僅在主動登入或綁定時啟用。'**
  String get publicApiCreditsPageUsageNotesLoginText;

  /// Web path: public.apiCreditsPage.usageNotes.backup.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'雲端備份'**
  String get publicApiCreditsPageUsageNotesBackupTitle;

  /// Web path: public.apiCreditsPage.usageNotes.backup.text
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'MEGA S4 僅在管理員主動上傳備份時接收整檔資料庫檔案。'**
  String get publicApiCreditsPageUsageNotesBackupText;

  /// Web path: public.apiCreditsPage.serviceListTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'外部服務清單'**
  String get publicApiCreditsPageServiceListTitle;

  /// Web path: public.apiCreditsPage.serviceSummary
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'共 {total} 項服務，其中 {free} 項支援免費方案，{paid} 項可使用付費方案。'**
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  );

  /// Web path: public.apiCreditsPage.officialSite
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'官方網站'**
  String get publicApiCreditsPageOfficialSite;

  /// Web path: public.apiCreditsPage.freePlan
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'免費方案'**
  String get publicApiCreditsPageFreePlan;

  /// Web path: public.apiCreditsPage.paidPlan
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'付費方案'**
  String get publicApiCreditsPagePaidPlan;

  /// Web path: public.apiCreditsPage.supported
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支援'**
  String get publicApiCreditsPageSupported;

  /// Web path: public.apiCreditsPage.unavailable
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未提供'**
  String get publicApiCreditsPageUnavailable;

  /// Web path: public.apiCreditsPage.descriptions.exchangeRate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'全球即時匯率（基礎貨幣 TWD）'**
  String get publicApiCreditsPageDescriptionsExchangeRate;

  /// Web path: public.apiCreditsPage.descriptions.ipinfo
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'IP 位址地理位置查詢（登入稽核國家欄位）'**
  String get publicApiCreditsPageDescriptionsIpinfo;

  /// Web path: public.apiCreditsPage.descriptions.twse
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票即時報價、除權息資料、股票名稱查詢'**
  String get publicApiCreditsPageDescriptionsTwse;

  /// Web path: public.apiCreditsPage.descriptions.google
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google SSO 登入'**
  String get publicApiCreditsPageDescriptionsGoogle;

  /// Web path: public.apiCreditsPage.descriptions.line
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入與帳號綁定'**
  String get publicApiCreditsPageDescriptionsLine;

  /// Web path: public.apiCreditsPage.descriptions.smtp
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Email 寄送通道（管理員資產統計報表，搭配 Gmail / Outlook 等 SMTP server）'**
  String get publicApiCreditsPageDescriptionsSmtp;

  /// Web path: public.apiCreditsPage.descriptions.zeabur
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Email 寄送通道（管理員資產統計報表，HTTP REST API）'**
  String get publicApiCreditsPageDescriptionsZeabur;

  /// Web path: public.apiCreditsPage.descriptions.resend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Email 寄送通道（管理員資產統計報表）'**
  String get publicApiCreditsPageDescriptionsResend;

  /// Web path: public.apiCreditsPage.descriptions.mega
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'管理員整檔 PostgreSQL SQL 備份的 S3 相容物件儲存目的地'**
  String get publicApiCreditsPageDescriptionsMega;

  /// Web path: public.appCallback.returningTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'正在返回 AssetPilot App...'**
  String get publicAppCallbackReturningTitle;

  /// Web path: public.appCallback.returningBody
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'如果沒有自動返回，請確認已安裝最新版 AssetPilot Android App。'**
  String get publicAppCallbackReturningBody;

  /// Web path: public.appCallback.passkeyTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'AssetPilot Passkey 登入'**
  String get publicAppCallbackPasskeyTitle;

  /// Web path: public.appCallback.passkeyStarting
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'正在啟動 Passkey 登入...'**
  String get publicAppCallbackPasskeyStarting;

  /// Web path: public.appCallback.passkeyUnsupported
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此瀏覽器不支援 Passkey'**
  String get publicAppCallbackPasskeyUnsupported;

  /// Web path: public.appCallback.passkeyChallengeFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法建立 Passkey 登入挑戰'**
  String get publicAppCallbackPasskeyChallengeFailed;

  /// Web path: public.appCallback.passkeyVerify
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請完成裝置上的 Passkey 驗證...'**
  String get publicAppCallbackPasskeyVerify;

  /// Web path: public.appCallback.passkeyLoginFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Passkey 登入失敗'**
  String get publicAppCallbackPasskeyLoginFailed;

  /// Web path: public.appCallback.returningApp
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'正在返回 App...'**
  String get publicAppCallbackReturningApp;

  /// Web path: public.appCallback.appTicketFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法建立 App 登入憑證'**
  String get publicAppCallbackAppTicketFailed;

  /// Web path: features.common.actions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'操作'**
  String get featuresCommonActions;

  /// Web path: features.common.account
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶'**
  String get featuresCommonAccount;

  /// Web path: features.common.amount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金額'**
  String get featuresCommonAmount;

  /// Web path: features.common.date
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'日期'**
  String get featuresCommonDate;

  /// Web path: features.common.endDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'結束'**
  String get featuresCommonEndDate;

  /// Web path: features.common.note
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'備註'**
  String get featuresCommonNote;

  /// Web path: features.common.startDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'起始'**
  String get featuresCommonStartDate;

  /// Web path: features.common.status
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'狀態'**
  String get featuresCommonStatus;

  /// Web path: features.common.stock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票'**
  String get featuresCommonStock;

  /// Web path: features.common.type
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'類型'**
  String get featuresCommonType;

  /// Web path: features.common.name
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'名稱'**
  String get featuresCommonName;

  /// Web path: features.common.currency
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'幣別'**
  String get featuresCommonCurrency;

  /// Web path: features.common.exchangeRate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯率'**
  String get featuresCommonExchangeRate;

  /// Web path: features.common.income
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入'**
  String get featuresCommonIncome;

  /// Web path: features.common.expense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出'**
  String get featuresCommonExpense;

  /// Web path: features.common.uncategorized
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未分類'**
  String get featuresCommonUncategorized;

  /// Web path: features.common.unspecified
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未指定'**
  String get featuresCommonUnspecified;

  /// Web path: features.common.autoCalculate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自動計算'**
  String get featuresCommonAutoCalculate;

  /// Web path: features.common.excludeFromStats
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'不計入統計'**
  String get featuresCommonExcludeFromStats;

  /// Web path: features.common.topLevelCategory
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'— 頂層分類 —'**
  String get featuresCommonTopLevelCategory;

  /// Web path: features.common.notRecorded
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'—'**
  String get featuresCommonNotRecorded;

  /// Web path: features.categories.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類管理'**
  String get featuresCategoriesTitle;

  /// Web path: features.categories.expenseTab
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出分類'**
  String get featuresCategoriesExpenseTab;

  /// Web path: features.categories.incomeTab
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入分類'**
  String get featuresCategoriesIncomeTab;

  /// Web path: features.categories.addCategory
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增分類'**
  String get featuresCategoriesAddCategory;

  /// Web path: features.categories.editCategory
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯分類'**
  String get featuresCategoriesEditCategory;

  /// Web path: features.categories.newCategory
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增分類'**
  String get featuresCategoriesNewCategory;

  /// Web path: features.categories.nameLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'名稱 *'**
  String get featuresCategoriesNameLabel;

  /// Web path: features.categories.typeLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'類型'**
  String get featuresCategoriesTypeLabel;

  /// Web path: features.categories.parentLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'父分類'**
  String get featuresCategoriesParentLabel;

  /// Web path: features.categories.colorLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'顏色'**
  String get featuresCategoriesColorLabel;

  /// Web path: features.categories.expense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出'**
  String get featuresCategoriesExpense;

  /// Web path: features.categories.income
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入'**
  String get featuresCategoriesIncome;

  /// Web path: features.categories.deleteMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除此分類嗎？其子分類也將一併刪除。'**
  String get featuresCategoriesDeleteMessage;

  /// Web path: features.categories.messages.nameRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入分類名稱'**
  String get featuresCategoriesMessagesNameRequired;

  /// Web path: features.categories.messages.deleteFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除失敗'**
  String get featuresCategoriesMessagesDeleteFailed;

  /// Web path: features.budget.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預算管理'**
  String get featuresBudgetTitle;

  /// Web path: features.budget.monthLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{year} 年 {month} 月'**
  String featuresBudgetMonthLabel(Object year, Object month);

  /// Web path: features.budget.totalBudget
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月總預算'**
  String get featuresBudgetTotalBudget;

  /// Web path: features.budget.spent
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已使用'**
  String get featuresBudgetSpent;

  /// Web path: features.budget.addBudget
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增預算'**
  String get featuresBudgetAddBudget;

  /// Web path: features.budget.editBudget
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯預算'**
  String get featuresBudgetEditBudget;

  /// Web path: features.budget.newBudget
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增預算'**
  String get featuresBudgetNewBudget;

  /// Web path: features.budget.categoryLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類（留空為總預算）'**
  String get featuresBudgetCategoryLabel;

  /// Web path: features.budget.totalBudgetOption
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'— 總預算 —'**
  String get featuresBudgetTotalBudgetOption;

  /// Web path: features.budget.amountLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預算金額 *'**
  String get featuresBudgetAmountLabel;

  /// Web path: features.budget.totalBudgetName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'（總預算）'**
  String get featuresBudgetTotalBudgetName;

  /// Web path: features.budget.overBudget
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'超出預算'**
  String get featuresBudgetOverBudget;

  /// Web path: features.budget.deleteMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除此預算設定嗎？'**
  String get featuresBudgetDeleteMessage;

  /// Web path: features.budget.messages.amountRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入有效預算金額'**
  String get featuresBudgetMessagesAmountRequired;

  /// Web path: features.reports.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'統計報表'**
  String get featuresReportsTitle;

  /// Web path: features.reports.tabs.category
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類統計'**
  String get featuresReportsTabsCategory;

  /// Web path: features.reports.tabs.trend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'趨勢分析'**
  String get featuresReportsTabsTrend;

  /// Web path: features.reports.tabs.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每日消費'**
  String get featuresReportsTabsDaily;

  /// Web path: features.reports.periods.thisMonth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月'**
  String get featuresReportsPeriodsThisMonth;

  /// Web path: features.reports.periods.lastMonth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上月'**
  String get featuresReportsPeriodsLastMonth;

  /// Web path: features.reports.periods.last3
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'近3個月'**
  String get featuresReportsPeriodsLast3;

  /// Web path: features.reports.periods.last6
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'近6個月'**
  String get featuresReportsPeriodsLast6;

  /// Web path: features.reports.periods.thisYear
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'今年'**
  String get featuresReportsPeriodsThisYear;

  /// Web path: features.reports.periods.custom
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自訂'**
  String get featuresReportsPeriodsCustom;

  /// Web path: features.reports.periodLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'期間'**
  String get featuresReportsPeriodLabel;

  /// Web path: features.reports.start
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'開始'**
  String get featuresReportsStart;

  /// Web path: features.reports.end
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'結束'**
  String get featuresReportsEnd;

  /// Web path: features.reports.currentTotal
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本期合計'**
  String get featuresReportsCurrentTotal;

  /// Web path: features.reports.comparedPrevious
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'相較前期'**
  String get featuresReportsComparedPrevious;

  /// Web path: features.reports.previousNoData
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{delta}，前期無資料'**
  String featuresReportsPreviousNoData(Object delta);

  /// Web path: features.reports.compareWithRate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{delta} ({rate}%)'**
  String featuresReportsCompareWithRate(Object delta, Object rate);

  /// Web path: features.reports.detailTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{type}明細'**
  String featuresReportsDetailTitle(Object type);

  /// Web path: features.reports.total
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'合計：{amount}'**
  String featuresReportsTotal(Object amount);

  /// Web path: features.reports.selectedCategory
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已選取分類：'**
  String get featuresReportsSelectedCategory;

  /// Web path: features.reports.selectedCategoryAmount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'，金額 {amount}'**
  String featuresReportsSelectedCategoryAmount(Object amount);

  /// Web path: features.reports.viewTransactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查看對應交易'**
  String get featuresReportsViewTransactions;

  /// Web path: features.recurring.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'固定收支'**
  String get featuresRecurringTitle;

  /// Web path: features.recurring.add
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增固定收支'**
  String get featuresRecurringAdd;

  /// Web path: features.recurring.edit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯固定收支'**
  String get featuresRecurringEdit;

  /// Web path: features.recurring.create
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增固定收支'**
  String get featuresRecurringCreate;

  /// Web path: features.recurring.amountLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金額 *'**
  String get featuresRecurringAmountLabel;

  /// Web path: features.recurring.fxFeeLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'海外手續費（TWD）'**
  String get featuresRecurringFxFeeLabel;

  /// Web path: features.recurring.fxFeePlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'留空則由系統依卡片費率自動計算'**
  String get featuresRecurringFxFeePlaceholder;

  /// Web path: features.recurring.fxFeeHint
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'卡片海外手續費率 {rate}%{suggestion}'**
  String featuresRecurringFxFeeHint(Object rate, Object suggestion);

  /// Web path: features.recurring.fxFeeSuggestion
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'，建議值 NT\$ {amount}'**
  String featuresRecurringFxFeeSuggestion(Object amount);

  /// Web path: features.recurring.latestRateLoading
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查詢最新匯率中...'**
  String get featuresRecurringLatestRateLoading;

  /// Web path: features.recurring.category
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類'**
  String get featuresRecurringCategory;

  /// Web path: features.recurring.frequency
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'頻率'**
  String get featuresRecurringFrequency;

  /// Web path: features.recurring.startDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'起始日期'**
  String get featuresRecurringStartDate;

  /// Web path: features.recurring.nextRun
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下次執行：{date}'**
  String featuresRecurringNextRun(Object date);

  /// Web path: features.recurring.categoryLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類：{name}'**
  String featuresRecurringCategoryLine(Object name);

  /// Web path: features.recurring.accountLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶：{name}'**
  String featuresRecurringAccountLine(Object name);

  /// Web path: features.recurring.fxFeeLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'海外手續費：NT\$ {amount}'**
  String featuresRecurringFxFeeLine(Object amount);

  /// Web path: features.recurring.deleteMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除此固定收支設定嗎？'**
  String get featuresRecurringDeleteMessage;

  /// Web path: features.recurring.creatingTransfer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立中...'**
  String get featuresRecurringCreatingTransfer;

  /// Web path: features.recurring.confirmTransfer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確認轉帳'**
  String get featuresRecurringConfirmTransfer;

  /// Web path: features.recurring.frequencyLabels.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每日'**
  String get featuresRecurringFrequencyLabelsDaily;

  /// Web path: features.recurring.frequencyLabels.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每週'**
  String get featuresRecurringFrequencyLabelsWeekly;

  /// Web path: features.recurring.frequencyLabels.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月'**
  String get featuresRecurringFrequencyLabelsMonthly;

  /// Web path: features.recurring.frequencyLabels.yearly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每年'**
  String get featuresRecurringFrequencyLabelsYearly;

  /// Web path: features.recurring.messages.amountRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入有效金額'**
  String get featuresRecurringMessagesAmountRequired;

  /// Web path: features.dataTransfer.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料匯出匯入'**
  String get featuresDataTransferTitle;

  /// Web path: features.dataTransfer.exportStartDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯出起始日'**
  String get featuresDataTransferExportStartDate;

  /// Web path: features.dataTransfer.exportEndDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯出結束日'**
  String get featuresDataTransferExportEndDate;

  /// Web path: features.dataTransfer.csvColumns
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支援 CSV 匯出與匯入。欄位：{columns}'**
  String featuresDataTransferCsvColumns(Object columns);

  /// Web path: features.dataTransfer.exportCsv
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯出 CSV'**
  String get featuresDataTransferExportCsv;

  /// Web path: features.dataTransfer.exporting
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯出中...'**
  String get featuresDataTransferExporting;

  /// Web path: features.dataTransfer.chooseCsv
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'選擇 CSV 匯入'**
  String get featuresDataTransferChooseCsv;

  /// Web path: features.dataTransfer.importing
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯入中...'**
  String get featuresDataTransferImporting;

  /// Web path: features.dataTransfer.imported
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯入成功：{count} 筆'**
  String featuresDataTransferImported(Object count);

  /// Web path: features.dataTransfer.skipped
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'略過：{count} 筆'**
  String featuresDataTransferSkipped(Object count);

  /// Web path: features.dataTransfer.createdCategories
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自動建立分類：{items}'**
  String featuresDataTransferCreatedCategories(Object items);

  /// Web path: features.dataTransfer.createdAccounts
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自動建立帳戶：{items}'**
  String featuresDataTransferCreatedAccounts(Object items);

  /// Web path: features.dataTransfer.warning
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'警告'**
  String get featuresDataTransferWarning;

  /// Web path: features.dataTransfer.error
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'錯誤'**
  String get featuresDataTransferError;

  /// Web path: features.dataTransfer.rowIssue
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'第 {row} 列：{reason}'**
  String featuresDataTransferRowIssue(Object row, Object reason);

  /// Web path: features.dataTransfer.modules.accounts
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶'**
  String get featuresDataTransferModulesAccounts;

  /// Web path: features.dataTransfer.modules.transactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易記錄'**
  String get featuresDataTransferModulesTransactions;

  /// Web path: features.dataTransfer.modules.categories
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類'**
  String get featuresDataTransferModulesCategories;

  /// Web path: features.dataTransfer.modules.stockTransactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票交易'**
  String get featuresDataTransferModulesStockTransactions;

  /// Web path: features.dataTransfer.modules.stockDividends
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股利紀錄'**
  String get featuresDataTransferModulesStockDividends;

  /// Web path: features.dataTransfer.messages.exportSuccess
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯出成功'**
  String get featuresDataTransferMessagesExportSuccess;

  /// Web path: features.dataTransfer.messages.exportFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯出失敗'**
  String get featuresDataTransferMessagesExportFailed;

  /// Web path: features.dataTransfer.messages.emptyCsv
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'CSV 沒有可匯入資料'**
  String get featuresDataTransferMessagesEmptyCsv;

  /// Web path: features.dataTransfer.messages.importComplete
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name} 匯入完成'**
  String featuresDataTransferMessagesImportComplete(Object name);

  /// Web path: features.dataTransfer.messages.importFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯入失敗'**
  String get featuresDataTransferMessagesImportFailed;

  /// Web path: features.dataTransfer.messages.bundleExportDone
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'完整備份下載完成'**
  String get featuresDataTransferMessagesBundleExportDone;

  /// Web path: features.dataTransfer.messages.bundleExportFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'完整備份下載失敗'**
  String get featuresDataTransferMessagesBundleExportFailed;

  /// Web path: features.dataTransfer.messages.restoreDone
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原完成'**
  String get featuresDataTransferMessagesRestoreDone;

  /// Web path: features.dataTransfer.messages.bundleRestoreFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'備份還原失敗'**
  String get featuresDataTransferMessagesBundleRestoreFailed;

  /// Web path: features.dataTransfer.messages.dbExportDone
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料庫備份下載完成'**
  String get featuresDataTransferMessagesDbExportDone;

  /// Web path: features.dataTransfer.messages.dbExportFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料庫備份失敗'**
  String get featuresDataTransferMessagesDbExportFailed;

  /// Web path: features.dataTransfer.messages.dbRestoreDone
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料庫還原成功'**
  String get featuresDataTransferMessagesDbRestoreDone;

  /// Web path: features.dataTransfer.messages.dbRestoreFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料庫還原失敗'**
  String get featuresDataTransferMessagesDbRestoreFailed;

  /// Web path: features.dataTransfer.messages.uploadedTo
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已上傳至 {bucket}/{key}'**
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key);

  /// Web path: features.dataTransfer.messages.megaBackupFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'MEGA S4 備份失敗'**
  String get featuresDataTransferMessagesMegaBackupFailed;

  /// Web path: features.dataTransfer.messages.requireOneField
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請至少填寫一個欄位'**
  String get featuresDataTransferMessagesRequireOneField;

  /// Web path: features.dataTransfer.messages.saved
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定已儲存'**
  String get featuresDataTransferMessagesSaved;

  /// Web path: features.dataTransfer.messages.saveFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定儲存失敗'**
  String get featuresDataTransferMessagesSaveFailed;

  /// Web path: features.dataTransfer.bundle.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'完整資料備份（含圖片）'**
  String get featuresDataTransferBundleTitle;

  /// Web path: features.dataTransfer.bundle.description1
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'一鍵打包下載你個人的全部資料（交易、帳戶、分類、預算、週期、匯率、股票，以及交易憑證圖片）為單一 ZIP。'**
  String get featuresDataTransferBundleDescription1;

  /// Web path: features.dataTransfer.bundle.description2
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上傳同一份 ZIP 即可還原。'**
  String get featuresDataTransferBundleDescription2;

  /// Web path: features.dataTransfer.bundle.restorePrefix
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原採'**
  String get featuresDataTransferBundleRestorePrefix;

  /// Web path: features.dataTransfer.bundle.mergeMode
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'合併方式'**
  String get featuresDataTransferBundleMergeMode;

  /// Web path: features.dataTransfer.bundle.restoreMiddle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'：已存在的資料會自動略過，只補回缺少的；'**
  String get featuresDataTransferBundleRestoreMiddle;

  /// Web path: features.dataTransfer.bundle.noOverwrite
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'不會刪除或覆蓋你現有的資料'**
  String get featuresDataTransferBundleNoOverwrite;

  /// Web path: features.dataTransfer.bundle.download
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下載完整備份'**
  String get featuresDataTransferBundleDownload;

  /// Web path: features.dataTransfer.bundle.downloading
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'打包下載中...'**
  String get featuresDataTransferBundleDownloading;

  /// Web path: features.dataTransfer.bundle.restore
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上傳備份還原'**
  String get featuresDataTransferBundleRestore;

  /// Web path: features.dataTransfer.bundle.restoring
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原中...'**
  String get featuresDataTransferBundleRestoring;

  /// Web path: features.dataTransfer.database.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'整檔備份 / 還原'**
  String get featuresDataTransferDatabaseTitle;

  /// Web path: features.dataTransfer.database.description
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'僅管理員可操作。SQLite 模式下載 `.db` 備份；PostgreSQL 模式下載 `.sql` 備份，還原時請上傳對應格式。'**
  String get featuresDataTransferDatabaseDescription;

  /// Web path: features.dataTransfer.database.download
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下載資料庫備份'**
  String get featuresDataTransferDatabaseDownload;

  /// Web path: features.dataTransfer.database.downloading
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下載中...'**
  String get featuresDataTransferDatabaseDownloading;

  /// Web path: features.dataTransfer.database.restore
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'選擇備份還原'**
  String get featuresDataTransferDatabaseRestore;

  /// Web path: features.dataTransfer.database.restoring
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原中...'**
  String get featuresDataTransferDatabaseRestoring;

  /// Web path: features.dataTransfer.mega.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'MEGA S4 雲端備份'**
  String get featuresDataTransferMegaTitle;

  /// Web path: features.dataTransfer.mega.description
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'將目前完整 SQLite 備份以上傳物件方式存入 MEGA S4 bucket。連線資訊由伺服器環境變數設定，不會在瀏覽器輸入或顯示金鑰。'**
  String get featuresDataTransferMegaDescription;

  /// Web path: features.dataTransfer.mega.state
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'狀態：'**
  String get featuresDataTransferMegaState;

  /// Web path: features.dataTransfer.mega.configured
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已設定'**
  String get featuresDataTransferMegaConfigured;

  /// Web path: features.dataTransfer.mega.notConfigured
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未完整設定'**
  String get featuresDataTransferMegaNotConfigured;

  /// Web path: features.dataTransfer.mega.bucket
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Bucket：'**
  String get featuresDataTransferMegaBucket;

  /// Web path: features.dataTransfer.mega.missing
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'缺少環境變數：{items}'**
  String featuresDataTransferMegaMissing(Object items);

  /// Web path: features.dataTransfer.mega.upload
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上傳備份到 MEGA S4'**
  String get featuresDataTransferMegaUpload;

  /// Web path: features.dataTransfer.mega.uploading
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上傳中...'**
  String get featuresDataTransferMegaUploading;

  /// Web path: features.dataTransfer.mega.configure
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定'**
  String get featuresDataTransferMegaConfigure;

  /// Web path: features.dataTransfer.mega.cancelConfigure
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'取消設定'**
  String get featuresDataTransferMegaCancelConfigure;

  /// Web path: features.dataTransfer.mega.formHelp
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定寫入伺服器持久化設定檔，立即生效。金鑰欄位請重新輸入，不會預填。'**
  String get featuresDataTransferMegaFormHelp;

  /// Web path: features.dataTransfer.mega.bucketName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Bucket 名稱'**
  String get featuresDataTransferMegaBucketName;

  /// Web path: features.dataTransfer.mega.prefix
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Prefix（選填）'**
  String get featuresDataTransferMegaPrefix;

  /// Web path: features.dataTransfer.mega.endpoint
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Endpoint（選填，留空自動推算）'**
  String get featuresDataTransferMegaEndpoint;

  /// Web path: features.dataTransfer.mega.saveSettings
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲存設定'**
  String get featuresDataTransferMegaSaveSettings;

  /// Web path: features.accounts.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶管理'**
  String get featuresAccountsTitle;

  /// Web path: features.accounts.typeLabels.bank
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'銀行帳戶'**
  String get featuresAccountsTypeLabelsBank;

  /// Web path: features.accounts.typeLabels.credit_card
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'信用卡'**
  String get featuresAccountsTypeLabelsCredit_card;

  /// Web path: features.accounts.typeLabels.cash
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'現金'**
  String get featuresAccountsTypeLabelsCash;

  /// Web path: features.accounts.typeLabels.virtual_wallet
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'電子錢包'**
  String get featuresAccountsTypeLabelsVirtual_wallet;

  /// Web path: features.accounts.typeLabels.other
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'其他'**
  String get featuresAccountsTypeLabelsOther;

  /// Web path: features.accounts.totalAssets
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總資產'**
  String get featuresAccountsTotalAssets;

  /// Web path: features.accounts.creditOutstanding
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'信用卡待還總額'**
  String get featuresAccountsCreditOutstanding;

  /// Web path: features.accounts.addAccount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增帳戶'**
  String get featuresAccountsAddAccount;

  /// Web path: features.accounts.editAccount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯帳戶'**
  String get featuresAccountsEditAccount;

  /// Web path: features.accounts.newAccount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增帳戶'**
  String get featuresAccountsNewAccount;

  /// Web path: features.accounts.accountName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶名稱 *'**
  String get featuresAccountsAccountName;

  /// Web path: features.accounts.initialBalance
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'初始餘額'**
  String get featuresAccountsInitialBalance;

  /// Web path: features.accounts.initialBalanceEdit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'初始餘額 / 目前設定'**
  String get featuresAccountsInitialBalanceEdit;

  /// Web path: features.accounts.linkedBank
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'所屬銀行'**
  String get featuresAccountsLinkedBank;

  /// Web path: features.accounts.ungrouped
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'不分組'**
  String get featuresAccountsUngrouped;

  /// Web path: features.accounts.overseasFeeRate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'海外手續費率（%）'**
  String get featuresAccountsOverseasFeeRate;

  /// Web path: features.accounts.statementClosingDay
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'結帳日（每月幾號，1~31）'**
  String get featuresAccountsStatementClosingDay;

  /// Web path: features.accounts.statementClosingDayPlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'例如 15，留空則不統計本期消費'**
  String get featuresAccountsStatementClosingDayPlaceholder;

  /// Web path: features.accounts.excludeFromTotal
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'不計入總資產'**
  String get featuresAccountsExcludeFromTotal;

  /// Web path: features.accounts.otherAccounts
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'其他帳戶'**
  String get featuresAccountsOtherAccounts;

  /// Web path: features.accounts.convertedTotal
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'折算總額：{amount}'**
  String featuresAccountsConvertedTotal(Object amount);

  /// Web path: features.accounts.linkedBankLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'關聯銀行：{name}'**
  String featuresAccountsLinkedBankLine(Object name);

  /// Web path: features.accounts.overseasFeeRateLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'海外手續費率：{rate}%'**
  String featuresAccountsOverseasFeeRateLine(Object rate);

  /// Web path: features.accounts.closingDayLine
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月結帳日：{day} 號'**
  String featuresAccountsClosingDayLine(Object day);

  /// Web path: features.accounts.cycleSpending
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本期消費：{amount}'**
  String featuresAccountsCycleSpending(Object amount);

  /// Web path: features.accounts.lastCycleBill
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上期帳單：'**
  String get featuresAccountsLastCycleBill;

  /// Web path: features.accounts.billSpending
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'消費 {amount}'**
  String featuresAccountsBillSpending(Object amount);

  /// Web path: features.accounts.billPaid
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已繳 {amount}'**
  String featuresAccountsBillPaid(Object amount);

  /// Web path: features.accounts.viewCycles
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查看每期明細 ›'**
  String get featuresAccountsViewCycles;

  /// Web path: features.accounts.repayment.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'信用卡還款'**
  String get featuresAccountsRepaymentTitle;

  /// Web path: features.accounts.repayment.paymentAccount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'付款帳戶'**
  String get featuresAccountsRepaymentPaymentAccount;

  /// Web path: features.accounts.repayment.paymentDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還款日期'**
  String get featuresAccountsRepaymentPaymentDate;

  /// Web path: features.accounts.repayment.noLinkedCards
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此付款帳戶目前沒有可還款的信用卡；請確認卡片已設定關聯銀行，且關聯的正是此付款帳戶'**
  String get featuresAccountsRepaymentNoLinkedCards;

  /// Web path: features.accounts.repayment.currentBalance
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前餘額：{amount}'**
  String featuresAccountsRepaymentCurrentBalance(Object amount);

  /// Web path: features.accounts.repayment.repaymentAmount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還款金額'**
  String get featuresAccountsRepaymentRepaymentAmount;

  /// Web path: features.accounts.repayment.confirm
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確認還款'**
  String get featuresAccountsRepaymentConfirm;

  /// Web path: features.accounts.repayment.totalAmount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還款總金額'**
  String get featuresAccountsRepaymentTotalAmount;

  /// Web path: features.accounts.repayment.totalAmountHint
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'以付款帳戶幣別輸入整數，系統依各卡欠款等比例分配'**
  String get featuresAccountsRepaymentTotalAmountHint;

  /// Web path: features.accounts.repayment.totalDebt
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'應繳總額：{amount}'**
  String featuresAccountsRepaymentTotalDebt(Object amount);

  /// Web path: features.accounts.repayment.allocationPreviewTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分配預覽'**
  String get featuresAccountsRepaymentAllocationPreviewTitle;

  /// Web path: features.accounts.repayment.colCard
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'卡片'**
  String get featuresAccountsRepaymentColCard;

  /// Web path: features.accounts.repayment.colAllocated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分配金額'**
  String get featuresAccountsRepaymentColAllocated;

  /// Web path: features.accounts.repayment.colBalanceAfter
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還款後餘額'**
  String get featuresAccountsRepaymentColBalanceAfter;

  /// Web path: features.accounts.repayment.prepaidBadge
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預繳'**
  String get featuresAccountsRepaymentPrepaidBadge;

  /// Web path: features.accounts.repayment.prepaidAmount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預繳 {amount}'**
  String featuresAccountsRepaymentPrepaidAmount(Object amount);

  /// Web path: features.accounts.repayment.resultTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還款完成'**
  String get featuresAccountsRepaymentResultTitle;

  /// Web path: features.accounts.repayment.resultDone
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'完成'**
  String get featuresAccountsRepaymentResultDone;

  /// Web path: features.accounts.deleteMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除此帳戶嗎？'**
  String get featuresAccountsDeleteMessage;

  /// Web path: features.accounts.cycles.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每期帳單明細'**
  String get featuresAccountsCyclesTitle;

  /// Web path: features.accounts.cycles.closingDay
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name}　每月結帳日 {day} 號'**
  String featuresAccountsCyclesClosingDay(Object name, Object day);

  /// Web path: features.accounts.cycles.help
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'「繳款」已對應回它所清償的帳單（結帳後下一期繳清的金額算回該期帳單）。'**
  String get featuresAccountsCyclesHelp;

  /// Web path: features.accounts.cycles.period
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'期間'**
  String get featuresAccountsCyclesPeriod;

  /// Web path: features.accounts.cycles.spending
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'消費'**
  String get featuresAccountsCyclesSpending;

  /// Web path: features.accounts.cycles.payment
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'實際繳款'**
  String get featuresAccountsCyclesPayment;

  /// Web path: features.accounts.cycles.current
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本期'**
  String get featuresAccountsCyclesCurrent;

  /// Web path: features.accounts.fx.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯率管理'**
  String get featuresAccountsFxTitle;

  /// Web path: features.accounts.fx.autoUpdate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自動更新匯率'**
  String get featuresAccountsFxAutoUpdate;

  /// Web path: features.accounts.fx.syncNow
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'立即同步'**
  String get featuresAccountsFxSyncNow;

  /// Web path: features.accounts.fx.syncing
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'同步中...'**
  String get featuresAccountsFxSyncing;

  /// Web path: features.accounts.fx.lastSynced
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上次同步：{date}'**
  String featuresAccountsFxLastSynced(Object date);

  /// Web path: features.accounts.fx.currency
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'幣別'**
  String get featuresAccountsFxCurrency;

  /// Web path: features.accounts.fx.unitToTwd
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'1 單位 = TWD'**
  String get featuresAccountsFxUnitToTwd;

  /// Web path: features.accounts.fx.empty
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未設定任何外幣匯率'**
  String get featuresAccountsFxEmpty;

  /// Web path: features.accounts.fx.currencyLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'幣別（如 USD）'**
  String get featuresAccountsFxCurrencyLabel;

  /// Web path: features.accounts.fx.rateToTwd
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'對 TWD 匯率'**
  String get featuresAccountsFxRateToTwd;

  /// Web path: features.accounts.fx.addOrUpdate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增 / 更新'**
  String get featuresAccountsFxAddOrUpdate;

  /// Web path: features.accounts.messages.nameRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入帳戶名稱'**
  String get featuresAccountsMessagesNameRequired;

  /// Web path: features.accounts.messages.repaymentAccountRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇付款帳戶'**
  String get featuresAccountsMessagesRepaymentAccountRequired;

  /// Web path: features.accounts.messages.repaymentAmountRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請至少輸入一張信用卡的還款金額'**
  String get featuresAccountsMessagesRepaymentAmountRequired;

  /// Web path: features.accounts.messages.repaymentTotalAmountInvalid
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還款總金額須為大於 0 的整數'**
  String get featuresAccountsMessagesRepaymentTotalAmountInvalid;

  /// Web path: features.accounts.messages.repaymentTotalAmountTooSmall
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金額過小，至少需 {min} 才能讓每張卡都分配到'**
  String featuresAccountsMessagesRepaymentTotalAmountTooSmall(Object min);

  /// Web path: features.accounts.messages.currencyInvalid
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'幣別格式錯誤（需為 3 碼英文字母）'**
  String get featuresAccountsMessagesCurrencyInvalid;

  /// Web path: features.accounts.messages.rateInvalid
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入有效匯率'**
  String get featuresAccountsMessagesRateInvalid;

  /// Web path: features.accounts.messages.saved
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已儲存'**
  String get featuresAccountsMessagesSaved;

  /// Web path: features.accounts.messages.saveFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲存失敗'**
  String get featuresAccountsMessagesSaveFailed;

  /// Web path: features.accounts.messages.deleteFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除失敗'**
  String get featuresAccountsMessagesDeleteFailed;

  /// Web path: features.accounts.messages.ratesUpdated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯率已更新'**
  String get featuresAccountsMessagesRatesUpdated;

  /// Web path: features.accounts.messages.syncFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'同步失敗'**
  String get featuresAccountsMessagesSyncFailed;

  /// Web path: features.accounts.messages.loadFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'載入失敗'**
  String get featuresAccountsMessagesLoadFailed;

  /// Web path: features.transactions.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易記錄'**
  String get featuresTransactionsTitle;

  /// Web path: features.transactions.searchPlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'搜尋備註...'**
  String get featuresTransactionsSearchPlaceholder;

  /// Web path: features.transactions.allTypes
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'所有類型'**
  String get featuresTransactionsAllTypes;

  /// Web path: features.transactions.allAccounts
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'所有帳戶'**
  String get featuresTransactionsAllAccounts;

  /// Web path: features.transactions.allCategories
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'所有分類'**
  String get featuresTransactionsAllCategories;

  /// Web path: features.transactions.transfer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉帳'**
  String get featuresTransactionsTransfer;

  /// Web path: features.transactions.future
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未來交易'**
  String get featuresTransactionsFuture;

  /// Web path: features.transactions.excludeTransfer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'排除轉帳'**
  String get featuresTransactionsExcludeTransfer;

  /// Web path: features.transactions.parentAll
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name}（全部）'**
  String featuresTransactionsParentAll(Object name);

  /// Web path: features.transactions.startDateTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'開始日期'**
  String get featuresTransactionsStartDateTitle;

  /// Web path: features.transactions.endDateTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'結束日期'**
  String get featuresTransactionsEndDateTitle;

  /// Web path: features.transactions.add
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增交易'**
  String get featuresTransactionsAdd;

  /// Web path: features.transactions.edit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯交易'**
  String get featuresTransactionsEdit;

  /// Web path: features.transactions.create
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增交易'**
  String get featuresTransactionsCreate;

  /// Web path: features.transactions.accountTransfer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶轉帳'**
  String get featuresTransactionsAccountTransfer;

  /// Web path: features.transactions.batchCategory
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'批次改分類'**
  String get featuresTransactionsBatchCategory;

  /// Web path: features.transactions.batchDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'批次改日期'**
  String get featuresTransactionsBatchDate;

  /// Web path: features.transactions.deleteSelected
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除選取 ({count})'**
  String featuresTransactionsDeleteSelected(Object count);

  /// Web path: features.transactions.pageIncome
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'當頁收入'**
  String get featuresTransactionsPageIncome;

  /// Web path: features.transactions.pageExpense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'當頁支出'**
  String get featuresTransactionsPageExpense;

  /// Web path: features.transactions.pageTotal
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'當頁合計'**
  String get featuresTransactionsPageTotal;

  /// Web path: features.transactions.pageSummaryAria
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'當頁交易統計'**
  String get featuresTransactionsPageSummaryAria;

  /// Web path: features.transactions.empty
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無符合條件的交易記錄'**
  String get featuresTransactionsEmpty;

  /// Web path: features.transactions.source
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'來源：{name}'**
  String featuresTransactionsSource(Object name);

  /// Web path: features.transactions.fxFee
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'國外刷卡手續費'**
  String get featuresTransactionsFxFee;

  /// Web path: features.transactions.aiCreated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'AI 建立'**
  String get featuresTransactionsAiCreated;

  /// Web path: features.transactions.noteAiModified
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'備註經 AI 修改'**
  String get featuresTransactionsNoteAiModified;

  /// Web path: features.transactions.restoreCreated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原建立'**
  String get featuresTransactionsRestoreCreated;

  /// Web path: features.transactions.restoreNote
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原備註'**
  String get featuresTransactionsRestoreNote;

  /// Web path: features.transactions.viewRepaymentAllocation
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'檢視還款分配'**
  String get featuresTransactionsViewRepaymentAllocation;

  /// Web path: features.transactions.repaymentSummaryTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還款分配摘要'**
  String get featuresTransactionsRepaymentSummaryTitle;

  /// Web path: features.transactions.repaymentSummaryTotal
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'輸入總金額'**
  String get featuresTransactionsRepaymentSummaryTotal;

  /// Web path: features.transactions.repaymentSummaryStale
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此摘要已與現況不符'**
  String get featuresTransactionsRepaymentSummaryStale;

  /// Web path: features.transactions.repaymentSummaryStatusIntact
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'一致'**
  String get featuresTransactionsRepaymentSummaryStatusIntact;

  /// Web path: features.transactions.repaymentSummaryStatusModified
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已修改'**
  String get featuresTransactionsRepaymentSummaryStatusModified;

  /// Web path: features.transactions.repaymentSummaryStatusDeleted
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已刪除'**
  String get featuresTransactionsRepaymentSummaryStatusDeleted;

  /// Web path: features.transactions.restoreCreatedTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原 AI 建立的交易'**
  String get featuresTransactionsRestoreCreatedTitle;

  /// Web path: features.transactions.restoreCreatedMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原後這筆交易（含連動的轉帳或手續費交易）將被移除，且無法復原。確定要還原嗎？'**
  String get featuresTransactionsRestoreCreatedMessage;

  /// Web path: features.transactions.restoreNoteTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原備註'**
  String get featuresTransactionsRestoreNoteTitle;

  /// Web path: features.transactions.restoreNoteConfirmMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原後備註將復原為 AI 修改前的內容，且無法復原。確定要還原嗎？'**
  String get featuresTransactionsRestoreNoteConfirmMessage;

  /// Web path: features.transactions.restoreNoteCurrentLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前備註'**
  String get featuresTransactionsRestoreNoteCurrentLabel;

  /// Web path: features.transactions.restoreNotePreviewLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還原後備註'**
  String get featuresTransactionsRestoreNotePreviewLabel;

  /// Web path: features.transactions.photoOne
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'照片 1'**
  String get featuresTransactionsPhotoOne;

  /// Web path: features.transactions.photoCount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'照片 {count}'**
  String featuresTransactionsPhotoCount(Object count);

  /// Web path: features.transactions.dateRequiredLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'日期 *'**
  String get featuresTransactionsDateRequiredLabel;

  /// Web path: features.transactions.amountRequiredLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金額 *'**
  String get featuresTransactionsAmountRequiredLabel;

  /// Web path: features.transactions.fxRateLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯率（1 {currency} = ? TWD）'**
  String featuresTransactionsFxRateLabel(Object currency);

  /// Web path: features.transactions.fxRatePlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'留空則使用系統匯率'**
  String get featuresTransactionsFxRatePlaceholder;

  /// Web path: features.transactions.latestRateLoading
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查詢最新匯率中...'**
  String get featuresTransactionsLatestRateLoading;

  /// Web path: features.transactions.fxFeePlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'留空則由系統依卡片費率自動計算'**
  String get featuresTransactionsFxFeePlaceholder;

  /// Web path: features.transactions.fxFeeHint
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'卡片海外手續費率 {rate}%{suggestion}'**
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion);

  /// Web path: features.transactions.fxFeeSuggestion
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'，建議值 NT\$ {amount}'**
  String featuresTransactionsFxFeeSuggestion(Object amount);

  /// Web path: features.transactions.photos
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'照片'**
  String get featuresTransactionsPhotos;

  /// Web path: features.transactions.loadingPhotos
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'載入照片中...'**
  String get featuresTransactionsLoadingPhotos;

  /// Web path: features.transactions.takePhoto
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'拍照'**
  String get featuresTransactionsTakePhoto;

  /// Web path: features.transactions.chooseImage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'選擇圖片'**
  String get featuresTransactionsChooseImage;

  /// Web path: features.transactions.photoHelp
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'手機可直接拍照或從相簿選圖。最多 5 張，每張上限 {maxMb} MB。'**
  String featuresTransactionsPhotoHelp(Object maxMb);

  /// Web path: features.transactions.newPhotos
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增照片 {count}'**
  String featuresTransactionsNewPhotos(Object count);

  /// Web path: features.transactions.remove
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'移除'**
  String get featuresTransactionsRemove;

  /// Web path: features.transactions.choosePhoto
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'選擇照片'**
  String get featuresTransactionsChoosePhoto;

  /// Web path: features.transactions.transferOut
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉出帳戶 *'**
  String get featuresTransactionsTransferOut;

  /// Web path: features.transactions.transferIn
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉入帳戶 *'**
  String get featuresTransactionsTransferIn;

  /// Web path: features.transactions.selectPlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇'**
  String get featuresTransactionsSelectPlaceholder;

  /// Web path: features.transactions.creating
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立中...'**
  String get featuresTransactionsCreating;

  /// Web path: features.transactions.confirmTransfer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確認轉帳'**
  String get featuresTransactionsConfirmTransfer;

  /// Web path: features.transactions.batchCategoryTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'批次變更分類'**
  String get featuresTransactionsBatchCategoryTitle;

  /// Web path: features.transactions.batchDateTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'批次變更日期'**
  String get featuresTransactionsBatchDateTitle;

  /// Web path: features.transactions.newCategory
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新分類'**
  String get featuresTransactionsNewCategory;

  /// Web path: features.transactions.newDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新日期'**
  String get featuresTransactionsNewDate;

  /// Web path: features.transactions.applyTo
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'套用到 {count} 筆'**
  String featuresTransactionsApplyTo(Object count);

  /// Web path: features.transactions.deleteMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除這筆交易記錄嗎？此操作無法復原。'**
  String get featuresTransactionsDeleteMessage;

  /// Web path: features.transactions.batchDeleteConfirm
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除選取的 {count} 筆交易嗎？'**
  String featuresTransactionsBatchDeleteConfirm(Object count);

  /// Web path: features.transactions.updatedWithWarning
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易已更新，但{message}'**
  String featuresTransactionsUpdatedWithWarning(Object message);

  /// Web path: features.transactions.createdWithWarning
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易已建立，但{message}'**
  String featuresTransactionsCreatedWithWarning(Object message);

  /// Web path: features.transactions.messages.editTransferBlocked
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉帳交易請改用刪除後重建'**
  String get featuresTransactionsMessagesEditTransferBlocked;

  /// Web path: features.transactions.messages.editFxFeeBlocked
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'國外刷卡手續費為自動產生，請編輯對應的國外交易（修改後手續費會自動同步）'**
  String get featuresTransactionsMessagesEditFxFeeBlocked;

  /// Web path: features.transactions.messages.photoUploadFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'照片上傳失敗'**
  String get featuresTransactionsMessagesPhotoUploadFailed;

  /// Web path: features.transactions.messages.dateRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇日期'**
  String get featuresTransactionsMessagesDateRequired;

  /// Web path: features.transactions.messages.amountRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入有效金額'**
  String get featuresTransactionsMessagesAmountRequired;

  /// Web path: features.transactions.messages.transferAccountsRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇轉出與轉入帳戶'**
  String get featuresTransactionsMessagesTransferAccountsRequired;

  /// Web path: features.transactions.messages.transferSameAccount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉出與轉入帳戶不可相同'**
  String get featuresTransactionsMessagesTransferSameAccount;

  /// Web path: features.transactions.typeLabels.income
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入'**
  String get featuresTransactionsTypeLabelsIncome;

  /// Web path: features.transactions.typeLabels.expense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出'**
  String get featuresTransactionsTypeLabelsExpense;

  /// Web path: features.transactions.typeLabels.transfer_in
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉入'**
  String get featuresTransactionsTypeLabelsTransfer_in;

  /// Web path: features.transactions.typeLabels.transfer_out
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉出'**
  String get featuresTransactionsTypeLabelsTransfer_out;

  /// Web path: features.stocks.tabs.portfolio
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'持股總覽'**
  String get featuresStocksTabsPortfolio;

  /// Web path: features.stocks.tabs.transactions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易紀錄'**
  String get featuresStocksTabsTransactions;

  /// Web path: features.stocks.tabs.dividends
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股利紀錄'**
  String get featuresStocksTabsDividends;

  /// Web path: features.stocks.tabs.realized
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'實現損益'**
  String get featuresStocksTabsRealized;

  /// Web path: features.stocks.tabs.settings
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易設定'**
  String get featuresStocksTabsSettings;

  /// Web path: features.stocks.common.stockLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票'**
  String get featuresStocksCommonStockLabel;

  /// Web path: features.stocks.common.stockRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票 *'**
  String get featuresStocksCommonStockRequired;

  /// Web path: features.stocks.common.stockType.stock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票'**
  String get featuresStocksCommonStockTypeStock;

  /// Web path: features.stocks.common.stockType.etf
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'ETF'**
  String get featuresStocksCommonStockTypeEtf;

  /// Web path: features.stocks.common.stockType.warrant
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'權證'**
  String get featuresStocksCommonStockTypeWarrant;

  /// Web path: features.stocks.common.date
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'日期'**
  String get featuresStocksCommonDate;

  /// Web path: features.stocks.common.shares
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股數'**
  String get featuresStocksCommonShares;

  /// Web path: features.stocks.common.price
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'價格'**
  String get featuresStocksCommonPrice;

  /// Web path: features.stocks.common.total
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'合計'**
  String get featuresStocksCommonTotal;

  /// Web path: features.stocks.common.returnRate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'報酬率'**
  String get featuresStocksCommonReturnRate;

  /// Web path: features.stocks.common.overallReturnRate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'整體報酬率'**
  String get featuresStocksCommonOverallReturnRate;

  /// Web path: features.stocks.common.estimatedPL
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預估損益'**
  String get featuresStocksCommonEstimatedPL;

  /// Web path: features.stocks.common.realizedPL
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'實現損益'**
  String get featuresStocksCommonRealizedPL;

  /// Web path: features.stocks.common.totalRealizedPL
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總實現損益'**
  String get featuresStocksCommonTotalRealizedPL;

  /// Web path: features.stocks.common.yearRealizedPL
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'今年實現損益'**
  String get featuresStocksCommonYearRealizedPL;

  /// Web path: features.stocks.common.realizedCount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已實現筆數'**
  String get featuresStocksCommonRealizedCount;

  /// Web path: features.stocks.common.recordsCount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{count} 筆'**
  String featuresStocksCommonRecordsCount(Object count);

  /// Web path: features.stocks.common.sellAverage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'賣出均價'**
  String get featuresStocksCommonSellAverage;

  /// Web path: features.stocks.common.costAverage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'成本均價'**
  String get featuresStocksCommonCostAverage;

  /// Web path: features.stocks.common.feeAndTax
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'手續費+稅'**
  String get featuresStocksCommonFeeAndTax;

  /// Web path: features.stocks.common.cashDividend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'現金股利'**
  String get featuresStocksCommonCashDividend;

  /// Web path: features.stocks.common.stockDividend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票股利'**
  String get featuresStocksCommonStockDividend;

  /// Web path: features.stocks.common.stockSymbol
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票代碼 *'**
  String get featuresStocksCommonStockSymbol;

  /// Web path: features.stocks.common.stockName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票名稱'**
  String get featuresStocksCommonStockName;

  /// Web path: features.stocks.common.searching
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查詢中...'**
  String get featuresStocksCommonSearching;

  /// Web path: features.stocks.common.cancelAccounting
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'— 不入帳（純股票股利）—'**
  String get featuresStocksCommonCancelAccounting;

  /// Web path: features.stocks.common.autoCalculate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自動計算'**
  String get featuresStocksCommonAutoCalculate;

  /// Web path: features.stocks.common.buy
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'買進'**
  String get featuresStocksCommonBuy;

  /// Web path: features.stocks.common.sell
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'賣出'**
  String get featuresStocksCommonSell;

  /// Web path: features.stocks.portfolio.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'持股總覽'**
  String get featuresStocksPortfolioTitle;

  /// Web path: features.stocks.portfolio.totalMarketValue
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票總市值'**
  String get featuresStocksPortfolioTotalMarketValue;

  /// Web path: features.stocks.portfolio.totalCost
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總投入成本'**
  String get featuresStocksPortfolioTotalCost;

  /// Web path: features.stocks.portfolio.totalDividend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'累計股利'**
  String get featuresStocksPortfolioTotalDividend;

  /// Web path: features.stocks.portfolio.addStock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增股票'**
  String get featuresStocksPortfolioAddStock;

  /// Web path: features.stocks.portfolio.editStock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯股票'**
  String get featuresStocksPortfolioEditStock;

  /// Web path: features.stocks.portfolio.newStock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增股票'**
  String get featuresStocksPortfolioNewStock;

  /// Web path: features.stocks.portfolio.updatePrices
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新股價'**
  String get featuresStocksPortfolioUpdatePrices;

  /// Web path: features.stocks.portfolio.batchUpdate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'批次自動更新'**
  String get featuresStocksPortfolioBatchUpdate;

  /// Web path: features.stocks.portfolio.updating
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新中...'**
  String get featuresStocksPortfolioUpdating;

  /// Web path: features.stocks.portfolio.priceModalDescription
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'優先由瀏覽器端向台灣證交所公開 API 查詢；若瀏覽器被擋，會改用登入後的 user API 代理查詢並更新持股。'**
  String get featuresStocksPortfolioPriceModalDescription;

  /// Web path: features.stocks.portfolio.priceResult
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新完成：{updated} 支成功。'**
  String featuresStocksPortfolioPriceResult(Object updated);

  /// Web path: features.stocks.portfolio.priceResultWithFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新完成：{updated} 支成功，{failed} 支失敗。'**
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  );

  /// Web path: features.stocks.portfolio.browserQuoteUnavailable
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'瀏覽器端無法取得台灣證交所行情資料'**
  String get featuresStocksPortfolioBrowserQuoteUnavailable;

  /// Web path: features.stocks.portfolio.heldShares
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'持有股數'**
  String get featuresStocksPortfolioHeldShares;

  /// Web path: features.stocks.portfolio.shareUnit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{count} 股'**
  String featuresStocksPortfolioShareUnit(Object count);

  /// Web path: features.stocks.portfolio.currentPrice
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前股價'**
  String get featuresStocksPortfolioCurrentPrice;

  /// Web path: features.stocks.portfolio.marketValue
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'市值'**
  String get featuresStocksPortfolioMarketValue;

  /// Web path: features.stocks.portfolio.dividendMonths
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'配息月份：{months}'**
  String featuresStocksPortfolioDividendMonths(Object months);

  /// Web path: features.stocks.portfolio.dividendMonthsEmpty
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無配息紀錄'**
  String get featuresStocksPortfolioDividendMonthsEmpty;

  /// Web path: features.stocks.portfolio.messages.symbolRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入股票代碼'**
  String get featuresStocksPortfolioMessagesSymbolRequired;

  /// Web path: features.stocks.transactions.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票交易紀錄'**
  String get featuresStocksTransactionsTitle;

  /// Web path: features.stocks.transactions.addTransaction
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增交易'**
  String get featuresStocksTransactionsAddTransaction;

  /// Web path: features.stocks.transactions.editTransaction
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯交易'**
  String get featuresStocksTransactionsEditTransaction;

  /// Web path: features.stocks.transactions.newTransaction
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增交易'**
  String get featuresStocksTransactionsNewTransaction;

  /// Web path: features.stocks.transactions.typeLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'類型'**
  String get featuresStocksTransactionsTypeLabel;

  /// Web path: features.stocks.transactions.dateLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'日期 *'**
  String get featuresStocksTransactionsDateLabel;

  /// Web path: features.stocks.transactions.sharesLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股數 *'**
  String get featuresStocksTransactionsSharesLabel;

  /// Web path: features.stocks.transactions.priceLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'單價 *'**
  String get featuresStocksTransactionsPriceLabel;

  /// Web path: features.stocks.transactions.feeLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'手續費'**
  String get featuresStocksTransactionsFeeLabel;

  /// Web path: features.stocks.transactions.taxLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易稅'**
  String get featuresStocksTransactionsTaxLabel;

  /// Web path: features.stocks.transactions.deleteMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除此交易記錄嗎？'**
  String get featuresStocksTransactionsDeleteMessage;

  /// Web path: features.stocks.transactions.messages.stockRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇股票'**
  String get featuresStocksTransactionsMessagesStockRequired;

  /// Web path: features.stocks.transactions.messages.sharesRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入有效股數'**
  String get featuresStocksTransactionsMessagesSharesRequired;

  /// Web path: features.stocks.transactions.messages.priceRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入有效價格'**
  String get featuresStocksTransactionsMessagesPriceRequired;

  /// Web path: features.stocks.dividends.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股利紀錄'**
  String get featuresStocksDividendsTitle;

  /// Web path: features.stocks.dividends.addDividend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增股利'**
  String get featuresStocksDividendsAddDividend;

  /// Web path: features.stocks.dividends.editDividend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯股利'**
  String get featuresStocksDividendsEditDividend;

  /// Web path: features.stocks.dividends.newDividend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增股利'**
  String get featuresStocksDividendsNewDividend;

  /// Web path: features.stocks.dividends.syncExDividends
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'同步除權息'**
  String get featuresStocksDividendsSyncExDividends;

  /// Web path: features.stocks.dividends.syncDescription
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'依照您的持股紀錄，從台灣證交所自動同步歷年除權息資料。'**
  String get featuresStocksDividendsSyncDescription;

  /// Web path: features.stocks.dividends.syncStart
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'開始同步'**
  String get featuresStocksDividendsSyncStart;

  /// Web path: features.stocks.dividends.syncing
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'同步中...'**
  String get featuresStocksDividendsSyncing;

  /// Web path: features.stocks.dividends.syncResult
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增 {synced} 筆，跳過 {skipped} 筆。'**
  String featuresStocksDividendsSyncResult(Object synced, Object skipped);

  /// Web path: features.stocks.dividends.syncResultWithFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增 {synced} 筆，跳過 {skipped} 筆，{failed} 筆失敗。'**
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  );

  /// Web path: features.stocks.dividends.cashDividendLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'現金股利 (NT\$)'**
  String get featuresStocksDividendsCashDividendLabel;

  /// Web path: features.stocks.dividends.stockDividendLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票股利 (股)'**
  String get featuresStocksDividendsStockDividendLabel;

  /// Web path: features.stocks.dividends.depositAccount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'入款帳戶'**
  String get featuresStocksDividendsDepositAccount;

  /// Web path: features.stocks.dividends.deleteMessage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除此股利記錄嗎？'**
  String get featuresStocksDividendsDeleteMessage;

  /// Web path: features.stocks.dividends.messages.stockRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇股票'**
  String get featuresStocksDividendsMessagesStockRequired;

  /// Web path: features.stocks.dividends.messages.dividendRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入現金股利或股票股利'**
  String get featuresStocksDividendsMessagesDividendRequired;

  /// Web path: features.stocks.realized.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'實現損益'**
  String get featuresStocksRealizedTitle;

  /// Web path: features.stocks.settings.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易設定'**
  String get featuresStocksSettingsTitle;

  /// Web path: features.stocks.settings.feeTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'手續費 / 交易稅設定'**
  String get featuresStocksSettingsFeeTitle;

  /// Web path: features.stocks.settings.feeRate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'手續費率'**
  String get featuresStocksSettingsFeeRate;

  /// Web path: features.stocks.settings.feeDiscount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'折扣 (0~1)'**
  String get featuresStocksSettingsFeeDiscount;

  /// Web path: features.stocks.settings.feeMinLot
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最低手續費（整股）'**
  String get featuresStocksSettingsFeeMinLot;

  /// Web path: features.stocks.settings.feeMinOdd
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最低手續費（零股）'**
  String get featuresStocksSettingsFeeMinOdd;

  /// Web path: features.stocks.settings.sellTaxRateStock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'賣出稅率（股票）'**
  String get featuresStocksSettingsSellTaxRateStock;

  /// Web path: features.stocks.settings.sellTaxRateEtf
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'賣出稅率（ETF）'**
  String get featuresStocksSettingsSellTaxRateEtf;

  /// Web path: features.stocks.settings.sellTaxRateWarrant
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'賣出稅率（權證）'**
  String get featuresStocksSettingsSellTaxRateWarrant;

  /// Web path: features.stocks.settings.sellTaxMin
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最低交易稅'**
  String get featuresStocksSettingsSellTaxMin;

  /// Web path: features.stocks.settings.saveSettings
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲存設定'**
  String get featuresStocksSettingsSaveSettings;

  /// Web path: features.stocks.settings.stockStatusTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票狀態管理'**
  String get featuresStocksSettingsStockStatusTitle;

  /// Web path: features.stocks.settings.currentPrice
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前價格'**
  String get featuresStocksSettingsCurrentPrice;

  /// Web path: features.stocks.settings.normalTracking
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'正常追蹤'**
  String get featuresStocksSettingsNormalTracking;

  /// Web path: features.stocks.settings.delisted
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已下市'**
  String get featuresStocksSettingsDelisted;

  /// Web path: features.stocks.settings.restoreTracking
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'恢復追蹤'**
  String get featuresStocksSettingsRestoreTracking;

  /// Web path: features.stocks.settings.markDelisted
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'標記下市'**
  String get featuresStocksSettingsMarkDelisted;

  /// Web path: features.stocks.settings.recurringTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票定期定額'**
  String get featuresStocksSettingsRecurringTitle;

  /// Web path: features.stocks.settings.addRecurringShort
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增'**
  String get featuresStocksSettingsAddRecurringShort;

  /// Web path: features.stocks.settings.editRecurring
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯定期定額'**
  String get featuresStocksSettingsEditRecurring;

  /// Web path: features.stocks.settings.newRecurring
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增定期定額'**
  String get featuresStocksSettingsNewRecurring;

  /// Web path: features.stocks.settings.recurringAmountLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金額 (NT\$) *'**
  String get featuresStocksSettingsRecurringAmountLabel;

  /// Web path: features.stocks.settings.frequency
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'頻率'**
  String get featuresStocksSettingsFrequency;

  /// Web path: features.stocks.settings.startDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'起始日期'**
  String get featuresStocksSettingsStartDate;

  /// Web path: features.stocks.settings.lastGenerated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上次產生'**
  String get featuresStocksSettingsLastGenerated;

  /// Web path: features.stocks.settings.active
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'啟用中'**
  String get featuresStocksSettingsActive;

  /// Web path: features.stocks.settings.inactive
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已停用'**
  String get featuresStocksSettingsInactive;

  /// Web path: features.stocks.settings.deleteRecurringConfirm
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除此定期定額設定嗎？'**
  String get featuresStocksSettingsDeleteRecurringConfirm;

  /// Web path: features.stocks.settings.frequencyLabels.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每日'**
  String get featuresStocksSettingsFrequencyLabelsDaily;

  /// Web path: features.stocks.settings.frequencyLabels.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每週'**
  String get featuresStocksSettingsFrequencyLabelsWeekly;

  /// Web path: features.stocks.settings.frequencyLabels.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月'**
  String get featuresStocksSettingsFrequencyLabelsMonthly;

  /// Web path: features.stocks.settings.frequencyLabels.yearly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每年'**
  String get featuresStocksSettingsFrequencyLabelsYearly;

  /// Web path: features.stocks.settings.messages.saved
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定已儲存'**
  String get featuresStocksSettingsMessagesSaved;

  /// Web path: features.stocks.settings.messages.saveFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲存失敗：{message}'**
  String featuresStocksSettingsMessagesSaveFailed(Object message);

  /// Web path: features.stocks.settings.messages.stockRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇股票'**
  String get featuresStocksSettingsMessagesStockRequired;

  /// Web path: features.stocks.settings.messages.amountRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入有效金額'**
  String get featuresStocksSettingsMessagesAmountRequired;

  /// Web path: features.stocks.settings.messages.stockStatusUpdated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{symbol} 已{status}'**
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  );

  /// Web path: features.stocks.settings.messages.restoredStatus
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'恢復為正常追蹤'**
  String get featuresStocksSettingsMessagesRestoredStatus;

  /// Web path: features.stocks.settings.messages.delistedStatus
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'標記為下市'**
  String get featuresStocksSettingsMessagesDelistedStatus;

  /// Web path: features.stocks.settings.messages.delistedUpdateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新下市狀態失敗'**
  String get featuresStocksSettingsMessagesDelistedUpdateFailed;

  /// Web path: notifications.brand
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'AssetPilot'**
  String get notificationsBrand;

  /// Web path: notifications.reportType.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每日收支報表'**
  String get notificationsReportTypeDaily;

  /// Web path: notifications.reportType.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每週收支報表'**
  String get notificationsReportTypeWeekly;

  /// Web path: notifications.reportType.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月收支報表'**
  String get notificationsReportTypeMonthly;

  /// Web path: notifications.subject.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每日收支報表｜{date}（週{weekday}）'**
  String notificationsSubjectDaily(Object date, Object weekday);

  /// Web path: notifications.subject.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每週收支報表｜{start} ~ {end}'**
  String notificationsSubjectWeekly(Object start, Object end);

  /// Web path: notifications.subject.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月收支報表｜{month}'**
  String notificationsSubjectMonthly(Object month);

  /// Web path: notifications.headerTitle.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name}，{date}（週{weekday}）的收支'**
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  );

  /// Web path: notifications.headerTitle.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name}，{start} ~ {end} 的收支'**
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end);

  /// Web path: notifications.headerTitle.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name}，{month} 月的收支'**
  String notificationsHeaderTitleMonthly(Object name, Object month);

  /// Web path: notifications.headerMeta.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'📅 報表日 {date}　·　寄送日 {sendDate}'**
  String notificationsHeaderMetaDaily(Object date, Object sendDate);

  /// Web path: notifications.headerMeta.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'📅 報表區間 {start} ~ {end}　·　寄送日 {sendDate}'**
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  );

  /// Web path: notifications.headerMeta.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'📅 報表月 {month}　·　寄送日 {sendDate}'**
  String notificationsHeaderMetaMonthly(Object month, Object sendDate);

  /// Web path: notifications.banner.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'統計昨日（{date} 週{weekday}）整日收支，今日（{sendDate}）寄出'**
  String notificationsBannerDaily(Object date, Object weekday, Object sendDate);

  /// Web path: notifications.banner.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'統計過去 7 日（{start} ~ {end}，共 7 天）收支，今日（{sendDate}）寄出'**
  String notificationsBannerWeekly(Object start, Object end, Object sendDate);

  /// Web path: notifications.banner.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'統計上月（{month}，{start} ~ {end}）整月收支，本月（{sendDate}）寄出'**
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  );

  /// Web path: notifications.lead.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'昨日'**
  String get notificationsLeadDaily;

  /// Web path: notifications.lead.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本週'**
  String get notificationsLeadWeekly;

  /// Web path: notifications.lead.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上月'**
  String get notificationsLeadMonthly;

  /// Web path: notifications.kpi.income
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{lead}收入'**
  String notificationsKpiIncome(Object lead);

  /// Web path: notifications.kpi.expense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{lead}支出'**
  String notificationsKpiExpense(Object lead);

  /// Web path: notifications.kpi.net
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{lead}淨額'**
  String notificationsKpiNet(Object lead);

  /// Web path: notifications.compareLabel.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'對比前日'**
  String get notificationsCompareLabelDaily;

  /// Web path: notifications.compareLabel.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'對比上週'**
  String get notificationsCompareLabelWeekly;

  /// Web path: notifications.compareLabel.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'對比上月'**
  String get notificationsCompareLabelMonthly;

  /// Web path: notifications.periodLabel.daily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'昨日（{date}）'**
  String notificationsPeriodLabelDaily(Object date);

  /// Web path: notifications.periodLabel.weekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'過去 7 日（{start} ~ {end}）'**
  String notificationsPeriodLabelWeekly(Object start, Object end);

  /// Web path: notifications.periodLabel.monthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上月（{month}）'**
  String notificationsPeriodLabelMonthly(Object month);

  /// Web path: notifications.sections.balance
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶餘額'**
  String get notificationsSectionsBalance;

  /// Web path: notifications.sections.topCategories
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月支出 Top 5'**
  String get notificationsSectionsTopCategories;

  /// Web path: notifications.sections.topCategoriesMonthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{month} 月支出 Top 5'**
  String notificationsSectionsTopCategoriesMonthly(Object month);

  /// Web path: notifications.sections.dailyDetail
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每日明細'**
  String get notificationsSectionsDailyDetail;

  /// Web path: notifications.sections.monthlyAccrual
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月累計（{month}）'**
  String notificationsSectionsMonthlyAccrual(Object month);

  /// Web path: notifications.sections.stock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票投資'**
  String get notificationsSectionsStock;

  /// Web path: notifications.sections.recentDaily
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'昨日交易'**
  String get notificationsSectionsRecentDaily;

  /// Web path: notifications.sections.recentWeekly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本週交易'**
  String get notificationsSectionsRecentWeekly;

  /// Web path: notifications.sections.recentMonthly
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上月交易'**
  String get notificationsSectionsRecentMonthly;

  /// Web path: notifications.labels.income
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入'**
  String get notificationsLabelsIncome;

  /// Web path: notifications.labels.expense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出'**
  String get notificationsLabelsExpense;

  /// Web path: notifications.labels.net
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'淨額'**
  String get notificationsLabelsNet;

  /// Web path: notifications.labels.cost
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總成本'**
  String get notificationsLabelsCost;

  /// Web path: notifications.labels.marketValue
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'市值'**
  String get notificationsLabelsMarketValue;

  /// Web path: notifications.labels.unrealizedPL
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未實現損益'**
  String get notificationsLabelsUnrealizedPL;

  /// Web path: notifications.labels.returnRate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'報酬率'**
  String get notificationsLabelsReturnRate;

  /// Web path: notifications.labels.uncategorized
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未分類'**
  String get notificationsLabelsUncategorized;

  /// Web path: notifications.table.date
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'日期'**
  String get notificationsTableDate;

  /// Web path: notifications.empty.noAccount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無帳戶'**
  String get notificationsEmptyNoAccount;

  /// Web path: notifications.empty.noExpense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無支出紀錄'**
  String get notificationsEmptyNoExpense;

  /// Web path: notifications.empty.noTx
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{label}沒有交易'**
  String notificationsEmptyNoTx(Object label);

  /// Web path: notifications.stockInline
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票投資：市值 {marketValue}，未實現損益 {pl}'**
  String notificationsStockInline(Object marketValue, Object pl);

  /// Web path: notifications.cta.viewFullReport
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查看完整報表'**
  String get notificationsCtaViewFullReport;

  /// Web path: notifications.cta.viewLineRecord
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查看 LINE 紀錄'**
  String get notificationsCtaViewLineRecord;

  /// Web path: notifications.reminder.altText
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'記錄支出提醒'**
  String get notificationsReminderAltText;

  /// Web path: notifications.reminder.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'記得記錄今天的支出'**
  String get notificationsReminderTitle;

  /// Web path: notifications.reminder.body
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name}，花 10 秒把今天的支出補上，月底比較不會漏帳。'**
  String notificationsReminderBody(Object name);

  /// Web path: notifications.reminder.hint
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'按下新增支出後，直接輸入：金額 備註 日期（日期可省略）'**
  String get notificationsReminderHint;

  /// Web path: notifications.reminder.fallbackName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'你'**
  String get notificationsReminderFallbackName;

  /// Web path: notifications.reminder.addExpense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增支出'**
  String get notificationsReminderAddExpense;

  /// Web path: notifications.reminder.viewToday
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查看今天紀錄'**
  String get notificationsReminderViewToday;

  /// Web path: notifications.fallbackUser
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用者'**
  String get notificationsFallbackUser;

  /// Mobile compatibility string: ・不計入總資產
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'・不計入總資產'**
  String get mobileLegacyMessagebde18a20;

  /// Mobile compatibility string: （無，作為父分類）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'（無，作為父分類）'**
  String get mobileLegacyNoneCreateAsParent;

  /// Mobile compatibility string: 「首頁」依月份顯示收入、支出、淨額與支出分類圓餅圖，左右切換月份，一眼看懂錢花到哪裡。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'「首頁」依月份顯示收入、支出、淨額與支出分類圓餅圖，左右切換月份，一眼看懂錢花到哪裡。'**
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow;

  /// Mobile compatibility string: 「繳款」已對應回它所清償的帳單（結帳後下一期繳清的金額算回該期）。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'「繳款」已對應回它所清償的帳單（結帳後下一期繳清的金額算回該期）。'**
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle;

  /// Mobile compatibility string: 0＝不還
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'0＝不還'**
  String get mobileLegacy0NoPayment;

  /// Mobile compatibility string: 一
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'一'**
  String get mobileLegacyMon;

  /// Mobile compatibility string: 一般股票
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'一般股票'**
  String get mobileLegacyStock;

  /// Mobile compatibility string: 一般股票（%）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'一般股票（%）'**
  String get mobileLegacyStocks;

  /// Mobile compatibility string: 二
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'二'**
  String get mobileLegacyTue;

  /// Mobile compatibility string: 入款帳戶（含現金股利時必填）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'入款帳戶（含現金股利時必填）'**
  String get mobileLegacyDepositAccountRequiredForCashDividends;

  /// Mobile compatibility string: 三
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'三'**
  String get mobileLegacyWed;

  /// Mobile compatibility string: 上期帳單
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上期帳單 '**
  String get mobileLegacyPreviousStatement;

  /// Mobile compatibility string: 下一步
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下一步'**
  String get mobileLegacyNext;

  /// Mobile compatibility string: 下市
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'下市'**
  String get mobileLegacyDelisted;

  /// Mobile compatibility string: 子分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'子分類'**
  String get mobileLegacySubcategory;

  /// Mobile compatibility string: 已刪除
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已刪除'**
  String get mobileLegacyDeleted;

  /// Mobile compatibility string: 已更新
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已更新'**
  String get mobileLegacyUpdated;

  /// Mobile compatibility string: 已綁定
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已綁定'**
  String get mobileLegacyLinked;

  /// Mobile compatibility string: 已解除綁定
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已解除綁定'**
  String get mobileLegacyUnlinked;

  /// Mobile compatibility string: 已實現損益合計
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已實現損益合計'**
  String get mobileLegacyTotalRealizedPL;

  /// Mobile compatibility string: 五
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'五'**
  String get mobileLegacyFri;

  /// Mobile compatibility string: 公定 0.1%
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'公定 0.1%'**
  String get mobileLegacyStandardRate01;

  /// Mobile compatibility string: 公定 0.3%
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'公定 0.3%'**
  String get mobileLegacyStandardRate03;

  /// Mobile compatibility string: 六
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'六'**
  String get mobileLegacySat;

  /// Mobile compatibility string: 分類名稱
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'分類名稱'**
  String get mobileLegacyCategoryName;

  /// Mobile compatibility string: 手續費（選填）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'手續費（選填）'**
  String get mobileLegacyFeeOptional;

  /// Mobile compatibility string: 手續費／證交稅留空則由後端自動計算
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'手續費／證交稅留空則由後端自動計算'**
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem;

  /// Mobile compatibility string: 手續費率（%）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'手續費率（%）'**
  String get mobileLegacyCommissionRate;

  /// Mobile compatibility string: 日
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'日'**
  String get mobileLegacyDay;

  /// Mobile compatibility string: 月度總預算
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'月度總預算'**
  String get mobileLegacyMonthlyBudget;

  /// Mobile compatibility string: 父分類（不選＝建立父分類）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'父分類（不選＝建立父分類）'**
  String get mobileLegacyParentCategoryNoneCreatesAParent;

  /// Mobile compatibility string: 主題
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'主題'**
  String get mobileLegacyTheme;

  /// Mobile compatibility string: 四
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'四'**
  String get mobileLegacyThu;

  /// Mobile compatibility string: 未命名 Passkey
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未命名 Passkey'**
  String get mobileLegacyUnnamedPasskey;

  /// Mobile compatibility string: 未知分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未知分類'**
  String get mobileLegacyUnknownCategory;

  /// Mobile compatibility string: 未綁定
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未綁定'**
  String get mobileLegacyNotLinked;

  /// Mobile compatibility string: 本月尚無交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月尚無交易'**
  String get mobileLegacyNoTransactionsThisMonth;

  /// Mobile compatibility string: 本月尚無預算
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月尚無預算'**
  String get mobileLegacyNoBudgetThisMonth;

  /// Mobile compatibility string: 本月淨額
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月淨額'**
  String get mobileLegacyNetThisMonth;

  /// Mobile compatibility string: 正整數
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'正整數'**
  String get mobileLegacyPositiveWholeNumber;

  /// Mobile compatibility string: 永久刪除
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'永久刪除'**
  String get mobileLegacyDeletePermanently;

  /// Mobile compatibility string: 永久刪除帳號與所有資料，無法復原
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'永久刪除帳號與所有資料，無法復原'**
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData;

  /// Mobile compatibility string: 目前沒有更新內容
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前沒有更新內容'**
  String get mobileLegacyNoReleaseNotesAvailable;

  /// Mobile compatibility string: 目前裝置
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前裝置'**
  String get mobileLegacyCurrentDevice;

  /// Mobile compatibility string: 交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易'**
  String get mobileLegacyTransactions;

  /// Mobile compatibility string: 全部
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'全部'**
  String get mobileLegacyAll;

  /// Mobile compatibility string: 全部分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'全部分類'**
  String get mobileLegacyAllCategories;

  /// Mobile compatibility string: 全部帳戶
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'全部帳戶'**
  String get mobileLegacyAllAccounts;

  /// Mobile compatibility string: 各卡還款金額（以卡片幣別計）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'各卡還款金額（以卡片幣別計）'**
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency;

  /// Mobile compatibility string: 同步股利
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'同步股利'**
  String get mobileLegacySyncDividends;

  /// Mobile compatibility string: 名稱（選填，留空自動帶入）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'名稱（選填，留空自動帶入）'**
  String get mobileLegacyNameOptionalFilledAutomatically;

  /// Mobile compatibility string: 在「股票」分頁輸入股票代號（例如 2330）即可追蹤即時股價、未實現與已實現損益，系統還會自動同步除權息。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'在「股票」分頁輸入股票代號（例如 2330）即可追蹤即時股價、未實現與已實現損益，系統還會自動同步除權息。'**
  String get mobileLegacyAddATickerSuchAs2330OnThe;

  /// Mobile compatibility string: 在底部「記帳」分頁點右下角的「＋」即可新增收入或支出，支援多幣別與帳戶轉帳。交易往左滑可刪除、點一下可編輯。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'在底部「記帳」分頁點右下角的「＋」即可新增收入或支出，支援多幣別與帳戶轉帳。交易往左滑可刪除、點一下可編輯。'**
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome;

  /// Mobile compatibility string: 此區間無資料
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此區間無資料'**
  String get mobileLegacyNoDataForThisPeriod;

  /// Mobile compatibility string: 此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票與設定），且無法復原。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票與設定），且無法復原。'**
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData;

  /// Mobile compatibility string: 自訂定期收支報表寄送時間
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自訂定期收支報表寄送時間'**
  String get mobileLegacyCustomizeScheduledCashFlowReports;

  /// Mobile compatibility string: 自動
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自動'**
  String get mobileLegacyAutomatic;

  /// Mobile compatibility string: 至少 8 字元
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'至少 8 字元'**
  String get mobileLegacyAtLeast8Characters;

  /// Mobile compatibility string: 至少 8 字元，含大小寫、數字與特殊符號
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'至少 8 字元，含大小寫、數字與特殊符號'**
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers;

  /// Mobile compatibility string: 你的個人資產管家——記帳、預算、台股投資與統計報表，一個 App 全部搞定。花一分鐘快速認識主要功能。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'你的個人資產管家——記帳、預算、台股投資與統計報表，一個 App 全部搞定。花一分鐘快速認識主要功能。'**
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan;

  /// Mobile compatibility string: 刪除 Passkey
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除 Passkey'**
  String get mobileLegacyDeletePasskey;

  /// Mobile compatibility string: 刪除分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除分類'**
  String get mobileLegacyDeleteCategory;

  /// Mobile compatibility string: 刪除交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除交易'**
  String get mobileLegacyDeleteTransaction;

  /// Mobile compatibility string: 刪除股利
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除股利'**
  String get mobileLegacyDeleteDividend;

  /// Mobile compatibility string: 刪除股票
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除股票'**
  String get mobileLegacyDeleteStock;

  /// Mobile compatibility string: 刪除帳戶
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除帳戶'**
  String get mobileLegacyDeleteAccount;

  /// Mobile compatibility string: 刪除排程
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除排程'**
  String get mobileLegacyDeleteSchedule;

  /// Mobile compatibility string: 刪除照片
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除照片'**
  String get mobileLegacyDeletePhoto;

  /// Mobile compatibility string: 含現金股利時，入款帳戶為必填
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'含現金股利時，入款帳戶為必填'**
  String get mobileLegacyADepositAccountIsRequiredForCashDividends;

  /// Mobile compatibility string: 找不到符合篩選的交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'找不到符合篩選的交易'**
  String get mobileLegacyNoTransactionsMatchTheseFilters;

  /// Mobile compatibility string: 折讓（0~1）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'折讓（0~1）'**
  String get mobileLegacyDiscount01;

  /// Mobile compatibility string: 改進
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'改進'**
  String get mobileLegacyImproved;

  /// Mobile compatibility string: 更多
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更多'**
  String get mobileLegacyMore;

  /// Mobile compatibility string: 更新
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新'**
  String get mobileLegacyUpdatedd9db02d0;

  /// Mobile compatibility string: 每月最後一天
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月最後一天'**
  String get mobileLegacyLastDayOfEachMonth;

  /// Mobile compatibility string: 沒有可更新的股價
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'沒有可更新的股價'**
  String get mobileLegacyNoPricesToUpdate;

  /// Mobile compatibility string: 沒有新的股利可同步
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'沒有新的股利可同步'**
  String get mobileLegacyNoNewDividendsToSync;

  /// Mobile compatibility string: 使用者登出，已清除本機登入
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用者登出，已清除本機登入'**
  String get mobileLegacySignedOutAndClearedTheLocalSession;

  /// Mobile compatibility string: 使用教學
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用教學'**
  String get mobileLegacyGettingStarted;

  /// Mobile compatibility string: 例：0.6 代表 6 折
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'例：0.6 代表 6 折'**
  String get mobileLegacyExample06MeansA40Discount;

  /// Mobile compatibility string: 例：1.5 代表 1.5%，外幣刷卡時自動計算手續費
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'例：1.5 代表 1.5%，外幣刷卡時自動計算手續費'**
  String get mobileLegacyExample15Means15FeesAre;

  /// Mobile compatibility string: 到「更多」設定每月預算、查看統計報表、管理帳戶與分類，還能設定固定收支與報表通知。準備好了，開始記錄吧！
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'到「更多」設定每月預算、查看統計報表、管理帳戶與分類，還能設定固定收支與報表通知。準備好了，開始記錄吧！'**
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports;

  /// Mobile compatibility string: 券商公定 0.1425%
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'券商公定 0.1425%'**
  String get mobileLegacyStandardBrokerageRate01425;

  /// Mobile compatibility string: 尚未寄送
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未寄送'**
  String get mobileLegacyNotSentYet;

  /// Mobile compatibility string: 尚無已實現損益
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無已實現損益'**
  String get mobileLegacyNoRealizedReturns;

  /// Mobile compatibility string: 尚無分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無分類'**
  String get mobileLegacyNoCategoriesYet;

  /// Mobile compatibility string: 尚無交易，點右下角記一筆
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無交易，點右下角記一筆'**
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin;

  /// Mobile compatibility string: 尚無固定收支
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無固定收支'**
  String get mobileLegacyNoRecurringTransactions;

  /// Mobile compatibility string: 尚無股利紀錄
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無股利紀錄'**
  String get mobileLegacyNoDividendRecords;

  /// Mobile compatibility string: 尚無股票交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無股票交易'**
  String get mobileLegacyNoStockTransactions;

  /// Mobile compatibility string: 尚無持股
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無持股'**
  String get mobileLegacyNoHoldingsYet;

  /// Mobile compatibility string: 尚無排程，點右下角新增\n可設定每日／每週／每月定時收到收支報表
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表'**
  String get mobileLegacyN;

  /// Mobile compatibility string: 尚無登入紀錄
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無登入紀錄'**
  String get mobileLegacyNoSignInHistory;

  /// Mobile compatibility string: 於瀏覽器完成註冊（需裝置生物辨識）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'於瀏覽器完成註冊（需裝置生物辨識）'**
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired;

  /// Mobile compatibility string: 注意
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'注意'**
  String get mobileLegacyNotice;

  /// Mobile compatibility string: 股利
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股利'**
  String get mobileLegacyDividends;

  /// Mobile compatibility string: 股利同步完成
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股利同步完成'**
  String get mobileLegacyDividendSyncCompleted;

  /// Mobile compatibility string: 股票代號（如 2330）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票代號（如 2330）'**
  String get mobileLegacyTickerEG2330;

  /// Mobile compatibility string: 股票市值
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股票市值'**
  String get mobileLegacyStockMarketValue;

  /// Mobile compatibility string: 持股
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'持股'**
  String get mobileLegacyHoldings;

  /// Mobile compatibility string: 星期
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'星期'**
  String get mobileLegacyDayOfWeek;

  /// Mobile compatibility string: 查看目前版本與更新內容
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'查看目前版本與更新內容'**
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes;

  /// Mobile compatibility string: 重新命名
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'重新命名'**
  String get mobileLegacyRename;

  /// Mobile compatibility string: 重新檢查
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'重新檢查'**
  String get mobileLegacyCheckAgain;

  /// Mobile compatibility string: 重試
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'重試'**
  String get mobileLegacyRetry;

  /// Mobile compatibility string: 首頁
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'首頁'**
  String get mobileLegacyHome;

  /// Mobile compatibility string: 修正
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'修正'**
  String get mobileLegacyFixed;

  /// Mobile compatibility string: 套用
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'套用'**
  String get mobileLegacyApply;

  /// Mobile compatibility string: 時間
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'時間'**
  String get mobileLegacyTime;

  /// Mobile compatibility string: 海外手續費 TWD（選填）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'海外手續費 TWD（選填）'**
  String get mobileLegacyForeignTransactionFeeInTwdOptional;

  /// Mobile compatibility string: 記一筆
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'記一筆'**
  String get mobileLegacyAddTransaction;

  /// Mobile compatibility string: 記帳
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'記帳'**
  String get mobileLegacyTransactions8084a8ea;

  /// Mobile compatibility string: 起始日
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'起始日'**
  String get mobileLegacyStartDate;

  /// Mobile compatibility string: 追蹤台股投資
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'追蹤台股投資'**
  String get mobileLegacyTrackTaiwanStocks;

  /// Mobile compatibility string: 配股股數（選填）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'配股股數（選填）'**
  String get mobileLegacyStockDividendSharesOptional;

  /// Mobile compatibility string: 國外刷卡手續費由原交易自動產生，請編輯對應的國外交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'國外刷卡手續費由原交易自動產生，請編輯對應的國外交易'**
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe;

  /// Mobile compatibility string: 密碼長度至少 8 字元
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'密碼長度至少 8 字元'**
  String get mobileLegacyPasswordMustBeAtLeast8Characters;

  /// Mobile compatibility string: 帳戶名稱
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳戶名稱'**
  String get mobileLegacyAccountName;

  /// Mobile compatibility string: 帳號已刪除
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳號已刪除'**
  String get mobileLegacyAccountDeleted;

  /// Mobile compatibility string: 帳號安全
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳號安全'**
  String get mobileLegacyAccountSecurity;

  /// Mobile compatibility string: 帳號綁定
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'帳號綁定'**
  String get mobileLegacyLinkedAccounts;

  /// Mobile compatibility string: 常用幣別
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'常用幣別'**
  String get mobileLegacyFrequentlyUsedCurrencies;

  /// Mobile compatibility string: 從相簿選擇
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'從相簿選擇'**
  String get mobileLegacyChooseFromGallery;

  /// Mobile compatibility string: 啟用
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'啟用'**
  String get mobileLegacyEnabled;

  /// Mobile compatibility string: 深色
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'深色'**
  String get mobileLegacyDark;

  /// Mobile compatibility string: 淺色
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'淺色'**
  String get mobileLegacyLight;

  /// Mobile compatibility string: 清除日期
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'清除日期'**
  String get mobileLegacyClearDates;

  /// Mobile compatibility string: 清除篩選
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'清除篩選'**
  String get mobileLegacyClearFilters;

  /// Mobile compatibility string: 現金股利（總額，選填）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'現金股利（總額，選填）'**
  String get mobileLegacyCashDividendTotalOptional;

  /// Mobile compatibility string: 現金股利與配股至少填一項
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'現金股利與配股至少填一項'**
  String get mobileLegacyEnterACashOrStockDividend;

  /// Mobile compatibility string: 設定後帳戶卡片會顯示本期帳單消費，留空則不統計
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設定後帳戶卡片會顯示本期帳單消費，留空則不統計'**
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor;

  /// Mobile compatibility string: 備註（選填）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'備註（選填）'**
  String get mobileLegacyNoteOptional;

  /// Mobile compatibility string: 備註關鍵字
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'備註關鍵字'**
  String get mobileLegacyNoteKeyword;

  /// Mobile compatibility string: 最低證交稅
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最低證交稅'**
  String get mobileLegacyMinimumTransactionTax;

  /// Mobile compatibility string: 單筆交易最多上傳 5 張照片
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'單筆交易最多上傳 5 張照片'**
  String get mobileLegacyUpTo5PhotosPerTransaction;

  /// Mobile compatibility string: 報表通知
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'報表通知'**
  String get mobileLegacyReportNotifications;

  /// Mobile compatibility string: 掌握收支全貌
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'掌握收支全貌'**
  String get mobileLegacySeeYourCompleteCashFlow;

  /// Mobile compatibility string: 無法建立 LINE 登入狀態
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法建立 LINE 登入狀態'**
  String get mobileLegacyUnableToCreateLineSignInState;

  /// Mobile compatibility string: 無法開啟瀏覽器
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法開啟瀏覽器'**
  String get mobileLegacyUnableToOpenBrowser;

  /// Mobile compatibility string: 無法開啟瀏覽器進行 Google 登入
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法開啟瀏覽器進行 Google 登入'**
  String get mobileLegacyUnableToOpenTheBrowserForGoogleSign;

  /// Mobile compatibility string: 無法開啟瀏覽器進行 LINE 登入
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法開啟瀏覽器進行 LINE 登入'**
  String get mobileLegacyUnableToOpenTheBrowserForLineSign;

  /// Mobile compatibility string: 無法開啟瀏覽器進行 Passkey 登入
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法開啟瀏覽器進行 Passkey 登入'**
  String get mobileLegacyUnableToOpenTheBrowserForPasskeySign;

  /// Mobile compatibility string: 登入已過期，請重新登入
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入已過期，請重新登入'**
  String get mobileLegacyYourSessionExpiredSignInAgain;

  /// Mobile compatibility string: 登入回應未包含認證 Cookie，請確認後端設定
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入回應未包含認證 Cookie，請確認後端設定'**
  String get mobileLegacyTheSignInResponseDidNotIncludeAn;

  /// Mobile compatibility string: 登入成功
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入成功'**
  String get mobileLegacySignedIn;

  /// Mobile compatibility string: 登入紀錄
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入紀錄'**
  String get mobileLegacySignInHistory;

  /// Mobile compatibility string: 登入裝置
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入裝置'**
  String get mobileLegacySignedInDevices;

  /// Mobile compatibility string: 登入請求連線失敗
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入請求連線失敗'**
  String get mobileLegacySignInRequestConnectionFailed;

  /// Mobile compatibility string: 結束日
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'結束日'**
  String get mobileLegacyEndDate;

  /// Mobile compatibility string: 註冊回應未包含認證 Cookie，請確認後端設定
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'註冊回應未包含認證 Cookie，請確認後端設定'**
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn;

  /// Mobile compatibility string: 註冊並登入
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'註冊並登入'**
  String get mobileLegacySignUpAndSignIn;

  /// Mobile compatibility string: 買
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'買'**
  String get mobileLegacyBuy;

  /// Mobile compatibility string: 週期
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'週期'**
  String get mobileLegacyFrequency;

  /// Mobile compatibility string: 匯率須大於 0
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯率須大於 0'**
  String get mobileLegacyExchangeRateMustBeGreaterThan0;

  /// Mobile compatibility string: 損益
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'損益'**
  String get mobileLegacyReturns;

  /// Mobile compatibility string: 新增 Passkey
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增 Passkey'**
  String get mobileLegacyAddPasskey;

  /// Mobile compatibility string: 新增股票交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增股票交易'**
  String get mobileLegacyAddStockTransaction;

  /// Mobile compatibility string: 新增排程
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增排程'**
  String get mobileLegacyAddSchedule;

  /// Mobile compatibility string: 新增報表排程
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增報表排程'**
  String get mobileLegacyAddReportSchedule;

  /// Mobile compatibility string: 新增照片（選填）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增照片（選填）'**
  String get mobileLegacyAddPhotosOptional;

  /// Mobile compatibility string: 照片載入失敗
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'照片載入失敗'**
  String get mobileLegacyFailedToLoadPhoto;

  /// Mobile compatibility string: 綁定
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'綁定'**
  String get mobileLegacyLink;

  /// Mobile compatibility string: 綁定需於瀏覽器完成授權；解除綁定前請確認仍可用其他方式登入。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'綁定需於瀏覽器完成授權；解除綁定前請確認仍可用其他方式登入。'**
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking;

  /// Mobile compatibility string: 解除
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'解除'**
  String get mobileLegacyUnlink;

  /// Mobile compatibility string: 資產管理 · 安卓客戶端
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資產管理 · 安卓客戶端'**
  String get mobileLegacyPersonalFinanceAndroidApp;

  /// Mobile compatibility string: 跳過
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'跳過'**
  String get mobileLegacySkip;

  /// Mobile compatibility string: 零股最低手續費
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'零股最低手續費'**
  String get mobileLegacyMinimumOddLotCommission;

  /// Mobile compatibility string: 電子郵件或密碼錯誤
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'電子郵件或密碼錯誤'**
  String get mobileLegacyIncorrectEmailOrPassword;

  /// Mobile compatibility string: 預設幣別
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預設幣別'**
  String get mobileLegacyDefaultCurrency;

  /// Mobile compatibility string: 預設幣別與常用幣別
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預設幣別與常用幣別'**
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies;

  /// Mobile compatibility string: 預算
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預算'**
  String get mobileLegacyBudgets;

  /// Mobile compatibility string: 預算、報表與更多
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預算、報表與更多'**
  String get mobileLegacyBudgetsReportsAndMore;

  /// Mobile compatibility string: 預算金額
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預算金額'**
  String get mobileLegacyBudgetAmount;

  /// Mobile compatibility string: 幣別設定
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'幣別設定'**
  String get mobileLegacyCurrencySettings;

  /// Mobile compatibility string: 語言（APP、通知與網頁版）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'語言（APP、通知與網頁版）'**
  String get mobileLegacyAppNotificationAndWebLanguage;

  /// Mobile compatibility string: 銀行
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'銀行'**
  String get mobileLegacyBank;

  /// Mobile compatibility string: 銀行餘額
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'銀行餘額'**
  String get mobileLegacyBankBalance;

  /// Mobile compatibility string: 需已綁定 LINE
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'需已綁定 LINE'**
  String get mobileLegacyRequiresALinkedLineAccount;

  /// Mobile compatibility string: 需至少一張信用卡與一個非信用卡帳戶才能還款
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'需至少一張信用卡與一個非信用卡帳戶才能還款'**
  String get mobileLegacyACreditCardAndANonCreditCard;

  /// Mobile compatibility string: 需含大小寫、數字與特殊符號
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'需含大小寫、數字與特殊符號'**
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols;

  /// Mobile compatibility string: 需含大寫、小寫、數字與特殊符號
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'需含大寫、小寫、數字與特殊符號'**
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3;

  /// Mobile compatibility string: 確定刪除此報表通知排程？
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定刪除此報表通知排程？'**
  String get mobileLegacyDeleteThisReportNotificationSchedule;

  /// Mobile compatibility string: 確定要刪除這張已上傳的照片嗎？此動作無法復原。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除這張已上傳的照片嗎？此動作無法復原。'**
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone;

  /// Mobile compatibility string: 編輯股票交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯股票交易'**
  String get mobileLegacyEditStockTransaction;

  /// Mobile compatibility string: 編輯報表排程
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'編輯報表排程'**
  String get mobileLegacyEditReportSchedule;

  /// Mobile compatibility string: 請先完成下方的真人驗證
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請先完成下方的真人驗證'**
  String get mobileLegacyCompleteTheVerificationBelowFirst;

  /// Mobile compatibility string: 請先到「持股」分頁新增股票
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請先到「持股」分頁新增股票'**
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst;

  /// Mobile compatibility string: 請先選擇父分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請先選擇父分類'**
  String get mobileLegacySelectAParentCategoryFirst;

  /// Mobile compatibility string: 請至少填一張卡的還款金額
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請至少填一張卡的還款金額'**
  String get mobileLegacyEnterAPaymentForAtLeastOneCard;

  /// Mobile compatibility string: 請至少選擇一種通知方式
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請至少選擇一種通知方式'**
  String get mobileLegacySelectAtLeastOneNotificationMethod;

  /// Mobile compatibility string: 請輸入 ≥ 0 的數字
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入 ≥ 0 的數字'**
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo;

  /// Mobile compatibility string: 請輸入 1~31
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入 1~31'**
  String get mobileLegacyEnterAValueFrom1To31;

  /// Mobile compatibility string: 請輸入大於 0 的金額
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入大於 0 的金額'**
  String get mobileLegacyEnterAnAmountGreaterThan0;

  /// Mobile compatibility string: 請輸入代號
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入代號'**
  String get mobileLegacyEnterATicker;

  /// Mobile compatibility string: 請輸入正整數
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入正整數'**
  String get mobileLegacyEnterAPositiveWholeNumber;

  /// Mobile compatibility string: 請輸入名稱
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入名稱'**
  String get mobileLegacyEnterAName;

  /// Mobile compatibility string: 請輸入有效的電子郵件
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入有效的電子郵件'**
  String get mobileLegacyEnterAValidEmailAddress;

  /// Mobile compatibility string: 請輸入密碼以確認
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入密碼以確認'**
  String get mobileLegacyEnterYourPasswordToConfirm;

  /// Mobile compatibility string: 請輸入帳號電子信箱以確認
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入帳號電子信箱以確認'**
  String get mobileLegacyEnterTheAccountEmailToConfirm;

  /// Mobile compatibility string: 請輸入顯示名稱
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入顯示名稱'**
  String get mobileLegacyEnterADisplayName;

  /// Mobile compatibility string: 請選擇子分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇子分類'**
  String get mobileLegacySelectASubcategory;

  /// Mobile compatibility string: 請選擇分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇分類'**
  String get mobileLegacySelectACategory;

  /// Mobile compatibility string: 請選擇父分類
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇父分類'**
  String get mobileLegacySelectAParentCategory;

  /// Mobile compatibility string: 請選擇帳戶
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇帳戶'**
  String get mobileLegacySelectAnAccount;

  /// Mobile compatibility string: 請選擇轉入帳戶
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請選擇轉入帳戶'**
  String get mobileLegacySelectADestinationAccount;

  /// Mobile compatibility string: 賣
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'賣'**
  String get mobileLegacySell;

  /// Mobile compatibility string: 整股最低手續費
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'整股最低手續費'**
  String get mobileLegacyMinimumBoardLotCommission;

  /// Mobile compatibility string: 篩選
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'篩選'**
  String get mobileLegacyFilter;

  /// Mobile compatibility string: 篩選交易
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'篩選交易'**
  String get mobileLegacyFilterTransactions;

  /// Mobile compatibility string: 選擇主題
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'選擇主題'**
  String get mobileLegacyChooseTheme;

  /// Mobile compatibility string: 隨手記一筆
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'隨手記一筆'**
  String get mobileLegacyLogTransactionsInSeconds;

  /// Mobile compatibility string: 總市值
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總市值'**
  String get mobileLegacyMarketValue;

  /// Mobile compatibility string: 總資產（換算 TWD）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總資產（換算 TWD）'**
  String get mobileLegacyTotalAssetsInTwd;

  /// Mobile compatibility string: 繁體中文 / English
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'繁體中文 / English'**
  String get mobileLegacyTraditionalChineseEnglish;

  /// Mobile compatibility string: 還沒有帳號？註冊
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還沒有帳號？註冊'**
  String get mobileLegacyDonTHaveAnAccountSignUp;

  /// Mobile compatibility string: 還款已記錄
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'還款已記錄'**
  String get mobileLegacyPaymentRecorded;

  /// Mobile compatibility string: 轉入帳戶
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉入帳戶'**
  String get mobileLegacyToAccount;

  /// Mobile compatibility string: 轉出帳戶
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉出帳戶'**
  String get mobileLegacyFromAccount;

  /// Mobile compatibility string: 轉出與轉入不可相同
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉出與轉入不可相同'**
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer;

  /// Mobile compatibility string: 轉帳請於網頁版編輯
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'轉帳請於網頁版編輯'**
  String get mobileLegacyEditTransfersInTheWebApp;

  /// Mobile compatibility string: 證交稅（賣出）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'證交稅（賣出）'**
  String get mobileLegacyTransactionTaxSell;

  /// Mobile compatibility string: 證交稅（選填）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'證交稅（選填）'**
  String get mobileLegacyTransactionTaxOptional;

  /// Mobile compatibility string: 類型（影響證交稅率）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'類型（影響證交稅率）'**
  String get mobileLegacyTypeAffectsTransactionTax;

  /// Mobile compatibility string: 權證（%）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'權證（%）'**
  String get mobileLegacyWarrants;

  /// Mobile compatibility string: 歡迎使用 AssetPilot
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'歡迎使用 AssetPilot'**
  String get mobileLegacyWelcomeToAssetpilot;

  /// Mobile compatibility string: 變更後其他裝置將被登出。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'變更後其他裝置將被登出。'**
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis;

  /// Mobile compatibility string: 驗證 Sentry 設定（測試用）
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'驗證 Sentry 設定（測試用）'**
  String get mobileLegacyTestSentryConfiguration;

  /// Mobile compatibility string: API 回應 401，工作階段已過期並清除本機登入
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'API 回應 401，工作階段已過期並清除本機登入'**
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas;

  /// Mobile compatibility string: API 請求失敗
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'API 請求失敗'**
  String get mobileLegacyApiRequestFailed;

  /// Mobile compatibility string: API 請求連線失敗
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'API 請求連線失敗'**
  String get mobileLegacyApiRequestConnectionFailed;

  /// Mobile compatibility string: App 登入回應未包含認證 Cookie
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'App 登入回應未包含認證 Cookie'**
  String get mobileLegacyTheAppSignInResponseDidNotInclude;

  /// Mobile compatibility string: Email 通知
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Email 通知'**
  String get mobileLegacyEmailNotifications;

  /// Mobile compatibility string: Google 登入回應未包含認證 Cookie
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 登入回應未包含認證 Cookie'**
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude;

  /// Mobile compatibility string: Google 登入狀態不符，請重試
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 登入狀態不符，請重試'**
  String get mobileLegacyGoogleSignInStateMismatchTryAgain;

  /// Mobile compatibility string: Google 登入逾時或已取消
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Google 登入逾時或已取消'**
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled;

  /// Mobile compatibility string: LINE 通知
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 通知'**
  String get mobileLegacyLineNotifications;

  /// Mobile compatibility string: LINE 登入回應未包含認證 Cookie
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入回應未包含認證 Cookie'**
  String get mobileLegacyTheLineSignInResponseDidNotInclude;

  /// Mobile compatibility string: LINE 登入狀態不符，請重試
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入狀態不符，請重試'**
  String get mobileLegacyLineSignInStateMismatchTryAgain;

  /// Mobile compatibility string: LINE 登入逾時或已取消
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入逾時或已取消'**
  String get mobileLegacyLineSignInTimedOutOrWasCancelled;

  /// Mobile compatibility string: Passkey 登入逾時或已取消
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'Passkey 登入逾時或已取消'**
  String get mobileLegacyPasskeySignInTimedOutOrWasCancelled;

  /// Mobile compatibility string: TWD 一律包含。勾選的幣別會出現在交易/固定收支的幣別清單前段。
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'TWD 一律包含。勾選的幣別會出現在交易/固定收支的幣別清單前段。'**
  String get mobileLegacyTwdIsAlwaysIncludedSelectedCurrenciesAppearFirst;

  /// Mobile dynamic message: mobile.dynamic.dayOfMonth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{day} 號'**
  String mobileDynamicDayOfMonth(Object day);

  /// Mobile dynamic message: mobile.dynamic.lastSent
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上次寄送 {value}'**
  String mobileDynamicLastSent(Object value);

  /// Mobile dynamic message: mobile.dynamic.currentVersion
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前版本 v{version}'**
  String mobileDynamicCurrentVersion(Object version);

  /// Mobile dynamic message: mobile.dynamic.versionAvailable
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'有新版本 v{version} 可更新'**
  String mobileDynamicVersionAvailable(Object version);

  /// Mobile dynamic message: mobile.dynamic.monthlyOnDay
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月 {day} 號'**
  String mobileDynamicMonthlyOnDay(Object day);

  /// Mobile dynamic message: mobile.dynamic.everyWeekday
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每週{weekday}'**
  String mobileDynamicEveryWeekday(Object weekday);

  /// Mobile dynamic message: mobile.dynamic.weekday
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'星期{weekday}'**
  String mobileDynamicWeekday(Object weekday);

  /// Mobile dynamic message: mobile.dynamic.createdAt
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立於 {value}'**
  String mobileDynamicCreatedAt(Object value);

  /// Mobile dynamic message: mobile.dynamic.languageUpdated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已更新語言：{value}'**
  String mobileDynamicLanguageUpdated(Object value);

  /// Mobile dynamic message: mobile.dynamic.failedToLoad
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'載入失敗：{value}'**
  String mobileDynamicFailedToLoad(Object value);

  /// Mobile dynamic message: mobile.dynamic.unexpectedError
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'發生未預期的錯誤：{value}'**
  String mobileDynamicUnexpectedError(Object value);

  /// Mobile dynamic message: mobile.dynamic.providerLoginFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{provider} 登入失敗：{error}'**
  String mobileDynamicProviderLoginFailed(Object provider, Object error);

  /// Mobile dynamic message: mobile.dynamic.failedUpdatePrices
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新股價失敗：{value}'**
  String mobileDynamicFailedUpdatePrices(Object value);

  /// Mobile dynamic message: mobile.dynamic.failedSyncDividends
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'同步股利失敗：{value}'**
  String mobileDynamicFailedSyncDividends(Object value);

  /// Mobile dynamic message: mobile.dynamic.photoUploadFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'照片上傳失敗：{value}'**
  String mobileDynamicPhotoUploadFailed(Object value);

  /// Mobile dynamic message: mobile.dynamic.requestFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請求失敗（HTTP {code}）'**
  String mobileDynamicRequestFailed(Object code);

  /// Mobile dynamic message: mobile.dynamic.loginHttpFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入失敗（HTTP {code}）'**
  String mobileDynamicLoginHttpFailed(Object code);

  /// Mobile dynamic message: mobile.dynamic.backendConnectFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法連線到後端（{target}）：{error}'**
  String mobileDynamicBackendConnectFailed(Object target, Object error);

  /// Mobile dynamic message: mobile.dynamic.confirmDeleteNamed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定刪除「{name}」？'**
  String mobileDynamicConfirmDeleteNamed(Object name);

  /// Mobile dynamic message: mobile.dynamic.unlinkProvider
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'解除 {provider} 綁定'**
  String mobileDynamicUnlinkProvider(Object provider);

  /// Mobile dynamic message: mobile.dynamic.confirmUnlinkProvider
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定解除與 {provider} 的綁定？'**
  String mobileDynamicConfirmUnlinkProvider(Object provider);

  /// Mobile dynamic message: mobile.dynamic.providerBinding
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{provider} 綁定'**
  String mobileDynamicProviderBinding(Object provider);

  /// Mobile dynamic message: mobile.dynamic.allForName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name}（全部）'**
  String mobileDynamicAllForName(Object name);

  /// Mobile dynamic message: mobile.dynamic.unknownHttpMethod
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未知的 HTTP method: {method}'**
  String mobileDynamicUnknownHttpMethod(Object method);

  /// Mobile dynamic message: mobile.dynamic.deleteAccountName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定刪除「{name}」？相關交易可能一併受影響。'**
  String mobileDynamicDeleteAccountName(Object name);

  /// Mobile dynamic message: mobile.dynamic.currentSpending
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本期消費 {amount}{range}'**
  String mobileDynamicCurrentSpending(Object amount, Object range);

  /// Mobile dynamic message: mobile.dynamic.spentAmount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'消費 {amount}'**
  String mobileDynamicSpentAmount(Object amount);

  /// Mobile dynamic message: mobile.dynamic.paidAmount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已繳 {amount}'**
  String mobileDynamicPaidAmount(Object amount);

  /// Mobile dynamic message: mobile.dynamic.statementCloses
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{name}　每月結帳日 {day} 號'**
  String mobileDynamicStatementCloses(Object name, Object day);

  /// Mobile dynamic message: mobile.dynamic.addBudgetForMonth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增預算（{month}）'**
  String mobileDynamicAddBudgetForMonth(Object month);

  /// Mobile dynamic message: mobile.dynamic.recurringSubtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{frequency}・{account}・自 {startDate}'**
  String mobileDynamicRecurringSubtitle(
    Object frequency,
    Object account,
    Object startDate,
  );

  /// Mobile dynamic message: mobile.dynamic.reportTotalExpense
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總支出：{total}'**
  String mobileDynamicReportTotalExpense(Object total);

  /// Mobile dynamic message: mobile.dynamic.reportTotalIncome
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'總收入：{total}'**
  String mobileDynamicReportTotalIncome(Object total);

  /// Mobile dynamic message: mobile.dynamic.deleteTransactionDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定刪除這筆 {date} 的交易？此動作無法復原。'**
  String mobileDynamicDeleteTransactionDate(Object date);

  /// Mobile dynamic message: mobile.dynamic.deleteTransactionCompact
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定刪除這筆{date}的交易？'**
  String mobileDynamicDeleteTransactionCompact(Object date);

  /// Mobile dynamic message: mobile.dynamic.exchangeRateForCurrency
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'匯率（1 {currency} = ? TWD）'**
  String mobileDynamicExchangeRateForCurrency(Object currency);

  /// Mobile dynamic message: mobile.dynamic.cardRateAutoFee
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此卡費率 {rate}%，留空將自動計算'**
  String mobileDynamicCardRateAutoFee(Object rate);

  /// Mobile dynamic message: mobile.dynamic.uploadedPhotosCount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已上傳照片（{count}）'**
  String mobileDynamicUploadedPhotosCount(Object count);

  /// Mobile dynamic message: mobile.dynamic.addPhotosCount
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增照片（{count}/5）'**
  String mobileDynamicAddPhotosCount(Object count);

  /// Mobile dynamic message: mobile.dynamic.stockPricesUpdated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已更新 {count} 檔股價'**
  String mobileDynamicStockPricesUpdated(Object count);

  /// Mobile dynamic message: mobile.dynamic.stockPricesUpdatedWithFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已更新 {count} 檔股價，{failed} 檔查詢失敗'**
  String mobileDynamicStockPricesUpdatedWithFailed(Object count, Object failed);

  /// Mobile dynamic message: mobile.dynamic.deleteStock
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定刪除「{symbol} {name}」？其所有交易與股利紀錄將一併刪除，無法復原。'**
  String mobileDynamicDeleteStock(Object symbol, Object name);

  /// Mobile dynamic message: mobile.dynamic.stockHoldingSubtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{shares} 股・均價 {avgCost}・現價 {currentPrice}'**
  String mobileDynamicStockHoldingSubtitle(
    Object shares,
    Object avgCost,
    Object currentPrice,
  );

  /// Mobile dynamic message: mobile.dynamic.stockTransactionSubtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{date}・{shares} 股 @ {price}'**
  String mobileDynamicStockTransactionSubtitle(
    Object date,
    Object shares,
    Object price,
  );

  /// Mobile dynamic message: mobile.dynamic.deleteDividend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定刪除 {symbol} 於 {date} 的股利紀錄？'**
  String mobileDynamicDeleteDividend(Object symbol, Object date);

  /// Mobile dynamic message: mobile.dynamic.dividendsSynced
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已同步 {count} 筆股利'**
  String mobileDynamicDividendsSynced(Object count);

  /// Mobile dynamic message: mobile.dynamic.dividendsSyncedWithSkipped
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已同步 {count} 筆股利，略過 {skipped} 筆'**
  String mobileDynamicDividendsSyncedWithSkipped(Object count, Object skipped);

  /// Mobile dynamic message: mobile.dynamic.cashDividend
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'現金 {amount}'**
  String mobileDynamicCashDividend(Object amount);

  /// Mobile dynamic message: mobile.dynamic.stockDividendShares
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'配股 {shares} 股'**
  String mobileDynamicStockDividendShares(Object shares);

  /// Mobile dynamic message: mobile.dynamic.realizedTransactionSubtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{date}・賣 {shares} 股'**
  String mobileDynamicRealizedTransactionSubtitle(Object date, Object shares);

  /// Web path: dashboard.dataStatus.queriedAt
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資料查詢時間 {time}'**
  String dashboardDataStatusQueriedAt(Object time);

  /// Web path: dashboard.attention.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'待處理'**
  String get dashboardAttentionTitle;

  /// Web path: dashboard.attention.allClear
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前沒有需要處理的事項'**
  String get dashboardAttentionAllClear;

  /// Web path: dashboard.attention.recurring
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{count} 筆固定收支需要檢查'**
  String dashboardAttentionRecurring(Object count);

  /// Web path: dashboard.attention.uncategorized
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{count} 筆未分類交易 · {amount}'**
  String dashboardAttentionUncategorized(Object count, Object amount);

  /// Web path: dashboard.attention.unpriced
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{count} 檔持倉尚無價格'**
  String dashboardAttentionUnpriced(Object count);

  /// Web path: dashboard.drivers.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本月 Top 3 驅動因素'**
  String get dashboardDriversTitle;

  /// Web path: dashboard.drivers.subtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{month} 金額最高的收入與支出項目'**
  String dashboardDriversSubtitle(Object month);

  /// Web path: dashboard.drivers.share
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'占此類型 {share}%'**
  String dashboardDriversShare(Object share);

  /// Web path: dashboard.personalize.trigger
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自訂首頁'**
  String get dashboardPersonalizeTrigger;

  /// Web path: dashboard.personalize.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'自訂首頁'**
  String get dashboardPersonalizeTitle;

  /// Web path: dashboard.personalize.description
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'選擇要顯示的模組，並依你的使用順序排列。'**
  String get dashboardPersonalizeDescription;

  /// Web path: dashboard.personalize.modules.assets
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'資產概覽'**
  String get dashboardPersonalizeModulesAssets;

  /// Web path: dashboard.personalize.modules.attention
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'需要處理'**
  String get dashboardPersonalizeModulesAttention;

  /// Web path: dashboard.personalize.modules.whyChanged
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'現金流為何變動'**
  String get dashboardPersonalizeModulesWhyChanged;

  /// Web path: dashboard.personalize.modules.spending
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'支出分類'**
  String get dashboardPersonalizeModulesSpending;

  /// Web path: dashboard.personalize.modules.portfolioHealth
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'投資組合健檢'**
  String get dashboardPersonalizeModulesPortfolioHealth;

  /// Web path: dashboard.personalize.modules.incomeRecent
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'收入與近期交易'**
  String get dashboardPersonalizeModulesIncomeRecent;

  /// Web path: dashboard.personalize.moveUp
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'將「{module}」上移'**
  String dashboardPersonalizeMoveUp(Object module);

  /// Web path: dashboard.personalize.moveDown
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'將「{module}」下移'**
  String dashboardPersonalizeMoveDown(Object module);

  /// Web path: dashboard.personalize.saved
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'首頁配置已儲存'**
  String get dashboardPersonalizeSaved;

  /// Web path: dashboard.personalize.saveError
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法儲存首頁配置'**
  String get dashboardPersonalizeSaveError;

  /// Web path: dashboard.personalize.reset
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'重設'**
  String get dashboardPersonalizeReset;

  /// Web path: dashboard.personalize.apply
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'套用'**
  String get dashboardPersonalizeApply;

  /// Web path: dashboard.comparison.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'現金流為何變動'**
  String get dashboardComparisonTitle;

  /// Web path: dashboard.comparison.mtd
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{currentStart}～{currentEnd}，對比 {previousStart}～{previousEnd}'**
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  );

  /// Web path: dashboard.comparison.full
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'完整月份，對比 {previousStart}～{previousEnd}'**
  String dashboardComparisonFull(Object previousStart, Object previousEnd);

  /// Web path: dashboard.comparison.unavailable
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'這個月份沒有可比較的上一期間。'**
  String get dashboardComparisonUnavailable;

  /// Web path: dashboard.comparison.noChanges
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已記錄的現金流與可比期間相同。'**
  String get dashboardComparisonNoChanges;

  /// Web path: dashboard.comparison.previousNet
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'上期淨現金流'**
  String get dashboardComparisonPreviousNet;

  /// Web path: dashboard.comparison.netChange
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'淨現金流變動'**
  String get dashboardComparisonNetChange;

  /// Web path: dashboard.comparison.newThisPeriod
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本期新增'**
  String get dashboardComparisonNewThisPeriod;

  /// Web path: dashboard.comparison.increased
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金額增加'**
  String get dashboardComparisonIncreased;

  /// Web path: dashboard.comparison.decreased
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'金額減少'**
  String get dashboardComparisonDecreased;

  /// Web path: dashboard.portfolioHealth.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'投資成本基礎健檢'**
  String get dashboardPortfolioHealthTitle;

  /// Web path: dashboard.portfolioHealth.subtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'目前市值與 FIFO 剩餘成本比較'**
  String get dashboardPortfolioHealthSubtitle;

  /// Web path: dashboard.portfolioHealth.noHoldings
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增持股後即可查看成本基礎洞察。'**
  String get dashboardPortfolioHealthNoHoldings;

  /// Web path: dashboard.portfolioHealth.missingPrices
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'需要目前價格才能提供這項比較。'**
  String get dashboardPortfolioHealthMissingPrices;

  /// Web path: dashboard.portfolioHealth.mixedCurrencies
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'持股包含多種幣別，暫不提供合併百分比。'**
  String get dashboardPortfolioHealthMixedCurrencies;

  /// Web path: dashboard.portfolioHealth.marketValue
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已有價格的市值'**
  String get dashboardPortfolioHealthMarketValue;

  /// Web path: dashboard.portfolioHealth.cost
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已有價格持股成本'**
  String get dashboardPortfolioHealthCost;

  /// Web path: dashboard.portfolioHealth.unrealizedGross
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未實現毛損益'**
  String get dashboardPortfolioHealthUnrealizedGross;

  /// Web path: dashboard.portfolioHealth.largestHolding
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最大持股：{name} · 佔已有價格市值 {share}%'**
  String dashboardPortfolioHealthLargestHolding(Object name, Object share);

  /// Web path: dashboard.portfolioHealth.disclaimer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'這裡比較目前價格與已記錄的 FIFO 成本，不是市場指數基準或時間加權績效。'**
  String get dashboardPortfolioHealthDisclaimer;

  /// Web path: dashboard.portfolioHealth.coverage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'價格涵蓋：{total} 檔持股中有 {priced} 檔'**
  String dashboardPortfolioHealthCoverage(Object priced, Object total);

  /// Web path: dashboard.personalize.modules.cashOutlook
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'排程現金展望'**
  String get dashboardPersonalizeModulesCashOutlook;

  /// Web path: dashboard.personalize.modules.savingsScenario
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲蓄情境'**
  String get dashboardPersonalizeModulesSavingsScenario;

  /// Web path: dashboard.cashOutlook.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'未來 30 天・排程現金'**
  String get dashboardCashOutlookTitle;

  /// Web path: dashboard.cashOutlook.subtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'依已確認的固定收支估算'**
  String get dashboardCashOutlookSubtitle;

  /// Web path: dashboard.cashOutlook.window
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{start}～{end}・排程估算'**
  String dashboardCashOutlookWindow(Object start, Object end);

  /// Web path: dashboard.cashOutlook.invalidDate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'無法計算估算期間。'**
  String get dashboardCashOutlookInvalidDate;

  /// Web path: dashboard.cashOutlook.noBankAccounts
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請先新增並納入銀行帳戶，才能估算排程現金。'**
  String get dashboardCashOutlookNoBankAccounts;

  /// Web path: dashboard.cashOutlook.noSchedules
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立固定收入或支出後，即可查看即將發生的排程現金。'**
  String get dashboardCashOutlookNoSchedules;

  /// Web path: dashboard.cashOutlook.noCoveredSchedules
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請檢查固定收支，並連結至已納入的銀行帳戶。'**
  String get dashboardCashOutlookNoCoveredSchedules;

  /// Web path: dashboard.cashOutlook.startingBalance
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'截至今日的銀行餘額'**
  String get dashboardCashOutlookStartingBalance;

  /// Web path: dashboard.cashOutlook.scheduledNet
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'排程淨變動'**
  String get dashboardCashOutlookScheduledNet;

  /// Web path: dashboard.cashOutlook.closingBalance
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'30 天後估算現金'**
  String get dashboardCashOutlookClosingBalance;

  /// Web path: dashboard.cashOutlook.lowestBalance
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最低估算現金'**
  String get dashboardCashOutlookLowestBalance;

  /// Web path: dashboard.cashOutlook.flowSummary
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{count} 筆排程・收入 {income}・支出 {expense}'**
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  );

  /// Web path: dashboard.cashOutlook.shortfallTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'合併估算現金可能低於零'**
  String get dashboardCashOutlookShortfallTitle;

  /// Web path: dashboard.cashOutlook.shortfallBody
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'約在 {date}，估算可能低於零 {amount}。採取行動前請先檢查日期與金額。'**
  String dashboardCashOutlookShortfallBody(Object date, Object amount);

  /// Web path: dashboard.cashOutlook.upcoming
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'即將發生的排程'**
  String get dashboardCashOutlookUpcoming;

  /// Web path: dashboard.cashOutlook.showing
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'顯示 {shown}／{total} 筆'**
  String dashboardCashOutlookShowing(Object shown, Object total);

  /// Web path: dashboard.cashOutlook.noUpcoming
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'這個 30 天期間內沒有排程項目。'**
  String get dashboardCashOutlookNoUpcoming;

  /// Web path: dashboard.cashOutlook.coverage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已涵蓋 {included}／{total} 筆固定收支；請檢查其餘 {uncovered} 筆。'**
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  );

  /// Web path: dashboard.cashOutlook.disclaimer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'估算合併所有已納入銀行帳戶，採用截至今日的餘額與已確認連結固定收支。它不會顯示單一帳戶可能透支，也不會改變實際餘額；到期交易會在服務下次處理時建立。TWD 估算一致使用目前匯率。'**
  String get dashboardCashOutlookDisclaimer;

  /// Web path: dashboard.cashOutlook.attentionShortfall
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'約在 {date}，排程現金可能短缺 {amount}'**
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date);

  /// Web path: dashboard.scenario.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'儲蓄情境試算'**
  String get dashboardScenarioTitle;

  /// Web path: dashboard.scenario.subtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'試算一項每月調整的累積影響'**
  String get dashboardScenarioSubtitle;

  /// Web path: dashboard.scenario.monthlyAdjustment
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月儲蓄調整（TWD）'**
  String get dashboardScenarioMonthlyAdjustment;

  /// Web path: dashboard.scenario.decrease
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月調整減少 500'**
  String get dashboardScenarioDecrease;

  /// Web path: dashboard.scenario.increase
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月調整增加 500'**
  String get dashboardScenarioIncrease;

  /// Web path: dashboard.scenario.horizon
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'試算期間'**
  String get dashboardScenarioHorizon;

  /// Web path: dashboard.scenario.months
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'{count} 個月'**
  String dashboardScenarioMonths(Object count);

  /// Web path: dashboard.scenario.difference
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'累積差額'**
  String get dashboardScenarioDifference;

  /// Web path: dashboard.scenario.summary
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'每月調整 {monthly}，持續 {months} 個月，累積差額為 {difference}。'**
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  );

  /// Web path: dashboard.scenario.disclaimer
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'簡易情境：每月調整 × 月數。不包含利息、市場報酬、通膨與稅務，也不保證未來結果。'**
  String get dashboardScenarioDisclaimer;

  /// Web path: nav.mcp
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'MCP 連線'**
  String get navMcp;

  /// Web path: nav.mcpConnections
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已連接 AI 工具'**
  String get navMcpConnections;

  /// Web path: settings.mcp.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'MCP 連線設定'**
  String get settingsMcpTitle;

  /// Web path: settings.mcp.description
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'透過 OAuth 連接支援 MCP 的 AI 工具，或為需要手動憑證的 client 建立個人化存取權杖。'**
  String get settingsMcpDescription;

  /// Web path: settings.mcp.oauthTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用 OAuth 連線'**
  String get settingsMcpOauthTitle;

  /// Web path: settings.mcp.oauthDescription
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'在支援 MCP OAuth 的 AI 工具中輸入下方連線位址，AssetPilot 會開啟安全的登入與授權頁，不需手動建立權杖。'**
  String get settingsMcpOauthDescription;

  /// Web path: settings.mcp.createNew
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立新憑證'**
  String get settingsMcpCreateNew;

  /// Web path: settings.mcp.nameLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'名稱'**
  String get settingsMcpNameLabel;

  /// Web path: settings.mcp.namePlaceholder
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'例如：我的 ChatGPT'**
  String get settingsMcpNamePlaceholder;

  /// Web path: settings.mcp.expiresAtLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'到期時間（選填）'**
  String get settingsMcpExpiresAtLabel;

  /// Web path: settings.mcp.createButton
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立憑證'**
  String get settingsMcpCreateButton;

  /// Web path: settings.mcp.creating
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立中…'**
  String get settingsMcpCreating;

  /// Web path: settings.mcp.createFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立憑證失敗'**
  String get settingsMcpCreateFailed;

  /// Web path: settings.mcp.nameRequired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'請輸入名稱'**
  String get settingsMcpNameRequired;

  /// Web path: settings.mcp.nameTooLong
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'名稱不可超過 100 字元'**
  String get settingsMcpNameTooLong;

  /// Web path: settings.mcp.listTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'我的 MCP 憑證'**
  String get settingsMcpListTitle;

  /// Web path: settings.mcp.refresh
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'重新整理'**
  String get settingsMcpRefresh;

  /// Web path: settings.mcp.noCredentials
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未建立任何憑證'**
  String get settingsMcpNoCredentials;

  /// Web path: settings.mcp.loadFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'載入憑證清單失敗'**
  String get settingsMcpLoadFailed;

  /// Web path: settings.mcp.colName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'名稱'**
  String get settingsMcpColName;

  /// Web path: settings.mcp.colCreatedAt
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'建立時間'**
  String get settingsMcpColCreatedAt;

  /// Web path: settings.mcp.colLastUsedAt
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最後使用時間'**
  String get settingsMcpColLastUsedAt;

  /// Web path: settings.mcp.colStatus
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'狀態'**
  String get settingsMcpColStatus;

  /// Web path: settings.mcp.colActions
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'操作'**
  String get settingsMcpColActions;

  /// Web path: settings.mcp.neverUsed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未使用'**
  String get settingsMcpNeverUsed;

  /// Web path: settings.mcp.status.active
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'啟用中'**
  String get settingsMcpStatusActive;

  /// Web path: settings.mcp.status.expired
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已過期'**
  String get settingsMcpStatusExpired;

  /// Web path: settings.mcp.status.revoked
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已撤銷'**
  String get settingsMcpStatusRevoked;

  /// Web path: settings.mcp.revokeButton
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'撤銷'**
  String get settingsMcpRevokeButton;

  /// Web path: settings.mcp.revokeConfirm
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要撤銷這組憑證嗎？撤銷後所有使用此憑證的查詢將立即被拒絕。'**
  String get settingsMcpRevokeConfirm;

  /// Web path: settings.mcp.revokeFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'撤銷憑證失敗'**
  String get settingsMcpRevokeFailed;

  /// Web path: settings.mcp.tokenModalTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'MCP 存取權杖'**
  String get settingsMcpTokenModalTitle;

  /// Web path: settings.mcp.tokenWarning
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'此權杖僅顯示這一次，請立即複製並妥善保存；關閉後將無法再次查看明文。'**
  String get settingsMcpTokenWarning;

  /// Web path: settings.mcp.tokenLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'存取權杖'**
  String get settingsMcpTokenLabel;

  /// Web path: settings.mcp.connectionUrlLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'MCP 連線位址'**
  String get settingsMcpConnectionUrlLabel;

  /// Web path: settings.mcp.copyButton
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'複製'**
  String get settingsMcpCopyButton;

  /// Web path: settings.mcp.copied
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已複製！'**
  String get settingsMcpCopied;

  /// Web path: settings.mcp.closeConfirm
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'我已複製，關閉視窗'**
  String get settingsMcpCloseConfirm;

  /// Web path: settings.mcpConnections.title
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已連接 AI 工具'**
  String get settingsMcpConnectionsTitle;

  /// Web path: settings.mcpConnections.description
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'管理透過 MCP OAuth 連接的 AI 工具，是否允許代替你新增交易紀錄。'**
  String get settingsMcpConnectionsDescription;

  /// Web path: settings.mcpConnections.listTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已連接 AI 工具'**
  String get settingsMcpConnectionsListTitle;

  /// Web path: settings.mcpConnections.refresh
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'重新整理'**
  String get settingsMcpConnectionsRefresh;

  /// Web path: settings.mcpConnections.colClientName
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'AI 工具'**
  String get settingsMcpConnectionsColClientName;

  /// Web path: settings.mcpConnections.colFirstConnectedAt
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'首次連接時間'**
  String get settingsMcpConnectionsColFirstConnectedAt;

  /// Web path: settings.mcpConnections.colLastUsedAt
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'最後使用時間'**
  String get settingsMcpConnectionsColLastUsedAt;

  /// Web path: settings.mcpConnections.colAllowCreate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許新增資料'**
  String get settingsMcpConnectionsColAllowCreate;

  /// Web path: settings.mcpConnections.allowCreateLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許新增資料'**
  String get settingsMcpConnectionsAllowCreateLabel;

  /// Web path: settings.mcpConnections.noConnections
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚未連接任何 AI 工具'**
  String get settingsMcpConnectionsNoConnections;

  /// Web path: settings.mcpConnections.loadFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'載入已連接工具清單失敗'**
  String get settingsMcpConnectionsLoadFailed;

  /// Web path: settings.mcpConnections.updateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新新增資料權限失敗'**
  String get settingsMcpConnectionsUpdateFailed;

  /// Web path: settings.mcpConnections.colAllowUpdateNote
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許更新備註'**
  String get settingsMcpConnectionsColAllowUpdateNote;

  /// Web path: settings.mcpConnections.allowUpdateNoteLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許更新備註'**
  String get settingsMcpConnectionsAllowUpdateNoteLabel;

  /// Web path: settings.mcpConnections.allowUpdateNoteUpdateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新備註權限更新失敗'**
  String get settingsMcpConnectionsAllowUpdateNoteUpdateFailed;

  /// Web path: settings.mcp.colAllowCreate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許新增資料'**
  String get settingsMcpColAllowCreate;

  /// Web path: settings.mcp.allowCreateLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許新增資料'**
  String get settingsMcpAllowCreateLabel;

  /// Web path: settings.mcp.allowCreateUpdateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新新增資料權限失敗'**
  String get settingsMcpAllowCreateUpdateFailed;

  /// Web path: settings.mcp.colAllowUpdateNote
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許更新備註'**
  String get settingsMcpColAllowUpdateNote;

  /// Web path: settings.mcp.allowUpdateNoteLabel
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許更新備註'**
  String get settingsMcpAllowUpdateNoteLabel;

  /// Web path: settings.mcp.allowUpdateNoteUpdateFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新備註權限更新失敗'**
  String get settingsMcpAllowUpdateNoteUpdateFailed;

  /// Web path: admin.adminSystemSettingsTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'系統設定'**
  String get adminSystemSettingsTitle;

  /// Web path: admin.adminUsersTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'使用者管理'**
  String get adminUsersTitle;

  /// Web path: admin.adminLoginAuditTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'登入稽核'**
  String get adminLoginAuditTitle;

  /// Web path: admin.adminPublicRegistration
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'開放註冊'**
  String get adminPublicRegistration;

  /// Web path: admin.adminLineLoginEnabled
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'LINE 登入'**
  String get adminLineLoginEnabled;

  /// Web path: admin.adminAllowedRegistrationEmails
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'允許註冊的 Email（每行一個）'**
  String get adminAllowedRegistrationEmails;

  /// Web path: admin.adminAdminIpAllowlist
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'管理員 IP 白名單（每行一個）'**
  String get adminAdminIpAllowlist;

  /// Web path: admin.adminRouteAuditMode
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'稽核模式'**
  String get adminRouteAuditMode;

  /// Web path: admin.adminRouteAuditSecurity
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'安全'**
  String get adminRouteAuditSecurity;

  /// Web path: admin.adminRouteAuditExtended
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'完整'**
  String get adminRouteAuditExtended;

  /// Web path: admin.adminRouteAuditMinimal
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'精簡'**
  String get adminRouteAuditMinimal;

  /// Web path: admin.adminTransactionPhotoStorage
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易照片儲存'**
  String get adminTransactionPhotoStorage;

  /// Web path: admin.adminPhotoStorageDefault
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'預設'**
  String get adminPhotoStorageDefault;

  /// Web path: admin.adminPhotoStorageLocal
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'本機'**
  String get adminPhotoStorageLocal;

  /// Web path: admin.adminPhotoStorageS3
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'S3'**
  String get adminPhotoStorageS3;

  /// Web path: admin.adminTransactionPhotoMaxMb
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'交易照片上限（MB）'**
  String get adminTransactionPhotoMaxMb;

  /// Web path: admin.adminStockAutoUpdateEnabled
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'股價自動更新'**
  String get adminStockAutoUpdateEnabled;

  /// Web path: admin.adminStockAutoUpdateIntervalMin
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新間隔（分鐘）'**
  String get adminStockAutoUpdateIntervalMin;

  /// Web path: admin.adminSaved
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已儲存'**
  String get adminSaved;

  /// Web path: admin.adminOperationsTitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'維運動作'**
  String get adminOperationsTitle;

  /// Web path: admin.adminRunStockUpdate
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'立即更新股價'**
  String get adminRunStockUpdate;

  /// Web path: admin.adminCompressPhotos
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'壓縮照片'**
  String get adminCompressPhotos;

  /// Web path: admin.adminEncryptPhotos
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'加密照片'**
  String get adminEncryptPhotos;

  /// Web path: admin.adminServerTime
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'伺服器時間'**
  String get adminServerTime;

  /// Web path: admin.adminNtpSync
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'NTP 同步'**
  String get adminNtpSync;

  /// Web path: admin.adminStockUpdateResult
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'更新完成：{updated} 筆'**
  String adminStockUpdateResult(Object updated);

  /// Web path: admin.adminPhotoCompressResult
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'壓縮完成：{recompressed} 張'**
  String adminPhotoCompressResult(Object recompressed);

  /// Web path: admin.adminPhotoEncryptResult
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'加密完成：{encrypted} 張'**
  String adminPhotoEncryptResult(Object encrypted);

  /// Web path: admin.adminNtpSynced
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已同步，偏移 {offset} ms'**
  String adminNtpSynced(Object offset);

  /// Web path: admin.adminAddUser
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'新增使用者'**
  String get adminAddUser;

  /// Web path: admin.adminUserCreated
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已建立使用者'**
  String get adminUserCreated;

  /// Web path: admin.adminResetPassword
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'重設密碼'**
  String get adminResetPassword;

  /// Web path: admin.adminPasswordReset
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'密碼已重設'**
  String get adminPasswordReset;

  /// Web path: admin.adminRoleChanged
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已更新權限'**
  String get adminRoleChanged;

  /// Web path: admin.adminDeleteUser
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'刪除使用者'**
  String get adminDeleteUser;

  /// Web path: admin.adminDeleteUserConfirm
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'確定要刪除「{email}」嗎？'**
  String adminDeleteUserConfirm(Object email);

  /// Web path: admin.adminUserDeleted
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'已刪除使用者'**
  String get adminUserDeleted;

  /// Web path: admin.adminNoUsers
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無使用者'**
  String get adminNoUsers;

  /// Web path: admin.adminRemoveAdmin
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'取消管理員'**
  String get adminRemoveAdmin;

  /// Web path: admin.adminMakeAdmin
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'設為管理員'**
  String get adminMakeAdmin;

  /// Web path: admin.adminPasswordTooShort
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'密碼至少 8 個字元'**
  String get adminPasswordTooShort;

  /// Web path: admin.adminNoLoginAudit
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'尚無登入紀錄'**
  String get adminNoLoginAudit;

  /// Web path: admin.adminLoginSuccess
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'成功'**
  String get adminLoginSuccess;

  /// Web path: admin.adminLoginFailed
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'失敗'**
  String get adminLoginFailed;

  /// Web path: admin.adminScreenSubtitle
  ///
  /// In zh_Hant_TW, this message translates to:
  /// **'系統設定與使用者管理'**
  String get adminScreenSubtitle;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
    'ar',
    'en',
    'es',
    'fr',
    'hi',
    'ko',
    'pt',
    'ru',
    'zh',
  ].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when language+script+country codes are specified.
  switch (locale.toString()) {
    case 'zh_Hans_CN':
      return AppLocalizationsZhHansCn();
    case 'zh_Hant_TW':
      return AppLocalizationsZhHantTw();
  }

  // Lookup logic when language+country codes are specified.
  switch (locale.languageCode) {
    case 'pt':
      {
        switch (locale.countryCode) {
          case 'BR':
            return AppLocalizationsPtBr();
        }
        break;
      }
  }

  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'fr':
      return AppLocalizationsFr();
    case 'hi':
      return AppLocalizationsHi();
    case 'ko':
      return AppLocalizationsKo();
    case 'pt':
      return AppLocalizationsPt();
    case 'ru':
      return AppLocalizationsRu();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
