// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get commonSave => 'सेव करें';

  @override
  String get commonCancel => 'रद्द करें';

  @override
  String get commonDelete => 'हटाएँ';

  @override
  String get commonEdit => 'संपादित करें';

  @override
  String get commonConfirm => 'पुष्टि करें';

  @override
  String get commonClose => 'बंद करें';

  @override
  String get commonLoading => 'लोड हो रहा है…';

  @override
  String get commonAdd => 'जोड़ें';

  @override
  String get commonBack => 'वापस';

  @override
  String get commonSearch => 'खोजें';

  @override
  String get commonLanguage => 'भाषा';

  @override
  String get commonClear => 'साफ़ करें';

  @override
  String get commonSaving => 'सेव हो रहा है...';

  @override
  String get commonConfirmDelete => 'हटाने की पुष्टि करें';

  @override
  String get commonPreviousPage => 'पिछला';

  @override
  String get commonNextPage => 'अगला';

  @override
  String commonTotalRecords(Object count) {
    return '$count रिकॉर्ड';
  }

  @override
  String get commonPerPage => 'प्रति पेज';

  @override
  String commonRecordsUnit(Object count) {
    return '$count रिकॉर्ड';
  }

  @override
  String get commonNoData => 'अभी कोई डेटा नहीं';

  @override
  String get navSectionsFinance => 'वित्त';

  @override
  String get navSectionsStocks => 'शेयर';

  @override
  String get navSectionsSystem => 'सिस्टम';

  @override
  String get navDashboard => 'डैशबोर्ड';

  @override
  String get navTransactions => 'लेन-देन';

  @override
  String get navReports => 'रिपोर्ट';

  @override
  String get navBudget => 'बजट';

  @override
  String get navInfoBoard => 'जानकारी बोर्ड';

  @override
  String get navAccounts => 'खाते';

  @override
  String get navCategories => 'श्रेणियाँ';

  @override
  String get navRecurring => 'दोहराव';

  @override
  String get navStocksPortfolio => 'पोर्टफ़ोलियो';

  @override
  String get navStocksTransactions => 'शेयर लेन-देन';

  @override
  String get navStocksDividends => 'डिविडेंड';

  @override
  String get navStocksRealized => 'वास्तविक P/L';

  @override
  String get navStocksSettings => 'शेयर सेटिंग्स';

  @override
  String get navExportImport => 'एक्सपोर्ट / इम्पोर्ट';

  @override
  String get navAccount => 'खाता';

  @override
  String get navApiCredits => 'API एक्सेस';

  @override
  String get navAdmin => 'एडमिन';

  @override
  String get navTitleStocks => 'पोर्टफ़ोलियो';

  @override
  String get navTitleStockTransactions => 'शेयर लेन-देन';

  @override
  String get navTitleStockDividends => 'शेयर डिविडेंड';

  @override
  String get navTitleStockRealized => 'वास्तविक P/L';

  @override
  String get navTitleStockSettings => 'शेयर ट्रेडिंग सेटिंग्स';

  @override
  String get navTitleApiCredits => 'API उपयोग और एक्सेस';

  @override
  String get shellFallbackUser => 'यूज़र';

  @override
  String get shellLogout => 'साइन आउट';

  @override
  String get shellVersionInfo => 'वर्ज़न जानकारी';

  @override
  String get shellOpenMenu => 'मेन्यू खोलें';

  @override
  String get shellSkipToContent => 'मुख्य सामग्री पर जाएँ';

  @override
  String get shellThemeLight => 'लाइट';

  @override
  String get shellThemeSystem => 'सिस्टम';

  @override
  String get shellThemeDark => 'डार्क';

  @override
  String get shellChangelogLoading => 'वर्ज़न जानकारी लोड हो रही है...';

  @override
  String get shellChangelogLoadFailed => 'वर्ज़न जानकारी लोड नहीं हो पाई';

  @override
  String get shellChangelogUnknownVersion => 'अज्ञात';

  @override
  String get shellChangelogCurrentVersion => 'मौजूदा वर्ज़न';

  @override
  String get shellChangelogUpdatableVersion => 'उपलब्ध वर्ज़न';

  @override
  String get shellChangelogUpToDate => 'पहले से नवीनतम';

  @override
  String get shellChangelogUpdatableContent => 'अपडेट सामग्री';

  @override
  String get shellChangelogRecentContent => 'हाल के अपडेट';

  @override
  String get authLoginTab => 'साइन इन';

  @override
  String get authRegisterTab => 'खाता बनाएँ';

  @override
  String get authSubtitleLogin =>
      'वापसी पर स्वागत है, अपने खाते में साइन इन करें';

  @override
  String get authSubtitleRegister => 'अपना खाता बनाएँ और ट्रैकिंग शुरू करें';

  @override
  String get authEmailLabel => 'ईमेल';

  @override
  String get authPasswordLabel => 'पासवर्ड';

  @override
  String get authPasswordPlaceholder => 'पासवर्ड दर्ज करें';

  @override
  String get authDisplayNameLabel => 'दिखने वाला नाम';

  @override
  String get authDisplayNamePlaceholder => 'आपका नाम या उपनाम';

  @override
  String get authRegisterPasswordPlaceholder =>
      'कम से कम 8 अक्षर, बड़े/छोटे अक्षर और संख्या सहित';

  @override
  String get authTogglePassword => 'पासवर्ड दिखाएँ या छिपाएँ';

  @override
  String get authTurnstileAria => 'Cloudflare Turnstile मानव सत्यापन';

  @override
  String get authLoginButton => 'साइन इन';

  @override
  String get authLoggingIn => 'साइन इन हो रहा है…';

  @override
  String get authPasskeyButton => 'Passkey से साइन इन करें';

  @override
  String get authPasskeyVerifying => 'Passkey सत्यापित हो रहा है…';

  @override
  String get authGoogleButton => 'Google से साइन इन करें';

  @override
  String get authGoogleVerifying => 'Google सत्यापित हो रहा है…';

  @override
  String get authLineButton => 'LINE से साइन इन करें';

  @override
  String get authLineVerifying => 'LINE सत्यापित हो रहा है…';

  @override
  String get authRegisterSubmit => 'खाता बनाएँ';

  @override
  String get authRegistering => 'खाता बन रहा है…';

  @override
  String get authLineCallbackCompleting => 'LINE सत्यापन पूरा हो रहा है...';

  @override
  String get authLineCallbackMissingCode =>
      'LINE ने authorization code वापस नहीं किया। कृपया फिर कोशिश करें।';

  @override
  String get authLineCallbackLinkFailed => 'LINE खाता लिंक नहीं हो पाया';

  @override
  String get authLineCallbackLoginFailed => 'LINE साइन इन विफल';

  @override
  String get authLineCallbackVerifyFailed => 'LINE सत्यापन विफल';

  @override
  String get authErrorsTurnstileRequired => 'पहले मानव सत्यापन पूरा करें';

  @override
  String get authErrorsLoginFailed => 'साइन इन नहीं हो पाया';

  @override
  String get authErrorsRegisterFailed => 'खाता नहीं बन पाया';

  @override
  String get authErrorsGoogleNotConfigured =>
      'Google साइन इन कॉन्फ़िगर नहीं है';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'Google साइन इन component लोड नहीं हुआ';

  @override
  String get authErrorsGoogleStateFailed => 'Google साइन इन state नहीं बन पाई';

  @override
  String get authErrorsGoogleNoCode => 'Google authorization code नहीं मिला';

  @override
  String get authErrorsGoogleFailed => 'Google साइन इन विफल';

  @override
  String get authErrorsGoogleCancelled => 'Google साइन इन रद्द किया गया';

  @override
  String get authErrorsPasskeyUnsupported =>
      'यह ब्राउज़र Passkey का समर्थन नहीं करता';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'Passkey साइन इन challenge नहीं बन पाया';

  @override
  String get authErrorsPasskeyFailed => 'Passkey साइन इन विफल';

  @override
  String get authErrorsLineNotConfigured => 'LINE साइन इन कॉन्फ़िगर नहीं है';

  @override
  String get authErrorsLineFailed => 'LINE साइन इन विफल';

  @override
  String get settingsTitle => 'सेटिंग्स';

  @override
  String get settingsLanguageTitle => 'भाषा';

  @override
  String get settingsLanguageDescription =>
      'इंटरफ़ेस और सूचनाओं (Email / LINE) की भाषा चुनें।';

  @override
  String get settingsLanguageSaved => 'भाषा पसंद अपडेट हो गई';

  @override
  String get settingsAccountTitle => 'खाता सेटिंग्स';

  @override
  String get settingsAccountProfileInfo => 'खाते की जानकारी';

  @override
  String get settingsAccountEmail => 'ईमेल';

  @override
  String get settingsAccountDisplayName => 'दिखने वाला नाम';

  @override
  String get settingsAccountEditDisplayName => 'नाम संपादित करें';

  @override
  String get settingsAccountUpdateName => 'नाम अपडेट करें';

  @override
  String get settingsAccountSaving => 'सेव हो रहा है...';

  @override
  String get settingsAccountSetLocalPassword => 'लोकल पासवर्ड सेट करें';

  @override
  String get settingsAccountChangePassword => 'पासवर्ड बदलें';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      'यह खाता अभी केवल थर्ड-पार्टी साइन इन का उपयोग कर रहा है। लोकल पासवर्ड सेट करने के बाद आप ईमेल और पासवर्ड से भी साइन इन कर सकेंगे।';

  @override
  String get settingsAccountCurrentPassword => 'मौजूदा पासवर्ड';

  @override
  String get settingsAccountNewPassword => 'नया पासवर्ड';

  @override
  String get settingsAccountConfirmNewPassword => 'नए पासवर्ड की पुष्टि करें';

  @override
  String get settingsAccountPasswordPlaceholder =>
      'कम से कम 8 अक्षर, जिनमें बड़ा अक्षर, छोटा अक्षर, अंक और प्रतीक हो';

  @override
  String get settingsAccountUpdating => 'अपडेट हो रहा है...';

  @override
  String get settingsAccountSetPassword => 'पासवर्ड सेट करें';

  @override
  String get settingsAccountUpdatePassword => 'पासवर्ड अपडेट करें';

  @override
  String get settingsAccountThemeTitle => 'डिस्प्ले थीम';

  @override
  String get settingsAccountThemeSystem => 'सिस्टम के अनुसार';

  @override
  String get settingsAccountThemeLight => 'लाइट मोड';

  @override
  String get settingsAccountThemeDark => 'डार्क मोड';

  @override
  String get settingsAccountDefaultCurrency => 'डिफ़ॉल्ट मुद्रा';

  @override
  String get settingsAccountCurrencyCode => 'मुद्रा कोड';

  @override
  String get settingsAccountUpdateDefaultCurrency =>
      'डिफ़ॉल्ट मुद्रा अपडेट करें';

  @override
  String get settingsAccountPasskeyTitle => 'Passkey प्रबंधन';

  @override
  String get settingsAccountNoPasskeys => 'अभी कोई Passkey पंजीकृत नहीं है';

  @override
  String get settingsAccountAddPasskey => '+ Passkey जोड़ें';

  @override
  String get settingsAccountGoogleTitle => 'Google लिंक';

  @override
  String get settingsAccountLineTitle => 'LINE लिंक';

  @override
  String get settingsAccountStatusPrefix => 'मौजूदा स्थिति: ';

  @override
  String get settingsAccountLinkedGoogle => 'Google खाता लिंक है';

  @override
  String get settingsAccountNotLinkedGoogle => 'Google खाता लिंक नहीं है';

  @override
  String get settingsAccountLinkGoogle => 'Google खाता लिंक करें';

  @override
  String get settingsAccountUnlink => 'लिंक हटाएँ';

  @override
  String get settingsAccountLinkedLine => 'LINE खाता लिंक है';

  @override
  String get settingsAccountNotLinkedLine => 'LINE खाता लिंक नहीं है';

  @override
  String get settingsAccountLinkLine => 'LINE खाता लिंक करें';

  @override
  String get settingsAccountLineVerifying => 'LINE सत्यापित हो रहा है…';

  @override
  String get settingsAccountSessionsTitle => 'साइन इन डिवाइस';

  @override
  String get settingsAccountRefresh => 'रीफ़्रेश';

  @override
  String get settingsAccountDeviceName => 'डिवाइस का नाम';

  @override
  String get settingsAccountLoginTime => 'साइन इन समय';

  @override
  String get settingsAccountLoginIp => 'साइन इन IP';

  @override
  String get settingsAccountActions => 'कार्रवाइयाँ';

  @override
  String get settingsAccountUnknownDevice => 'अज्ञात डिवाइस';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (यह डिवाइस)';

  @override
  String get settingsAccountSignOut => 'साइन आउट';

  @override
  String get settingsAccountNoSessions =>
      'अभी कोई साइन इन डिवाइस रिकॉर्ड नहीं है';

  @override
  String get settingsAccountAuditTitle => 'साइन इन लॉग';

  @override
  String get settingsAccountCountry => 'देश';

  @override
  String get settingsAccountMethod => 'तरीका';

  @override
  String get settingsAccountDevice => 'डिवाइस';

  @override
  String get settingsAccountAdminLogin => 'एडमिन साइन इन';

  @override
  String get settingsAccountYes => 'हाँ';

  @override
  String get settingsAccountNo => 'नहीं';

  @override
  String get settingsAccountDeleteTitle => 'खाता हटाएँ';

  @override
  String get settingsAccountDeleteDescription =>
      'खाता हटाने के बाद आपके लेन-देन, खाते, शेयर, Passkeys और सेटिंग्स स्थायी रूप से हट जाएँगे और वापस नहीं लाए जा सकेंगे।';

  @override
  String get settingsAccountDeleteButton => 'मेरा खाता हटाएँ';

  @override
  String get settingsAccountDeleteModalTitle => 'खाता हटाने की पुष्टि करें';

  @override
  String get settingsAccountDeleteModalWarning =>
      'यह कार्रवाई खाते और सभी डेटा को स्थायी रूप से हटा देगी, जिसमें लेन-देन, खाते, शेयर, Passkeys और सेटिंग्स शामिल हैं। इसे वापस नहीं किया जा सकता।';

  @override
  String get settingsAccountDeletePasswordLabel =>
      'हटाने की पुष्टि के लिए पासवर्ड दर्ज करें';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return 'हटाने की पुष्टि के लिए खाते का ईमेल \"$email\" दर्ज करें';
  }

  @override
  String get settingsAccountDeleting => 'हटाया जा रहा है...';

  @override
  String get settingsAccountDeletePermanently => 'खाता हमेशा के लिए हटाएँ';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired =>
      'मौजूदा पासवर्ड दर्ज करें';

  @override
  String get settingsAccountMessagesNewPasswordRequired =>
      'नया पासवर्ड दर्ज करें';

  @override
  String get settingsAccountMessagesPasswordTooShort =>
      'नया पासवर्ड कम से कम 8 अक्षरों का होना चाहिए';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      'नए पासवर्ड में बड़ा अक्षर, छोटा अक्षर, अंक और विशेष प्रतीक होना चाहिए';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      'दोनों नए पासवर्ड मेल नहीं खाते';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      'पासवर्ड सेट हो गया है। अब आप पासवर्ड से साइन इन कर सकते हैं';

  @override
  String get settingsAccountMessagesPasswordUpdated => 'पासवर्ड अपडेट हो गया';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      'पासवर्ड अपडेट नहीं हो पाया';

  @override
  String get settingsAccountMessagesDisplayNameRequired =>
      'दिखने वाला नाम खाली नहीं हो सकता';

  @override
  String get settingsAccountMessagesDisplayNameUpdated =>
      'दिखने वाला नाम अपडेट हो गया';

  @override
  String get settingsAccountMessagesUpdateFailed => 'अपडेट नहीं हो पाया';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      'क्या यह Passkey हटानी है?';

  @override
  String get settingsAccountMessagesCurrencyInvalid =>
      'मुद्रा 3 अक्षरों का कोड होना चाहिए';

  @override
  String get settingsAccountMessagesCurrencyUpdated =>
      'डिफ़ॉल्ट मुद्रा अपडेट हो गई';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      'डिफ़ॉल्ट मुद्रा अपडेट नहीं हो पाई';

  @override
  String get settingsAccountMessagesSessionLoggedOut =>
      'डिवाइस से साइन आउट कर दिया गया';

  @override
  String get settingsAccountMessagesSessionLogoutFailed =>
      'डिवाइस से साइन आउट नहीं हो पाया';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      'यह ब्राउज़र Passkey का समर्थन नहीं करता';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Android डिवाइस';

  @override
  String get settingsAccountMessagesComputerDevice => 'कंप्यूटर';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'Passkey पंजीकृत नहीं हो पाई';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      'लिंकिंग का परीक्षण करने के लिए Google ID Token चिपकाएँ';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Google खाता लिंक हो गया';

  @override
  String get settingsAccountMessagesGoogleLinkFailed =>
      'Google खाता लिंक नहीं हो पाया';

  @override
  String get settingsAccountMessagesGoogleUnlinked =>
      'Google खाता अनलिंक हो गया';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'Google खाता अनलिंक नहीं हो पाया';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'LINE साइन इन सेट नहीं है';

  @override
  String get settingsAccountMessagesLineLinkFailed =>
      'LINE खाता लिंक नहीं हो पाया';

  @override
  String get settingsAccountMessagesLineUnlinked => 'LINE खाता अनलिंक हो गया';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'LINE खाता अनलिंक नहीं हो पाया';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      'हटाने की पुष्टि के लिए पासवर्ड दर्ज करें';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      'हटाने की पुष्टि के लिए सही खाते का ईमेल दर्ज करें';

  @override
  String get settingsAccountMessagesDeleteFailed => 'खाता हटाया नहीं जा सका';

  @override
  String get dashboardTitle => 'डैशबोर्ड';

  @override
  String dashboardSubtitle(Object month) {
    return '$month के लिए आय, खर्च, श्रेणियाँ और हाल की लेन-देन।';
  }

  @override
  String get dashboardUncategorized => 'बिना श्रेणी';

  @override
  String get dashboardKpiTotalIncome => 'कुल आय';

  @override
  String get dashboardKpiTotalExpense => 'कुल खर्च';

  @override
  String get dashboardKpiNet => 'नेट';

  @override
  String get dashboardKpiTodayExpense => 'आज का खर्च';

  @override
  String get dashboardKpiBankAccounts => 'बैंक खाते';

  @override
  String get dashboardKpiStockMarketValue => 'शेयर बाज़ार मूल्य';

  @override
  String get dashboardOverviewTitle => 'मासिक कैश-फ़्लो सारांश';

  @override
  String get dashboardOverviewBalance => 'मासिक बचत';

  @override
  String get dashboardOverviewDeficit => 'मासिक घाटा';

  @override
  String get dashboardOverviewIncome => 'आय';

  @override
  String get dashboardOverviewExpense => 'खर्च';

  @override
  String get dashboardOverviewNet => 'नेट';

  @override
  String get dashboardRatioTitle => 'आय / खर्च अनुपात';

  @override
  String get dashboardRatioIncomeShare => 'आय का हिस्सा';

  @override
  String get dashboardRatioExpenseShare => 'खर्च का हिस्सा';

  @override
  String get dashboardSectionsExpenseCategories => 'खर्च की श्रेणियाँ';

  @override
  String get dashboardSectionsIncomeCategories => 'आय की श्रेणियाँ';

  @override
  String get dashboardSectionsRecentTransactions => 'हाल की लेन-देन';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return 'नवीनतम $count रिकॉर्ड';
  }

  @override
  String get dashboardEmptyNoExpense => 'इस महीने कोई खर्च नहीं';

  @override
  String get dashboardEmptyNoIncome => 'इस महीने कोई आय नहीं';

  @override
  String get dashboardEmptyNoTransactions => 'इस महीने कोई लेन-देन नहीं';

  @override
  String get dashboardTableDate => 'तारीख';

  @override
  String get dashboardTableCategory => 'श्रेणी';

  @override
  String get dashboardTableNote => 'नोट';

  @override
  String get dashboardTableAmount => 'राशि';

  @override
  String get dashboardFiltersPreviousMonth => 'पिछला महीना';

  @override
  String get dashboardFiltersNextMonth => 'अगला महीना';

  @override
  String get dashboardFiltersCurrentMonth => 'यह महीना';

  @override
  String get publicCommonBackHome => 'होम पर वापस';

  @override
  String get publicCommonPrivacy => 'गोपनीयता नीति';

  @override
  String get publicCommonTerms => 'सेवा की शर्तें';

  @override
  String get publicCommonApiCredits => 'API उपयोग और श्रेय';

  @override
  String publicCommonLastUpdated(Object date) {
    return 'अंतिम अपडेट: $date';
  }

  @override
  String get publicCommonMetadataTitle =>
      'AssetPilot - व्यक्तिगत वित्त कमांड सेंटर';

  @override
  String get publicCommonMetadataDescription =>
      'खर्च, बजट, ताइवान शेयर निवेश और विश्लेषण के लिए स्व-होस्टेड, एन्क्रिप्टेड व्यक्तिगत वित्त प्रबंधक।';

  @override
  String get publicCommonDatesApiCredits => '11 जून 2026';

  @override
  String get publicCommonDatesPrivacy => '17 जून 2026';

  @override
  String get publicCommonDatesTerms => '11 जून 2026';

  @override
  String get publicHomeTagline => 'व्यक्तिगत वित्त नियंत्रण केंद्र';

  @override
  String get publicHomeLogin => 'साइन इन करें';

  @override
  String get publicHomeRegister => 'खाता बनाएँ';

  @override
  String get publicHomeBadge => 'स्व-होस्टेड, डेटा एन्क्रिप्टेड, AGPL v3';

  @override
  String get publicHomeHeadline1 => 'आपका वित्त नियंत्रण केंद्र';

  @override
  String get publicHomeHeadline2 => 'होम पेज से ही साफ़ तस्वीर';

  @override
  String get publicHomeLeadBefore =>
      'ताइवान शेयर निवेश, आय-खर्च, बजट, रिपोर्ट और ऑडिट रिकॉर्ड को एक जगह संभालें। सभी वित्तीय डेटा स्टोरेज में';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      'से एन्क्रिप्ट होता है, किसी खास क्लाउड या सब्सक्रिप्शन से बंधा नहीं। पहले प्रोडक्ट समझें, फिर साइन इन करें।';

  @override
  String get publicHomeStartUsing => 'शुरू करें';

  @override
  String get publicHomeCreateFirst => 'पहले खाता बनाएँ';

  @override
  String get publicHomeChipsOpenSource => 'ओपन सोर्स AGPL v3';

  @override
  String get publicHomeChipsEncrypted => 'लोकल एन्क्रिप्टेड स्टोरेज';

  @override
  String get publicHomeChipsNoCloudLock => 'बाहरी क्लाउड लॉक-इन नहीं';

  @override
  String get publicHomeChipsDocker => 'Docker एक कमांड में डिप्लॉय';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => 'मुख्य मॉड्यूल';

  @override
  String get publicHomeStatsModulesSublabel => 'लेखा, शेयर, रिपोर्ट, गवर्नेंस';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => 'डेटा एन्क्रिप्शन';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => 'शेयर डेटा स्रोत';

  @override
  String get publicHomeStatsStockSourceSublabel =>
      'इंट्राडे, क्लोज़, बैकअप रणनीति';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => 'सटीक गणना';

  @override
  String get publicHomeStatsPrecisionSublabel => 'decimal.js से प्रति-लॉट P/L';

  @override
  String get publicHomePreLoginNote =>
      'साइन इन करने से पहले भी आप AssetPilot की सुविधाएँ, डेटा हैंडलिंग और डिप्लॉयमेंट विकल्प देख सकते हैं, फिर तय करें कि लॉग इन करना है या खाता बनाना है।';

  @override
  String get publicHomeWhyLabel => 'AssetPilot क्यों';

  @override
  String get publicHomeWhyTitle =>
      'रोज़मर्रा का लेखा-जोखा, निवेश ट्रैकिंग और डेटा कंट्रोल एक ही जगह';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot उन लोगों के लिए बनाया गया है जो अपना व्यक्तिगत वित्त खुद संभालते हैं। यह नकदी प्रवाह, बजट और ताइवान शेयरों को एक साथ रखता है, साथ ही एक्सपोर्ट, ऑडिट और स्व-होस्टिंग की स्वतंत्रता भी देता है।';

  @override
  String get publicHomePillarsFinanceTitle => 'कैश-फ़्लो और बजट प्रबंधन';

  @override
  String get publicHomePillarsFinanceTag => 'लेखा मूल';

  @override
  String get publicHomePillarsFinanceItemsOne =>
      'कई खातों का बैलेंस और खातों के बीच ट्रांसफ़र ट्रैक करें';

  @override
  String get publicHomePillarsFinanceItemsTwo =>
      'मासिक और श्रेणी बजट की प्रगति देखें';

  @override
  String get publicHomePillarsFinanceItemsThree =>
      'दोहराने वाली आय और खर्च अपने आप बनाएँ';

  @override
  String get publicHomePillarsFinanceItemsFour =>
      'श्रेणी, तारीख और डिलीट के लिए बैच वर्कफ़्लो';

  @override
  String get publicHomePillarsStocksTitle => 'ताइवान शेयर निवेश ट्रैकिंग';

  @override
  String get publicHomePillarsStocksTag => 'शेयर मॉड्यूल';

  @override
  String get publicHomePillarsStocksItemsOne =>
      'TWSE कीमत क्वेरी और एक्स-डिविडेंड सिंक';

  @override
  String get publicHomePillarsStocksItemsTwo =>
      'पूरी सटीकता के साथ FIFO realized P/L';

  @override
  String get publicHomePillarsStocksItemsThree =>
      'डिविडेंड रिकॉर्ड और खाते में जमा ट्रैकिंग';

  @override
  String get publicHomePillarsStocksItemsFour =>
      'रिकरिंग निवेश और डिलिस्टिंग मार्क प्रबंधन';

  @override
  String get publicHomePillarsSecurityTitle => 'सुरक्षा और डेटा गवर्नेंस';

  @override
  String get publicHomePillarsSecurityTag => 'गवर्नेंस';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'ChaCha20-Poly1305 से डेटा-at-rest एन्क्रिप्शन';

  @override
  String get publicHomePillarsSecurityItemsTwo =>
      'पासवर्ड, Google और Passkey से साइन इन';

  @override
  String get publicHomePillarsSecurityItemsThree =>
      'एक्सपोर्ट/इम्पोर्ट, बैकअप, रिस्टोर और ऑडिट लॉग';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'Rate limit, CSP और CSV injection सुरक्षा';

  @override
  String get publicHomePillarsSelfHostedTitle =>
      'स्व-होस्टेड डिप्लॉयमेंट और कॉन्ट्रैक्ट';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne => 'Docker एक कमांड में शुरू';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => 'amd64 और arm64 सपोर्ट';

  @override
  String get publicHomePillarsSelfHostedItemsThree =>
      'OpenAPI 3.2 कॉन्ट्रैक्ट दस्तावेज़';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      'URL-first रूटिंग, बुकमार्क और रिफ़्रेश के अनुकूल';

  @override
  String get publicHomeQuickStartLabel => 'क्विक स्टार्ट';

  @override
  String get publicHomeQuickStartTitle => '60 सेकंड में अपने सर्वर पर चलाएँ';

  @override
  String get publicHomeQuickStartDescription =>
      'Docker से तुरंत शुरू करें। पहली बार चलाने पर JWT और डेटाबेस एन्क्रिप्शन कुंजियाँ अपने आप बनती हैं। amd64 और arm64 सपोर्ट है, इसलिए NAS, VPS या अपने Docker होस्ट पर आसानी से चलता है।';

  @override
  String get publicHomeQuickStartChipsImage => 'लगभग 180 MB इमेज';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => 'बिल्ट-इन हेल्थ चेक';

  @override
  String get publicHomeQuickStartChipsKeys =>
      'पहले स्टार्ट पर कुंजियाँ बनती हैं';

  @override
  String get publicHomeTechLabel => 'टेक स्टैक';

  @override
  String get publicHomeTechTitle => 'तकनीक और सार्वजनिक जानकारी';

  @override
  String get publicHomeTechDescription =>
      'मुख्य तकनीकें, बाहरी डेटा स्रोत और लाइसेंस जानकारी साफ़ रखी गई है ताकि शुरू करने से पहले आप समझ सकें कि सेवा कैसे काम करती है।';

  @override
  String get publicHomeFooter =>
      'GNU AGPL v3. व्यक्तिगत संपत्ति प्रबंधन जिसे आप खुद होस्ट, नियंत्रित और बैकअप करते हैं।';

  @override
  String get publicApiCreditsPageTitle => 'API उपयोग और क्रेडिट';

  @override
  String get publicApiCreditsPageMetadataTitle =>
      'API उपयोग और क्रेडिट — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => 'बाहरी API पारदर्शिता';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot केवल तब बाहरी डेटा स्रोतों से जुड़ता है जब कोई सुविधा इसकी ज़रूरत रखती है। यहाँ हर API का उपयोग, लाइसेंस नोट और भेजे जाने वाले डेटा का दायरा दिया गया है, ताकि स्व-होस्टिंग के समय अनुपालन जाँचा जा सके।';

  @override
  String get publicApiCreditsPageStatsExternalServices => 'बाहरी सेवाएँ';

  @override
  String get publicApiCreditsPageStatsFreeSupported => 'मुफ़्त योजना समर्थित';

  @override
  String get publicApiCreditsPageStatsAttributionRequired =>
      'श्रेय देना आवश्यक';

  @override
  String get publicApiCreditsPageServiceKindsData => 'डेटा क्वेरी';

  @override
  String get publicApiCreditsPageServiceKindsAuth => 'प्रमाणीकरण';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'ईमेल चैनल';

  @override
  String get publicApiCreditsPageServiceKindsBackup => 'क्लाउड बैकअप';

  @override
  String get publicApiCreditsPageTransparencyTitle => 'डेटा पारदर्शिता';

  @override
  String get publicApiCreditsPageTransparencyText =>
      'नीचे दिए गए हालात में केवल सुविधा पूरी करने के लिए ज़रूरी न्यूनतम डेटा भेजा जाता है; आपकी वित्तीय जानकारी तीसरी सेवाओं को नहीं दी जाती।';

  @override
  String get publicApiCreditsPageMinNecessary => 'न्यूनतम आवश्यक डेटा सिद्धांत';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => 'विनिमय दर सिंक';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      'सिर्फ़ सार्वजनिक विनिमय दर डेटा देखा जाता है; व्यक्तिगत वित्तीय विवरण नहीं भेजे जाते।';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle => 'ताइवान शेयर डेटा';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      'सिर्फ़ शेयर कोड और बाज़ार डेटा भेजे जाते हैं, खाते, लागत आधार या लेन-देन रिकॉर्ड नहीं।';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => 'साइन इन ऑडिट';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo केवल साइन इन रिकॉर्ड में देश दिखाने के लिए इस्तेमाल होता है।';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => 'थर्ड-पार्टी साइन इन';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google और LINE केवल तब चालू होते हैं जब आप खुद साइन इन या लिंक करते हैं।';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => 'क्लाउड बैकअप';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4 को पूरा डेटाबेस बैकअप फ़ाइल तभी मिलता है जब एडमिन स्पष्ट रूप से अपलोड करता है।';

  @override
  String get publicApiCreditsPageServiceListTitle => 'बाहरी सेवाओं की सूची';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return 'कुल $total सेवाएँ हैं। इनमें $free मुफ़्त योजना का समर्थन करती हैं और $paid में paid plans उपलब्ध हैं।';
  }

  @override
  String get publicApiCreditsPageOfficialSite => 'आधिकारिक साइट';

  @override
  String get publicApiCreditsPageFreePlan => 'मुफ़्त योजना';

  @override
  String get publicApiCreditsPagePaidPlan => 'पेड योजना';

  @override
  String get publicApiCreditsPageSupported => 'समर्थित';

  @override
  String get publicApiCreditsPageUnavailable => 'उपलब्ध नहीं';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'TWD को आधार मुद्रा बनाकर वैश्विक रीयल-टाइम विनिमय दरें';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'साइन इन ऑडिट रिकॉर्ड के देश फ़ील्ड के लिए IP जियोलोकेशन';

  @override
  String get publicApiCreditsPageDescriptionsTwse =>
      'रीयल-टाइम कोट, एक्स-डिविडेंड डेटा और शेयर नाम खोज';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Google SSO साइन इन';

  @override
  String get publicApiCreditsPageDescriptionsLine =>
      'LINE साइन इन और खाता लिंकिंग';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Gmail, Outlook या अन्य SMTP server के ज़रिए एडमिन संपत्ति रिपोर्ट भेजने का ईमेल चैनल';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'HTTP REST API के ज़रिए एडमिन संपत्ति रिपोर्ट भेजने का ईमेल चैनल';

  @override
  String get publicApiCreditsPageDescriptionsResend =>
      'एडमिन संपत्ति रिपोर्ट भेजने का ईमेल चैनल';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      'एडमिन की पूरी PostgreSQL SQL बैकअप के लिए S3-compatible object storage destination';

  @override
  String get publicAppCallbackReturningTitle =>
      'AssetPilot App पर वापस जा रहे हैं...';

  @override
  String get publicAppCallbackReturningBody =>
      'अगर अपने आप वापस नहीं जाता, तो पक्का करें कि AssetPilot Android App का नया संस्करण इंस्टॉल है।';

  @override
  String get publicAppCallbackPasskeyTitle => 'AssetPilot Passkey साइन इन';

  @override
  String get publicAppCallbackPasskeyStarting =>
      'Passkey साइन इन शुरू हो रहा है...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      'यह ब्राउज़र Passkey का समर्थन नहीं करता';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'Passkey साइन इन चैलेंज नहीं बन पाया';

  @override
  String get publicAppCallbackPasskeyVerify =>
      'अपने डिवाइस पर Passkey सत्यापन पूरा करें...';

  @override
  String get publicAppCallbackPasskeyLoginFailed => 'Passkey साइन इन विफल';

  @override
  String get publicAppCallbackReturningApp => 'App पर वापस जा रहे हैं...';

  @override
  String get publicAppCallbackAppTicketFailed =>
      'App साइन इन credential नहीं बन पाया';

  @override
  String get featuresCommonActions => 'कार्रवाइयाँ';

  @override
  String get featuresCommonAccount => 'खाता';

  @override
  String get featuresCommonAmount => 'राशि';

  @override
  String get featuresCommonDate => 'तारीख';

  @override
  String get featuresCommonEndDate => 'समाप्ति';

  @override
  String get featuresCommonNote => 'नोट';

  @override
  String get featuresCommonStartDate => 'शुरुआत';

  @override
  String get featuresCommonStatus => 'स्थिति';

  @override
  String get featuresCommonStock => 'शेयर';

  @override
  String get featuresCommonType => 'प्रकार';

  @override
  String get featuresCommonName => 'नाम';

  @override
  String get featuresCommonCurrency => 'मुद्रा';

  @override
  String get featuresCommonExchangeRate => 'विनिमय दर';

  @override
  String get featuresCommonIncome => 'आय';

  @override
  String get featuresCommonExpense => 'खर्च';

  @override
  String get featuresCommonUncategorized => 'बिना श्रेणी';

  @override
  String get featuresCommonUnspecified => 'निर्दिष्ट नहीं';

  @override
  String get featuresCommonAutoCalculate => 'अपने आप गणना करें';

  @override
  String get featuresCommonExcludeFromStats => 'आँकड़ों से बाहर रखें';

  @override
  String get featuresCommonTopLevelCategory => '- शीर्ष स्तर -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => 'श्रेणी प्रबंधन';

  @override
  String get featuresCategoriesExpenseTab => 'खर्च की श्रेणियाँ';

  @override
  String get featuresCategoriesIncomeTab => 'आय की श्रेणियाँ';

  @override
  String get featuresCategoriesAddCategory => 'श्रेणी जोड़ें';

  @override
  String get featuresCategoriesEditCategory => 'श्रेणी संपादित करें';

  @override
  String get featuresCategoriesNewCategory => 'श्रेणी जोड़ें';

  @override
  String get featuresCategoriesNameLabel => 'नाम *';

  @override
  String get featuresCategoriesTypeLabel => 'प्रकार';

  @override
  String get featuresCategoriesParentLabel => 'मुख्य श्रेणी';

  @override
  String get featuresCategoriesColorLabel => 'रंग';

  @override
  String get featuresCategoriesExpense => 'खर्च';

  @override
  String get featuresCategoriesIncome => 'आय';

  @override
  String get featuresCategoriesDeleteMessage =>
      'क्या यह श्रेणी हटानी है? इसकी उप-श्रेणियाँ भी हट जाएँगी।';

  @override
  String get featuresCategoriesMessagesNameRequired =>
      'श्रेणी का नाम दर्ज करें';

  @override
  String get featuresCategoriesMessagesDeleteFailed => 'हटाया नहीं जा सका';

  @override
  String get featuresBudgetTitle => 'बजट';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$month/$year';
  }

  @override
  String get featuresBudgetTotalBudget => 'इस महीने का कुल बजट';

  @override
  String get featuresBudgetSpent => 'खर्च किया';

  @override
  String get featuresBudgetAddBudget => 'बजट जोड़ें';

  @override
  String get featuresBudgetEditBudget => 'बजट संपादित करें';

  @override
  String get featuresBudgetNewBudget => 'बजट जोड़ें';

  @override
  String get featuresBudgetCategoryLabel => 'श्रेणी (खाली छोड़ें = कुल बजट)';

  @override
  String get featuresBudgetTotalBudgetOption => '- कुल बजट -';

  @override
  String get featuresBudgetAmountLabel => 'बजट राशि *';

  @override
  String get featuresBudgetTotalBudgetName => '(कुल बजट)';

  @override
  String get featuresBudgetOverBudget => 'बजट से अधिक';

  @override
  String get featuresBudgetDeleteMessage => 'क्या यह बजट हटाना है?';

  @override
  String get featuresBudgetMessagesAmountRequired => 'मान्य बजट राशि दर्ज करें';

  @override
  String get featuresReportsTitle => 'रिपोर्ट';

  @override
  String get featuresReportsTabsCategory => 'श्रेणी विश्लेषण';

  @override
  String get featuresReportsTabsTrend => 'ट्रेंड विश्लेषण';

  @override
  String get featuresReportsTabsDaily => 'दैनिक खर्च';

  @override
  String get featuresReportsPeriodsThisMonth => 'यह महीना';

  @override
  String get featuresReportsPeriodsLastMonth => 'पिछला महीना';

  @override
  String get featuresReportsPeriodsLast3 => 'पिछले 3 महीने';

  @override
  String get featuresReportsPeriodsLast6 => 'पिछले 6 महीने';

  @override
  String get featuresReportsPeriodsThisYear => 'यह वर्ष';

  @override
  String get featuresReportsPeriodsCustom => 'कस्टम अवधि';

  @override
  String get featuresReportsPeriodLabel => 'अवधि';

  @override
  String get featuresReportsStart => 'शुरुआत';

  @override
  String get featuresReportsEnd => 'समाप्ति';

  @override
  String get featuresReportsCurrentTotal => 'मौजूदा कुल';

  @override
  String get featuresReportsComparedPrevious => 'पिछली अवधि से तुलना';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta, पिछली अवधि में डेटा नहीं है';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return 'विवरण: $type';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return 'कुल: $amount';
  }

  @override
  String get featuresReportsSelectedCategory => 'चुनी गई श्रेणी: ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return ', राशि $amount';
  }

  @override
  String get featuresReportsViewTransactions => 'संबंधित लेन-देन देखें';

  @override
  String get featuresRecurringTitle => 'दोहराई जाने वाली आय और खर्च';

  @override
  String get featuresRecurringAdd => 'दोहराव रिकॉर्ड जोड़ें';

  @override
  String get featuresRecurringEdit => 'दोहराव रिकॉर्ड संपादित करें';

  @override
  String get featuresRecurringCreate => 'दोहराव रिकॉर्ड जोड़ें';

  @override
  String get featuresRecurringAmountLabel => 'राशि *';

  @override
  String get featuresRecurringFxFeeLabel => 'विदेशी लेन-देन शुल्क (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder =>
      'खाली: सिस्टम कार्ड की दर से गणना करेगा';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return 'कार्ड विदेशी लेन-देन शुल्क $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return ', सुझाई गई राशि NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading =>
      'नवीनतम विनिमय दर लाई जा रही है...';

  @override
  String get featuresRecurringCategory => 'श्रेणी';

  @override
  String get featuresRecurringFrequency => 'आवृत्ति';

  @override
  String get featuresRecurringStartDate => 'शुरुआत तारीख';

  @override
  String featuresRecurringNextRun(Object date) {
    return 'अगली बार: $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return 'श्रेणी: $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return 'खाता: $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return 'विदेशी लेन-देन शुल्क: NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage =>
      'क्या यह दोहराव रिकॉर्ड हटाना है?';

  @override
  String get featuresRecurringCreatingTransfer => 'बनाया जा रहा है...';

  @override
  String get featuresRecurringConfirmTransfer => 'ट्रांसफ़र की पुष्टि करें';

  @override
  String get featuresRecurringFrequencyLabelsDaily => 'रोज़';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => 'हर सप्ताह';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => 'हर महीने';

  @override
  String get featuresRecurringFrequencyLabelsYearly => 'हर साल';

  @override
  String get featuresRecurringMessagesAmountRequired => 'मान्य राशि दर्ज करें';

  @override
  String get featuresDataTransferTitle => 'डेटा एक्सपोर्ट और इम्पोर्ट';

  @override
  String get featuresDataTransferExportStartDate => 'एक्सपोर्ट शुरू तारीख';

  @override
  String get featuresDataTransferExportEndDate => 'एक्सपोर्ट समाप्त तारीख';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'CSV एक्सपोर्ट और इम्पोर्ट समर्थित हैं। कॉलम: $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'CSV एक्सपोर्ट करें';

  @override
  String get featuresDataTransferExporting => 'एक्सपोर्ट हो रहा है...';

  @override
  String get featuresDataTransferChooseCsv => 'इम्पोर्ट के लिए CSV चुनें';

  @override
  String get featuresDataTransferImporting => 'इम्पोर्ट हो रहा है...';

  @override
  String featuresDataTransferImported(Object count) {
    return 'इम्पोर्ट हुए: $count रिकॉर्ड';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return 'छोड़े गए: $count रिकॉर्ड';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return 'अपने आप बनी श्रेणियाँ: $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return 'अपने आप बने खाते: $items';
  }

  @override
  String get featuresDataTransferWarning => 'चेतावनी';

  @override
  String get featuresDataTransferError => 'त्रुटि';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return 'पंक्ति $row: $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => 'खाते';

  @override
  String get featuresDataTransferModulesTransactions => 'लेन-देन';

  @override
  String get featuresDataTransferModulesCategories => 'श्रेणियाँ';

  @override
  String get featuresDataTransferModulesStockTransactions => 'शेयर लेन-देन';

  @override
  String get featuresDataTransferModulesStockDividends => 'डिविडेंड';

  @override
  String get featuresDataTransferMessagesExportSuccess => 'एक्सपोर्ट पूरा हुआ';

  @override
  String get featuresDataTransferMessagesExportFailed =>
      'एक्सपोर्ट नहीं हो पाया';

  @override
  String get featuresDataTransferMessagesEmptyCsv =>
      'इम्पोर्ट करने के लिए CSV में डेटा नहीं है';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return '$name इम्पोर्ट पूरा हुआ';
  }

  @override
  String get featuresDataTransferMessagesImportFailed =>
      'इम्पोर्ट नहीं हो पाया';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      'पूरा डेटा बैकअप डाउनलोड हो गया';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      'पूरा डेटा बैकअप डाउनलोड नहीं हो पाया';

  @override
  String get featuresDataTransferMessagesRestoreDone => 'रिस्टोर पूरा हुआ';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      'डेटा बैकअप रिस्टोर नहीं हो पाया';

  @override
  String get featuresDataTransferMessagesDbExportDone =>
      'डेटाबेस बैकअप डाउनलोड हो गया';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      'डेटाबेस बैकअप नहीं बन पाया';

  @override
  String get featuresDataTransferMessagesDbRestoreDone =>
      'डेटाबेस रिस्टोर हो गया';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      'डेटाबेस रिस्टोर नहीं हो पाया';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return '$bucket/$key पर अपलोड हुआ';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed =>
      'MEGA S4 बैकअप विफल';

  @override
  String get featuresDataTransferMessagesRequireOneField =>
      'कम से कम एक फ़ील्ड भरें';

  @override
  String get featuresDataTransferMessagesSaved => 'सेटिंग्स सेव हो गईं';

  @override
  String get featuresDataTransferMessagesSaveFailed =>
      'सेटिंग्स सेव नहीं हो पाईं';

  @override
  String get featuresDataTransferBundleTitle =>
      'पूरा डेटा बैकअप (तस्वीरों सहित)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      'अपने सभी व्यक्तिगत डेटा का एक ZIP डाउनलोड करें: लेन-देन, खाते, श्रेणियाँ, बजट, बिलिंग साइकिल, विनिमय दरें, शेयर और रसीद की तस्वीरें।';

  @override
  String get featuresDataTransferBundleDescription2 =>
      'उसी ZIP को अपलोड करके डेटा रिस्टोर किया जा सकता है।';

  @override
  String get featuresDataTransferBundleRestorePrefix => 'रिस्टोर';

  @override
  String get featuresDataTransferBundleMergeMode => 'merge mode';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      'का उपयोग करता है: मौजूदा डेटा छोड़ा जाता है और केवल कमी वाले रिकॉर्ड जोड़े जाते हैं;';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      'मौजूदा डेटा हटाया या ओवरराइट नहीं किया जाएगा';

  @override
  String get featuresDataTransferBundleDownload =>
      'पूरा डेटा बैकअप डाउनलोड करें';

  @override
  String get featuresDataTransferBundleDownloading =>
      'डाउनलोड तैयार हो रहा है...';

  @override
  String get featuresDataTransferBundleRestore =>
      'रिस्टोर के लिए डेटा बैकअप अपलोड करें';

  @override
  String get featuresDataTransferBundleRestoring => 'रिस्टोर हो रहा है...';

  @override
  String get featuresDataTransferDatabaseTitle =>
      'पूरा डेटाबेस बैकअप / रिस्टोर';

  @override
  String get featuresDataTransferDatabaseDescription =>
      'केवल एडमिन के लिए। SQLite mode में `.db` बैकअप डाउनलोड होता है; PostgreSQL में `.sql` डाउनलोड होता है। रिस्टोर करने के लिए संबंधित फ़ॉर्मेट अपलोड करें।';

  @override
  String get featuresDataTransferDatabaseDownload =>
      'डेटाबेस बैकअप डाउनलोड करें';

  @override
  String get featuresDataTransferDatabaseDownloading => 'डाउनलोड हो रहा है...';

  @override
  String get featuresDataTransferDatabaseRestore =>
      'रिस्टोर के लिए डेटाबेस बैकअप चुनें';

  @override
  String get featuresDataTransferDatabaseRestoring => 'रिस्टोर हो रहा है...';

  @override
  String get featuresDataTransferMegaTitle => 'MEGA S4 क्लाउड बैकअप';

  @override
  String get featuresDataTransferMegaDescription =>
      'मौजूदा SQLite पूर्ण बैकअप को MEGA S4 bucket में object के रूप में अपलोड करता है। कनेक्शन सर्वर environment variables से सेट होता है; कुंजियाँ ब्राउज़र में दर्ज या दिखाई नहीं जातीं।';

  @override
  String get featuresDataTransferMegaState => 'स्थिति: ';

  @override
  String get featuresDataTransferMegaConfigured => 'सेट है';

  @override
  String get featuresDataTransferMegaNotConfigured => 'सेटअप अधूरा है';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket: ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return 'गुम environment variables: $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'MEGA S4 पर बैकअप अपलोड करें';

  @override
  String get featuresDataTransferMegaUploading => 'अपलोड हो रहा है...';

  @override
  String get featuresDataTransferMegaConfigure => 'सेट करें';

  @override
  String get featuresDataTransferMegaCancelConfigure => 'सेटअप रद्द करें';

  @override
  String get featuresDataTransferMegaFormHelp =>
      'सेटिंग्स सर्वर पर स्थायी फ़ाइल में लिखी जाती हैं और तुरंत लागू होती हैं। कुंजी वाले फ़ील्ड फिर से दर्ज करने होंगे; वे अपने आप नहीं भरेंगे।';

  @override
  String get featuresDataTransferMegaBucketName => 'Bucket नाम';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefix (वैकल्पिक)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (वैकल्पिक, auto-detect के लिए खाली छोड़ें)';

  @override
  String get featuresDataTransferMegaSaveSettings => 'सेटिंग्स सेव करें';

  @override
  String get featuresAccountsTitle => 'खाते';

  @override
  String get featuresAccountsTypeLabelsBank => 'बैंक खाता';

  @override
  String get featuresAccountsTypeLabelsCredit_card => 'क्रेडिट कार्ड';

  @override
  String get featuresAccountsTypeLabelsCash => 'नकद';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => 'डिजिटल वॉलेट';

  @override
  String get featuresAccountsTypeLabelsOther => 'अन्य';

  @override
  String get featuresAccountsTotalAssets => 'कुल संपत्ति';

  @override
  String get featuresAccountsCreditOutstanding => 'क्रेडिट कार्ड बकाया';

  @override
  String get featuresAccountsAddAccount => 'खाता जोड़ें';

  @override
  String get featuresAccountsEditAccount => 'खाता संपादित करें';

  @override
  String get featuresAccountsNewAccount => 'खाता जोड़ें';

  @override
  String get featuresAccountsAccountName => 'खाते का नाम *';

  @override
  String get featuresAccountsInitialBalance => 'शुरुआती बैलेंस';

  @override
  String get featuresAccountsInitialBalanceEdit =>
      'शुरुआती बैलेंस / मौजूदा सेटिंग';

  @override
  String get featuresAccountsLinkedBank => 'बैंक';

  @override
  String get featuresAccountsUngrouped => 'बिना समूह';

  @override
  String get featuresAccountsOverseasFeeRate => 'विदेशी लेन-देन शुल्क दर (%)';

  @override
  String get featuresAccountsStatementClosingDay =>
      'स्टेटमेंट क्लोजिंग दिन (1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      'जैसे: 15. मौजूदा साइकिल गणना नहीं करनी हो तो खाली छोड़ें।';

  @override
  String get featuresAccountsExcludeFromTotal => 'कुल संपत्ति में शामिल न करें';

  @override
  String get featuresAccountsOtherAccounts => 'अन्य खाते';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return 'कन्वर्ट होने के बाद कुल: $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return 'लिंक किया बैंक: $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return 'विदेशी लेन-देन शुल्क: $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return 'मासिक क्लोजिंग दिन: $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return 'मौजूदा साइकिल खर्च: $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => 'पिछला स्टेटमेंट: ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return 'खर्च $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return 'भुगतान $amount';
  }

  @override
  String get featuresAccountsViewCycles => 'साइकिल विवरण देखें ›';

  @override
  String get featuresAccountsRepaymentTitle => 'क्रेडिट कार्ड भुगतान';

  @override
  String get featuresAccountsRepaymentPaymentAccount => 'भुगतान खाता';

  @override
  String get featuresAccountsRepaymentPaymentDate => 'भुगतान तारीख';

  @override
  String get featuresAccountsRepaymentNoLinkedCards =>
      'इस बैंक से कोई कार्ड लिंक नहीं है';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return 'मौजूदा बैलेंस: $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => 'भुगतान राशि';

  @override
  String get featuresAccountsRepaymentConfirm => 'भुगतान की पुष्टि करें';

  @override
  String get featuresAccountsDeleteMessage => 'क्या यह खाता हटाना है?';

  @override
  String get featuresAccountsCyclesTitle => 'स्टेटमेंट साइकिल विवरण';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name मासिक क्लोजिंग दिन $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      'भुगतान उस स्टेटमेंट से मिलाए जाते हैं जो क्लोज हो चुका है। क्लोजिंग के बाद किए गए भुगतान उसी साइकिल में गिने जाते हैं।';

  @override
  String get featuresAccountsCyclesPeriod => 'अवधि';

  @override
  String get featuresAccountsCyclesSpending => 'खर्च';

  @override
  String get featuresAccountsCyclesPayment => 'वास्तविक भुगतान';

  @override
  String get featuresAccountsCyclesCurrent => 'मौजूदा';

  @override
  String get featuresAccountsFxTitle => 'विनिमय दर प्रबंधन';

  @override
  String get featuresAccountsFxAutoUpdate => 'विनिमय दर अपने आप अपडेट करें';

  @override
  String get featuresAccountsFxSyncNow => 'अभी सिंक करें';

  @override
  String get featuresAccountsFxSyncing => 'सिंक हो रहा है...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return 'आखिरी सिंक: $date';
  }

  @override
  String get featuresAccountsFxCurrency => 'मुद्रा';

  @override
  String get featuresAccountsFxUnitToTwd => '1 यूनिट = TWD';

  @override
  String get featuresAccountsFxEmpty => 'अभी कोई विदेशी मुद्रा दर सेट नहीं है';

  @override
  String get featuresAccountsFxCurrencyLabel => 'मुद्रा (जैसे USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'TWD के मुकाबले दर';

  @override
  String get featuresAccountsFxAddOrUpdate => 'जोड़ें / अपडेट करें';

  @override
  String get featuresAccountsMessagesNameRequired => 'खाते का नाम दर्ज करें';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired =>
      'भुगतान खाता चुनें';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      'कम से कम एक कार्ड के लिए भुगतान राशि दर्ज करें';

  @override
  String get featuresAccountsMessagesCurrencyInvalid =>
      'मुद्रा 3 अक्षरों का कोड होना चाहिए';

  @override
  String get featuresAccountsMessagesRateInvalid => 'मान्य विनिमय दर दर्ज करें';

  @override
  String get featuresAccountsMessagesSaved => 'सेव हो गया';

  @override
  String get featuresAccountsMessagesSaveFailed => 'सेव नहीं हो पाया';

  @override
  String get featuresAccountsMessagesDeleteFailed => 'हटाया नहीं जा सका';

  @override
  String get featuresAccountsMessagesRatesUpdated => 'विनिमय दरें अपडेट हो गईं';

  @override
  String get featuresAccountsMessagesSyncFailed => 'सिंक नहीं हो पाया';

  @override
  String get featuresAccountsMessagesLoadFailed => 'लोड नहीं हो पाया';

  @override
  String get featuresTransactionsTitle => 'लेन-देन';

  @override
  String get featuresTransactionsSearchPlaceholder => 'नोट खोजें...';

  @override
  String get featuresTransactionsAllTypes => 'सभी प्रकार';

  @override
  String get featuresTransactionsAllAccounts => 'सभी खाते';

  @override
  String get featuresTransactionsAllCategories => 'सभी श्रेणियाँ';

  @override
  String get featuresTransactionsTransfer => 'ट्रांसफ़र';

  @override
  String get featuresTransactionsFuture => 'भविष्य की लेन-देन';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (सभी)';
  }

  @override
  String get featuresTransactionsStartDateTitle => 'शुरुआत तारीख';

  @override
  String get featuresTransactionsEndDateTitle => 'समाप्ति तारीख';

  @override
  String get featuresTransactionsAdd => 'लेन-देन जोड़ें';

  @override
  String get featuresTransactionsEdit => 'लेन-देन संपादित करें';

  @override
  String get featuresTransactionsCreate => 'लेन-देन जोड़ें';

  @override
  String get featuresTransactionsAccountTransfer => 'खातों के बीच ट्रांसफ़र';

  @override
  String get featuresTransactionsBatchCategory => 'श्रेणी batch में बदलें';

  @override
  String get featuresTransactionsBatchDate => 'तारीख batch में बदलें';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return 'चुने हुए हटाएँ ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => 'इस पेज की आय';

  @override
  String get featuresTransactionsPageExpense => 'इस पेज का खर्च';

  @override
  String get featuresTransactionsPageTotal => 'इस पेज का कुल';

  @override
  String get featuresTransactionsPageSummaryAria => 'इस पेज की लेन-देन सारांश';

  @override
  String get featuresTransactionsEmpty => 'कोई मेल खाती लेन-देन नहीं';

  @override
  String featuresTransactionsSource(Object name) {
    return 'स्रोत: $name';
  }

  @override
  String get featuresTransactionsFxFee => 'विदेशी कार्ड शुल्क';

  @override
  String get featuresTransactionsPhotoOne => '1 तस्वीर';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count तस्वीरें';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => 'तारीख *';

  @override
  String get featuresTransactionsAmountRequiredLabel => 'राशि *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return 'विनिमय दर (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder =>
      'खाली: सिस्टम दर उपयोग करें';

  @override
  String get featuresTransactionsLatestRateLoading =>
      'नवीनतम विनिमय दर लाई जा रही है...';

  @override
  String get featuresTransactionsFxFeePlaceholder =>
      'खाली: सिस्टम कार्ड की दर से गणना करेगा';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return 'कार्ड विदेशी लेन-देन शुल्क $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return ', सुझाई गई राशि NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => 'तस्वीरें';

  @override
  String get featuresTransactionsLoadingPhotos => 'तस्वीरें लोड हो रही हैं...';

  @override
  String get featuresTransactionsTakePhoto => 'तस्वीर लें';

  @override
  String get featuresTransactionsChooseImage => 'छवि चुनें';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return 'मोबाइल पर आप तस्वीर ले सकते हैं या गैलरी से चुन सकते हैं। अधिकतम 5 तस्वीरें, हर तस्वीर $maxMb MB तक।';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return 'नई तस्वीरें $count';
  }

  @override
  String get featuresTransactionsRemove => 'हटाएँ';

  @override
  String get featuresTransactionsChoosePhoto => 'तस्वीर चुनें';

  @override
  String get featuresTransactionsTransferOut => 'निकासी खाता *';

  @override
  String get featuresTransactionsTransferIn => 'जमा खाता *';

  @override
  String get featuresTransactionsSelectPlaceholder => 'चुनें';

  @override
  String get featuresTransactionsCreating => 'बन रहा है...';

  @override
  String get featuresTransactionsConfirmTransfer => 'ट्रांसफ़र की पुष्टि करें';

  @override
  String get featuresTransactionsBatchCategoryTitle => 'श्रेणी batch में बदलें';

  @override
  String get featuresTransactionsBatchDateTitle => 'तारीख batch में बदलें';

  @override
  String get featuresTransactionsNewCategory => 'नई श्रेणी';

  @override
  String get featuresTransactionsNewDate => 'नई तारीख';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return '$count रिकॉर्ड पर लागू करें';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      'क्या यह लेन-देन हटाना है? यह कार्रवाई वापस नहीं की जा सकती।';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return 'चुनी गई लेन-देन हटाएँ: $count?';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return 'लेन-देन अपडेट हो गई, लेकिन $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return 'लेन-देन बन गई, लेकिन $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      'ट्रांसफ़र को हटाकर फिर से बनाना होगा';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      'विदेशी कार्ड शुल्क अपने आप बनता है। संबंधित विदेशी मुद्रा लेन-देन को संपादित करें; इसके बाद शुल्क सिंक हो जाएगा।';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed =>
      'तस्वीर अपलोड नहीं हो पाई';

  @override
  String get featuresTransactionsMessagesDateRequired => 'तारीख चुनें';

  @override
  String get featuresTransactionsMessagesAmountRequired =>
      'मान्य राशि दर्ज करें';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      'निकासी और जमा खाते चुनें';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      'निकासी और जमा खाता एक जैसा नहीं हो सकता';

  @override
  String get featuresTransactionsTypeLabelsIncome => 'आय';

  @override
  String get featuresTransactionsTypeLabelsExpense => 'खर्च';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => 'आवक ट्रांसफ़र';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => 'जावक ट्रांसफ़र';

  @override
  String get featuresStocksTabsPortfolio => 'पोर्टफ़ोलियो';

  @override
  String get featuresStocksTabsTransactions => 'लेन-देन';

  @override
  String get featuresStocksTabsDividends => 'डिविडेंड';

  @override
  String get featuresStocksTabsRealized => 'वास्तविक P/L';

  @override
  String get featuresStocksTabsSettings => 'ट्रेडिंग सेटिंग्स';

  @override
  String get featuresStocksCommonStockLabel => 'शेयर';

  @override
  String get featuresStocksCommonStockRequired => 'शेयर *';

  @override
  String get featuresStocksCommonStockTypeStock => 'शेयर';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => 'वारंट';

  @override
  String get featuresStocksCommonDate => 'तारीख';

  @override
  String get featuresStocksCommonShares => 'शेयर';

  @override
  String get featuresStocksCommonPrice => 'कीमत';

  @override
  String get featuresStocksCommonTotal => 'कुल';

  @override
  String get featuresStocksCommonReturnRate => 'रिटर्न';

  @override
  String get featuresStocksCommonOverallReturnRate => 'कुल रिटर्न';

  @override
  String get featuresStocksCommonEstimatedPL => 'अनुमानित P/L';

  @override
  String get featuresStocksCommonRealizedPL => 'वास्तविक P/L';

  @override
  String get featuresStocksCommonTotalRealizedPL => 'कुल वास्तविक P/L';

  @override
  String get featuresStocksCommonYearRealizedPL => 'इस वर्ष का वास्तविक P/L';

  @override
  String get featuresStocksCommonRealizedCount => 'वास्तविक रिकॉर्ड';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count रिकॉर्ड';
  }

  @override
  String get featuresStocksCommonSellAverage => 'औसत बिक्री मूल्य';

  @override
  String get featuresStocksCommonCostAverage => 'औसत लागत';

  @override
  String get featuresStocksCommonFeeAndTax => 'शुल्क + टैक्स';

  @override
  String get featuresStocksCommonCashDividend => 'नकद डिविडेंड';

  @override
  String get featuresStocksCommonStockDividend => 'शेयर डिविडेंड';

  @override
  String get featuresStocksCommonStockSymbol => 'शेयर कोड *';

  @override
  String get featuresStocksCommonStockName => 'शेयर नाम';

  @override
  String get featuresStocksCommonSearching => 'खोज हो रही है...';

  @override
  String get featuresStocksCommonCancelAccounting =>
      '- खाते में पोस्ट न करें (सिर्फ़ शेयर डिविडेंड) -';

  @override
  String get featuresStocksCommonAutoCalculate => 'अपने आप गणना करें';

  @override
  String get featuresStocksCommonBuy => 'खरीदें';

  @override
  String get featuresStocksCommonSell => 'बेचें';

  @override
  String get featuresStocksPortfolioTitle => 'पोर्टफ़ोलियो';

  @override
  String get featuresStocksPortfolioTotalMarketValue => 'कुल बाज़ार मूल्य';

  @override
  String get featuresStocksPortfolioTotalCost => 'कुल निवेश लागत';

  @override
  String get featuresStocksPortfolioTotalDividend => 'कुल डिविडेंड';

  @override
  String get featuresStocksPortfolioAddStock => 'शेयर जोड़ें';

  @override
  String get featuresStocksPortfolioEditStock => 'शेयर संपादित करें';

  @override
  String get featuresStocksPortfolioNewStock => 'शेयर जोड़ें';

  @override
  String get featuresStocksPortfolioUpdatePrices => 'कीमतें अपडेट करें';

  @override
  String get featuresStocksPortfolioBatchUpdate => 'Batch auto-update';

  @override
  String get featuresStocksPortfolioUpdating => 'अपडेट हो रहा है...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'AssetPilot पहले ब्राउज़र से TWSE public API को कॉल करता है। यदि अनुरोध ब्लॉक हो, तो साइन इन के बाद user API proxy का उपयोग करके होल्डिंग्स अपडेट की जाती हैं।';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return 'अपडेट पूरा: $updated सफल।';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return 'अपडेट पूरा: $updated सफल, $failed विफल।';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      'ब्राउज़र से TWSE डेटा नहीं मिल पाया';

  @override
  String get featuresStocksPortfolioHeldShares => 'होल्डिंग शेयर';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count शेयर';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => 'मौजूदा कीमत';

  @override
  String get featuresStocksPortfolioMarketValue => 'बाज़ार मूल्य';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired =>
      'शेयर कोड दर्ज करें';

  @override
  String get featuresStocksTransactionsTitle => 'शेयर लेन-देन';

  @override
  String get featuresStocksTransactionsAddTransaction => 'लेन-देन जोड़ें';

  @override
  String get featuresStocksTransactionsEditTransaction =>
      'लेन-देन संपादित करें';

  @override
  String get featuresStocksTransactionsNewTransaction => 'लेन-देन जोड़ें';

  @override
  String get featuresStocksTransactionsTypeLabel => 'प्रकार';

  @override
  String get featuresStocksTransactionsDateLabel => 'तारीख *';

  @override
  String get featuresStocksTransactionsSharesLabel => 'शेयर संख्या *';

  @override
  String get featuresStocksTransactionsPriceLabel => 'प्रति शेयर कीमत *';

  @override
  String get featuresStocksTransactionsFeeLabel => 'ब्रोकरेज शुल्क';

  @override
  String get featuresStocksTransactionsTaxLabel => 'लेन-देन टैक्स';

  @override
  String get featuresStocksTransactionsDeleteMessage =>
      'क्या यह लेन-देन हटाना है?';

  @override
  String get featuresStocksTransactionsMessagesStockRequired => 'शेयर चुनें';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      'मान्य शेयर संख्या दर्ज करें';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired =>
      'मान्य कीमत दर्ज करें';

  @override
  String get featuresStocksDividendsTitle => 'डिविडेंड';

  @override
  String get featuresStocksDividendsAddDividend => 'डिविडेंड जोड़ें';

  @override
  String get featuresStocksDividendsEditDividend => 'डिविडेंड संपादित करें';

  @override
  String get featuresStocksDividendsNewDividend => 'डिविडेंड जोड़ें';

  @override
  String get featuresStocksDividendsSyncExDividends =>
      'एक्स-डिविडेंड सिंक करें';

  @override
  String get featuresStocksDividendsSyncDescription =>
      'आपकी होल्डिंग्स के आधार पर TWSE का ऐतिहासिक एक्स-डिविडेंड डेटा अपने आप सिंक करता है।';

  @override
  String get featuresStocksDividendsSyncStart => 'सिंक शुरू करें';

  @override
  String get featuresStocksDividendsSyncing => 'सिंक हो रहा है...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return '$synced जोड़े गए, $skipped छोड़े गए।';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return '$synced जोड़े गए, $skipped छोड़े गए, $failed विफल।';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel => 'नकद डिविडेंड (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel => 'शेयर डिविडेंड';

  @override
  String get featuresStocksDividendsDepositAccount => 'जमा खाता';

  @override
  String get featuresStocksDividendsDeleteMessage =>
      'क्या यह डिविडेंड हटाना है?';

  @override
  String get featuresStocksDividendsMessagesStockRequired => 'शेयर चुनें';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      'नकद डिविडेंड या शेयर डिविडेंड दर्ज करें';

  @override
  String get featuresStocksRealizedTitle => 'वास्तविक P/L';

  @override
  String get featuresStocksSettingsTitle => 'ट्रेडिंग सेटिंग्स';

  @override
  String get featuresStocksSettingsFeeTitle => 'ब्रोकरेज शुल्क / लेन-देन टैक्स';

  @override
  String get featuresStocksSettingsFeeRate => 'ब्रोकरेज शुल्क दर';

  @override
  String get featuresStocksSettingsFeeDiscount => 'डिस्काउंट (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot => 'न्यूनतम शुल्क (पूरी lot)';

  @override
  String get featuresStocksSettingsFeeMinOdd => 'न्यूनतम शुल्क (odd lot)';

  @override
  String get featuresStocksSettingsSellTaxRateStock => 'बिक्री टैक्स दर (शेयर)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => 'बिक्री टैक्स दर (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant =>
      'बिक्री टैक्स दर (वारंट)';

  @override
  String get featuresStocksSettingsSellTaxMin => 'न्यूनतम लेन-देन टैक्स';

  @override
  String get featuresStocksSettingsSaveSettings => 'सेटिंग्स सेव करें';

  @override
  String get featuresStocksSettingsStockStatusTitle => 'शेयर स्थिति';

  @override
  String get featuresStocksSettingsCurrentPrice => 'मौजूदा कीमत';

  @override
  String get featuresStocksSettingsNormalTracking => 'सामान्य ट्रैकिंग';

  @override
  String get featuresStocksSettingsDelisted => 'डिलिस्टेड';

  @override
  String get featuresStocksSettingsRestoreTracking => 'ट्रैकिंग फिर शुरू करें';

  @override
  String get featuresStocksSettingsMarkDelisted => 'डिलिस्टेड मार्क करें';

  @override
  String get featuresStocksSettingsRecurringTitle => 'दोहराव शेयर निवेश';

  @override
  String get featuresStocksSettingsAddRecurringShort => 'जोड़ें';

  @override
  String get featuresStocksSettingsEditRecurring => 'दोहराव निवेश संपादित करें';

  @override
  String get featuresStocksSettingsNewRecurring => 'दोहराव निवेश जोड़ें';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => 'राशि (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => 'आवृत्ति';

  @override
  String get featuresStocksSettingsStartDate => 'शुरुआत तारीख';

  @override
  String get featuresStocksSettingsLastGenerated => 'आखिरी जनरेट';

  @override
  String get featuresStocksSettingsActive => 'सक्रिय';

  @override
  String get featuresStocksSettingsInactive => 'निष्क्रिय';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm =>
      'क्या यह दोहराव निवेश हटाना है?';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => 'रोज़';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => 'हर सप्ताह';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => 'हर महीने';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => 'हर साल';

  @override
  String get featuresStocksSettingsMessagesSaved => 'सेटिंग्स सेव हो गईं';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return 'सेव नहीं हो पाया: $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired => 'शेयर चुनें';

  @override
  String get featuresStocksSettingsMessagesAmountRequired =>
      'मान्य राशि दर्ज करें';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol: स्थिति $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus =>
      'सामान्य ट्रैकिंग फिर शुरू';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus =>
      'डिलिस्टेड मार्क किया गया';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      'डिलिस्टिंग स्थिति अपडेट नहीं हो पाई';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => 'दैनिक कैश-फ़्लो रिपोर्ट';

  @override
  String get notificationsReportTypeWeekly => 'साप्ताहिक कैश-फ़्लो रिपोर्ट';

  @override
  String get notificationsReportTypeMonthly => 'मासिक कैश-फ़्लो रिपोर्ट';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return 'दैनिक कैश-फ़्लो रिपोर्ट｜$date ($weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return 'साप्ताहिक कैश-फ़्लो रिपोर्ट｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return 'मासिक कैश-फ़्लो रिपोर्ट｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name, $date ($weekday) का कैश-फ़्लो';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name, $start ~ $end का कैश-फ़्लो';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name, $month का कैश-फ़्लो';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 रिपोर्ट तारीख $date　·　भेजा गया $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 रिपोर्ट अवधि $start ~ $end　·　भेजा गया $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 रिपोर्ट माह $month　·　भेजा गया $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return 'कल पूरे दिन ($date, $weekday) का सारांश; आज ($sendDate) भेजा गया';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return 'पिछले 7 दिनों ($start ~ $end) का सारांश; आज ($sendDate) भेजा गया';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return 'पिछले महीने ($month, $start ~ $end) का सारांश; इस महीने ($sendDate) भेजा गया';
  }

  @override
  String get notificationsLeadDaily => 'कल';

  @override
  String get notificationsLeadWeekly => 'इस सप्ताह';

  @override
  String get notificationsLeadMonthly => 'पिछला महीना';

  @override
  String notificationsKpiIncome(Object lead) {
    return '$lead की आय';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return '$lead का खर्च';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return '$lead का नेट';
  }

  @override
  String get notificationsCompareLabelDaily => 'पिछले दिन की तुलना';

  @override
  String get notificationsCompareLabelWeekly => 'पिछले सप्ताह की तुलना';

  @override
  String get notificationsCompareLabelMonthly => 'पिछले महीने की तुलना';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return 'कल ($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return 'पिछले 7 दिन ($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return 'पिछला महीना ($month)';
  }

  @override
  String get notificationsSectionsBalance => 'खातों का बैलेंस';

  @override
  String get notificationsSectionsTopCategories => 'इस महीने के टॉप 5 खर्च';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return '$month के टॉप 5 खर्च';
  }

  @override
  String get notificationsSectionsDailyDetail => 'दैनिक विवरण';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return 'महीने का संचयी ($month)';
  }

  @override
  String get notificationsSectionsStock => 'शेयर निवेश';

  @override
  String get notificationsSectionsRecentDaily => 'कल की लेन-देन';

  @override
  String get notificationsSectionsRecentWeekly => 'इस सप्ताह की लेन-देन';

  @override
  String get notificationsSectionsRecentMonthly => 'पिछले महीने की लेन-देन';

  @override
  String get notificationsLabelsIncome => 'आय';

  @override
  String get notificationsLabelsExpense => 'खर्च';

  @override
  String get notificationsLabelsNet => 'नेट';

  @override
  String get notificationsLabelsCost => 'कुल लागत';

  @override
  String get notificationsLabelsMarketValue => 'बाज़ार मूल्य';

  @override
  String get notificationsLabelsUnrealizedPL => 'अवास्तविक P/L';

  @override
  String get notificationsLabelsReturnRate => 'रिटर्न';

  @override
  String get notificationsLabelsUncategorized => 'बिना श्रेणी';

  @override
  String get notificationsTableDate => 'तारीख';

  @override
  String get notificationsEmptyNoAccount => 'अभी कोई खाता नहीं';

  @override
  String get notificationsEmptyNoExpense => 'अभी कोई खर्च नहीं';

  @override
  String notificationsEmptyNoTx(Object label) {
    return '$label के लिए कोई लेन-देन नहीं';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return 'शेयर: बाज़ार मूल्य $marketValue, अवास्तविक P/L $pl';
  }

  @override
  String get notificationsCtaViewFullReport => 'पूरी रिपोर्ट देखें';

  @override
  String get notificationsCtaViewLineRecord => 'LINE रिकॉर्ड देखें';

  @override
  String get notificationsReminderAltText => 'खर्च याद दिलाने वाला संदेश';

  @override
  String get notificationsReminderTitle => 'आज का खर्च दर्ज करना न भूलें';

  @override
  String notificationsReminderBody(Object name) {
    return '$name, आज के खर्च दर्ज करने में 10 सेकंड लगाएँ ताकि महीने के अंत में कुछ छूट न जाए।';
  }

  @override
  String get notificationsReminderHint =>
      'खर्च जोड़ें पर टैप करें, फिर लिखें: राशि नोट तारीख (तारीख वैकल्पिक)';

  @override
  String get notificationsReminderFallbackName => 'नमस्ते';

  @override
  String get notificationsReminderAddExpense => 'खर्च जोड़ें';

  @override
  String get notificationsReminderViewToday => 'आज के रिकॉर्ड देखें';

  @override
  String get notificationsFallbackUser => 'यूज़र';

  @override
  String get mobileLegacyMessagebde18a20 => '・कुल संपत्ति में शामिल नहीं';

  @override
  String get mobileLegacyNoneCreateAsParent =>
      '(कोई नहीं, मुख्य श्रेणी के रूप में)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      'Home में महीने के हिसाब से आय, खर्च, नेट और खर्च श्रेणी चार्ट दिखता है। महीनों के बीच स्वाइप करके देखें कि पैसा कहाँ गया।';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      'भुगतान उसी स्टेटमेंट से जोड़े जाते हैं जिसे वे चुकाते हैं, भले ही बंद होने के बाद अगले चक्र में चुकाए गए हों।';

  @override
  String get mobileLegacy0NoPayment => '0 = भुगतान नहीं';

  @override
  String get mobileLegacyMon => 'सोम';

  @override
  String get mobileLegacyStock => 'Stock';

  @override
  String get mobileLegacyStocks => 'Stocks (%)';

  @override
  String get mobileLegacyTue => 'मंगल';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      'Deposit account (cash dividend होने पर अनिवार्य)';

  @override
  String get mobileLegacyWed => 'बुध';

  @override
  String get mobileLegacyPreviousStatement => 'पिछला स्टेटमेंट ';

  @override
  String get mobileLegacyNext => 'आगे';

  @override
  String get mobileLegacyDelisted => 'डिलिस्टेड';

  @override
  String get mobileLegacySubcategory => 'उप-श्रेणी';

  @override
  String get mobileLegacyDeleted => 'हटा दिया गया';

  @override
  String get mobileLegacyUpdated => 'अपडेट हो गया';

  @override
  String get mobileLegacyLinked => 'लिंक है';

  @override
  String get mobileLegacyUnlinked => 'लिंक हट गया';

  @override
  String get mobileLegacyTotalRealizedPL => 'कुल realized P/L';

  @override
  String get mobileLegacyFri => 'शुक्र';

  @override
  String get mobileLegacyStandardRate01 => 'Standard rate: 0.1%';

  @override
  String get mobileLegacyStandardRate03 => 'Standard rate: 0.3%';

  @override
  String get mobileLegacySat => 'शनि';

  @override
  String get mobileLegacyCategoryName => 'श्रेणी नाम';

  @override
  String get mobileLegacyFeeOptional => 'शुल्क (वैकल्पिक)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      'Fee और tax खाली छोड़ें तो backend अपने आप calculate करेगा';

  @override
  String get mobileLegacyCommissionRate => 'शुल्क दर (%)';

  @override
  String get mobileLegacyDay => 'रवि';

  @override
  String get mobileLegacyMonthlyBudget => 'मासिक बजट';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      'मुख्य श्रेणी (न चुनें = मुख्य श्रेणी बनाएँ)';

  @override
  String get mobileLegacyTheme => 'थीम';

  @override
  String get mobileLegacyThu => 'गुरु';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => 'अज्ञात श्रेणी';

  @override
  String get mobileLegacyNotLinked => 'लिंक नहीं है';

  @override
  String get mobileLegacyNoTransactionsThisMonth => 'इस महीने कोई लेन-देन नहीं';

  @override
  String get mobileLegacyNoBudgetThisMonth => 'इस महीने कोई बजट नहीं है';

  @override
  String get mobileLegacyNetThisMonth => 'इस महीने का नेट';

  @override
  String get mobileLegacyPositiveWholeNumber => 'धनात्मक पूर्णांक';

  @override
  String get mobileLegacyDeletePermanently => 'हमेशा के लिए हटाएँ';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      'खाता और सभी डेटा स्थायी रूप से हटाएँ';

  @override
  String get mobileLegacyNoReleaseNotesAvailable => 'अभी कोई अपडेट नोट नहीं';

  @override
  String get mobileLegacyCurrentDevice => 'मौजूदा device';

  @override
  String get mobileLegacyTransactions => 'लेन-देन';

  @override
  String get mobileLegacyAll => 'सभी';

  @override
  String get mobileLegacyAllCategories => 'सभी श्रेणियाँ';

  @override
  String get mobileLegacyAllAccounts => 'सभी खाते';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      'हर कार्ड का भुगतान (कार्ड की मुद्रा में)';

  @override
  String get mobileLegacySyncDividends => 'डिविडेंड सिंक करें';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      'नाम (वैकल्पिक, खाली छोड़ने पर अपने आप भरेगा)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      'Stocks टैब में 2330 जैसा ticker डालकर कीमतें, realized और unrealized P/L ट्रैक करें। सिस्टम dividends भी अपने आप सिंक करता है।';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      'नीचे Transactions टैब में + दबाकर आय या खर्च जोड़ें। कई मुद्राएँ और खातों के बीच ट्रांसफ़र समर्थित हैं। हटाने के लिए बाएँ स्वाइप करें, संपादन के लिए टैप करें।';

  @override
  String get mobileLegacyNoDataForThisPeriod => 'इस अवधि में डेटा नहीं है';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      'यह कार्रवाई आपके खाते और सभी डेटा को स्थायी रूप से हटा देगी, जिसमें transactions, accounts, stocks और settings शामिल हैं। इसे वापस नहीं किया जा सकता।';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      'Scheduled cash-flow reports का समय बदलें';

  @override
  String get mobileLegacyAutomatic => 'अपने आप';

  @override
  String get mobileLegacyAtLeast8Characters => 'कम से कम 8 अक्षर';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      'कम से कम 8 अक्षर, बड़े/छोटे अक्षर, अंक और symbol सहित';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      'लेन-देन, बजट, ताइवान शेयर निवेश और रिपोर्ट के लिए आपका पर्सनल फाइनेंस साथी। मुख्य सुविधाएँ समझने में बस एक मिनट लगेगा।';

  @override
  String get mobileLegacyDeletePasskey => 'Passkey हटाएँ';

  @override
  String get mobileLegacyDeleteCategory => 'श्रेणी हटाएँ';

  @override
  String get mobileLegacyDeleteTransaction => 'लेन-देन हटाएँ';

  @override
  String get mobileLegacyDeleteDividend => 'डिविडेंड हटाएँ';

  @override
  String get mobileLegacyDeleteStock => 'शेयर हटाएँ';

  @override
  String get mobileLegacyDeleteAccount => 'खाता हटाएँ';

  @override
  String get mobileLegacyDeleteSchedule => 'Schedule हटाएँ';

  @override
  String get mobileLegacyDeletePhoto => 'फ़ोटो हटाएँ';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      'Cash dividend होने पर deposit account अनिवार्य है';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters =>
      'इन filters से कोई लेन-देन नहीं मिला';

  @override
  String get mobileLegacyDiscount01 => 'Discount (0-1)';

  @override
  String get mobileLegacyImproved => 'बेहतर किया गया';

  @override
  String get mobileLegacyMore => 'और';

  @override
  String get mobileLegacyUpdatedd9db02d0 => 'अपडेट';

  @override
  String get mobileLegacyLastDayOfEachMonth => 'हर महीने का आखिरी दिन';

  @override
  String get mobileLegacyNoPricesToUpdate => 'अपडेट करने के लिए कोई कीमत नहीं';

  @override
  String get mobileLegacyNoNewDividendsToSync =>
      'सिंक करने के लिए नया डिविडेंड नहीं';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      'यूज़र साइन आउट हो गया; स्थानीय लॉगिन साफ़ कर दिया गया';

  @override
  String get mobileLegacyGettingStarted => 'शुरुआत कैसे करें';

  @override
  String get mobileLegacyExample06MeansA40Discount =>
      'उदाहरण: 0.6 का मतलब 40% discount';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      'उदाहरण: 1.5 का अर्थ 1.5%; विदेशी मुद्रा भुगतान पर शुल्क अपने आप गणना होगा';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      'More में मासिक बजट सेट करें, रिपोर्ट देखें, खाते और श्रेणियाँ संभालें, recurring transactions और report notifications सेट करें। तैयार हैं? रिकॉर्ड करना शुरू करें।';

  @override
  String get mobileLegacyStandardBrokerageRate01425 =>
      'Broker standard rate: 0.1425%';

  @override
  String get mobileLegacyNotSentYet => 'अभी नहीं भेजा गया';

  @override
  String get mobileLegacyNoRealizedReturns => 'कोई realized P/L नहीं';

  @override
  String get mobileLegacyNoCategoriesYet => 'अभी कोई श्रेणी नहीं';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      'अभी कोई लेन-देन नहीं। शुरू करने के लिए नीचे दाईं ओर टैप करें।';

  @override
  String get mobileLegacyNoRecurringTransactions =>
      'कोई recurring transaction नहीं';

  @override
  String get mobileLegacyNoDividendRecords => 'कोई डिविडेंड रिकॉर्ड नहीं';

  @override
  String get mobileLegacyNoStockTransactions => 'कोई शेयर लेन-देन नहीं';

  @override
  String get mobileLegacyNoHoldingsYet => 'अभी कोई holding नहीं';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => 'कोई sign-in history नहीं';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      'ब्राउज़र में registration पूरा करें (device biometrics आवश्यक)';

  @override
  String get mobileLegacyNotice => 'सूचना';

  @override
  String get mobileLegacyDividends => 'डिविडेंड';

  @override
  String get mobileLegacyDividendSyncCompleted => 'डिविडेंड सिंक पूरा हुआ';

  @override
  String get mobileLegacyTickerEG2330 => 'Ticker (जैसे 2330)';

  @override
  String get mobileLegacyStockMarketValue => 'शेयर बाज़ार मूल्य';

  @override
  String get mobileLegacyHoldings => 'पोर्टफ़ोलियो';

  @override
  String get mobileLegacyDayOfWeek => 'सप्ताह का दिन';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      'मौजूदा वर्ज़न और release notes देखें';

  @override
  String get mobileLegacyRename => 'नाम बदलें';

  @override
  String get mobileLegacyCheckAgain => 'फिर से जाँचें';

  @override
  String get mobileLegacyRetry => 'फिर कोशिश करें';

  @override
  String get mobileLegacyHome => 'होम';

  @override
  String get mobileLegacyFixed => 'ठीक किया गया';

  @override
  String get mobileLegacyApply => 'लागू करें';

  @override
  String get mobileLegacyTime => 'समय';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      'विदेशी शुल्क TWD (वैकल्पिक)';

  @override
  String get mobileLegacyAddTransaction => 'लेन-देन जोड़ें';

  @override
  String get mobileLegacyTransactions8084a8ea => 'लेन-देन';

  @override
  String get mobileLegacyStartDate => 'शुरुआत तारीख';

  @override
  String get mobileLegacyTrackTaiwanStocks => 'ताइवान शेयर निवेश ट्रैक करें';

  @override
  String get mobileLegacyStockDividendSharesOptional =>
      'Stock dividend shares (वैकल्पिक)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      'Foreign card fee अपने आप बनती है। संबंधित foreign transaction को संपादित करें।';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए';

  @override
  String get mobileLegacyAccountName => 'खाते का नाम';

  @override
  String get mobileLegacyAccountDeleted => 'खाता हट गया';

  @override
  String get mobileLegacyAccountSecurity => 'खाता सुरक्षा';

  @override
  String get mobileLegacyLinkedAccounts => 'लिंक किए गए खाते';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies =>
      'अक्सर उपयोग की जाने वाली मुद्राएँ';

  @override
  String get mobileLegacyChooseFromGallery => 'Gallery से चुनें';

  @override
  String get mobileLegacyEnabled => 'चालू';

  @override
  String get mobileLegacyDark => 'डार्क';

  @override
  String get mobileLegacyLight => 'लाइट';

  @override
  String get mobileLegacyClearDates => 'तारीख हटाएँ';

  @override
  String get mobileLegacyClearFilters => 'फ़िल्टर हटाएँ';

  @override
  String get mobileLegacyCashDividendTotalOptional =>
      'Cash dividend (कुल, वैकल्पिक)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      'Cash dividend या stock dividend में से एक भरें';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      'सेट करने पर खाता कार्ड मौजूदा चक्र का खर्च दिखाएगा; खाली छोड़ने पर नहीं गिनेगा';

  @override
  String get mobileLegacyNoteOptional => 'नोट (वैकल्पिक)';

  @override
  String get mobileLegacyNoteKeyword => 'नोट keyword';

  @override
  String get mobileLegacyMinimumTransactionTax => 'Minimum transaction tax';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction =>
      'एक लेन-देन में अधिकतम 5 फ़ोटो';

  @override
  String get mobileLegacyReportNotifications => 'Report notifications';

  @override
  String get mobileLegacySeeYourCompleteCashFlow => 'पूरा कैश फ़्लो समझें';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser => 'ब्राउज़र नहीं खुल पाया';

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
      'लॉगिन समाप्त हो गया है। फिर से साइन इन करें';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      'साइन इन प्रतिक्रिया में authentication cookie नहीं है। backend सेटिंग जाँचें';

  @override
  String get mobileLegacySignedIn => 'साइन इन सफल';

  @override
  String get mobileLegacySignInHistory => 'Sign-in history';

  @override
  String get mobileLegacySignedInDevices => 'Signed-in devices';

  @override
  String get mobileLegacySignInRequestConnectionFailed =>
      'साइन इन अनुरोध कनेक्ट नहीं हो पाया';

  @override
  String get mobileLegacyEndDate => 'समाप्ति तारीख';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      'रजिस्ट्रेशन प्रतिक्रिया में authentication cookie नहीं है। backend सेटिंग जाँचें';

  @override
  String get mobileLegacySignUpAndSignIn => 'साइन अप करके साइन इन करें';

  @override
  String get mobileLegacyBuy => 'खरीदें';

  @override
  String get mobileLegacyFrequency => 'आवृत्ति';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 =>
      'Exchange rate 0 से बड़ा होना चाहिए';

  @override
  String get mobileLegacyReturns => 'लाभ/हानि';

  @override
  String get mobileLegacyAddPasskey => 'Passkey जोड़ें';

  @override
  String get mobileLegacyAddStockTransaction => 'शेयर लेन-देन जोड़ें';

  @override
  String get mobileLegacyAddSchedule => 'Schedule जोड़ें';

  @override
  String get mobileLegacyAddReportSchedule => 'Report schedule जोड़ें';

  @override
  String get mobileLegacyAddPhotosOptional => 'फ़ोटो जोड़ें (वैकल्पिक)';

  @override
  String get mobileLegacyFailedToLoadPhoto => 'फ़ोटो लोड नहीं हो पाई';

  @override
  String get mobileLegacyLink => 'लिंक करें';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      'लिंकिंग का authorization ब्राउज़र में पूरा होता है। अनलिंक करने से पहले पक्का करें कि कोई दूसरी sign-in method उपलब्ध है।';

  @override
  String get mobileLegacyUnlink => 'लिंक हटाएँ';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp =>
      'पर्सनल फाइनेंस · Android App';

  @override
  String get mobileLegacySkip => 'छोड़ें';

  @override
  String get mobileLegacyMinimumOddLotCommission => 'Odd-lot minimum fee';

  @override
  String get mobileLegacyIncorrectEmailOrPassword => 'ईमेल या पासवर्ड गलत है';

  @override
  String get mobileLegacyDefaultCurrency => 'Default currency';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      'Default और frequent currencies';

  @override
  String get mobileLegacyBudgets => 'बजट';

  @override
  String get mobileLegacyBudgetsReportsAndMore => 'बजट, रिपोर्ट और बहुत कुछ';

  @override
  String get mobileLegacyBudgetAmount => 'बजट राशि';

  @override
  String get mobileLegacyCurrencySettings => 'Currency settings';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage =>
      'App, notification और web भाषा';

  @override
  String get mobileLegacyBank => 'बैंक';

  @override
  String get mobileLegacyBankBalance => 'बैंक बैलेंस';

  @override
  String get mobileLegacyRequiresALinkedLineAccount =>
      'LINE account लिंक होना चाहिए';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      'भुगतान दर्ज करने के लिए कम से कम एक क्रेडिट कार्ड और एक गैर-क्रेडिट कार्ड खाता चाहिए';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      'बड़े/छोटे अक्षर, अंक और symbol शामिल करें';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      'बड़ा अक्षर, छोटा अक्षर, अंक और symbol शामिल करें';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      'क्या यह report notification schedule हटाना है?';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      'क्या यह अपलोड की गई फ़ोटो हटानी है? यह कार्रवाई वापस नहीं होगी।';

  @override
  String get mobileLegacyEditStockTransaction => 'शेयर लेन-देन संपादित करें';

  @override
  String get mobileLegacyEditReportSchedule => 'Report schedule संपादित करें';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst =>
      'पहले नीचे दिया गया सत्यापन पूरा करें';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      'पहले Holdings टैब में शेयर जोड़ें';

  @override
  String get mobileLegacySelectAParentCategoryFirst =>
      'पहले मुख्य श्रेणी चुनें';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      'कम से कम एक कार्ड का भुगतान दर्ज करें';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      'कम से कम एक notification method चुनें';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo =>
      '0 या उससे बड़ा नंबर दर्ज करें';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => '1 से 31 तक दर्ज करें';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 =>
      '0 से बड़ी राशि दर्ज करें';

  @override
  String get mobileLegacyEnterATicker => 'Ticker दर्ज करें';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber =>
      'धनात्मक पूर्णांक दर्ज करें';

  @override
  String get mobileLegacyEnterAName => 'नाम दर्ज करें';

  @override
  String get mobileLegacyEnterAValidEmailAddress => 'मान्य ईमेल दर्ज करें';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm =>
      'पुष्टि के लिए पासवर्ड दर्ज करें';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      'पुष्टि के लिए account email दर्ज करें';

  @override
  String get mobileLegacyEnterADisplayName => 'दिखने वाला नाम दर्ज करें';

  @override
  String get mobileLegacySelectASubcategory => 'उप-श्रेणी चुनें';

  @override
  String get mobileLegacySelectACategory => 'श्रेणी चुनें';

  @override
  String get mobileLegacySelectAParentCategory => 'मुख्य श्रेणी चुनें';

  @override
  String get mobileLegacySelectAnAccount => 'खाता चुनें';

  @override
  String get mobileLegacySelectADestinationAccount =>
      'Destination account चुनें';

  @override
  String get mobileLegacySell => 'बेचें';

  @override
  String get mobileLegacyMinimumBoardLotCommission => 'Board-lot minimum fee';

  @override
  String get mobileLegacyFilter => 'फ़िल्टर';

  @override
  String get mobileLegacyFilterTransactions => 'लेन-देन फ़िल्टर करें';

  @override
  String get mobileLegacyChooseTheme => 'Theme चुनें';

  @override
  String get mobileLegacyLogTransactionsInSeconds => 'तुरंत लेन-देन जोड़ें';

  @override
  String get mobileLegacyMarketValue => 'कुल बाज़ार मूल्य';

  @override
  String get mobileLegacyTotalAssetsInTwd => 'कुल संपत्ति (TWD में)';

  @override
  String get mobileLegacyTraditionalChineseEnglish =>
      'Traditional Chinese / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp =>
      'खाता नहीं है? साइन अप करें';

  @override
  String get mobileLegacyPaymentRecorded => 'भुगतान दर्ज हो गया';

  @override
  String get mobileLegacyToAccount => 'To account';

  @override
  String get mobileLegacyFromAccount => 'From account';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      'Source और destination account अलग होने चाहिए';

  @override
  String get mobileLegacyEditTransfersInTheWebApp =>
      'Transfers को web app में संपादित करें';

  @override
  String get mobileLegacyTransactionTaxSell => 'Transaction tax (sell)';

  @override
  String get mobileLegacyTransactionTaxOptional => 'Transaction tax (वैकल्पिक)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax =>
      'प्रकार (transaction tax को प्रभावित करता है)';

  @override
  String get mobileLegacyWarrants => 'Warrants (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot => 'AssetPilot में आपका स्वागत है';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      'बदलाव के बाद दूसरे devices से sign out हो जाएगा।';

  @override
  String get mobileLegacyTestSentryConfiguration => 'Sentry सेटिंग टेस्ट करें';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'API ने 401 लौटाया; सत्र समाप्त हो गया और स्थानीय लॉगिन साफ़ कर दिया गया';

  @override
  String get mobileLegacyApiRequestFailed => 'API अनुरोध विफल';

  @override
  String get mobileLegacyApiRequestConnectionFailed =>
      'API अनुरोध से कनेक्ट नहीं हो पाया';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'App साइन इन प्रतिक्रिया में authentication cookie नहीं है';

  @override
  String get mobileLegacyEmailNotifications => 'Email notifications';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'Google साइन इन प्रतिक्रिया में authentication cookie नहीं है';

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
      'LINE साइन इन प्रतिक्रिया में authentication cookie नहीं है';

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
      'TWD हमेशा शामिल रहता है। चुनी गई मुद्राएँ transaction और recurring transaction की सूची में ऊपर दिखेंगी।';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return 'दिन $day';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return 'पिछली बार भेजा गया: $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return 'मौजूदा वर्ज़न v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'वर्ज़न v$version उपलब्ध है';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return 'हर महीने दिन $day';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return 'हर $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return 'बनाया गया: $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return 'भाषा अपडेट हुई: $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return 'लोड नहीं हो पाया: $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return 'अनपेक्षित त्रुटि: $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return '$provider साइन इन विफल: $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return 'कीमतें अपडेट नहीं हो पाईं: $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return 'डिविडेंड सिंक नहीं हो पाए: $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return 'फ़ोटो अपलोड विफल: $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return 'अनुरोध विफल (HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return 'साइन इन विफल (HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return 'सर्वर से कनेक्ट नहीं हो पाया ($target): $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return '“$name” हटाएँ?';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return '$provider लिंक हटाएँ';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return 'क्या $provider से लिंक हटाना है?';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return '$provider लिंकिंग';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (सभी)';
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
    return 'डेटा पूछताछ समय $time';
  }

  @override
  String get dashboardAttentionTitle => 'ध्यान आवश्यक';

  @override
  String get dashboardAttentionAllClear =>
      'अभी किसी चीज़ पर ध्यान देने की आवश्यकता नहीं है';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count आवर्ती लेन-देन की समीक्षा आवश्यक है';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count अवर्गीकृत लेन-देन · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count होल्डिंग का मूल्य उपलब्ध नहीं है';
  }

  @override
  String get dashboardDriversTitle => 'इस महीने के शीर्ष 3 कारक';

  @override
  String dashboardDriversSubtitle(Object month) {
    return '$month में सबसे बड़ा योगदान';
  }

  @override
  String dashboardDriversShare(Object share) {
    return 'इस प्रकार का $share%';
  }

  @override
  String get dashboardPersonalizeTrigger => 'होम अनुकूलित करें';

  @override
  String get dashboardPersonalizeTitle => 'होम अनुकूलित करें';

  @override
  String get dashboardPersonalizeDescription =>
      'दिखने वाले मॉड्यूल चुनें और उपयोग के क्रम में व्यवस्थित करें।';

  @override
  String get dashboardPersonalizeModulesAssets => 'संपत्ति अवलोकन';

  @override
  String get dashboardPersonalizeModulesAttention => 'ध्यान आवश्यक';

  @override
  String get dashboardPersonalizeModulesWhyChanged => 'नकदी प्रवाह क्यों बदला';

  @override
  String get dashboardPersonalizeModulesSpending => 'खर्च श्रेणियाँ';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => 'पोर्टफोलियो स्थिति';

  @override
  String get dashboardPersonalizeModulesIncomeRecent => 'आय और हाल के लेन-देन';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return '$module को ऊपर ले जाएँ';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return '$module को नीचे ले जाएँ';
  }

  @override
  String get dashboardPersonalizeSaved => 'डैशबोर्ड लेआउट सहेजा गया';

  @override
  String get dashboardPersonalizeSaveError =>
      'डैशबोर्ड लेआउट सहेजा नहीं जा सका';

  @override
  String get dashboardPersonalizeReset => 'रीसेट';

  @override
  String get dashboardPersonalizeApply => 'लागू करें';

  @override
  String get dashboardComparisonTitle => 'नकदी प्रवाह क्यों बदला';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart–$currentEnd की तुलना $previousStart–$previousEnd से';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return 'पूरे महीने की तुलना $previousStart–$previousEnd से';
  }

  @override
  String get dashboardComparisonUnavailable =>
      'इस महीने के लिए तुलना योग्य पिछली अवधि नहीं है।';

  @override
  String get dashboardComparisonNoChanges =>
      'दर्ज नकदी प्रवाह तुलना अवधि से अपरिवर्तित है।';

  @override
  String get dashboardComparisonPreviousNet => 'पिछला शुद्ध नकदी प्रवाह';

  @override
  String get dashboardComparisonNetChange => 'शुद्ध नकदी प्रवाह में बदलाव';

  @override
  String get dashboardComparisonNewThisPeriod => 'इस अवधि में नया';

  @override
  String get dashboardComparisonIncreased => 'राशि बढ़ी';

  @override
  String get dashboardComparisonDecreased => 'राशि घटी';

  @override
  String get dashboardPortfolioHealthTitle => 'पोर्टफोलियो लागत-आधार स्थिति';

  @override
  String get dashboardPortfolioHealthSubtitle =>
      'वर्तमान मूल्य की शेष FIFO लागत से तुलना';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      'लागत-आधार जानकारी के लिए एक होल्डिंग जोड़ें।';

  @override
  String get dashboardPortfolioHealthMissingPrices =>
      'इस तुलना के लिए वर्तमान कीमतें आवश्यक हैं।';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      'कई मुद्राओं वाली होल्डिंग के लिए संयुक्त प्रतिशत उपलब्ध नहीं है।';

  @override
  String get dashboardPortfolioHealthMarketValue => 'कीमत उपलब्ध बाजार मूल्य';

  @override
  String get dashboardPortfolioHealthCost => 'कीमत उपलब्ध होल्डिंग की लागत';

  @override
  String get dashboardPortfolioHealthUnrealizedGross => 'अप्राप्त सकल लाभ/हानि';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return 'सबसे बड़ी होल्डिंग: $name · कीमत उपलब्ध मूल्य का $share%';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      'यह वर्तमान कीमतों की दर्ज FIFO लागत से तुलना है। यह बाजार सूचकांक बेंचमार्क या समय-भारित प्रदर्शन नहीं है।';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return 'कीमत कवरेज: $total में से $priced होल्डिंग';
  }
}
