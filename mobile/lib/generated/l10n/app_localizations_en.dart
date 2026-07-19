// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get commonSave => 'Save';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonDelete => 'Delete';

  @override
  String get commonEdit => 'Edit';

  @override
  String get commonConfirm => 'Confirm';

  @override
  String get commonClose => 'Close';

  @override
  String get commonLoading => 'Loading…';

  @override
  String get commonAdd => 'Add';

  @override
  String get commonBack => 'Back';

  @override
  String get commonSearch => 'Search';

  @override
  String get commonLanguage => 'Language';

  @override
  String get commonClear => 'Clear';

  @override
  String get commonSaving => 'Saving...';

  @override
  String get commonConfirmDelete => 'Confirm deletion';

  @override
  String get commonPreviousPage => 'Previous';

  @override
  String get commonNextPage => 'Next';

  @override
  String commonTotalRecords(Object count) {
    return '$count records';
  }

  @override
  String get commonPerPage => 'Per page';

  @override
  String commonRecordsUnit(Object count) {
    return '$count records';
  }

  @override
  String get commonNoData => 'No data yet';

  @override
  String get navSectionsFinance => 'Finance';

  @override
  String get navSectionsStocks => 'Stocks';

  @override
  String get navSectionsSystem => 'System';

  @override
  String get navDashboard => 'Dashboard';

  @override
  String get navTransactions => 'Transactions';

  @override
  String get navReports => 'Reports';

  @override
  String get navBudget => 'Budgets';

  @override
  String get navInfoBoard => 'Info board';

  @override
  String get navAccounts => 'Accounts';

  @override
  String get navCategories => 'Categories';

  @override
  String get navRecurring => 'Recurring';

  @override
  String get navStocksPortfolio => 'Portfolio';

  @override
  String get navStocksTransactions => 'Stock transactions';

  @override
  String get navStocksDividends => 'Dividends';

  @override
  String get navStocksRealized => 'Realized P/L';

  @override
  String get navStocksSettings => 'Stock settings';

  @override
  String get navExportImport => 'Export / Import';

  @override
  String get navAccount => 'Account';

  @override
  String get navApiCredits => 'API access';

  @override
  String get navAdmin => 'Admin';

  @override
  String get navTitleStocks => 'Portfolio';

  @override
  String get navTitleStockTransactions => 'Stock transactions';

  @override
  String get navTitleStockDividends => 'Stock dividends';

  @override
  String get navTitleStockRealized => 'Realized P/L';

  @override
  String get navTitleStockSettings => 'Stock trading settings';

  @override
  String get navTitleApiCredits => 'API usage & access';

  @override
  String get shellFallbackUser => 'User';

  @override
  String get shellLogout => 'Sign out';

  @override
  String get shellVersionInfo => 'Version info';

  @override
  String get shellOpenMenu => 'Open menu';

  @override
  String get shellSkipToContent => 'Skip to main content';

  @override
  String get shellThemeLight => 'Light';

  @override
  String get shellThemeSystem => 'System';

  @override
  String get shellThemeDark => 'Dark';

  @override
  String get shellChangelogLoading => 'Loading version info…';

  @override
  String get shellChangelogLoadFailed => 'Failed to load version info';

  @override
  String get shellChangelogUnknownVersion => 'Unknown';

  @override
  String get shellChangelogCurrentVersion => 'Current version';

  @override
  String get shellChangelogUpdatableVersion => 'Available version';

  @override
  String get shellChangelogUpToDate => 'Up to date';

  @override
  String get shellChangelogUpdatableContent => 'What\'s new';

  @override
  String get shellChangelogRecentContent => 'Recent updates';

  @override
  String get authLoginTab => 'Sign in';

  @override
  String get authRegisterTab => 'Sign up';

  @override
  String get authSubtitleLogin => 'Welcome back — sign in to your account';

  @override
  String get authSubtitleRegister => 'Create your account and start tracking';

  @override
  String get authEmailLabel => 'Email';

  @override
  String get authPasswordLabel => 'Password';

  @override
  String get authPasswordPlaceholder => 'Enter your password';

  @override
  String get authDisplayNameLabel => 'Display name';

  @override
  String get authDisplayNamePlaceholder => 'Your nickname';

  @override
  String get authRegisterPasswordPlaceholder =>
      'At least 8 chars, incl. upper/lowercase letters and numbers';

  @override
  String get authTogglePassword => 'Toggle password visibility';

  @override
  String get authTurnstileAria => 'Cloudflare Turnstile human verification';

  @override
  String get authLoginButton => 'Sign in';

  @override
  String get authLoggingIn => 'Signing in…';

  @override
  String get authPasskeyButton => 'Sign in with Passkey';

  @override
  String get authPasskeyVerifying => 'Verifying Passkey…';

  @override
  String get authGoogleButton => 'Sign in with Google';

  @override
  String get authGoogleVerifying => 'Verifying Google…';

  @override
  String get authLineButton => 'Sign in with LINE';

  @override
  String get authLineVerifying => 'Verifying LINE…';

  @override
  String get authRegisterSubmit => 'Sign up now';

  @override
  String get authRegistering => 'Signing up…';

  @override
  String get authLineCallbackCompleting => 'Completing LINE verification...';

  @override
  String get authLineCallbackMissingCode =>
      'LINE did not return an authorization code. Please try again.';

  @override
  String get authLineCallbackLinkFailed => 'Failed to link LINE account';

  @override
  String get authLineCallbackLoginFailed => 'LINE sign-in failed';

  @override
  String get authLineCallbackVerifyFailed => 'LINE verification failed';

  @override
  String get authErrorsTurnstileRequired =>
      'Please complete the human verification first';

  @override
  String get authErrorsLoginFailed => 'Sign-in failed';

  @override
  String get authErrorsRegisterFailed => 'Sign-up failed';

  @override
  String get authErrorsGoogleNotConfigured =>
      'Google sign-in is not configured';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'Google sign-in component not loaded';

  @override
  String get authErrorsGoogleStateFailed =>
      'Failed to create Google sign-in state';

  @override
  String get authErrorsGoogleNoCode => 'No Google authorization code received';

  @override
  String get authErrorsGoogleFailed => 'Google sign-in failed';

  @override
  String get authErrorsGoogleCancelled => 'Google sign-in cancelled';

  @override
  String get authErrorsPasskeyUnsupported =>
      'This browser does not support Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'Failed to create Passkey sign-in challenge';

  @override
  String get authErrorsPasskeyFailed => 'Passkey sign-in failed';

  @override
  String get authErrorsLineNotConfigured => 'LINE sign-in is not configured';

  @override
  String get authErrorsLineFailed => 'LINE sign-in failed';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsLanguageTitle => 'Language';

  @override
  String get settingsLanguageDescription =>
      'Choose the language for the interface and notifications (Email / LINE).';

  @override
  String get settingsLanguageSaved => 'Language preference updated';

  @override
  String get settingsAccountTitle => 'Account settings';

  @override
  String get settingsAccountProfileInfo => 'Account information';

  @override
  String get settingsAccountEmail => 'Email';

  @override
  String get settingsAccountDisplayName => 'Display name';

  @override
  String get settingsAccountEditDisplayName => 'Edit display name';

  @override
  String get settingsAccountUpdateName => 'Update name';

  @override
  String get settingsAccountSaving => 'Saving...';

  @override
  String get settingsAccountSetLocalPassword => 'Set local password';

  @override
  String get settingsAccountChangePassword => 'Change password';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      'This account currently uses third-party sign-in only. After setting a local password, you can sign in with email and password.';

  @override
  String get settingsAccountCurrentPassword => 'Current password';

  @override
  String get settingsAccountNewPassword => 'New password';

  @override
  String get settingsAccountConfirmNewPassword => 'Confirm new password';

  @override
  String get settingsAccountPasswordPlaceholder =>
      'At least 8 characters with uppercase, lowercase, number, and symbol';

  @override
  String get settingsAccountUpdating => 'Updating...';

  @override
  String get settingsAccountSetPassword => 'Set password';

  @override
  String get settingsAccountUpdatePassword => 'Update password';

  @override
  String get settingsAccountThemeTitle => 'Display theme';

  @override
  String get settingsAccountThemeSystem => 'Follow system';

  @override
  String get settingsAccountThemeLight => 'Light mode';

  @override
  String get settingsAccountThemeDark => 'Dark mode';

  @override
  String get settingsAccountDefaultCurrency => 'Default currency';

  @override
  String get settingsAccountCurrencyCode => 'Currency code';

  @override
  String get settingsAccountUpdateDefaultCurrency => 'Update default currency';

  @override
  String get settingsAccountPasskeyTitle => 'Passkey management';

  @override
  String get settingsAccountNoPasskeys => 'No Passkeys registered yet';

  @override
  String get settingsAccountAddPasskey => '+ Add Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Google link';

  @override
  String get settingsAccountLineTitle => 'LINE link';

  @override
  String get settingsAccountStatusPrefix => 'Current status: ';

  @override
  String get settingsAccountLinkedGoogle => 'Google account linked';

  @override
  String get settingsAccountNotLinkedGoogle => 'Google account not linked';

  @override
  String get settingsAccountLinkGoogle => 'Link Google account';

  @override
  String get settingsAccountUnlink => 'Unlink';

  @override
  String get settingsAccountLinkedLine => 'LINE account linked';

  @override
  String get settingsAccountNotLinkedLine => 'LINE account not linked';

  @override
  String get settingsAccountLinkLine => 'Link LINE account';

  @override
  String get settingsAccountLineVerifying => 'Verifying LINE...';

  @override
  String get settingsAccountSessionsTitle => 'Signed-in devices';

  @override
  String get settingsAccountRefresh => 'Refresh';

  @override
  String get settingsAccountDeviceName => 'Device name';

  @override
  String get settingsAccountLoginTime => 'Sign-in time';

  @override
  String get settingsAccountLoginIp => 'Sign-in IP';

  @override
  String get settingsAccountActions => 'Actions';

  @override
  String get settingsAccountUnknownDevice => 'Unknown device';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (current device)';

  @override
  String get settingsAccountSignOut => 'Sign out';

  @override
  String get settingsAccountNoSessions => 'No signed-in device records';

  @override
  String get settingsAccountAuditTitle => 'Sign-in audit log';

  @override
  String get settingsAccountCountry => 'Country';

  @override
  String get settingsAccountMethod => 'Method';

  @override
  String get settingsAccountDevice => 'Device';

  @override
  String get settingsAccountAdminLogin => 'Admin sign-in';

  @override
  String get settingsAccountYes => 'Yes';

  @override
  String get settingsAccountNo => 'No';

  @override
  String get settingsAccountDeleteTitle => 'Delete account';

  @override
  String get settingsAccountDeleteDescription =>
      'After deleting your account, your transactions, accounts, stocks, Passkeys, and settings will be permanently removed and cannot be recovered.';

  @override
  String get settingsAccountDeleteButton => 'Delete my account';

  @override
  String get settingsAccountDeleteModalTitle => 'Confirm account deletion';

  @override
  String get settingsAccountDeleteModalWarning =>
      'This action will permanently delete your account and all data, including transactions, accounts, stocks, Passkeys, and settings. It cannot be recovered.';

  @override
  String get settingsAccountDeletePasswordLabel =>
      'Enter your password to confirm deletion';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return 'Enter your account email \"$email\" to confirm deletion';
  }

  @override
  String get settingsAccountDeleting => 'Deleting...';

  @override
  String get settingsAccountDeletePermanently => 'Delete account permanently';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired =>
      'Please enter your current password';

  @override
  String get settingsAccountMessagesNewPasswordRequired =>
      'Please enter a new password';

  @override
  String get settingsAccountMessagesPasswordTooShort =>
      'New password must be at least 8 characters';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      'New password must include uppercase, lowercase, number, and special character';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      'The two new password entries do not match';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      'Password set. You can now sign in with your password';

  @override
  String get settingsAccountMessagesPasswordUpdated => 'Password updated';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      'Failed to update password';

  @override
  String get settingsAccountMessagesDisplayNameRequired =>
      'Display name cannot be blank';

  @override
  String get settingsAccountMessagesDisplayNameUpdated =>
      'Display name updated';

  @override
  String get settingsAccountMessagesUpdateFailed => 'Update failed';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      'Delete this Passkey?';

  @override
  String get settingsAccountMessagesCurrencyInvalid =>
      'Currency must be a 3-letter code';

  @override
  String get settingsAccountMessagesCurrencyUpdated =>
      'Default currency updated';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      'Failed to update default currency';

  @override
  String get settingsAccountMessagesSessionLoggedOut => 'Device signed out';

  @override
  String get settingsAccountMessagesSessionLogoutFailed =>
      'Failed to sign out device';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      'This browser does not support Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Android device';

  @override
  String get settingsAccountMessagesComputerDevice => 'Computer';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'Passkey registration failed';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      'Paste a Google ID Token to simulate the link flow';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Google account linked';

  @override
  String get settingsAccountMessagesGoogleLinkFailed =>
      'Failed to link Google account';

  @override
  String get settingsAccountMessagesGoogleUnlinked => 'Google account unlinked';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'Failed to unlink Google account';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'LINE sign-in is not configured';

  @override
  String get settingsAccountMessagesLineLinkFailed =>
      'Failed to link LINE account';

  @override
  String get settingsAccountMessagesLineUnlinked => 'LINE account unlinked';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'Failed to unlink LINE account';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      'Please enter your password to confirm deletion';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      'Please enter the correct account email to confirm deletion';

  @override
  String get settingsAccountMessagesDeleteFailed => 'Failed to delete account';

  @override
  String get dashboardTitle => 'Dashboard';

  @override
  String dashboardSubtitle(Object month) {
    return 'Income, expense, category breakdown, and recent transactions for $month.';
  }

  @override
  String get dashboardUncategorized => 'Uncategorized';

  @override
  String get dashboardKpiTotalIncome => 'Total income';

  @override
  String get dashboardKpiTotalExpense => 'Total expense';

  @override
  String get dashboardKpiNet => 'Net';

  @override
  String get dashboardKpiTodayExpense => 'Today\'s expense';

  @override
  String get dashboardKpiBankAccounts => 'Bank accounts';

  @override
  String get dashboardKpiStockMarketValue => 'Stock market value';

  @override
  String get dashboardOverviewTitle => 'Monthly cash-flow overview';

  @override
  String get dashboardOverviewBalance => 'Monthly surplus';

  @override
  String get dashboardOverviewDeficit => 'Monthly deficit';

  @override
  String get dashboardOverviewIncome => 'Income';

  @override
  String get dashboardOverviewExpense => 'Expense';

  @override
  String get dashboardOverviewNet => 'Net';

  @override
  String get dashboardRatioTitle => 'Income / expense ratio';

  @override
  String get dashboardRatioIncomeShare => 'Income share';

  @override
  String get dashboardRatioExpenseShare => 'Expense share';

  @override
  String get dashboardSectionsExpenseCategories => 'Expense categories';

  @override
  String get dashboardSectionsIncomeCategories => 'Income categories';

  @override
  String get dashboardSectionsRecentTransactions => 'Recent transactions';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return 'Latest $count records';
  }

  @override
  String get dashboardEmptyNoExpense => 'No expenses this month';

  @override
  String get dashboardEmptyNoIncome => 'No income this month';

  @override
  String get dashboardEmptyNoTransactions => 'No transactions this month';

  @override
  String get dashboardTableDate => 'Date';

  @override
  String get dashboardTableCategory => 'Category';

  @override
  String get dashboardTableNote => 'Note';

  @override
  String get dashboardTableAmount => 'Amount';

  @override
  String get dashboardFiltersPreviousMonth => 'Previous month';

  @override
  String get dashboardFiltersNextMonth => 'Next month';

  @override
  String get dashboardFiltersCurrentMonth => 'This month';

  @override
  String get publicCommonBackHome => 'Back home';

  @override
  String get publicCommonPrivacy => 'Privacy Policy';

  @override
  String get publicCommonTerms => 'Terms of Service';

  @override
  String get publicCommonApiCredits => 'API usage & credits';

  @override
  String publicCommonLastUpdated(Object date) {
    return 'Last updated: $date';
  }

  @override
  String get publicCommonMetadataTitle =>
      'AssetPilot - Personal Finance Command Center';

  @override
  String get publicCommonMetadataDescription =>
      'A self-hosted, encrypted personal finance manager for expense tracking, budgets, Taiwan stock investments, and analytics.';

  @override
  String get publicCommonDatesApiCredits => 'June 11, 2026';

  @override
  String get publicCommonDatesPrivacy => 'June 17, 2026';

  @override
  String get publicCommonDatesTerms => 'June 11, 2026';

  @override
  String get publicHomeTagline => 'Personal finance command center';

  @override
  String get publicHomeLogin => 'Sign in';

  @override
  String get publicHomeRegister => 'Create account';

  @override
  String get publicHomeBadge => 'Self-hosted, encrypted data, AGPL v3';

  @override
  String get publicHomeHeadline1 => 'Your finance command center';

  @override
  String get publicHomeHeadline2 => 'clear before you sign in';

  @override
  String get publicHomeLeadBefore =>
      'Track Taiwan stocks, income and expenses, budgets, reports, and audit trails in one place. Financial data is encrypted at rest with';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      'with no cloud lock-in and no subscription dependency, so you can understand the product before signing in.';

  @override
  String get publicHomeStartUsing => 'Start using';

  @override
  String get publicHomeCreateFirst => 'Create an account first';

  @override
  String get publicHomeChipsOpenSource => 'Open source AGPL v3';

  @override
  String get publicHomeChipsEncrypted => 'Local encrypted storage';

  @override
  String get publicHomeChipsNoCloudLock => 'No external cloud lock-in';

  @override
  String get publicHomeChipsDocker => 'One-command Docker deploy';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => 'Core modules';

  @override
  String get publicHomeStatsModulesSublabel =>
      'Bookkeeping, stocks, reports, governance';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => 'Data encryption';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => 'Stock source';

  @override
  String get publicHomeStatsStockSourceSublabel =>
      'Intraday, close, fallback strategy';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => 'Precise math';

  @override
  String get publicHomeStatsPrecisionSublabel => 'decimal.js per-lot P/L';

  @override
  String get publicHomePreLoginNote =>
      'Before signing in, you can review AssetPilot features, data handling, and deployment traits, then choose whether to sign in or create an account.';

  @override
  String get publicHomeWhyLabel => 'Why AssetPilot';

  @override
  String get publicHomeWhyTitle =>
      'Daily bookkeeping, investment tracking, and data control in one place';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot is built for people who manage their own finances. It centralizes cash flow, budgets, and Taiwan stock tracking while keeping export, audit, and self-hosting options available.';

  @override
  String get publicHomePillarsFinanceTitle => 'Cash-flow and budget management';

  @override
  String get publicHomePillarsFinanceTag => 'Bookkeeping core';

  @override
  String get publicHomePillarsFinanceItemsOne =>
      'Multi-account balance tracking and transfers';

  @override
  String get publicHomePillarsFinanceItemsTwo =>
      'Monthly and category budget progress controls';

  @override
  String get publicHomePillarsFinanceItemsThree =>
      'Recurring income and expense automation';

  @override
  String get publicHomePillarsFinanceItemsFour =>
      'Batch category, date, and deletion workflows';

  @override
  String get publicHomePillarsStocksTitle => 'Taiwan stock investment tracking';

  @override
  String get publicHomePillarsStocksTag => 'Stock module';

  @override
  String get publicHomePillarsStocksItemsOne =>
      'TWSE price lookup and ex-dividend sync';

  @override
  String get publicHomePillarsStocksItemsTwo =>
      'Full-precision FIFO realized P/L';

  @override
  String get publicHomePillarsStocksItemsThree =>
      'Dividend records and account deposits';

  @override
  String get publicHomePillarsStocksItemsFour =>
      'Recurring investments and delisting flags';

  @override
  String get publicHomePillarsSecurityTitle => 'Security and data governance';

  @override
  String get publicHomePillarsSecurityTag => 'Governance';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'ChaCha20-Poly1305 encryption at rest';

  @override
  String get publicHomePillarsSecurityItemsTwo =>
      'Password, Google, and Passkey sign-in';

  @override
  String get publicHomePillarsSecurityItemsThree =>
      'Export/import, backup restore, and audit logs';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'Rate limits, CSP, and CSV injection protection';

  @override
  String get publicHomePillarsSelfHostedTitle =>
      'Self-hosted deployment and contracts';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne =>
      'One-command Docker startup';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => 'amd64 and arm64 support';

  @override
  String get publicHomePillarsSelfHostedItemsThree =>
      'OpenAPI 3.2 contract documentation';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      'URL-first routing for bookmarks and refreshes';

  @override
  String get publicHomeQuickStartLabel => 'Quick Start';

  @override
  String get publicHomeQuickStartTitle => 'Run it on your server in 60 seconds';

  @override
  String get publicHomeQuickStartDescription =>
      'Start quickly with Docker. The first run automatically creates JWT and database encryption keys. amd64 and arm64 are supported, so it fits NAS boxes, VPS hosts, and your own Docker machines.';

  @override
  String get publicHomeQuickStartChipsImage => 'Approx. 180 MB image';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => 'Built-in health check';

  @override
  String get publicHomeQuickStartChipsKeys => 'Keys generated on first startup';

  @override
  String get publicHomeTechLabel => 'Tech Stack';

  @override
  String get publicHomeTechTitle => 'Tech stack and public information';

  @override
  String get publicHomeTechDescription =>
      'Key technologies, external data sources, and licensing information are listed clearly so users understand how the service works before they start.';

  @override
  String get publicHomeFooter =>
      'GNU AGPL v3. Personal asset management that you self-host, control, and back up.';

  @override
  String get publicApiCreditsPageTitle => 'API usage & credits';

  @override
  String get publicApiCreditsPageMetadataTitle =>
      'API usage & credits — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => 'External API transparency';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot connects to external data sources only when a feature needs them. This page lists API purposes, licensing notes, and transmitted data scopes for self-hosting compliance review.';

  @override
  String get publicApiCreditsPageStatsExternalServices => 'External services';

  @override
  String get publicApiCreditsPageStatsFreeSupported => 'Free tier support';

  @override
  String get publicApiCreditsPageStatsAttributionRequired =>
      'Attribution required';

  @override
  String get publicApiCreditsPageServiceKindsData => 'Data queries';

  @override
  String get publicApiCreditsPageServiceKindsAuth => 'Authentication';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Email channels';

  @override
  String get publicApiCreditsPageServiceKindsBackup => 'Cloud backup';

  @override
  String get publicApiCreditsPageTransparencyTitle => 'Data transparency';

  @override
  String get publicApiCreditsPageTransparencyText =>
      'The scenarios below send only the minimum data needed for the feature and do not hand your financial details to third-party services.';

  @override
  String get publicApiCreditsPageMinNecessary => 'Minimum necessary data';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => 'Exchange-rate sync';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      'Only public exchange-rate data is queried. Personal financial details are not sent.';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle => 'Taiwan stock data';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      'Only stock symbols and market data are sent, not accounts, cost basis, or transaction records.';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => 'Sign-in audit';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo is used only to show country information in sign-in records.';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => 'Third-party sign-in';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google and LINE sign-in are used only when you actively sign in or link an account.';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => 'Cloud backup';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4 receives the full database backup file only when an administrator explicitly uploads a backup.';

  @override
  String get publicApiCreditsPageServiceListTitle => 'External service list';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return '$total services total. $free support a free tier, and $paid offer paid plans.';
  }

  @override
  String get publicApiCreditsPageOfficialSite => 'Official site';

  @override
  String get publicApiCreditsPageFreePlan => 'Free plan';

  @override
  String get publicApiCreditsPagePaidPlan => 'Paid plan';

  @override
  String get publicApiCreditsPageSupported => 'Supported';

  @override
  String get publicApiCreditsPageUnavailable => 'Unavailable';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'Global real-time exchange rates with TWD as the base currency';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'IP geolocation lookup for the country field in sign-in audit records';

  @override
  String get publicApiCreditsPageDescriptionsTwse =>
      'Real-time quotes, ex-dividend data, and stock-name lookup';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Google SSO sign-in';

  @override
  String get publicApiCreditsPageDescriptionsLine =>
      'LINE sign-in and account linking';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Email delivery channel for administrator asset reports via Gmail, Outlook, or another SMTP server';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Email delivery channel for administrator asset reports via HTTP REST API';

  @override
  String get publicApiCreditsPageDescriptionsResend =>
      'Email delivery channel for administrator asset reports';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      'S3-compatible object storage destination for administrator full PostgreSQL SQL backups';

  @override
  String get publicAppCallbackReturningTitle =>
      'Returning to the AssetPilot app...';

  @override
  String get publicAppCallbackReturningBody =>
      'If you are not redirected automatically, make sure the latest AssetPilot Android app is installed.';

  @override
  String get publicAppCallbackPasskeyTitle => 'AssetPilot Passkey sign-in';

  @override
  String get publicAppCallbackPasskeyStarting => 'Starting Passkey sign-in...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      'This browser does not support Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'Failed to create Passkey sign-in challenge';

  @override
  String get publicAppCallbackPasskeyVerify =>
      'Complete Passkey verification on your device...';

  @override
  String get publicAppCallbackPasskeyLoginFailed => 'Passkey sign-in failed';

  @override
  String get publicAppCallbackReturningApp => 'Returning to the app...';

  @override
  String get publicAppCallbackAppTicketFailed =>
      'Failed to create app sign-in ticket';

  @override
  String get featuresCommonActions => 'Actions';

  @override
  String get featuresCommonAccount => 'Account';

  @override
  String get featuresCommonAmount => 'Amount';

  @override
  String get featuresCommonDate => 'Date';

  @override
  String get featuresCommonEndDate => 'End';

  @override
  String get featuresCommonNote => 'Note';

  @override
  String get featuresCommonStartDate => 'Start';

  @override
  String get featuresCommonStatus => 'Status';

  @override
  String get featuresCommonStock => 'Stock';

  @override
  String get featuresCommonType => 'Type';

  @override
  String get featuresCommonName => 'Name';

  @override
  String get featuresCommonCurrency => 'Currency';

  @override
  String get featuresCommonExchangeRate => 'Exchange rate';

  @override
  String get featuresCommonIncome => 'Income';

  @override
  String get featuresCommonExpense => 'Expense';

  @override
  String get featuresCommonUncategorized => 'Uncategorized';

  @override
  String get featuresCommonUnspecified => 'Unspecified';

  @override
  String get featuresCommonAutoCalculate => 'Auto-calculate';

  @override
  String get featuresCommonExcludeFromStats => 'Exclude from stats';

  @override
  String get featuresCommonTopLevelCategory => '- Top-level category -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => 'Category management';

  @override
  String get featuresCategoriesExpenseTab => 'Expense categories';

  @override
  String get featuresCategoriesIncomeTab => 'Income categories';

  @override
  String get featuresCategoriesAddCategory => 'Add category';

  @override
  String get featuresCategoriesEditCategory => 'Edit category';

  @override
  String get featuresCategoriesNewCategory => 'Add category';

  @override
  String get featuresCategoriesNameLabel => 'Name *';

  @override
  String get featuresCategoriesTypeLabel => 'Type';

  @override
  String get featuresCategoriesParentLabel => 'Parent category';

  @override
  String get featuresCategoriesColorLabel => 'Color';

  @override
  String get featuresCategoriesExpense => 'Expense';

  @override
  String get featuresCategoriesIncome => 'Income';

  @override
  String get featuresCategoriesDeleteMessage =>
      'Delete this category? Its child categories will also be deleted.';

  @override
  String get featuresCategoriesMessagesNameRequired =>
      'Please enter a category name';

  @override
  String get featuresCategoriesMessagesDeleteFailed => 'Failed to delete';

  @override
  String get featuresBudgetTitle => 'Budget management';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$month $year';
  }

  @override
  String get featuresBudgetTotalBudget => 'Total budget this month';

  @override
  String get featuresBudgetSpent => 'Spent';

  @override
  String get featuresBudgetAddBudget => 'Add budget';

  @override
  String get featuresBudgetEditBudget => 'Edit budget';

  @override
  String get featuresBudgetNewBudget => 'Add budget';

  @override
  String get featuresBudgetCategoryLabel => 'Category (blank for total budget)';

  @override
  String get featuresBudgetTotalBudgetOption => '- Total budget -';

  @override
  String get featuresBudgetAmountLabel => 'Budget amount *';

  @override
  String get featuresBudgetTotalBudgetName => '(Total budget)';

  @override
  String get featuresBudgetOverBudget => 'Over budget';

  @override
  String get featuresBudgetDeleteMessage => 'Delete this budget setting?';

  @override
  String get featuresBudgetMessagesAmountRequired =>
      'Please enter a valid budget amount';

  @override
  String get featuresReportsTitle => 'Reports';

  @override
  String get featuresReportsTabsCategory => 'Category breakdown';

  @override
  String get featuresReportsTabsTrend => 'Trend analysis';

  @override
  String get featuresReportsTabsDaily => 'Daily spending';

  @override
  String get featuresReportsPeriodsThisMonth => 'This month';

  @override
  String get featuresReportsPeriodsLastMonth => 'Last month';

  @override
  String get featuresReportsPeriodsLast3 => 'Last 3 months';

  @override
  String get featuresReportsPeriodsLast6 => 'Last 6 months';

  @override
  String get featuresReportsPeriodsThisYear => 'This year';

  @override
  String get featuresReportsPeriodsCustom => 'Custom';

  @override
  String get featuresReportsPeriodLabel => 'Period';

  @override
  String get featuresReportsStart => 'Start';

  @override
  String get featuresReportsEnd => 'End';

  @override
  String get featuresReportsCurrentTotal => 'Current total';

  @override
  String get featuresReportsComparedPrevious => 'Compared with previous period';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta, no previous data';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return '$type details';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return 'Total: $amount';
  }

  @override
  String get featuresReportsSelectedCategory => 'Selected category: ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return ', amount $amount';
  }

  @override
  String get featuresReportsViewTransactions => 'View matching transactions';

  @override
  String get featuresRecurringTitle => 'Recurring income / expenses';

  @override
  String get featuresRecurringAdd => 'Add recurring item';

  @override
  String get featuresRecurringEdit => 'Edit recurring item';

  @override
  String get featuresRecurringCreate => 'Add recurring item';

  @override
  String get featuresRecurringAmountLabel => 'Amount *';

  @override
  String get featuresRecurringFxFeeLabel => 'Overseas fee (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder =>
      'Blank means the system auto-calculates from the card fee rate';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return 'Card overseas fee rate $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return ', suggested NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading =>
      'Fetching latest exchange rate...';

  @override
  String get featuresRecurringCategory => 'Category';

  @override
  String get featuresRecurringFrequency => 'Frequency';

  @override
  String get featuresRecurringStartDate => 'Start date';

  @override
  String featuresRecurringNextRun(Object date) {
    return 'Next run: $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return 'Category: $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return 'Account: $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return 'Overseas fee: NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage =>
      'Delete this recurring item setting?';

  @override
  String get featuresRecurringCreatingTransfer => 'Creating...';

  @override
  String get featuresRecurringConfirmTransfer => 'Confirm transfer';

  @override
  String get featuresRecurringFrequencyLabelsDaily => 'Daily';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => 'Weekly';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => 'Monthly';

  @override
  String get featuresRecurringFrequencyLabelsYearly => 'Yearly';

  @override
  String get featuresRecurringMessagesAmountRequired =>
      'Please enter a valid amount';

  @override
  String get featuresDataTransferTitle => 'Export / Import';

  @override
  String get featuresDataTransferExportStartDate => 'Export start date';

  @override
  String get featuresDataTransferExportEndDate => 'Export end date';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'Supports CSV export and import. Columns: $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'Export CSV';

  @override
  String get featuresDataTransferExporting => 'Exporting...';

  @override
  String get featuresDataTransferChooseCsv => 'Choose CSV to import';

  @override
  String get featuresDataTransferImporting => 'Importing...';

  @override
  String featuresDataTransferImported(Object count) {
    return 'Imported: $count records';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return 'Skipped: $count records';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return 'Created categories: $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return 'Created accounts: $items';
  }

  @override
  String get featuresDataTransferWarning => 'Warning';

  @override
  String get featuresDataTransferError => 'Error';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return 'Row $row: $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => 'Accounts';

  @override
  String get featuresDataTransferModulesTransactions => 'Transactions';

  @override
  String get featuresDataTransferModulesCategories => 'Categories';

  @override
  String get featuresDataTransferModulesStockTransactions =>
      'Stock transactions';

  @override
  String get featuresDataTransferModulesStockDividends => 'Dividends';

  @override
  String get featuresDataTransferMessagesExportSuccess => 'Export complete';

  @override
  String get featuresDataTransferMessagesExportFailed => 'Export failed';

  @override
  String get featuresDataTransferMessagesEmptyCsv =>
      'CSV has no importable rows';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return '$name import complete';
  }

  @override
  String get featuresDataTransferMessagesImportFailed => 'Import failed';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      'Full backup downloaded';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      'Full backup download failed';

  @override
  String get featuresDataTransferMessagesRestoreDone => 'Restore complete';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      'Backup restore failed';

  @override
  String get featuresDataTransferMessagesDbExportDone =>
      'Database backup downloaded';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      'Database backup failed';

  @override
  String get featuresDataTransferMessagesDbRestoreDone =>
      'Database restore complete';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      'Database restore failed';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return 'Uploaded to $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed =>
      'MEGA S4 backup failed';

  @override
  String get featuresDataTransferMessagesRequireOneField =>
      'Fill in at least one field';

  @override
  String get featuresDataTransferMessagesSaved => 'Settings saved';

  @override
  String get featuresDataTransferMessagesSaveFailed =>
      'Failed to save settings';

  @override
  String get featuresDataTransferBundleTitle =>
      'Full data backup (including images)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      'Download all of your personal data, including transactions, accounts, categories, budgets, recurring items, exchange rates, stocks, and receipt images, as one ZIP.';

  @override
  String get featuresDataTransferBundleDescription2 =>
      'Upload the same ZIP to restore it.';

  @override
  String get featuresDataTransferBundleRestorePrefix => 'Restore uses ';

  @override
  String get featuresDataTransferBundleMergeMode => 'merge mode';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      ': existing data is skipped automatically and only missing data is added; ';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      'your current data will not be deleted or overwritten';

  @override
  String get featuresDataTransferBundleDownload => 'Download full backup';

  @override
  String get featuresDataTransferBundleDownloading => 'Preparing download...';

  @override
  String get featuresDataTransferBundleRestore => 'Upload backup to restore';

  @override
  String get featuresDataTransferBundleRestoring => 'Restoring...';

  @override
  String get featuresDataTransferDatabaseTitle =>
      'Full database backup / restore';

  @override
  String get featuresDataTransferDatabaseDescription =>
      'Admins only. SQLite mode downloads a `.db` backup; PostgreSQL mode downloads a `.sql` backup. Upload the matching format when restoring.';

  @override
  String get featuresDataTransferDatabaseDownload => 'Download database backup';

  @override
  String get featuresDataTransferDatabaseDownloading => 'Downloading...';

  @override
  String get featuresDataTransferDatabaseRestore => 'Choose backup to restore';

  @override
  String get featuresDataTransferDatabaseRestoring => 'Restoring...';

  @override
  String get featuresDataTransferMegaTitle => 'MEGA S4 cloud backup';

  @override
  String get featuresDataTransferMegaDescription =>
      'Upload the current full SQLite backup to a MEGA S4 bucket as an object. Connection details are configured through server environment variables and keys are never entered or shown in the browser.';

  @override
  String get featuresDataTransferMegaState => 'Status: ';

  @override
  String get featuresDataTransferMegaConfigured => 'Configured';

  @override
  String get featuresDataTransferMegaNotConfigured => 'Not fully configured';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket: ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return 'Missing environment variables: $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'Upload backup to MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => 'Uploading...';

  @override
  String get featuresDataTransferMegaConfigure => 'Configure';

  @override
  String get featuresDataTransferMegaCancelConfigure => 'Cancel configuration';

  @override
  String get featuresDataTransferMegaFormHelp =>
      'Settings are written to the server persisted config and take effect immediately. Key fields must be re-entered and are not prefilled.';

  @override
  String get featuresDataTransferMegaBucketName => 'Bucket name';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefix (optional)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (optional, auto-derived when blank)';

  @override
  String get featuresDataTransferMegaSaveSettings => 'Save settings';

  @override
  String get featuresAccountsTitle => 'Account management';

  @override
  String get featuresAccountsTypeLabelsBank => 'Bank account';

  @override
  String get featuresAccountsTypeLabelsCredit_card => 'Credit card';

  @override
  String get featuresAccountsTypeLabelsCash => 'Cash';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => 'Digital wallet';

  @override
  String get featuresAccountsTypeLabelsOther => 'Other';

  @override
  String get featuresAccountsTotalAssets => 'Total assets';

  @override
  String get featuresAccountsCreditOutstanding => 'Credit card outstanding';

  @override
  String get featuresAccountsAddAccount => 'Add account';

  @override
  String get featuresAccountsEditAccount => 'Edit account';

  @override
  String get featuresAccountsNewAccount => 'Add account';

  @override
  String get featuresAccountsAccountName => 'Account name *';

  @override
  String get featuresAccountsInitialBalance => 'Initial balance';

  @override
  String get featuresAccountsInitialBalanceEdit =>
      'Initial balance / current setting';

  @override
  String get featuresAccountsLinkedBank => 'Bank';

  @override
  String get featuresAccountsUngrouped => 'Ungrouped';

  @override
  String get featuresAccountsOverseasFeeRate => 'Overseas fee rate (%)';

  @override
  String get featuresAccountsStatementClosingDay =>
      'Statement closing day (day of month, 1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      'Example: 15. Leave blank to skip current-cycle spending.';

  @override
  String get featuresAccountsExcludeFromTotal => 'Exclude from total assets';

  @override
  String get featuresAccountsOtherAccounts => 'Other accounts';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return 'Converted total: $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return 'Linked bank: $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return 'Overseas fee rate: $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return 'Monthly closing day: $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return 'Current-cycle spending: $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => 'Previous statement: ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return 'Spending $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return 'Paid $amount';
  }

  @override
  String get featuresAccountsViewCycles => 'View cycle details ›';

  @override
  String get featuresAccountsRepaymentTitle => 'Credit card repayment';

  @override
  String get featuresAccountsRepaymentPaymentAccount => 'Payment account';

  @override
  String get featuresAccountsRepaymentPaymentDate => 'Repayment date';

  @override
  String get featuresAccountsRepaymentNoLinkedCards =>
      'This bank has no linked credit cards';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return 'Current balance: $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => 'Repayment amount';

  @override
  String get featuresAccountsRepaymentConfirm => 'Confirm repayment';

  @override
  String get featuresAccountsDeleteMessage => 'Delete this account?';

  @override
  String get featuresAccountsCyclesTitle => 'Statement cycle details';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name monthly closing day $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      'Payments are mapped back to the statement they settled. Amounts paid after a closing date count toward that statement cycle.';

  @override
  String get featuresAccountsCyclesPeriod => 'Period';

  @override
  String get featuresAccountsCyclesSpending => 'Spending';

  @override
  String get featuresAccountsCyclesPayment => 'Actual payment';

  @override
  String get featuresAccountsCyclesCurrent => 'Current';

  @override
  String get featuresAccountsFxTitle => 'Exchange-rate management';

  @override
  String get featuresAccountsFxAutoUpdate => 'Auto-update rates';

  @override
  String get featuresAccountsFxSyncNow => 'Sync now';

  @override
  String get featuresAccountsFxSyncing => 'Syncing...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return 'Last synced: $date';
  }

  @override
  String get featuresAccountsFxCurrency => 'Currency';

  @override
  String get featuresAccountsFxUnitToTwd => '1 unit = TWD';

  @override
  String get featuresAccountsFxEmpty =>
      'No foreign exchange rates configured yet';

  @override
  String get featuresAccountsFxCurrencyLabel => 'Currency (e.g. USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'Rate to TWD';

  @override
  String get featuresAccountsFxAddOrUpdate => 'Add / Update';

  @override
  String get featuresAccountsMessagesNameRequired =>
      'Please enter an account name';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired =>
      'Please select a payment account';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      'Enter a repayment amount for at least one credit card';

  @override
  String get featuresAccountsMessagesCurrencyInvalid =>
      'Currency must be a 3-letter code';

  @override
  String get featuresAccountsMessagesRateInvalid =>
      'Please enter a valid exchange rate';

  @override
  String get featuresAccountsMessagesSaved => 'Saved';

  @override
  String get featuresAccountsMessagesSaveFailed => 'Failed to save';

  @override
  String get featuresAccountsMessagesDeleteFailed => 'Failed to delete';

  @override
  String get featuresAccountsMessagesRatesUpdated => 'Exchange rates updated';

  @override
  String get featuresAccountsMessagesSyncFailed => 'Sync failed';

  @override
  String get featuresAccountsMessagesLoadFailed => 'Failed to load';

  @override
  String get featuresTransactionsTitle => 'Transactions';

  @override
  String get featuresTransactionsSearchPlaceholder => 'Search notes...';

  @override
  String get featuresTransactionsAllTypes => 'All types';

  @override
  String get featuresTransactionsAllAccounts => 'All accounts';

  @override
  String get featuresTransactionsAllCategories => 'All categories';

  @override
  String get featuresTransactionsTransfer => 'Transfer';

  @override
  String get featuresTransactionsFuture => 'Future transactions';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (all)';
  }

  @override
  String get featuresTransactionsStartDateTitle => 'Start date';

  @override
  String get featuresTransactionsEndDateTitle => 'End date';

  @override
  String get featuresTransactionsAdd => 'Add transaction';

  @override
  String get featuresTransactionsEdit => 'Edit transaction';

  @override
  String get featuresTransactionsCreate => 'Add transaction';

  @override
  String get featuresTransactionsAccountTransfer => 'Account transfer';

  @override
  String get featuresTransactionsBatchCategory => 'Batch change category';

  @override
  String get featuresTransactionsBatchDate => 'Batch change date';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return 'Delete selected ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => 'Page income';

  @override
  String get featuresTransactionsPageExpense => 'Page expense';

  @override
  String get featuresTransactionsPageTotal => 'Page total';

  @override
  String get featuresTransactionsPageSummaryAria => 'Page transaction summary';

  @override
  String get featuresTransactionsEmpty => 'No matching transactions';

  @override
  String featuresTransactionsSource(Object name) {
    return 'Source: $name';
  }

  @override
  String get featuresTransactionsFxFee => 'Overseas card fee';

  @override
  String get featuresTransactionsPhotoOne => 'Photo 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count photos';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => 'Date *';

  @override
  String get featuresTransactionsAmountRequiredLabel => 'Amount *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return 'Exchange rate (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder =>
      'Blank means use the system exchange rate';

  @override
  String get featuresTransactionsLatestRateLoading =>
      'Fetching latest exchange rate...';

  @override
  String get featuresTransactionsFxFeePlaceholder =>
      'Blank means the system auto-calculates from the card fee rate';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return 'Card overseas fee rate $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return ', suggested NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => 'Photos';

  @override
  String get featuresTransactionsLoadingPhotos => 'Loading photos...';

  @override
  String get featuresTransactionsTakePhoto => 'Take photo';

  @override
  String get featuresTransactionsChooseImage => 'Choose image';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return 'On mobile, take a photo directly or choose from your gallery. Up to 5 images, $maxMb MB each.';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return 'New photos $count';
  }

  @override
  String get featuresTransactionsRemove => 'Remove';

  @override
  String get featuresTransactionsChoosePhoto => 'Choose photo';

  @override
  String get featuresTransactionsTransferOut => 'From account *';

  @override
  String get featuresTransactionsTransferIn => 'To account *';

  @override
  String get featuresTransactionsSelectPlaceholder => 'Select';

  @override
  String get featuresTransactionsCreating => 'Creating...';

  @override
  String get featuresTransactionsConfirmTransfer => 'Confirm transfer';

  @override
  String get featuresTransactionsBatchCategoryTitle => 'Batch change category';

  @override
  String get featuresTransactionsBatchDateTitle => 'Batch change date';

  @override
  String get featuresTransactionsNewCategory => 'New category';

  @override
  String get featuresTransactionsNewDate => 'New date';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return 'Apply to $count records';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      'Delete this transaction record? This action cannot be undone.';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return 'Delete the selected $count transactions?';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return 'Transaction updated, but $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return 'Transaction created, but $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      'Transfer transactions must be deleted and recreated';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      'Overseas card fees are generated automatically. Edit the related foreign-currency transaction instead; the fee will sync after changes.';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed =>
      'Photo upload failed';

  @override
  String get featuresTransactionsMessagesDateRequired => 'Please select a date';

  @override
  String get featuresTransactionsMessagesAmountRequired =>
      'Please enter a valid amount';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      'Please select the source and destination accounts';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      'Source and destination accounts cannot be the same';

  @override
  String get featuresTransactionsTypeLabelsIncome => 'Income';

  @override
  String get featuresTransactionsTypeLabelsExpense => 'Expense';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => 'Transfer in';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => 'Transfer out';

  @override
  String get featuresStocksTabsPortfolio => 'Portfolio';

  @override
  String get featuresStocksTabsTransactions => 'Transactions';

  @override
  String get featuresStocksTabsDividends => 'Dividends';

  @override
  String get featuresStocksTabsRealized => 'Realized P/L';

  @override
  String get featuresStocksTabsSettings => 'Trading settings';

  @override
  String get featuresStocksCommonStockLabel => 'Stock';

  @override
  String get featuresStocksCommonStockRequired => 'Stock *';

  @override
  String get featuresStocksCommonStockTypeStock => 'Stock';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => 'Warrant';

  @override
  String get featuresStocksCommonDate => 'Date';

  @override
  String get featuresStocksCommonShares => 'Shares';

  @override
  String get featuresStocksCommonPrice => 'Price';

  @override
  String get featuresStocksCommonTotal => 'Total';

  @override
  String get featuresStocksCommonReturnRate => 'Return';

  @override
  String get featuresStocksCommonOverallReturnRate => 'Overall return';

  @override
  String get featuresStocksCommonEstimatedPL => 'Estimated P/L';

  @override
  String get featuresStocksCommonRealizedPL => 'Realized P/L';

  @override
  String get featuresStocksCommonTotalRealizedPL => 'Total realized P/L';

  @override
  String get featuresStocksCommonYearRealizedPL => 'Realized P/L this year';

  @override
  String get featuresStocksCommonRealizedCount => 'Realized records';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count records';
  }

  @override
  String get featuresStocksCommonSellAverage => 'Avg sell price';

  @override
  String get featuresStocksCommonCostAverage => 'Avg cost';

  @override
  String get featuresStocksCommonFeeAndTax => 'Fees + tax';

  @override
  String get featuresStocksCommonCashDividend => 'Cash dividend';

  @override
  String get featuresStocksCommonStockDividend => 'Stock dividend';

  @override
  String get featuresStocksCommonStockSymbol => 'Stock symbol *';

  @override
  String get featuresStocksCommonStockName => 'Stock name';

  @override
  String get featuresStocksCommonSearching => 'Searching...';

  @override
  String get featuresStocksCommonCancelAccounting =>
      '- Do not deposit (stock dividend only) -';

  @override
  String get featuresStocksCommonAutoCalculate => 'Auto-calculate';

  @override
  String get featuresStocksCommonBuy => 'Buy';

  @override
  String get featuresStocksCommonSell => 'Sell';

  @override
  String get featuresStocksPortfolioTitle => 'Portfolio';

  @override
  String get featuresStocksPortfolioTotalMarketValue => 'Total market value';

  @override
  String get featuresStocksPortfolioTotalCost => 'Total invested cost';

  @override
  String get featuresStocksPortfolioTotalDividend => 'Total dividends';

  @override
  String get featuresStocksPortfolioAddStock => 'Add stock';

  @override
  String get featuresStocksPortfolioEditStock => 'Edit stock';

  @override
  String get featuresStocksPortfolioNewStock => 'Add stock';

  @override
  String get featuresStocksPortfolioUpdatePrices => 'Update prices';

  @override
  String get featuresStocksPortfolioBatchUpdate => 'Batch auto update';

  @override
  String get featuresStocksPortfolioUpdating => 'Updating...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'AssetPilot first queries the public TWSE API from your browser. If the browser request is blocked, it falls back to the signed-in user API proxy and updates your holdings.';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return 'Update complete: $updated succeeded.';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return 'Update complete: $updated succeeded, $failed failed.';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      'Unable to retrieve TWSE market data from the browser';

  @override
  String get featuresStocksPortfolioHeldShares => 'Held shares';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count shares';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => 'Current price';

  @override
  String get featuresStocksPortfolioMarketValue => 'Market value';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired =>
      'Please enter a stock symbol';

  @override
  String get featuresStocksTransactionsTitle => 'Stock transactions';

  @override
  String get featuresStocksTransactionsAddTransaction => 'Add transaction';

  @override
  String get featuresStocksTransactionsEditTransaction => 'Edit transaction';

  @override
  String get featuresStocksTransactionsNewTransaction => 'Add transaction';

  @override
  String get featuresStocksTransactionsTypeLabel => 'Type';

  @override
  String get featuresStocksTransactionsDateLabel => 'Date *';

  @override
  String get featuresStocksTransactionsSharesLabel => 'Shares *';

  @override
  String get featuresStocksTransactionsPriceLabel => 'Price *';

  @override
  String get featuresStocksTransactionsFeeLabel => 'Fee';

  @override
  String get featuresStocksTransactionsTaxLabel => 'Transaction tax';

  @override
  String get featuresStocksTransactionsDeleteMessage =>
      'Delete this transaction record?';

  @override
  String get featuresStocksTransactionsMessagesStockRequired =>
      'Please select a stock';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      'Please enter a valid share count';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired =>
      'Please enter a valid price';

  @override
  String get featuresStocksDividendsTitle => 'Dividends';

  @override
  String get featuresStocksDividendsAddDividend => 'Add dividend';

  @override
  String get featuresStocksDividendsEditDividend => 'Edit dividend';

  @override
  String get featuresStocksDividendsNewDividend => 'Add dividend';

  @override
  String get featuresStocksDividendsSyncExDividends => 'Sync ex-dividends';

  @override
  String get featuresStocksDividendsSyncDescription =>
      'Automatically sync historical ex-dividend data from TWSE based on your holdings.';

  @override
  String get featuresStocksDividendsSyncStart => 'Start sync';

  @override
  String get featuresStocksDividendsSyncing => 'Syncing...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return 'Added $synced, skipped $skipped.';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return 'Added $synced, skipped $skipped, $failed failed.';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel => 'Cash dividend (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel =>
      'Stock dividend (shares)';

  @override
  String get featuresStocksDividendsDepositAccount => 'Deposit account';

  @override
  String get featuresStocksDividendsDeleteMessage =>
      'Delete this dividend record?';

  @override
  String get featuresStocksDividendsMessagesStockRequired =>
      'Please select a stock';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      'Please enter a cash dividend or stock dividend';

  @override
  String get featuresStocksRealizedTitle => 'Realized P/L';

  @override
  String get featuresStocksSettingsTitle => 'Trading settings';

  @override
  String get featuresStocksSettingsFeeTitle => 'Fee / transaction tax settings';

  @override
  String get featuresStocksSettingsFeeRate => 'Fee rate';

  @override
  String get featuresStocksSettingsFeeDiscount => 'Discount (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot => 'Minimum fee (round lot)';

  @override
  String get featuresStocksSettingsFeeMinOdd => 'Minimum fee (odd lot)';

  @override
  String get featuresStocksSettingsSellTaxRateStock => 'Sell tax rate (stock)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => 'Sell tax rate (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant =>
      'Sell tax rate (warrant)';

  @override
  String get featuresStocksSettingsSellTaxMin => 'Minimum transaction tax';

  @override
  String get featuresStocksSettingsSaveSettings => 'Save settings';

  @override
  String get featuresStocksSettingsStockStatusTitle =>
      'Stock status management';

  @override
  String get featuresStocksSettingsCurrentPrice => 'Current price';

  @override
  String get featuresStocksSettingsNormalTracking => 'Tracking';

  @override
  String get featuresStocksSettingsDelisted => 'Delisted';

  @override
  String get featuresStocksSettingsRestoreTracking => 'Restore tracking';

  @override
  String get featuresStocksSettingsMarkDelisted => 'Mark delisted';

  @override
  String get featuresStocksSettingsRecurringTitle =>
      'Recurring stock investment';

  @override
  String get featuresStocksSettingsAddRecurringShort => 'Add';

  @override
  String get featuresStocksSettingsEditRecurring => 'Edit recurring investment';

  @override
  String get featuresStocksSettingsNewRecurring => 'Add recurring investment';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => 'Amount (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => 'Frequency';

  @override
  String get featuresStocksSettingsStartDate => 'Start date';

  @override
  String get featuresStocksSettingsLastGenerated => 'Last generated';

  @override
  String get featuresStocksSettingsActive => 'Active';

  @override
  String get featuresStocksSettingsInactive => 'Inactive';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm =>
      'Delete this recurring investment setting?';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => 'Daily';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => 'Weekly';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => 'Monthly';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => 'Yearly';

  @override
  String get featuresStocksSettingsMessagesSaved => 'Settings saved';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return 'Failed to save: $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired =>
      'Please select a stock';

  @override
  String get featuresStocksSettingsMessagesAmountRequired =>
      'Please enter a valid amount';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol has been $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus =>
      'restored to normal tracking';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus => 'marked delisted';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      'Failed to update delisted status';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => 'Daily cash-flow report';

  @override
  String get notificationsReportTypeWeekly => 'Weekly cash-flow report';

  @override
  String get notificationsReportTypeMonthly => 'Monthly cash-flow report';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return 'Daily cash-flow report｜$date (Wk $weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return 'Weekly cash-flow report｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return 'Monthly cash-flow report｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name, cash flow for $date (Wk $weekday)';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name, cash flow for $start ~ $end';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name, cash flow for $month';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 Report date $date　·　Sent $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 Report range $start ~ $end　·　Sent $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 Report month $month　·　Sent $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return 'Summary of yesterday ($date Wk $weekday); sent today ($sendDate)';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return 'Summary of the past 7 days ($start ~ $end); sent today ($sendDate)';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return 'Summary of last month ($month, $start ~ $end); sent this month ($sendDate)';
  }

  @override
  String get notificationsLeadDaily => 'Yesterday';

  @override
  String get notificationsLeadWeekly => 'This week';

  @override
  String get notificationsLeadMonthly => 'Last month';

  @override
  String notificationsKpiIncome(Object lead) {
    return '$lead income';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return '$lead expense';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return '$lead net';
  }

  @override
  String get notificationsCompareLabelDaily => 'vs. prev. day';

  @override
  String get notificationsCompareLabelWeekly => 'vs. prev. week';

  @override
  String get notificationsCompareLabelMonthly => 'vs. prev. month';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return 'yesterday ($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return 'the past 7 days ($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return 'last month ($month)';
  }

  @override
  String get notificationsSectionsBalance => 'Account balances';

  @override
  String get notificationsSectionsTopCategories => 'Top 5 expenses this month';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return 'Top 5 expenses in $month';
  }

  @override
  String get notificationsSectionsDailyDetail => 'Daily breakdown';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return 'Month-to-date ($month)';
  }

  @override
  String get notificationsSectionsStock => 'Stock investments';

  @override
  String get notificationsSectionsRecentDaily => 'Yesterday\'s transactions';

  @override
  String get notificationsSectionsRecentWeekly => 'This week\'s transactions';

  @override
  String get notificationsSectionsRecentMonthly => 'Last month\'s transactions';

  @override
  String get notificationsLabelsIncome => 'Income';

  @override
  String get notificationsLabelsExpense => 'Expense';

  @override
  String get notificationsLabelsNet => 'Net';

  @override
  String get notificationsLabelsCost => 'Total cost';

  @override
  String get notificationsLabelsMarketValue => 'Market value';

  @override
  String get notificationsLabelsUnrealizedPL => 'Unrealized P/L';

  @override
  String get notificationsLabelsReturnRate => 'Return';

  @override
  String get notificationsLabelsUncategorized => 'Uncategorized';

  @override
  String get notificationsTableDate => 'Date';

  @override
  String get notificationsEmptyNoAccount => 'No accounts yet';

  @override
  String get notificationsEmptyNoExpense => 'No expenses yet';

  @override
  String notificationsEmptyNoTx(Object label) {
    return 'No transactions for $label';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return 'Stocks: market value $marketValue, unrealized P/L $pl';
  }

  @override
  String get notificationsCtaViewFullReport => 'View full report';

  @override
  String get notificationsCtaViewLineRecord => 'View LINE records';

  @override
  String get notificationsReminderAltText => 'Expense reminder';

  @override
  String get notificationsReminderTitle =>
      'Don\'t forget to log today\'s expenses';

  @override
  String notificationsReminderBody(Object name) {
    return '$name, take 10 seconds to log today\'s expenses so nothing slips by month-end.';
  }

  @override
  String get notificationsReminderHint =>
      'Tap Add expense, then type: amount note date (date optional)';

  @override
  String get notificationsReminderFallbackName => 'there';

  @override
  String get notificationsReminderAddExpense => 'Add expense';

  @override
  String get notificationsReminderViewToday => 'View today\'s records';

  @override
  String get notificationsFallbackUser => 'User';

  @override
  String get mobileLegacyMessagebde18a20 => '・不計入總資產';

  @override
  String get mobileLegacyNoneCreateAsParent => '(None — create as parent)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      'Home shows monthly income, expenses, net cash flow, and spending categories. Swipe between months to see where your money goes.';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      'Payments are assigned to the statement they settle, including payments made in the following period.';

  @override
  String get mobileLegacy0NoPayment => '0 = no payment';

  @override
  String get mobileLegacyMon => 'Mon';

  @override
  String get mobileLegacyStock => 'Stock';

  @override
  String get mobileLegacyStocks => 'Stocks (%)';

  @override
  String get mobileLegacyTue => 'Tue';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      'Deposit account (required for cash dividends)';

  @override
  String get mobileLegacyWed => 'Wed';

  @override
  String get mobileLegacyPreviousStatement => 'Previous statement ';

  @override
  String get mobileLegacyNext => 'Next';

  @override
  String get mobileLegacyDelisted => 'Delisted';

  @override
  String get mobileLegacySubcategory => 'Subcategory';

  @override
  String get mobileLegacyDeleted => 'Deleted';

  @override
  String get mobileLegacyUpdated => 'Updated';

  @override
  String get mobileLegacyLinked => 'Linked';

  @override
  String get mobileLegacyUnlinked => 'Unlinked';

  @override
  String get mobileLegacyTotalRealizedPL => 'Total realized P/L';

  @override
  String get mobileLegacyFri => 'Fri';

  @override
  String get mobileLegacyStandardRate01 => 'Standard rate: 0.1%';

  @override
  String get mobileLegacyStandardRate03 => 'Standard rate: 0.3%';

  @override
  String get mobileLegacySat => 'Sat';

  @override
  String get mobileLegacyCategoryName => 'Category name';

  @override
  String get mobileLegacyFeeOptional => 'Fee (optional)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      'Leave fee and tax blank to calculate them automatically';

  @override
  String get mobileLegacyCommissionRate => 'Commission rate (%)';

  @override
  String get mobileLegacyDay => 'Day';

  @override
  String get mobileLegacyMonthlyBudget => 'Monthly budget';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      'Parent category (none creates a parent)';

  @override
  String get mobileLegacyTheme => 'Theme';

  @override
  String get mobileLegacyThu => 'Thu';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => 'Unknown category';

  @override
  String get mobileLegacyNotLinked => 'Not linked';

  @override
  String get mobileLegacyNoTransactionsThisMonth =>
      'No transactions this month';

  @override
  String get mobileLegacyNoBudgetThisMonth => 'No budget this month';

  @override
  String get mobileLegacyNetThisMonth => 'Net this month';

  @override
  String get mobileLegacyPositiveWholeNumber => 'Positive whole number';

  @override
  String get mobileLegacyDeletePermanently => 'Delete permanently';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      'Permanently delete your account and all data';

  @override
  String get mobileLegacyNoReleaseNotesAvailable =>
      'No release notes available';

  @override
  String get mobileLegacyCurrentDevice => 'Current device';

  @override
  String get mobileLegacyTransactions => 'Transactions';

  @override
  String get mobileLegacyAll => 'All';

  @override
  String get mobileLegacyAllCategories => 'All categories';

  @override
  String get mobileLegacyAllAccounts => 'All accounts';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      'Payment amount for each card (in card currency)';

  @override
  String get mobileLegacySyncDividends => 'Sync dividends';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      'Name (optional; filled automatically)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      'Add a ticker such as 2330 on the Stocks tab to track prices, unrealized and realized returns, and automatically sync dividends.';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      'Tap + on the Transactions tab to add income or expenses. Multiple currencies and account transfers are supported. Swipe left to delete or tap to edit.';

  @override
  String get mobileLegacyNoDataForThisPeriod => 'No data for this period';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      'This permanently deletes your account and all data, including transactions, accounts, stocks, and settings. This cannot be undone.';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      'Customize scheduled cash-flow reports';

  @override
  String get mobileLegacyAutomatic => 'Automatic';

  @override
  String get mobileLegacyAtLeast8Characters => 'At least 8 characters';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      'At least 8 characters with uppercase, lowercase, numbers, and symbols';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      'Your personal finance companion for transactions, budgets, Taiwan stocks, and reports. Take a minute to see the essentials.';

  @override
  String get mobileLegacyDeletePasskey => 'Delete passkey';

  @override
  String get mobileLegacyDeleteCategory => 'Delete category';

  @override
  String get mobileLegacyDeleteTransaction => 'Delete transaction';

  @override
  String get mobileLegacyDeleteDividend => 'Delete dividend';

  @override
  String get mobileLegacyDeleteStock => 'Delete stock';

  @override
  String get mobileLegacyDeleteAccount => 'Delete account';

  @override
  String get mobileLegacyDeleteSchedule => 'Delete schedule';

  @override
  String get mobileLegacyDeletePhoto => 'Delete photo';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      'A deposit account is required for cash dividends';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters =>
      'No transactions match these filters';

  @override
  String get mobileLegacyDiscount01 => 'Discount (0–1)';

  @override
  String get mobileLegacyImproved => 'Improved';

  @override
  String get mobileLegacyMore => 'More';

  @override
  String get mobileLegacyUpdatedd9db02d0 => 'Updated';

  @override
  String get mobileLegacyLastDayOfEachMonth => 'Last day of each month';

  @override
  String get mobileLegacyNoPricesToUpdate => 'No prices to update';

  @override
  String get mobileLegacyNoNewDividendsToSync => 'No new dividends to sync';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      'Signed out and cleared the local session';

  @override
  String get mobileLegacyGettingStarted => 'Getting started';

  @override
  String get mobileLegacyExample06MeansA40Discount =>
      'Example: 0.6 means a 40% discount';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      'Example: 1.5 means 1.5%; fees are calculated automatically for foreign purchases';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      'Use More to set monthly budgets, view reports, manage accounts and categories, schedule recurring transactions, and configure report notifications.';

  @override
  String get mobileLegacyStandardBrokerageRate01425 =>
      'Standard brokerage rate: 0.1425%';

  @override
  String get mobileLegacyNotSentYet => 'Not sent yet';

  @override
  String get mobileLegacyNoRealizedReturns => 'No realized returns';

  @override
  String get mobileLegacyNoCategoriesYet => 'No categories yet';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      'No transactions yet. Tap Add transaction to begin.';

  @override
  String get mobileLegacyNoRecurringTransactions => 'No recurring transactions';

  @override
  String get mobileLegacyNoDividendRecords => 'No dividend records';

  @override
  String get mobileLegacyNoStockTransactions => 'No stock transactions';

  @override
  String get mobileLegacyNoHoldingsYet => 'No holdings yet';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => 'No sign-in history';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      'Complete registration in the browser (device biometrics required)';

  @override
  String get mobileLegacyNotice => 'Notice';

  @override
  String get mobileLegacyDividends => 'Dividends';

  @override
  String get mobileLegacyDividendSyncCompleted => 'Dividend sync completed';

  @override
  String get mobileLegacyTickerEG2330 => 'Ticker (e.g. 2330)';

  @override
  String get mobileLegacyStockMarketValue => 'Stock market value';

  @override
  String get mobileLegacyHoldings => 'Holdings';

  @override
  String get mobileLegacyDayOfWeek => 'Day of week';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      'View the current version and release notes';

  @override
  String get mobileLegacyRename => 'Rename';

  @override
  String get mobileLegacyCheckAgain => 'Check again';

  @override
  String get mobileLegacyRetry => 'Retry';

  @override
  String get mobileLegacyHome => 'Home';

  @override
  String get mobileLegacyFixed => 'Fixed';

  @override
  String get mobileLegacyApply => 'Apply';

  @override
  String get mobileLegacyTime => 'Time';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      'Foreign transaction fee in TWD (optional)';

  @override
  String get mobileLegacyAddTransaction => 'Add transaction';

  @override
  String get mobileLegacyTransactions8084a8ea => 'Transactions';

  @override
  String get mobileLegacyStartDate => 'Start date';

  @override
  String get mobileLegacyTrackTaiwanStocks => 'Track Taiwan stocks';

  @override
  String get mobileLegacyStockDividendSharesOptional =>
      'Stock dividend shares (optional)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      'Foreign card fees are generated automatically. Edit the related foreign transaction instead.';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      'Password must be at least 8 characters';

  @override
  String get mobileLegacyAccountName => 'Account name';

  @override
  String get mobileLegacyAccountDeleted => 'Account deleted';

  @override
  String get mobileLegacyAccountSecurity => 'Account security';

  @override
  String get mobileLegacyLinkedAccounts => 'Linked accounts';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies =>
      'Frequently used currencies';

  @override
  String get mobileLegacyChooseFromGallery => 'Choose from gallery';

  @override
  String get mobileLegacyEnabled => 'Enabled';

  @override
  String get mobileLegacyDark => 'Dark';

  @override
  String get mobileLegacyLight => 'Light';

  @override
  String get mobileLegacyClearDates => 'Clear dates';

  @override
  String get mobileLegacyClearFilters => 'Clear filters';

  @override
  String get mobileLegacyCashDividendTotalOptional =>
      'Cash dividend (total, optional)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      'Enter a cash or stock dividend';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      'When set, the account card shows spending for the current statement period';

  @override
  String get mobileLegacyNoteOptional => 'Note (optional)';

  @override
  String get mobileLegacyNoteKeyword => 'Note keyword';

  @override
  String get mobileLegacyMinimumTransactionTax => 'Minimum transaction tax';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction =>
      'Up to 5 photos per transaction';

  @override
  String get mobileLegacyReportNotifications => 'Report notifications';

  @override
  String get mobileLegacySeeYourCompleteCashFlow =>
      'See your complete cash flow';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser => 'Unable to open browser';

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
  String get mobileLegacyYourSessionExpiredSignInAgain =>
      'Your session expired. Sign in again.';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      'The sign-in response did not include an authentication cookie';

  @override
  String get mobileLegacySignedIn => 'Signed in';

  @override
  String get mobileLegacySignInHistory => 'Sign-in history';

  @override
  String get mobileLegacySignedInDevices => 'Signed-in devices';

  @override
  String get mobileLegacySignInRequestConnectionFailed =>
      'Sign-in request connection failed';

  @override
  String get mobileLegacyEndDate => 'End date';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      'The sign-up response did not include an authentication cookie';

  @override
  String get mobileLegacySignUpAndSignIn => 'Sign up and sign in';

  @override
  String get mobileLegacyBuy => 'Buy';

  @override
  String get mobileLegacyFrequency => 'Frequency';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 =>
      'Exchange rate must be greater than 0';

  @override
  String get mobileLegacyReturns => 'Returns';

  @override
  String get mobileLegacyAddPasskey => 'Add passkey';

  @override
  String get mobileLegacyAddStockTransaction => 'Add stock transaction';

  @override
  String get mobileLegacyAddSchedule => 'Add schedule';

  @override
  String get mobileLegacyAddReportSchedule => 'Add report schedule';

  @override
  String get mobileLegacyAddPhotosOptional => 'Add photos (optional)';

  @override
  String get mobileLegacyFailedToLoadPhoto => 'Failed to load photo';

  @override
  String get mobileLegacyLink => 'Link';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      'Linking is completed in the browser. Before unlinking, make sure another sign-in method is available.';

  @override
  String get mobileLegacyUnlink => 'Unlink';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp =>
      'Personal finance · Android app';

  @override
  String get mobileLegacySkip => 'Skip';

  @override
  String get mobileLegacyMinimumOddLotCommission =>
      'Minimum odd-lot commission';

  @override
  String get mobileLegacyIncorrectEmailOrPassword =>
      'Incorrect email or password';

  @override
  String get mobileLegacyDefaultCurrency => 'Default currency';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      'Default and frequently used currencies';

  @override
  String get mobileLegacyBudgets => 'Budgets';

  @override
  String get mobileLegacyBudgetsReportsAndMore => 'Budgets, reports, and more';

  @override
  String get mobileLegacyBudgetAmount => 'Budget amount';

  @override
  String get mobileLegacyCurrencySettings => 'Currency settings';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage =>
      'App, notification, and web language';

  @override
  String get mobileLegacyBank => 'Bank';

  @override
  String get mobileLegacyBankBalance => 'Bank balance';

  @override
  String get mobileLegacyRequiresALinkedLineAccount =>
      'Requires a linked LINE account';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      'A credit card and a non-credit-card account are required';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      'Include uppercase, lowercase, numbers, and symbols';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      'Include uppercase, lowercase, numbers, and symbols';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      'Delete this report notification schedule?';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      'Delete this uploaded photo? This cannot be undone.';

  @override
  String get mobileLegacyEditStockTransaction => 'Edit stock transaction';

  @override
  String get mobileLegacyEditReportSchedule => 'Edit report schedule';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst =>
      'Complete the verification below first';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      'Add a stock on the Holdings tab first';

  @override
  String get mobileLegacySelectAParentCategoryFirst =>
      'Select a parent category first';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      'Enter a payment for at least one card';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      'Select at least one notification method';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo =>
      'Enter a number greater than or equal to 0';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => 'Enter a value from 1 to 31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 =>
      'Enter an amount greater than 0';

  @override
  String get mobileLegacyEnterATicker => 'Enter a ticker';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber =>
      'Enter a positive whole number';

  @override
  String get mobileLegacyEnterAName => 'Enter a name';

  @override
  String get mobileLegacyEnterAValidEmailAddress =>
      'Enter a valid email address';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm =>
      'Enter your password to confirm';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      'Enter the account email to confirm';

  @override
  String get mobileLegacyEnterADisplayName => 'Enter a display name';

  @override
  String get mobileLegacySelectASubcategory => 'Select a subcategory';

  @override
  String get mobileLegacySelectACategory => 'Select a category';

  @override
  String get mobileLegacySelectAParentCategory => 'Select a parent category';

  @override
  String get mobileLegacySelectAnAccount => 'Select an account';

  @override
  String get mobileLegacySelectADestinationAccount =>
      'Select a destination account';

  @override
  String get mobileLegacySell => 'Sell';

  @override
  String get mobileLegacyMinimumBoardLotCommission =>
      'Minimum board-lot commission';

  @override
  String get mobileLegacyFilter => 'Filter';

  @override
  String get mobileLegacyFilterTransactions => 'Filter transactions';

  @override
  String get mobileLegacyChooseTheme => 'Choose theme';

  @override
  String get mobileLegacyLogTransactionsInSeconds =>
      'Log transactions in seconds';

  @override
  String get mobileLegacyMarketValue => 'Market value';

  @override
  String get mobileLegacyTotalAssetsInTwd => 'Total assets (in TWD)';

  @override
  String get mobileLegacyTraditionalChineseEnglish =>
      'Traditional Chinese / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp =>
      'Don\'t have an account? Sign up';

  @override
  String get mobileLegacyPaymentRecorded => 'Payment recorded';

  @override
  String get mobileLegacyToAccount => 'To account';

  @override
  String get mobileLegacyFromAccount => 'From account';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      'The source and destination accounts must differ';

  @override
  String get mobileLegacyEditTransfersInTheWebApp =>
      'Edit transfers in the web app';

  @override
  String get mobileLegacyTransactionTaxSell => 'Transaction tax (sell)';

  @override
  String get mobileLegacyTransactionTaxOptional => 'Transaction tax (optional)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax =>
      'Type (affects transaction tax)';

  @override
  String get mobileLegacyWarrants => 'Warrants (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot => 'Welcome to AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      'Other devices will be signed out after this change.';

  @override
  String get mobileLegacyTestSentryConfiguration => 'Test Sentry configuration';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'API returned 401; the expired local session was cleared';

  @override
  String get mobileLegacyApiRequestFailed => 'API request failed';

  @override
  String get mobileLegacyApiRequestConnectionFailed =>
      'API request connection failed';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'The app sign-in response did not include an authentication cookie';

  @override
  String get mobileLegacyEmailNotifications => 'Email notifications';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'The Google sign-in response did not include an authentication cookie';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'LINE notifications';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'The LINE sign-in response did not include an authentication cookie';

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
      'TWD is always included. Selected currencies appear first in transaction and recurring-transaction lists.';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return 'Day $day';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return 'Last sent $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return 'Current version v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'Version v$version is available';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return 'Monthly on day $day';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return 'Every $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return 'Created $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return 'Language updated: $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return 'Failed to load: $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return 'Unexpected error: $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return '$provider sign-in failed: $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return 'Failed to update prices: $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return 'Failed to sync dividends: $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return 'Photo upload failed: $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return 'Request failed (HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return 'Sign-in failed (HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return 'Unable to connect to the server ($target): $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return 'Delete “$name”?';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return 'Unlink $provider';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return 'Unlink $provider?';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return '$provider link';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (all)';
  }

  @override
  String mobileDynamicUnknownHttpMethod(Object method) {
    return 'Unknown HTTP method: $method';
  }

  @override
  String mobileDynamicDeleteAccountName(Object name) {
    return 'Delete “$name”? Related transactions may also be affected.';
  }

  @override
  String mobileDynamicCurrentSpending(Object amount, Object range) {
    return 'Current spending $amount$range';
  }

  @override
  String mobileDynamicSpentAmount(Object amount) {
    return 'Spent $amount';
  }

  @override
  String mobileDynamicPaidAmount(Object amount) {
    return 'Paid $amount';
  }

  @override
  String mobileDynamicStatementCloses(Object name, Object day) {
    return '$name · Statement closes on day $day';
  }

  @override
  String mobileDynamicAddBudgetForMonth(Object month) {
    return 'Add budget ($month)';
  }

  @override
  String mobileDynamicRecurringSubtitle(
    Object frequency,
    Object account,
    Object startDate,
  ) {
    return '$frequency · $account · From $startDate';
  }

  @override
  String mobileDynamicReportTotalExpense(Object total) {
    return 'Total expenses: $total';
  }

  @override
  String mobileDynamicReportTotalIncome(Object total) {
    return 'Total income: $total';
  }

  @override
  String mobileDynamicDeleteTransactionDate(Object date) {
    return 'Delete the transaction from $date? This cannot be undone.';
  }

  @override
  String mobileDynamicDeleteTransactionCompact(Object date) {
    return 'Delete the transaction from $date?';
  }

  @override
  String mobileDynamicExchangeRateForCurrency(Object currency) {
    return 'Exchange rate (1 $currency = ? TWD)';
  }

  @override
  String mobileDynamicCardRateAutoFee(Object rate) {
    return 'Card rate: $rate%. Leave blank to calculate automatically.';
  }

  @override
  String mobileDynamicUploadedPhotosCount(Object count) {
    return 'Uploaded photos ($count)';
  }

  @override
  String mobileDynamicAddPhotosCount(Object count) {
    return 'Add photos ($count/5)';
  }

  @override
  String mobileDynamicStockPricesUpdated(Object count) {
    return 'Updated $count stocks';
  }

  @override
  String mobileDynamicStockPricesUpdatedWithFailed(
    Object count,
    Object failed,
  ) {
    return 'Updated $count stocks; $failed lookups failed';
  }

  @override
  String mobileDynamicDeleteStock(Object symbol, Object name) {
    return 'Delete “$symbol $name”? All of its transactions and dividends will also be deleted.';
  }

  @override
  String mobileDynamicStockHoldingSubtitle(
    Object shares,
    Object avgCost,
    Object currentPrice,
  ) {
    return '$shares shares · Avg. $avgCost · Current $currentPrice';
  }

  @override
  String mobileDynamicStockTransactionSubtitle(
    Object date,
    Object shares,
    Object price,
  ) {
    return '$date · $shares shares @ $price';
  }

  @override
  String mobileDynamicDeleteDividend(Object symbol, Object date) {
    return 'Delete the $symbol dividend from $date?';
  }

  @override
  String mobileDynamicDividendsSynced(Object count) {
    return 'Synced $count dividends';
  }

  @override
  String mobileDynamicDividendsSyncedWithSkipped(Object count, Object skipped) {
    return 'Synced $count dividends; skipped $skipped';
  }

  @override
  String mobileDynamicCashDividend(Object amount) {
    return 'Cash $amount';
  }

  @override
  String mobileDynamicStockDividendShares(Object shares) {
    return '$shares stock-dividend shares';
  }

  @override
  String mobileDynamicRealizedTransactionSubtitle(Object date, Object shares) {
    return '$date · Sold $shares shares';
  }

  @override
  String dashboardDataStatusQueriedAt(Object time) {
    return 'Data queried $time';
  }

  @override
  String get dashboardAttentionTitle => 'Needs attention';

  @override
  String get dashboardAttentionAllClear =>
      'Nothing needs your attention right now';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count recurring transactions need review';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count uncategorized transactions · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count held positions have no price';
  }

  @override
  String get dashboardDriversTitle => 'Top 3 monthly drivers';

  @override
  String dashboardDriversSubtitle(Object month) {
    return 'What contributes most in $month';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '$share% of this type';
  }

  @override
  String get dashboardPersonalizeTrigger => 'Customize home';

  @override
  String get dashboardPersonalizeTitle => 'Customize home';

  @override
  String get dashboardPersonalizeDescription =>
      'Choose which modules appear and arrange them in the order you use them.';

  @override
  String get dashboardPersonalizeModulesAssets => 'Asset overview';

  @override
  String get dashboardPersonalizeModulesAttention => 'Needs attention';

  @override
  String get dashboardPersonalizeModulesWhyChanged => 'Why cashflow changed';

  @override
  String get dashboardPersonalizeModulesSpending => 'Spending categories';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => 'Portfolio health';

  @override
  String get dashboardPersonalizeModulesIncomeRecent =>
      'Income and recent transactions';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return 'Move $module up';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return 'Move $module down';
  }

  @override
  String get dashboardPersonalizeSaved => 'Dashboard layout saved';

  @override
  String get dashboardPersonalizeSaveError =>
      'Could not save the dashboard layout';

  @override
  String get dashboardPersonalizeReset => 'Reset';

  @override
  String get dashboardPersonalizeApply => 'Apply';

  @override
  String get dashboardComparisonTitle => 'Why cashflow changed';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart–$currentEnd compared with $previousStart–$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return 'Full month compared with $previousStart–$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable =>
      'There is no comparable previous period for this month.';

  @override
  String get dashboardComparisonNoChanges =>
      'Recorded cashflow is unchanged from the comparable period.';

  @override
  String get dashboardComparisonPreviousNet => 'Previous net cashflow';

  @override
  String get dashboardComparisonNetChange => 'Net cashflow change';

  @override
  String get dashboardComparisonNewThisPeriod => 'New this period';

  @override
  String get dashboardComparisonIncreased => 'Amount increased';

  @override
  String get dashboardComparisonDecreased => 'Amount decreased';

  @override
  String get dashboardPortfolioHealthTitle => 'Portfolio cost-basis health';

  @override
  String get dashboardPortfolioHealthSubtitle =>
      'Current value compared with remaining FIFO cost';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      'Add a holding to see cost-basis insights.';

  @override
  String get dashboardPortfolioHealthMissingPrices =>
      'Current prices are needed before this comparison is available.';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      'A combined percentage is unavailable for holdings in multiple currencies.';

  @override
  String get dashboardPortfolioHealthMarketValue => 'Priced market value';

  @override
  String get dashboardPortfolioHealthCost => 'Cost of priced holdings';

  @override
  String get dashboardPortfolioHealthUnrealizedGross => 'Unrealized gross P/L';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return 'Largest holding: $name · $share% of priced value';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      'This compares current prices with recorded FIFO cost. It is not a market-index benchmark or time-weighted performance.';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return 'Price coverage: $priced of $total holdings';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook => 'Scheduled cash outlook';

  @override
  String get dashboardPersonalizeModulesSavingsScenario => 'Savings scenario';

  @override
  String get dashboardCashOutlookTitle => 'Next 30 days · scheduled cash';

  @override
  String get dashboardCashOutlookSubtitle =>
      'Based on confirmed recurring entries';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start–$end · Scheduled estimate';
  }

  @override
  String get dashboardCashOutlookInvalidDate =>
      'The estimate window could not be calculated.';

  @override
  String get dashboardCashOutlookNoBankAccounts =>
      'Add an included bank account before estimating scheduled cash.';

  @override
  String get dashboardCashOutlookNoSchedules =>
      'Create a recurring income or expense to see upcoming scheduled cash.';

  @override
  String get dashboardCashOutlookNoCoveredSchedules =>
      'Review recurring entries and link them to included bank accounts.';

  @override
  String get dashboardCashOutlookStartingBalance => 'Bank balance as of today';

  @override
  String get dashboardCashOutlookScheduledNet => 'Scheduled net change';

  @override
  String get dashboardCashOutlookClosingBalance =>
      'Estimated cash after 30 days';

  @override
  String get dashboardCashOutlookLowestBalance => 'Lowest estimated cash';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count scheduled occurrences · Income $income · Expense $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle =>
      'Estimated combined cash may fall below zero';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return 'Around $date, the estimate reaches $amount below zero. Review the timing and amounts before acting.';
  }

  @override
  String get dashboardCashOutlookUpcoming => 'Upcoming scheduled entries';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return 'Showing $shown of $total';
  }

  @override
  String get dashboardCashOutlookNoUpcoming =>
      'No scheduled occurrence falls inside this 30-day window.';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return '$included of $total recurring entries are covered; review $uncovered.';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      'Estimate combines all included bank accounts using today\'s balance and confirmed linked recurring entries. It does not show possible overdrafts in one account or change actual balances; due transactions are created when the service next processes them. Current FX rates are used consistently for TWD estimates.';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return 'Scheduled cash may be short by $amount around $date';
  }

  @override
  String get dashboardScenarioTitle => 'Savings scenario';

  @override
  String get dashboardScenarioSubtitle =>
      'Estimate the cumulative effect of one monthly adjustment';

  @override
  String get dashboardScenarioMonthlyAdjustment =>
      'Monthly savings adjustment (TWD)';

  @override
  String get dashboardScenarioDecrease => 'Decrease monthly adjustment by 500';

  @override
  String get dashboardScenarioIncrease => 'Increase monthly adjustment by 500';

  @override
  String get dashboardScenarioHorizon => 'Time horizon';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count months';
  }

  @override
  String get dashboardScenarioDifference => 'Cumulative difference';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return 'A monthly adjustment of $monthly for $months months produces a cumulative difference of $difference.';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      'Simple scenario: monthly adjustment × months. It excludes interest, market returns, inflation and taxes, and does not guarantee a future result.';
}
