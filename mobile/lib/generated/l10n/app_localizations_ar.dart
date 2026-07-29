// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get commonSave => 'حفظ';

  @override
  String get commonCancel => 'إلغاء';

  @override
  String get commonDelete => 'حذف';

  @override
  String get commonEdit => 'تعديل';

  @override
  String get commonConfirm => 'تأكيد';

  @override
  String get commonClose => 'إغلاق';

  @override
  String get commonLoading => 'جارٍ التحميل…';

  @override
  String get commonAdd => 'إضافة';

  @override
  String get commonBack => 'رجوع';

  @override
  String get commonSearch => 'بحث';

  @override
  String get commonLanguage => 'اللغة';

  @override
  String get commonClear => 'مسح';

  @override
  String get commonSaving => 'جارٍ الحفظ...';

  @override
  String get commonConfirmDelete => 'تأكيد الحذف';

  @override
  String get commonPreviousPage => 'السابق';

  @override
  String get commonNextPage => 'التالي';

  @override
  String commonTotalRecords(Object count) {
    return '$count سجل';
  }

  @override
  String get commonPerPage => 'لكل صفحة';

  @override
  String commonRecordsUnit(Object count) {
    return '$count سجل';
  }

  @override
  String get commonNoData => 'لا توجد بيانات بعد';

  @override
  String get navSectionsFinance => 'المالية';

  @override
  String get navSectionsStocks => 'الأسهم';

  @override
  String get navSectionsSystem => 'النظام';

  @override
  String get navDashboard => 'لوحة التحكم';

  @override
  String get navTransactions => 'المعاملات';

  @override
  String get navReports => 'التقارير';

  @override
  String get navBudget => 'الميزانيات';

  @override
  String get navInfoBoard => 'لوحة المعلومات';

  @override
  String get navAccounts => 'الحسابات';

  @override
  String get navCategories => 'التصنيفات';

  @override
  String get navRecurring => 'المتكررة';

  @override
  String get navStocksPortfolio => 'المحفظة';

  @override
  String get navStocksTransactions => 'معاملات الأسهم';

  @override
  String get navStocksDividends => 'التوزيعات';

  @override
  String get navStocksRealized => 'ربح/خسارة محققة';

  @override
  String get navStocksSettings => 'إعدادات الأسهم';

  @override
  String get navExportImport => 'تصدير / استيراد';

  @override
  String get navAccount => 'الحساب';

  @override
  String get navApiCredits => 'وصول API';

  @override
  String get navAdmin => 'المدير';

  @override
  String get navTitleStocks => 'المحفظة';

  @override
  String get navTitleStockTransactions => 'معاملات الأسهم';

  @override
  String get navTitleStockDividends => 'توزيعات الأسهم';

  @override
  String get navTitleStockRealized => 'الربح/الخسارة المحققة';

  @override
  String get navTitleStockSettings => 'إعدادات تداول الأسهم';

  @override
  String get navTitleApiCredits => 'استخدام API والوصول';

  @override
  String get shellFallbackUser => 'المستخدم';

  @override
  String get shellLogout => 'تسجيل الخروج';

  @override
  String get shellVersionInfo => 'معلومات الإصدار';

  @override
  String get shellOpenMenu => 'فتح القائمة';

  @override
  String get shellSkipToContent => 'الانتقال إلى المحتوى الرئيسي';

  @override
  String get shellThemeLight => 'فاتح';

  @override
  String get shellThemeSystem => 'النظام';

  @override
  String get shellThemeDark => 'داكن';

  @override
  String get shellChangelogLoading => 'جارٍ تحميل معلومات الإصدار...';

  @override
  String get shellChangelogLoadFailed => 'تعذر تحميل معلومات الإصدار';

  @override
  String get shellChangelogUnknownVersion => 'غير معروف';

  @override
  String get shellChangelogCurrentVersion => 'الإصدار الحالي';

  @override
  String get shellChangelogUpdatableVersion => 'الإصدار المتاح';

  @override
  String get shellChangelogUpToDate => 'أنت على أحدث إصدار';

  @override
  String get shellChangelogUpdatableContent => 'محتوى التحديث';

  @override
  String get shellChangelogRecentContent => 'آخر التحديثات';

  @override
  String get authLoginTab => 'تسجيل الدخول';

  @override
  String get authRegisterTab => 'إنشاء حساب';

  @override
  String get authSubtitleLogin => 'مرحبًا بعودتك، سجّل الدخول إلى حسابك';

  @override
  String get authSubtitleRegister => 'أنشئ حسابك وابدأ المتابعة';

  @override
  String get authEmailLabel => 'البريد الإلكتروني';

  @override
  String get authPasswordLabel => 'كلمة المرور';

  @override
  String get authPasswordPlaceholder => 'أدخل كلمة المرور';

  @override
  String get authDisplayNameLabel => 'الاسم المعروض';

  @override
  String get authDisplayNamePlaceholder => 'اسمك أو لقبك';

  @override
  String get authRegisterPasswordPlaceholder =>
      '8 أحرف على الأقل، مع أحرف كبيرة وصغيرة وأرقام';

  @override
  String get authTogglePassword => 'إظهار أو إخفاء كلمة المرور';

  @override
  String get authTurnstileAria => 'تحقق Cloudflare Turnstile البشري';

  @override
  String get authLoginButton => 'تسجيل الدخول';

  @override
  String get authLoggingIn => 'جارٍ تسجيل الدخول…';

  @override
  String get authPasskeyButton => 'تسجيل الدخول باستخدام Passkey';

  @override
  String get authPasskeyVerifying => 'جارٍ التحقق من Passkey…';

  @override
  String get authGoogleButton => 'تسجيل الدخول باستخدام Google';

  @override
  String get authGoogleVerifying => 'جارٍ التحقق من Google…';

  @override
  String get authLineButton => 'تسجيل الدخول باستخدام LINE';

  @override
  String get authLineVerifying => 'جارٍ التحقق من LINE…';

  @override
  String get authRegisterSubmit => 'إنشاء الحساب';

  @override
  String get authRegistering => 'جارٍ إنشاء الحساب…';

  @override
  String get authLineCallbackCompleting => 'جارٍ إكمال تحقق LINE...';

  @override
  String get authLineCallbackMissingCode =>
      'لم يُرجع LINE رمز تفويض. حاول مرة أخرى.';

  @override
  String get authLineCallbackLinkFailed => 'تعذر ربط حساب LINE';

  @override
  String get authLineCallbackLoginFailed => 'فشل تسجيل الدخول عبر LINE';

  @override
  String get authLineCallbackVerifyFailed => 'فشل تحقق LINE';

  @override
  String get authErrorsTurnstileRequired => 'يرجى إكمال التحقق البشري أولًا';

  @override
  String get authErrorsLoginFailed => 'تعذر تسجيل الدخول';

  @override
  String get authErrorsRegisterFailed => 'تعذر إنشاء الحساب';

  @override
  String get authErrorsGoogleNotConfigured =>
      'تسجيل الدخول عبر Google غير مهيأ';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'لم يتم تحميل مكوّن تسجيل الدخول عبر Google';

  @override
  String get authErrorsGoogleStateFailed =>
      'تعذر إنشاء حالة تسجيل الدخول عبر Google';

  @override
  String get authErrorsGoogleNoCode => 'لم يتم استلام رمز تفويض Google';

  @override
  String get authErrorsGoogleFailed => 'فشل تسجيل الدخول عبر Google';

  @override
  String get authErrorsGoogleCancelled => 'تم إلغاء تسجيل الدخول عبر Google';

  @override
  String get authErrorsPasskeyUnsupported => 'هذا المتصفح لا يدعم Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'تعذر إنشاء تحدي تسجيل الدخول باستخدام Passkey';

  @override
  String get authErrorsPasskeyFailed => 'فشل تسجيل الدخول باستخدام Passkey';

  @override
  String get authErrorsLineNotConfigured => 'تسجيل الدخول عبر LINE غير مهيأ';

  @override
  String get authErrorsLineFailed => 'فشل تسجيل الدخول عبر LINE';

  @override
  String get settingsTitle => 'الإعدادات';

  @override
  String get settingsLanguageTitle => 'اللغة';

  @override
  String get settingsLanguageDescription =>
      'اختر لغة الواجهة والإشعارات (البريد الإلكتروني / LINE).';

  @override
  String get settingsLanguageSaved => 'تم تحديث تفضيل اللغة';

  @override
  String get settingsAccountTitle => 'إعدادات الحساب';

  @override
  String get settingsAccountProfileInfo => 'معلومات الحساب';

  @override
  String get settingsAccountEmail => 'البريد الإلكتروني';

  @override
  String get settingsAccountDisplayName => 'الاسم المعروض';

  @override
  String get settingsAccountEditDisplayName => 'تعديل الاسم المعروض';

  @override
  String get settingsAccountUpdateName => 'تحديث الاسم';

  @override
  String get settingsAccountSaving => 'جارٍ الحفظ...';

  @override
  String get settingsAccountSetLocalPassword => 'تعيين كلمة مرور محلية';

  @override
  String get settingsAccountChangePassword => 'تغيير كلمة المرور';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      'يستخدم هذا الحساب حاليًا تسجيل الدخول عبر طرف خارجي فقط. بعد تعيين كلمة مرور محلية يمكنك تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.';

  @override
  String get settingsAccountCurrentPassword => 'كلمة المرور الحالية';

  @override
  String get settingsAccountNewPassword => 'كلمة المرور الجديدة';

  @override
  String get settingsAccountConfirmNewPassword => 'تأكيد كلمة المرور الجديدة';

  @override
  String get settingsAccountPasswordPlaceholder =>
      '8 أحرف على الأقل، مع حرف كبير وحرف صغير ورقم ورمز';

  @override
  String get settingsAccountUpdating => 'جارٍ التحديث...';

  @override
  String get settingsAccountSetPassword => 'تعيين كلمة المرور';

  @override
  String get settingsAccountUpdatePassword => 'تحديث كلمة المرور';

  @override
  String get settingsAccountThemeTitle => 'المظهر';

  @override
  String get settingsAccountThemeSystem => 'اتباع النظام';

  @override
  String get settingsAccountThemeLight => 'الوضع الفاتح';

  @override
  String get settingsAccountThemeDark => 'الوضع الداكن';

  @override
  String get settingsAccountDefaultCurrency => 'العملة الافتراضية';

  @override
  String get settingsAccountCurrencyCode => 'رمز العملة';

  @override
  String get settingsAccountUpdateDefaultCurrency => 'تحديث العملة الافتراضية';

  @override
  String get settingsAccountPasskeyTitle => 'إدارة Passkeys';

  @override
  String get settingsAccountNoPasskeys => 'لم يتم تسجيل أي Passkey بعد';

  @override
  String get settingsAccountAddPasskey => '+ إضافة Passkey';

  @override
  String get settingsAccountGoogleTitle => 'ربط Google';

  @override
  String get settingsAccountLineTitle => 'ربط LINE';

  @override
  String get settingsAccountStatusPrefix => 'الحالة الحالية: ';

  @override
  String get settingsAccountLinkedGoogle => 'حساب Google مربوط';

  @override
  String get settingsAccountNotLinkedGoogle => 'حساب Google غير مربوط';

  @override
  String get settingsAccountLinkGoogle => 'ربط حساب Google';

  @override
  String get settingsAccountUnlink => 'إلغاء الربط';

  @override
  String get settingsAccountLinkedLine => 'حساب LINE مربوط';

  @override
  String get settingsAccountNotLinkedLine => 'حساب LINE غير مربوط';

  @override
  String get settingsAccountLinkLine => 'ربط حساب LINE';

  @override
  String get settingsAccountLineVerifying => 'جارٍ التحقق من LINE…';

  @override
  String get settingsAccountSessionsTitle => 'الأجهزة المسجّلة';

  @override
  String get settingsAccountRefresh => 'تحديث';

  @override
  String get settingsAccountDeviceName => 'اسم الجهاز';

  @override
  String get settingsAccountLoginTime => 'وقت تسجيل الدخول';

  @override
  String get settingsAccountLoginIp => 'عنوان IP لتسجيل الدخول';

  @override
  String get settingsAccountActions => 'الإجراءات';

  @override
  String get settingsAccountUnknownDevice => 'جهاز غير معروف';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (هذا الجهاز)';

  @override
  String get settingsAccountSignOut => 'تسجيل الخروج';

  @override
  String get settingsAccountNoSessions => 'لا توجد سجلات لأجهزة مسجّلة بعد';

  @override
  String get settingsAccountAuditTitle => 'سجل تسجيل الدخول';

  @override
  String get settingsAccountCountry => 'الدولة';

  @override
  String get settingsAccountMethod => 'الطريقة';

  @override
  String get settingsAccountDevice => 'الجهاز';

  @override
  String get settingsAccountAdminLogin => 'تسجيل دخول مدير';

  @override
  String get settingsAccountYes => 'نعم';

  @override
  String get settingsAccountNo => 'لا';

  @override
  String get settingsAccountDeleteTitle => 'حذف الحساب';

  @override
  String get settingsAccountDeleteDescription =>
      'بعد حذف الحساب، ستُحذف معاملاتك وحساباتك وأسهمك وPasskeys وإعداداتك نهائيًا ولا يمكن استعادتها.';

  @override
  String get settingsAccountDeleteButton => 'حذف حسابي';

  @override
  String get settingsAccountDeleteModalTitle => 'تأكيد حذف الحساب';

  @override
  String get settingsAccountDeleteModalWarning =>
      'سيؤدي هذا الإجراء إلى حذف الحساب وكل البيانات نهائيًا، بما في ذلك المعاملات والحسابات والأسهم وPasskeys والإعدادات. لا يمكن التراجع عنه.';

  @override
  String get settingsAccountDeletePasswordLabel =>
      'أدخل كلمة المرور لتأكيد الحذف';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return 'أدخل بريد الحساب \"$email\" لتأكيد الحذف';
  }

  @override
  String get settingsAccountDeleting => 'جارٍ الحذف...';

  @override
  String get settingsAccountDeletePermanently => 'حذف الحساب نهائيًا';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired =>
      'أدخل كلمة المرور الحالية';

  @override
  String get settingsAccountMessagesNewPasswordRequired =>
      'أدخل كلمة المرور الجديدة';

  @override
  String get settingsAccountMessagesPasswordTooShort =>
      'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      'يجب أن تحتوي كلمة المرور الجديدة على حرف كبير وحرف صغير ورقم ورمز خاص';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      'كلمتا المرور الجديدتان غير متطابقتين';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      'تم تعيين كلمة المرور. يمكنك الآن تسجيل الدخول بكلمة المرور';

  @override
  String get settingsAccountMessagesPasswordUpdated => 'تم تحديث كلمة المرور';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      'تعذر تحديث كلمة المرور';

  @override
  String get settingsAccountMessagesDisplayNameRequired =>
      'لا يمكن أن يكون الاسم المعروض فارغًا';

  @override
  String get settingsAccountMessagesDisplayNameUpdated =>
      'تم تحديث الاسم المعروض';

  @override
  String get settingsAccountMessagesUpdateFailed => 'تعذر التحديث';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      'هل تريد حذف هذا Passkey؟';

  @override
  String get settingsAccountMessagesCurrencyInvalid =>
      'يجب أن يكون رمز العملة مكونًا من 3 أحرف';

  @override
  String get settingsAccountMessagesCurrencyUpdated =>
      'تم تحديث العملة الافتراضية';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      'تعذر تحديث العملة الافتراضية';

  @override
  String get settingsAccountMessagesSessionLoggedOut => 'تم تسجيل خروج الجهاز';

  @override
  String get settingsAccountMessagesSessionLogoutFailed =>
      'تعذر تسجيل خروج الجهاز';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      'هذا المتصفح لا يدعم Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'جهاز Android';

  @override
  String get settingsAccountMessagesComputerDevice => 'حاسوب';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'تعذر تسجيل Passkey';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      'الصق Google ID Token لمحاكاة الربط';

  @override
  String get settingsAccountMessagesGoogleLinked => 'تم ربط حساب Google';

  @override
  String get settingsAccountMessagesGoogleLinkFailed => 'تعذر ربط حساب Google';

  @override
  String get settingsAccountMessagesGoogleUnlinked =>
      'تم إلغاء ربط حساب Google';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'تعذر إلغاء ربط حساب Google';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'تسجيل الدخول عبر LINE غير مهيأ';

  @override
  String get settingsAccountMessagesLineLinkFailed => 'تعذر ربط حساب LINE';

  @override
  String get settingsAccountMessagesLineUnlinked => 'تم إلغاء ربط حساب LINE';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'تعذر إلغاء ربط حساب LINE';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      'أدخل كلمة المرور لتأكيد الحذف';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      'أدخل بريد الحساب الصحيح لتأكيد الحذف';

  @override
  String get settingsAccountMessagesDeleteFailed => 'تعذر حذف الحساب';

  @override
  String get dashboardTitle => 'لوحة التحكم';

  @override
  String dashboardSubtitle(Object month) {
    return 'الدخل والمصروفات وتصنيفها وآخر المعاملات في $month.';
  }

  @override
  String get dashboardUncategorized => 'غير مصنّف';

  @override
  String get dashboardKpiTotalIncome => 'إجمالي الدخل';

  @override
  String get dashboardKpiTotalExpense => 'إجمالي المصروفات';

  @override
  String get dashboardKpiNet => 'الصافي';

  @override
  String get dashboardKpiTodayExpense => 'مصروفات اليوم';

  @override
  String get dashboardKpiBankAccounts => 'الحسابات البنكية';

  @override
  String get dashboardKpiStockMarketValue => 'القيمة السوقية للأسهم';

  @override
  String get dashboardOverviewTitle => 'نظرة شهرية على التدفق النقدي';

  @override
  String get dashboardOverviewBalance => 'فائض الشهر';

  @override
  String get dashboardOverviewDeficit => 'عجز الشهر';

  @override
  String get dashboardOverviewIncome => 'الدخل';

  @override
  String get dashboardOverviewExpense => 'المصروفات';

  @override
  String get dashboardOverviewNet => 'الصافي';

  @override
  String get dashboardRatioTitle => 'نسبة الدخل إلى المصروفات';

  @override
  String get dashboardRatioIncomeShare => 'حصة الدخل';

  @override
  String get dashboardRatioExpenseShare => 'حصة المصروفات';

  @override
  String get dashboardSectionsExpenseCategories => 'تصنيفات المصروفات';

  @override
  String get dashboardSectionsIncomeCategories => 'تصنيفات الدخل';

  @override
  String get dashboardSectionsRecentTransactions => 'آخر المعاملات';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return 'آخر $count سجلات';
  }

  @override
  String get dashboardEmptyNoExpense => 'لا توجد مصروفات هذا الشهر';

  @override
  String get dashboardEmptyNoIncome => 'لا يوجد دخل هذا الشهر';

  @override
  String get dashboardEmptyNoTransactions => 'لا توجد معاملات هذا الشهر';

  @override
  String get dashboardTableDate => 'التاريخ';

  @override
  String get dashboardTableCategory => 'التصنيف';

  @override
  String get dashboardTableNote => 'ملاحظة';

  @override
  String get dashboardTableAmount => 'المبلغ';

  @override
  String get dashboardFiltersPreviousMonth => 'الشهر السابق';

  @override
  String get dashboardFiltersNextMonth => 'الشهر التالي';

  @override
  String get dashboardFiltersCurrentMonth => 'هذا الشهر';

  @override
  String get publicCommonBackHome => 'العودة إلى الرئيسية';

  @override
  String get publicCommonPrivacy => 'سياسة الخصوصية';

  @override
  String get publicCommonTerms => 'شروط الخدمة';

  @override
  String get publicCommonApiCredits => 'استخدام API والاعتمادات';

  @override
  String publicCommonLastUpdated(Object date) {
    return 'آخر تحديث: $date';
  }

  @override
  String get publicCommonMetadataTitle =>
      'AssetPilot - مركز إدارة التمويل الشخصي';

  @override
  String get publicCommonMetadataDescription =>
      'مدير تمويل شخصي مشفّر وقابل للاستضافة الذاتية لتتبع المصروفات والميزانيات والأسهم التايوانية والتحليلات.';

  @override
  String get publicCommonDatesApiCredits => '11 يونيو 2026';

  @override
  String get publicCommonDatesPrivacy => '17 يونيو 2026';

  @override
  String get publicCommonDatesTerms => '11 يونيو 2026';

  @override
  String get publicHomeTagline => 'مركز إدارة التمويل الشخصي';

  @override
  String get publicHomeLogin => 'تسجيل الدخول';

  @override
  String get publicHomeRegister => 'إنشاء حساب';

  @override
  String get publicHomeBadge => 'استضافة ذاتية، بيانات مشفّرة، AGPL v3';

  @override
  String get publicHomeHeadline1 => 'مركز التحكم في أموالك';

  @override
  String get publicHomeHeadline2 => 'واضح منذ الصفحة الرئيسية';

  @override
  String get publicHomeLeadBefore =>
      'يجمع استثمارات الأسهم التايوانية، الدخل والمصروفات، الميزانيات، التقارير وسجلات التدقيق. تُشفَّر كل البيانات المالية عند التخزين باستخدام';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      'من دون ربطك بسحابة معيّنة أو اشتراك؛ افهم المنتج أولًا ثم قرر تسجيل الدخول.';

  @override
  String get publicHomeStartUsing => 'ابدأ الاستخدام';

  @override
  String get publicHomeCreateFirst => 'أنشئ حسابًا أولًا';

  @override
  String get publicHomeChipsOpenSource => 'مفتوح المصدر AGPL v3';

  @override
  String get publicHomeChipsEncrypted => 'تخزين محلي مشفّر';

  @override
  String get publicHomeChipsNoCloudLock => 'بلا ارتباط بسحابة خارجية';

  @override
  String get publicHomeChipsDocker => 'تشغيل Docker بأمر واحد';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => 'وحدات أساسية';

  @override
  String get publicHomeStatsModulesSublabel => 'مصروفات، أسهم، تقارير، حوكمة';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => 'تشفير البيانات';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => 'مصدر الأسعار';

  @override
  String get publicHomeStatsStockSourceSublabel => 'لحظي، إغلاق، وخطة احتياطية';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => 'حساب دقيق';

  @override
  String get publicHomeStatsPrecisionSublabel =>
      'ربح/خسارة لكل دفعة عبر decimal.js';

  @override
  String get publicHomePreLoginNote =>
      'حتى قبل تسجيل الدخول يمكنك مراجعة وظائف AssetPilot، وطريقة معالجة البيانات، وخيارات النشر، ثم تقرر هل تدخل أم تنشئ حسابًا.';

  @override
  String get publicHomeWhyLabel => 'لماذا AssetPilot';

  @override
  String get publicHomeWhyTitle =>
      'المحاسبة اليومية، تتبع الاستثمار، والتحكم بالبيانات في مكان واحد';

  @override
  String get publicHomeWhyDescription =>
      'صُمم AssetPilot لمن يديرون أموالهم بأنفسهم. يجمع التدفق النقدي والميزانيات وأسهم تايوان، مع إبقاء التصدير والتدقيق والاستضافة الذاتية ضمن سيطرتك.';

  @override
  String get publicHomePillarsFinanceTitle => 'إدارة التدفق النقدي والميزانية';

  @override
  String get publicHomePillarsFinanceTag => 'جوهر المحاسبة';

  @override
  String get publicHomePillarsFinanceItemsOne =>
      'تتبع أرصدة حسابات متعددة وتحويلات داخلية';

  @override
  String get publicHomePillarsFinanceItemsTwo =>
      'متابعة تقدم الميزانية الشهرية وحسب التصنيف';

  @override
  String get publicHomePillarsFinanceItemsThree =>
      'إنشاء تلقائي للدخل والمصروفات المتكررة';

  @override
  String get publicHomePillarsFinanceItemsFour =>
      'تعديل جماعي للتصنيف والتاريخ والحذف';

  @override
  String get publicHomePillarsStocksTitle => 'تتبع استثمارات الأسهم التايوانية';

  @override
  String get publicHomePillarsStocksTag => 'وحدة الأسهم';

  @override
  String get publicHomePillarsStocksItemsOne =>
      'استعلام أسعار TWSE ومزامنة حقوق التوزيعات';

  @override
  String get publicHomePillarsStocksItemsTwo =>
      'حساب FIFO دقيق للربح/الخسارة المحققة';

  @override
  String get publicHomePillarsStocksItemsThree =>
      'سجلات التوزيعات وتتبع الإيداع في الحساب';

  @override
  String get publicHomePillarsStocksItemsFour =>
      'استثمارات دورية وإشارات الشطب من السوق';

  @override
  String get publicHomePillarsSecurityTitle => 'الأمان وحوكمة البيانات';

  @override
  String get publicHomePillarsSecurityTag => 'حوكمة';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'تشفير البيانات المخزنة عبر ChaCha20-Poly1305';

  @override
  String get publicHomePillarsSecurityItemsTwo =>
      'تسجيل دخول بكلمة مرور أو Google أو Passkey';

  @override
  String get publicHomePillarsSecurityItemsThree =>
      'تصدير/استيراد، نسخ احتياطي، استعادة وسجلات تدقيق';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'حماية عبر rate limit وCSP ومنع حقن CSV';

  @override
  String get publicHomePillarsSelfHostedTitle => 'استضافة ذاتية وعقود API';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne => 'تشغيل Docker بأمر واحد';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => 'دعم amd64 و arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree => 'توثيق عقد OpenAPI 3.2';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      'مسارات URL-first مناسبة للحفظ والتحديث المباشر';

  @override
  String get publicHomeQuickStartLabel => 'بدء سريع';

  @override
  String get publicHomeQuickStartTitle => 'شغّله على خادمك خلال 60 ثانية';

  @override
  String get publicHomeQuickStartDescription =>
      'ابدأ سريعًا عبر Docker. عند التشغيل الأول تُنشأ مفاتيح JWT وتشفير قاعدة البيانات تلقائيًا. يدعم amd64 وarm64، ومناسب لأجهزة NAS أو VPS أو مضيف Docker الخاص بك.';

  @override
  String get publicHomeQuickStartChipsImage => 'صورة بحجم يقارب 180 MB';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => 'فحص صحة مدمج';

  @override
  String get publicHomeQuickStartChipsKeys => 'مفاتيح تُنشأ عند أول تشغيل';

  @override
  String get publicHomeTechLabel => 'الحزمة التقنية';

  @override
  String get publicHomeTechTitle => 'التقنيات ومداخل المعلومات العامة';

  @override
  String get publicHomeTechDescription =>
      'تُعرض التقنيات الرئيسية ومصادر البيانات الخارجية ومعلومات الترخيص بوضوح حتى تفهم آلية عمل الخدمة قبل استخدامها.';

  @override
  String get publicHomeFooter =>
      'GNU AGPL v3. إدارة أصول شخصية تستضيفها وتتحكم بها وتنسخها احتياطيًا بنفسك.';

  @override
  String get publicApiCreditsPageTitle => 'استخدام API والاعتمادات';

  @override
  String get publicApiCreditsPageMetadataTitle =>
      'استخدام API والاعتمادات — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => 'شفافية واجهات API الخارجية';

  @override
  String get publicApiCreditsPageDescription =>
      'يتصل AssetPilot بمصادر بيانات خارجية فقط عندما تحتاج الوظيفة لذلك. تسرد هذه الصفحة أغراض كل API وملاحظات الترخيص ونطاق البيانات المرسلة لمراجعة الامتثال عند الاستضافة الذاتية.';

  @override
  String get publicApiCreditsPageStatsExternalServices => 'خدمات خارجية';

  @override
  String get publicApiCreditsPageStatsFreeSupported => 'يدعم المجاني';

  @override
  String get publicApiCreditsPageStatsAttributionRequired =>
      'يتطلب نسبة المصدر';

  @override
  String get publicApiCreditsPageServiceKindsData => 'استعلامات بيانات';

  @override
  String get publicApiCreditsPageServiceKindsAuth => 'مصادقة';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'قنوات البريد';

  @override
  String get publicApiCreditsPageServiceKindsBackup => 'نسخ احتياطي سحابي';

  @override
  String get publicApiCreditsPageTransparencyTitle => 'شفافية البيانات';

  @override
  String get publicApiCreditsPageTransparencyText =>
      'ترسل السيناريوهات التالية الحد الأدنى فقط من البيانات اللازمة للوظيفة، ولا تسلم تفاصيلك المالية إلى خدمات خارجية.';

  @override
  String get publicApiCreditsPageMinNecessary =>
      'مبدأ الحد الأدنى اللازم من البيانات';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => 'مزامنة أسعار الصرف';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      'يتم الاستعلام عن أسعار صرف عامة فقط، ولا تُرسل تفاصيل مالية شخصية.';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle =>
      'بيانات الأسهم التايوانية';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      'تُرسل رموز الأسهم وبيانات السوق فقط، من دون حسابات أو تكلفة حيازة أو سجلات تداول.';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => 'تدقيق تسجيل الدخول';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'يُستخدم IPinfo فقط لعرض الدولة في سجلات تسجيل الدخول.';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => 'تسجيل دخول خارجي';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'يُستخدم Google وLINE فقط عندما تسجل الدخول أو تربط حسابًا بإرادتك.';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => 'نسخ احتياطي سحابي';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'يتلقى MEGA S4 ملف قاعدة البيانات كاملًا فقط عندما يرفعه المسؤول صراحةً.';

  @override
  String get publicApiCreditsPageServiceListTitle => 'قائمة الخدمات الخارجية';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return 'إجمالي $total خدمات؛ $free منها تدعم خطة مجانية و$paid توفر خططًا مدفوعة.';
  }

  @override
  String get publicApiCreditsPageOfficialSite => 'الموقع الرسمي';

  @override
  String get publicApiCreditsPageFreePlan => 'الخطة المجانية';

  @override
  String get publicApiCreditsPagePaidPlan => 'الخطة المدفوعة';

  @override
  String get publicApiCreditsPageSupported => 'مدعوم';

  @override
  String get publicApiCreditsPageUnavailable => 'غير متاح';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'أسعار صرف عالمية فورية مع TWD كعملة أساس';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'تحديد موقع IP لحقل الدولة في سجلات تدقيق الدخول';

  @override
  String get publicApiCreditsPageDescriptionsTwse =>
      'أسعار لحظية وبيانات توزيعات وبحث أسماء الأسهم';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'تسجيل دخول Google SSO';

  @override
  String get publicApiCreditsPageDescriptionsLine =>
      'تسجيل دخول LINE وربط الحساب';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'قناة إرسال بريد لتقارير أصول المسؤول عبر Gmail أو Outlook أو خادم SMTP آخر';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'قناة إرسال بريد لتقارير أصول المسؤول عبر HTTP REST API';

  @override
  String get publicApiCreditsPageDescriptionsResend =>
      'قناة إرسال بريد لتقارير أصول المسؤول';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      'وجهة تخزين كائنات متوافقة مع S3 لنسخ PostgreSQL SQL الكاملة للمسؤول';

  @override
  String get publicAppCallbackReturningTitle =>
      'جارٍ الرجوع إلى تطبيق AssetPilot...';

  @override
  String get publicAppCallbackReturningBody =>
      'إذا لم يتم الرجوع تلقائيًا، تأكد من تثبيت أحدث إصدار من تطبيق AssetPilot على Android.';

  @override
  String get publicAppCallbackPasskeyTitle =>
      'تسجيل الدخول إلى AssetPilot باستخدام Passkey';

  @override
  String get publicAppCallbackPasskeyStarting =>
      'جارٍ بدء تسجيل الدخول باستخدام Passkey...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      'هذا المتصفح لا يدعم Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'تعذر إنشاء تحدي تسجيل الدخول باستخدام Passkey';

  @override
  String get publicAppCallbackPasskeyVerify => 'أكمل تحقق Passkey على جهازك...';

  @override
  String get publicAppCallbackPasskeyLoginFailed =>
      'فشل تسجيل الدخول باستخدام Passkey';

  @override
  String get publicAppCallbackReturningApp => 'جارٍ الرجوع إلى التطبيق...';

  @override
  String get publicAppCallbackAppTicketFailed =>
      'تعذر إنشاء تذكرة تسجيل الدخول للتطبيق';

  @override
  String get featuresCommonActions => 'الإجراءات';

  @override
  String get featuresCommonAccount => 'الحساب';

  @override
  String get featuresCommonAmount => 'المبلغ';

  @override
  String get featuresCommonDate => 'التاريخ';

  @override
  String get featuresCommonEndDate => 'النهاية';

  @override
  String get featuresCommonNote => 'ملاحظة';

  @override
  String get featuresCommonStartDate => 'البداية';

  @override
  String get featuresCommonStatus => 'الحالة';

  @override
  String get featuresCommonStock => 'السهم';

  @override
  String get featuresCommonType => 'النوع';

  @override
  String get featuresCommonName => 'الاسم';

  @override
  String get featuresCommonCurrency => 'العملة';

  @override
  String get featuresCommonExchangeRate => 'سعر الصرف';

  @override
  String get featuresCommonIncome => 'دخل';

  @override
  String get featuresCommonExpense => 'مصروف';

  @override
  String get featuresCommonUncategorized => 'غير مصنّف';

  @override
  String get featuresCommonUnspecified => 'غير محدد';

  @override
  String get featuresCommonAutoCalculate => 'حساب تلقائي';

  @override
  String get featuresCommonExcludeFromStats => 'استبعاد من الإحصاءات';

  @override
  String get featuresCommonTopLevelCategory => '- المستوى الأعلى -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => 'إدارة التصنيفات';

  @override
  String get featuresCategoriesExpenseTab => 'تصنيفات المصروفات';

  @override
  String get featuresCategoriesIncomeTab => 'تصنيفات الدخل';

  @override
  String get featuresCategoriesAddCategory => 'إضافة تصنيف';

  @override
  String get featuresCategoriesEditCategory => 'تعديل التصنيف';

  @override
  String get featuresCategoriesNewCategory => 'إضافة تصنيف';

  @override
  String get featuresCategoriesNameLabel => 'الاسم *';

  @override
  String get featuresCategoriesTypeLabel => 'النوع';

  @override
  String get featuresCategoriesParentLabel => 'التصنيف الرئيسي';

  @override
  String get featuresCategoriesColorLabel => 'اللون';

  @override
  String get featuresCategoriesExpense => 'مصروف';

  @override
  String get featuresCategoriesIncome => 'دخل';

  @override
  String get featuresCategoriesDeleteMessage =>
      'هل تريد حذف هذا التصنيف؟ سيتم حذف التصنيفات الفرعية أيضًا.';

  @override
  String get featuresCategoriesMessagesNameRequired => 'أدخل اسم التصنيف';

  @override
  String get featuresCategoriesMessagesDeleteFailed => 'تعذر الحذف';

  @override
  String get featuresBudgetTitle => 'الميزانيات';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$month/$year';
  }

  @override
  String get featuresBudgetTotalBudget => 'ميزانية هذا الشهر';

  @override
  String get featuresBudgetSpent => 'المصروف';

  @override
  String get featuresBudgetAddBudget => 'إضافة ميزانية';

  @override
  String get featuresBudgetEditBudget => 'تعديل الميزانية';

  @override
  String get featuresBudgetNewBudget => 'إضافة ميزانية';

  @override
  String get featuresBudgetCategoryLabel =>
      'التصنيف (اتركه فارغًا للميزانية الإجمالية)';

  @override
  String get featuresBudgetTotalBudgetOption => '- الميزانية الإجمالية -';

  @override
  String get featuresBudgetAmountLabel => 'مبلغ الميزانية *';

  @override
  String get featuresBudgetTotalBudgetName => '(الميزانية الإجمالية)';

  @override
  String get featuresBudgetOverBudget => 'تجاوز الميزانية';

  @override
  String get featuresBudgetDeleteMessage => 'هل تريد حذف هذه الميزانية؟';

  @override
  String get featuresBudgetMessagesAmountRequired => 'أدخل مبلغ ميزانية صحيحًا';

  @override
  String get featuresReportsTitle => 'التقارير';

  @override
  String get featuresReportsTabsCategory => 'تحليل حسب التصنيف';

  @override
  String get featuresReportsTabsTrend => 'تحليل الاتجاه';

  @override
  String get featuresReportsTabsDaily => 'المصروف اليومي';

  @override
  String get featuresReportsPeriodsThisMonth => 'هذا الشهر';

  @override
  String get featuresReportsPeriodsLastMonth => 'الشهر الماضي';

  @override
  String get featuresReportsPeriodsLast3 => 'آخر 3 أشهر';

  @override
  String get featuresReportsPeriodsLast6 => 'آخر 6 أشهر';

  @override
  String get featuresReportsPeriodsThisYear => 'هذه السنة';

  @override
  String get featuresReportsPeriodsCustom => 'فترة مخصصة';

  @override
  String get featuresReportsPeriodLabel => 'الفترة';

  @override
  String get featuresReportsStart => 'البداية';

  @override
  String get featuresReportsEnd => 'النهاية';

  @override
  String get featuresReportsCurrentTotal => 'إجمالي الفترة الحالية';

  @override
  String get featuresReportsComparedPrevious => 'مقارنة بالفترة السابقة';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta، لا توجد بيانات في الفترة السابقة';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return 'التفاصيل: $type';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return 'الإجمالي: $amount';
  }

  @override
  String get featuresReportsSelectedCategory => 'التصنيف المحدد: ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return '، المبلغ $amount';
  }

  @override
  String get featuresReportsViewTransactions => 'عرض المعاملات المرتبطة';

  @override
  String get featuresRecurringTitle => 'الدخل والمصروفات المتكررة';

  @override
  String get featuresRecurringAdd => 'إضافة سجل متكرر';

  @override
  String get featuresRecurringEdit => 'تعديل السجل المتكرر';

  @override
  String get featuresRecurringCreate => 'إضافة سجل متكرر';

  @override
  String get featuresRecurringAmountLabel => 'المبلغ *';

  @override
  String get featuresRecurringFxFeeLabel => 'رسوم المعاملات الأجنبية (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder =>
      'فارغ: يحسبها النظام حسب نسبة البطاقة';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return 'نسبة رسوم المعاملات الأجنبية للبطاقة $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return '، القيمة المقترحة NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading => 'جارٍ جلب أحدث سعر صرف...';

  @override
  String get featuresRecurringCategory => 'التصنيف';

  @override
  String get featuresRecurringFrequency => 'التكرار';

  @override
  String get featuresRecurringStartDate => 'تاريخ البداية';

  @override
  String featuresRecurringNextRun(Object date) {
    return 'التنفيذ التالي: $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return 'التصنيف: $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return 'الحساب: $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return 'رسوم المعاملات الأجنبية: NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => 'هل تريد حذف هذا السجل المتكرر؟';

  @override
  String get featuresRecurringCreatingTransfer => 'جارٍ الإنشاء...';

  @override
  String get featuresRecurringConfirmTransfer => 'تأكيد التحويل';

  @override
  String get featuresRecurringFrequencyLabelsDaily => 'يوميًا';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => 'أسبوعيًا';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => 'شهريًا';

  @override
  String get featuresRecurringFrequencyLabelsYearly => 'سنويًا';

  @override
  String get featuresRecurringMessagesAmountRequired => 'أدخل مبلغًا صحيحًا';

  @override
  String get featuresDataTransferTitle => 'تصدير واستيراد البيانات';

  @override
  String get featuresDataTransferExportStartDate => 'تاريخ بداية التصدير';

  @override
  String get featuresDataTransferExportEndDate => 'تاريخ نهاية التصدير';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'يدعم تصدير واستيراد CSV. الأعمدة: $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'تصدير CSV';

  @override
  String get featuresDataTransferExporting => 'جارٍ التصدير...';

  @override
  String get featuresDataTransferChooseCsv => 'اختيار CSV للاستيراد';

  @override
  String get featuresDataTransferImporting => 'جارٍ الاستيراد...';

  @override
  String featuresDataTransferImported(Object count) {
    return 'تم الاستيراد: $count سجلات';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return 'تم التخطي: $count سجلات';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return 'تصنيفات أُنشئت تلقائيًا: $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return 'حسابات أُنشئت تلقائيًا: $items';
  }

  @override
  String get featuresDataTransferWarning => 'تحذير';

  @override
  String get featuresDataTransferError => 'خطأ';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return 'الصف $row: $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => 'الحسابات';

  @override
  String get featuresDataTransferModulesTransactions => 'المعاملات';

  @override
  String get featuresDataTransferModulesCategories => 'التصنيفات';

  @override
  String get featuresDataTransferModulesStockTransactions => 'معاملات الأسهم';

  @override
  String get featuresDataTransferModulesStockDividends => 'التوزيعات';

  @override
  String get featuresDataTransferMessagesExportSuccess => 'اكتمل التصدير';

  @override
  String get featuresDataTransferMessagesExportFailed => 'فشل التصدير';

  @override
  String get featuresDataTransferMessagesEmptyCsv =>
      'لا توجد بيانات في CSV للاستيراد';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return 'اكتمل استيراد $name';
  }

  @override
  String get featuresDataTransferMessagesImportFailed => 'فشل الاستيراد';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      'تم تنزيل نسخة البيانات الكاملة';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      'تعذر تنزيل نسخة البيانات الكاملة';

  @override
  String get featuresDataTransferMessagesRestoreDone => 'اكتملت الاستعادة';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      'تعذرت استعادة نسخة البيانات';

  @override
  String get featuresDataTransferMessagesDbExportDone =>
      'تم تنزيل نسخة قاعدة البيانات';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      'تعذر إنشاء نسخة قاعدة البيانات';

  @override
  String get featuresDataTransferMessagesDbRestoreDone =>
      'تمت استعادة قاعدة البيانات';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      'تعذرت استعادة قاعدة البيانات';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return 'تم الرفع إلى $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed =>
      'فشل نسخ MEGA S4 الاحتياطي';

  @override
  String get featuresDataTransferMessagesRequireOneField =>
      'املأ حقلًا واحدًا على الأقل';

  @override
  String get featuresDataTransferMessagesSaved => 'تم حفظ الإعدادات';

  @override
  String get featuresDataTransferMessagesSaveFailed => 'تعذر حفظ الإعدادات';

  @override
  String get featuresDataTransferBundleTitle => 'نسخة بيانات كاملة (مع الصور)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      'نزّل ملف ZIP واحدًا يحتوي على كل بياناتك الشخصية: المعاملات، الحسابات، التصنيفات، الميزانيات، الدورات، أسعار الصرف، الأسهم وصور الإيصالات.';

  @override
  String get featuresDataTransferBundleDescription2 =>
      'يمكن رفع ملف ZIP نفسه لاستعادة البيانات.';

  @override
  String get featuresDataTransferBundleRestorePrefix => 'تستخدم الاستعادة';

  @override
  String get featuresDataTransferBundleMergeMode => 'وضع الدمج';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      ': تُتجاوز البيانات الموجودة وتُضاف البيانات الناقصة فقط؛';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      'لن تُحذف أو تُستبدل البيانات الحالية';

  @override
  String get featuresDataTransferBundleDownload =>
      'تنزيل نسخة البيانات الكاملة';

  @override
  String get featuresDataTransferBundleDownloading => 'جارٍ تجهيز التنزيل...';

  @override
  String get featuresDataTransferBundleRestore => 'رفع نسخة بيانات للاستعادة';

  @override
  String get featuresDataTransferBundleRestoring => 'جارٍ الاستعادة...';

  @override
  String get featuresDataTransferDatabaseTitle =>
      'نسخ/استعادة قاعدة البيانات كاملة';

  @override
  String get featuresDataTransferDatabaseDescription =>
      'للمدراء فقط. في وضع SQLite يتم تنزيل نسخة `.db`؛ وفي PostgreSQL يتم تنزيل `.sql`. للاستعادة، ارفع ملفًا من النوع الموافق.';

  @override
  String get featuresDataTransferDatabaseDownload =>
      'تنزيل نسخة قاعدة البيانات';

  @override
  String get featuresDataTransferDatabaseDownloading => 'جارٍ التنزيل...';

  @override
  String get featuresDataTransferDatabaseRestore =>
      'اختيار نسخة قاعدة بيانات للاستعادة';

  @override
  String get featuresDataTransferDatabaseRestoring => 'جارٍ الاستعادة...';

  @override
  String get featuresDataTransferMegaTitle => 'نسخة احتياطية سحابية MEGA S4';

  @override
  String get featuresDataTransferMegaDescription =>
      'يرفع نسخة SQLite الكاملة الحالية ككائن داخل bucket في MEGA S4. يتم ضبط الاتصال عبر متغيرات بيئة الخادم؛ لا تُدخل المفاتيح ولا تُعرض في المتصفح.';

  @override
  String get featuresDataTransferMegaState => 'الحالة: ';

  @override
  String get featuresDataTransferMegaConfigured => 'مهيأ';

  @override
  String get featuresDataTransferMegaNotConfigured => 'غير مكتمل الإعداد';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket: ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return 'متغيرات البيئة الناقصة: $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'رفع نسخة احتياطية إلى MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => 'جارٍ الرفع...';

  @override
  String get featuresDataTransferMegaConfigure => 'إعداد';

  @override
  String get featuresDataTransferMegaCancelConfigure => 'إلغاء الإعداد';

  @override
  String get featuresDataTransferMegaFormHelp =>
      'تُكتب الإعدادات في ملف دائم على الخادم وتُطبق فورًا. يجب إدخال حقول المفاتيح من جديد؛ لن تُملأ تلقائيًا.';

  @override
  String get featuresDataTransferMegaBucketName => 'اسم bucket';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefix (اختياري)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (اختياري، اتركه فارغًا للاختيار التلقائي)';

  @override
  String get featuresDataTransferMegaSaveSettings => 'حفظ الإعدادات';

  @override
  String get featuresAccountsTitle => 'الحسابات';

  @override
  String get featuresAccountsTypeLabelsBank => 'حساب بنكي';

  @override
  String get featuresAccountsTypeLabelsCredit_card => 'بطاقة ائتمان';

  @override
  String get featuresAccountsTypeLabelsCash => 'نقد';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => 'محفظة رقمية';

  @override
  String get featuresAccountsTypeLabelsOther => 'أخرى';

  @override
  String get featuresAccountsTotalAssets => 'إجمالي الأصول';

  @override
  String get featuresAccountsCreditOutstanding => 'الرصيد المستحق للبطاقة';

  @override
  String get featuresAccountsAddAccount => 'إضافة حساب';

  @override
  String get featuresAccountsEditAccount => 'تعديل الحساب';

  @override
  String get featuresAccountsNewAccount => 'إضافة حساب';

  @override
  String get featuresAccountsAccountName => 'اسم الحساب *';

  @override
  String get featuresAccountsInitialBalance => 'الرصيد الافتتاحي';

  @override
  String get featuresAccountsInitialBalanceEdit =>
      'الرصيد الافتتاحي / الإعداد الحالي';

  @override
  String get featuresAccountsLinkedBank => 'البنك';

  @override
  String get featuresAccountsUngrouped => 'بلا مجموعة';

  @override
  String get featuresAccountsOverseasFeeRate =>
      'نسبة رسوم المعاملات الأجنبية (%)';

  @override
  String get featuresAccountsStatementClosingDay =>
      'يوم إقفال كشف الحساب (1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      'مثال: 15. اتركه فارغًا إذا لم تكن تريد حساب الدورة الحالية.';

  @override
  String get featuresAccountsExcludeFromTotal => 'عدم تضمينه في إجمالي الأصول';

  @override
  String get featuresAccountsOtherAccounts => 'حسابات أخرى';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return 'الإجمالي بعد التحويل: $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return 'البنك المرتبط: $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return 'رسوم المعاملات الأجنبية: $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return 'يوم إقفال الشهر: $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return 'إنفاق الدورة الحالية: $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => 'كشف الدورة السابقة: ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return 'إنفاق $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return 'مدفوع $amount';
  }

  @override
  String get featuresAccountsViewCycles => 'عرض تفاصيل الدورات ›';

  @override
  String get featuresAccountsRepaymentTitle => 'سداد بطاقة الائتمان';

  @override
  String get featuresAccountsRepaymentPaymentAccount => 'حساب الدفع';

  @override
  String get featuresAccountsRepaymentPaymentDate => 'تاريخ الدفع';

  @override
  String get featuresAccountsRepaymentNoLinkedCards =>
      'لا توجد بطاقات مرتبطة بهذا البنك';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return 'الرصيد الحالي: $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => 'مبلغ السداد';

  @override
  String get featuresAccountsRepaymentConfirm => 'تأكيد السداد';

  @override
  String get featuresAccountsDeleteMessage => 'هل تريد حذف هذا الحساب؟';

  @override
  String get featuresAccountsCyclesTitle => 'تفاصيل دورات كشف الحساب';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name يوم إقفال الشهر $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      'تُطابق المدفوعات مع الكشف الذي تم إقفاله. المبالغ المدفوعة بعد الإقفال تُحسب ضمن تلك الدورة.';

  @override
  String get featuresAccountsCyclesPeriod => 'الفترة';

  @override
  String get featuresAccountsCyclesSpending => 'الإنفاق';

  @override
  String get featuresAccountsCyclesPayment => 'الدفع الفعلي';

  @override
  String get featuresAccountsCyclesCurrent => 'الحالي';

  @override
  String get featuresAccountsFxTitle => 'إدارة أسعار الصرف';

  @override
  String get featuresAccountsFxAutoUpdate => 'تحديث أسعار الصرف تلقائيًا';

  @override
  String get featuresAccountsFxSyncNow => 'مزامنة الآن';

  @override
  String get featuresAccountsFxSyncing => 'جارٍ المزامنة...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return 'آخر مزامنة: $date';
  }

  @override
  String get featuresAccountsFxCurrency => 'العملة';

  @override
  String get featuresAccountsFxUnitToTwd => 'وحدة واحدة = TWD';

  @override
  String get featuresAccountsFxEmpty => 'لم يتم إعداد أسعار صرف أجنبية بعد';

  @override
  String get featuresAccountsFxCurrencyLabel => 'العملة (مثل USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'السعر مقابل TWD';

  @override
  String get featuresAccountsFxAddOrUpdate => 'إضافة / تحديث';

  @override
  String get featuresAccountsMessagesNameRequired => 'أدخل اسم الحساب';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired =>
      'اختر حساب الدفع';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      'أدخل مبلغ سداد لبطاقة واحدة على الأقل';

  @override
  String get featuresAccountsMessagesCurrencyInvalid =>
      'يجب أن يكون رمز العملة مكونًا من 3 أحرف';

  @override
  String get featuresAccountsMessagesRateInvalid => 'أدخل سعر صرف صحيحًا';

  @override
  String get featuresAccountsMessagesSaved => 'تم الحفظ';

  @override
  String get featuresAccountsMessagesSaveFailed => 'تعذر الحفظ';

  @override
  String get featuresAccountsMessagesDeleteFailed => 'تعذر الحذف';

  @override
  String get featuresAccountsMessagesRatesUpdated => 'تم تحديث أسعار الصرف';

  @override
  String get featuresAccountsMessagesSyncFailed => 'فشلت المزامنة';

  @override
  String get featuresAccountsMessagesLoadFailed => 'تعذر التحميل';

  @override
  String get featuresTransactionsTitle => 'المعاملات';

  @override
  String get featuresTransactionsSearchPlaceholder => 'البحث في الملاحظات...';

  @override
  String get featuresTransactionsAllTypes => 'كل الأنواع';

  @override
  String get featuresTransactionsAllAccounts => 'كل الحسابات';

  @override
  String get featuresTransactionsAllCategories => 'كل التصنيفات';

  @override
  String get featuresTransactionsTransfer => 'تحويل';

  @override
  String get featuresTransactionsFuture => 'معاملات مستقبلية';

  @override
  String get featuresTransactionsExcludeTransfer => 'استبعاد التحويلات';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (الكل)';
  }

  @override
  String get featuresTransactionsStartDateTitle => 'تاريخ البداية';

  @override
  String get featuresTransactionsEndDateTitle => 'تاريخ النهاية';

  @override
  String get featuresTransactionsAdd => 'إضافة معاملة';

  @override
  String get featuresTransactionsEdit => 'تعديل المعاملة';

  @override
  String get featuresTransactionsCreate => 'إضافة معاملة';

  @override
  String get featuresTransactionsAccountTransfer => 'تحويل بين الحسابات';

  @override
  String get featuresTransactionsBatchCategory => 'تغيير التصنيف دفعة واحدة';

  @override
  String get featuresTransactionsBatchDate => 'تغيير التاريخ دفعة واحدة';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return 'حذف المحدد ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => 'دخل الصفحة';

  @override
  String get featuresTransactionsPageExpense => 'مصروفات الصفحة';

  @override
  String get featuresTransactionsPageTotal => 'إجمالي الصفحة';

  @override
  String get featuresTransactionsPageSummaryAria => 'ملخص معاملات الصفحة';

  @override
  String get featuresTransactionsEmpty => 'لا توجد معاملات مطابقة';

  @override
  String featuresTransactionsSource(Object name) {
    return 'المصدر: $name';
  }

  @override
  String get featuresTransactionsFxFee => 'رسوم بطاقة أجنبية';

  @override
  String get featuresTransactionsPhotoOne => 'صورة واحدة';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count صور';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => 'التاريخ *';

  @override
  String get featuresTransactionsAmountRequiredLabel => 'المبلغ *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return 'سعر الصرف (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder =>
      'فارغ: استخدام سعر النظام';

  @override
  String get featuresTransactionsLatestRateLoading =>
      'جارٍ جلب أحدث سعر صرف...';

  @override
  String get featuresTransactionsFxFeePlaceholder =>
      'فارغ: يحسبها النظام حسب نسبة البطاقة';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return 'نسبة رسوم المعاملات الأجنبية للبطاقة $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return '، القيمة المقترحة NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => 'الصور';

  @override
  String get featuresTransactionsLoadingPhotos => 'جارٍ تحميل الصور...';

  @override
  String get featuresTransactionsTakePhoto => 'التقاط صورة';

  @override
  String get featuresTransactionsChooseImage => 'اختيار صورة';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return 'على الهاتف يمكنك التقاط صورة أو اختيارها من المعرض. حتى 5 صور، وكل صورة حتى $maxMb MB.';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return 'صور جديدة $count';
  }

  @override
  String get featuresTransactionsRemove => 'إزالة';

  @override
  String get featuresTransactionsChoosePhoto => 'اختيار صورة';

  @override
  String get featuresTransactionsTransferOut => 'حساب التحويل منه *';

  @override
  String get featuresTransactionsTransferIn => 'حساب التحويل إليه *';

  @override
  String get featuresTransactionsSelectPlaceholder => 'اختيار';

  @override
  String get featuresTransactionsCreating => 'جارٍ الإنشاء...';

  @override
  String get featuresTransactionsConfirmTransfer => 'تأكيد التحويل';

  @override
  String get featuresTransactionsBatchCategoryTitle =>
      'تغيير التصنيف دفعة واحدة';

  @override
  String get featuresTransactionsBatchDateTitle => 'تغيير التاريخ دفعة واحدة';

  @override
  String get featuresTransactionsNewCategory => 'التصنيف الجديد';

  @override
  String get featuresTransactionsNewDate => 'التاريخ الجديد';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return 'تطبيق على $count سجلات';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      'هل تريد حذف هذه المعاملة؟ لا يمكن التراجع عن هذا الإجراء.';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return 'حذف المعاملات المحددة: $count؟';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return 'تم تحديث المعاملة، لكن $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return 'تم إنشاء المعاملة، لكن $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      'يجب حذف التحويلات وإعادة إنشائها';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      'تُنشأ رسوم البطاقة الأجنبية تلقائيًا. عدّل المعاملة المرتبطة بالعملة الأجنبية وستتزامن الرسوم بعدها.';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed => 'تعذر رفع الصورة';

  @override
  String get featuresTransactionsMessagesDateRequired => 'اختر التاريخ';

  @override
  String get featuresTransactionsMessagesAmountRequired => 'أدخل مبلغًا صحيحًا';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      'اختر حساب التحويل منه وحساب التحويل إليه';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      'لا يمكن أن يكون حسابا التحويل منه وإليه متطابقين';

  @override
  String get featuresTransactionsTypeLabelsIncome => 'دخل';

  @override
  String get featuresTransactionsTypeLabelsExpense => 'مصروف';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => 'تحويل وارد';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => 'تحويل صادر';

  @override
  String get featuresStocksTabsPortfolio => 'المحفظة';

  @override
  String get featuresStocksTabsTransactions => 'المعاملات';

  @override
  String get featuresStocksTabsDividends => 'التوزيعات';

  @override
  String get featuresStocksTabsRealized => 'الربح/الخسارة المحققة';

  @override
  String get featuresStocksTabsSettings => 'إعدادات التداول';

  @override
  String get featuresStocksCommonStockLabel => 'السهم';

  @override
  String get featuresStocksCommonStockRequired => 'السهم *';

  @override
  String get featuresStocksCommonStockTypeStock => 'سهم';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => 'وارنت';

  @override
  String get featuresStocksCommonDate => 'التاريخ';

  @override
  String get featuresStocksCommonShares => 'الأسهم';

  @override
  String get featuresStocksCommonPrice => 'السعر';

  @override
  String get featuresStocksCommonTotal => 'الإجمالي';

  @override
  String get featuresStocksCommonReturnRate => 'العائد';

  @override
  String get featuresStocksCommonOverallReturnRate => 'العائد الإجمالي';

  @override
  String get featuresStocksCommonEstimatedPL => 'ربح/خسارة تقديرية';

  @override
  String get featuresStocksCommonRealizedPL => 'ربح/خسارة محققة';

  @override
  String get featuresStocksCommonTotalRealizedPL =>
      'إجمالي الربح/الخسارة المحققة';

  @override
  String get featuresStocksCommonYearRealizedPL => 'ربح/خسارة محققة هذا العام';

  @override
  String get featuresStocksCommonRealizedCount => 'عدد السجلات المحققة';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count سجلات';
  }

  @override
  String get featuresStocksCommonSellAverage => 'متوسط سعر البيع';

  @override
  String get featuresStocksCommonCostAverage => 'متوسط التكلفة';

  @override
  String get featuresStocksCommonFeeAndTax => 'الرسوم + الضريبة';

  @override
  String get featuresStocksCommonCashDividend => 'توزيع نقدي';

  @override
  String get featuresStocksCommonStockDividend => 'توزيع أسهم';

  @override
  String get featuresStocksCommonStockSymbol => 'رمز السهم *';

  @override
  String get featuresStocksCommonStockName => 'اسم السهم';

  @override
  String get featuresStocksCommonSearching => 'جارٍ البحث...';

  @override
  String get featuresStocksCommonCancelAccounting =>
      '- عدم الترحيل للحساب (توزيع أسهم فقط) -';

  @override
  String get featuresStocksCommonAutoCalculate => 'حساب تلقائي';

  @override
  String get featuresStocksCommonBuy => 'شراء';

  @override
  String get featuresStocksCommonSell => 'بيع';

  @override
  String get featuresStocksPortfolioTitle => 'المحفظة';

  @override
  String get featuresStocksPortfolioTotalMarketValue => 'إجمالي القيمة السوقية';

  @override
  String get featuresStocksPortfolioTotalCost => 'إجمالي تكلفة الاستثمار';

  @override
  String get featuresStocksPortfolioTotalDividend => 'إجمالي التوزيعات';

  @override
  String get featuresStocksPortfolioAddStock => 'إضافة سهم';

  @override
  String get featuresStocksPortfolioEditStock => 'تعديل السهم';

  @override
  String get featuresStocksPortfolioNewStock => 'إضافة سهم';

  @override
  String get featuresStocksPortfolioUpdatePrices => 'تحديث الأسعار';

  @override
  String get featuresStocksPortfolioBatchUpdate => 'تحديث تلقائي دفعة واحدة';

  @override
  String get featuresStocksPortfolioUpdating => 'جارٍ التحديث...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'يحاول AssetPilot أولًا استدعاء API العام من TWSE عبر المتصفح. إذا تم حظر الطلب، يستخدم وكيل API الخاص بعد تسجيل الدخول ثم يحدّث المراكز.';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return 'اكتمل التحديث: نجح $updated.';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return 'اكتمل التحديث: نجح $updated، فشل $failed.';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      'تعذر جلب بيانات TWSE من المتصفح';

  @override
  String get featuresStocksPortfolioHeldShares => 'الأسهم المحتفظ بها';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count سهم';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => 'السعر الحالي';

  @override
  String get featuresStocksPortfolioMarketValue => 'القيمة السوقية';

  @override
  String featuresStocksPortfolioDividendMonths(Object months) {
    return 'أشهر توزيع الأرباح: $months';
  }

  @override
  String get featuresStocksPortfolioDividendMonthsEmpty =>
      'لا يوجد سجل توزيعات بعد';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired => 'أدخل رمز السهم';

  @override
  String get featuresStocksTransactionsTitle => 'معاملات الأسهم';

  @override
  String get featuresStocksTransactionsAddTransaction => 'إضافة معاملة';

  @override
  String get featuresStocksTransactionsEditTransaction => 'تعديل المعاملة';

  @override
  String get featuresStocksTransactionsNewTransaction => 'إضافة معاملة';

  @override
  String get featuresStocksTransactionsTypeLabel => 'النوع';

  @override
  String get featuresStocksTransactionsDateLabel => 'التاريخ *';

  @override
  String get featuresStocksTransactionsSharesLabel => 'عدد الأسهم *';

  @override
  String get featuresStocksTransactionsPriceLabel => 'سعر الوحدة *';

  @override
  String get featuresStocksTransactionsFeeLabel => 'العمولة';

  @override
  String get featuresStocksTransactionsTaxLabel => 'ضريبة التداول';

  @override
  String get featuresStocksTransactionsDeleteMessage =>
      'هل تريد حذف هذه المعاملة؟';

  @override
  String get featuresStocksTransactionsMessagesStockRequired => 'اختر سهمًا';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      'أدخل عدد أسهم صحيحًا';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired =>
      'أدخل سعرًا صحيحًا';

  @override
  String get featuresStocksDividendsTitle => 'التوزيعات';

  @override
  String get featuresStocksDividendsAddDividend => 'إضافة توزيع';

  @override
  String get featuresStocksDividendsEditDividend => 'تعديل التوزيع';

  @override
  String get featuresStocksDividendsNewDividend => 'إضافة توزيع';

  @override
  String get featuresStocksDividendsSyncExDividends =>
      'مزامنة بيانات ex-dividend';

  @override
  String get featuresStocksDividendsSyncDescription =>
      'يزامن تلقائيًا بيانات ex-dividend التاريخية من TWSE بناءً على مراكزك.';

  @override
  String get featuresStocksDividendsSyncStart => 'بدء المزامنة';

  @override
  String get featuresStocksDividendsSyncing => 'جارٍ المزامنة...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return 'تمت إضافة $synced وتخطي $skipped.';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return 'تمت إضافة $synced وتخطي $skipped وفشل $failed.';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel =>
      'التوزيع النقدي (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel => 'توزيع الأسهم';

  @override
  String get featuresStocksDividendsDepositAccount => 'حساب الإيداع';

  @override
  String get featuresStocksDividendsDeleteMessage => 'هل تريد حذف هذا التوزيع؟';

  @override
  String get featuresStocksDividendsMessagesStockRequired => 'اختر سهمًا';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      'أدخل توزيعًا نقديًا أو توزيع أسهم';

  @override
  String get featuresStocksRealizedTitle => 'الربح/الخسارة المحققة';

  @override
  String get featuresStocksSettingsTitle => 'إعدادات التداول';

  @override
  String get featuresStocksSettingsFeeTitle => 'العمولة / ضريبة التداول';

  @override
  String get featuresStocksSettingsFeeRate => 'نسبة العمولة';

  @override
  String get featuresStocksSettingsFeeDiscount => 'الخصم (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot =>
      'الحد الأدنى للعمولة (لوت كامل)';

  @override
  String get featuresStocksSettingsFeeMinOdd =>
      'الحد الأدنى للعمولة (لوت كسري)';

  @override
  String get featuresStocksSettingsSellTaxRateStock => 'ضريبة البيع (سهم)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => 'ضريبة البيع (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant => 'ضريبة البيع (وارنت)';

  @override
  String get featuresStocksSettingsSellTaxMin => 'الحد الأدنى لضريبة التداول';

  @override
  String get featuresStocksSettingsSaveSettings => 'حفظ الإعدادات';

  @override
  String get featuresStocksSettingsStockStatusTitle => 'حالة السهم';

  @override
  String get featuresStocksSettingsCurrentPrice => 'السعر الحالي';

  @override
  String get featuresStocksSettingsNormalTracking => 'تتبع عادي';

  @override
  String get featuresStocksSettingsDelisted => 'مشطوب من السوق';

  @override
  String get featuresStocksSettingsRestoreTracking => 'استعادة التتبع';

  @override
  String get featuresStocksSettingsMarkDelisted => 'وضع علامة شطب';

  @override
  String get featuresStocksSettingsRecurringTitle => 'استثمار دوري في الأسهم';

  @override
  String get featuresStocksSettingsAddRecurringShort => 'إضافة';

  @override
  String get featuresStocksSettingsEditRecurring => 'تعديل الاستثمار الدوري';

  @override
  String get featuresStocksSettingsNewRecurring => 'إضافة استثمار دوري';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => 'المبلغ (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => 'التكرار';

  @override
  String get featuresStocksSettingsStartDate => 'تاريخ البداية';

  @override
  String get featuresStocksSettingsLastGenerated => 'آخر إنشاء';

  @override
  String get featuresStocksSettingsActive => 'نشط';

  @override
  String get featuresStocksSettingsInactive => 'متوقف';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm =>
      'هل تريد حذف هذا الاستثمار الدوري؟';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => 'يوميًا';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => 'أسبوعيًا';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => 'شهريًا';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => 'سنويًا';

  @override
  String get featuresStocksSettingsMessagesSaved => 'تم حفظ الإعدادات';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return 'تعذر الحفظ: $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired => 'اختر سهمًا';

  @override
  String get featuresStocksSettingsMessagesAmountRequired =>
      'أدخل مبلغًا صحيحًا';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol: الحالة $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus =>
      'تمت استعادة التتبع العادي';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus =>
      'تم وضع علامة الشطب';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      'تعذر تحديث حالة الشطب';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => 'تقرير التدفق النقدي اليومي';

  @override
  String get notificationsReportTypeWeekly => 'تقرير التدفق النقدي الأسبوعي';

  @override
  String get notificationsReportTypeMonthly => 'تقرير التدفق النقدي الشهري';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return 'تقرير التدفق النقدي اليومي｜$date ($weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return 'تقرير التدفق النقدي الأسبوعي｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return 'تقرير التدفق النقدي الشهري｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name، التدفق النقدي ليوم $date ($weekday)';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name، التدفق النقدي للفترة $start ~ $end';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name، التدفق النقدي لشهر $month';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 تاريخ التقرير $date　·　تاريخ الإرسال $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 فترة التقرير $start ~ $end　·　تاريخ الإرسال $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 شهر التقرير $month　·　تاريخ الإرسال $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return 'ملخص يوم أمس بالكامل ($date، $weekday)؛ أُرسل اليوم ($sendDate)';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return 'ملخص آخر 7 أيام ($start ~ $end)؛ أُرسل اليوم ($sendDate)';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return 'ملخص الشهر الماضي ($month، $start ~ $end)؛ أُرسل هذا الشهر ($sendDate)';
  }

  @override
  String get notificationsLeadDaily => 'أمس';

  @override
  String get notificationsLeadWeekly => 'هذا الأسبوع';

  @override
  String get notificationsLeadMonthly => 'الشهر الماضي';

  @override
  String notificationsKpiIncome(Object lead) {
    return 'دخل $lead';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return 'مصروفات $lead';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return 'صافي $lead';
  }

  @override
  String get notificationsCompareLabelDaily => 'مقارنة باليوم السابق';

  @override
  String get notificationsCompareLabelWeekly => 'مقارنة بالأسبوع السابق';

  @override
  String get notificationsCompareLabelMonthly => 'مقارنة بالشهر السابق';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return 'أمس ($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return 'آخر 7 أيام ($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return 'الشهر الماضي ($month)';
  }

  @override
  String get notificationsSectionsBalance => 'أرصدة الحسابات';

  @override
  String get notificationsSectionsTopCategories => 'أعلى 5 مصروفات هذا الشهر';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return 'أعلى 5 مصروفات في $month';
  }

  @override
  String get notificationsSectionsDailyDetail => 'التفصيل اليومي';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return 'المتراكم الشهري ($month)';
  }

  @override
  String get notificationsSectionsStock => 'استثمارات الأسهم';

  @override
  String get notificationsSectionsRecentDaily => 'معاملات أمس';

  @override
  String get notificationsSectionsRecentWeekly => 'معاملات هذا الأسبوع';

  @override
  String get notificationsSectionsRecentMonthly => 'معاملات الشهر الماضي';

  @override
  String get notificationsLabelsIncome => 'الدخل';

  @override
  String get notificationsLabelsExpense => 'المصروفات';

  @override
  String get notificationsLabelsNet => 'الصافي';

  @override
  String get notificationsLabelsCost => 'إجمالي التكلفة';

  @override
  String get notificationsLabelsMarketValue => 'القيمة السوقية';

  @override
  String get notificationsLabelsUnrealizedPL => 'ربح/خسارة غير محققة';

  @override
  String get notificationsLabelsReturnRate => 'العائد';

  @override
  String get notificationsLabelsUncategorized => 'غير مصنّف';

  @override
  String get notificationsTableDate => 'التاريخ';

  @override
  String get notificationsEmptyNoAccount => 'لا توجد حسابات بعد';

  @override
  String get notificationsEmptyNoExpense => 'لا توجد مصروفات بعد';

  @override
  String notificationsEmptyNoTx(Object label) {
    return 'لا توجد معاملات لـ $label';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return 'الأسهم: القيمة السوقية $marketValue، الربح/الخسارة غير المحققة $pl';
  }

  @override
  String get notificationsCtaViewFullReport => 'عرض التقرير الكامل';

  @override
  String get notificationsCtaViewLineRecord => 'عرض سجلات LINE';

  @override
  String get notificationsReminderAltText => 'تذكير بتسجيل المصروف';

  @override
  String get notificationsReminderTitle => 'لا تنس تسجيل مصروفات اليوم';

  @override
  String notificationsReminderBody(Object name) {
    return '$name، خصص 10 ثوانٍ لتسجيل مصروفات اليوم حتى لا تفوتك عند إغلاق الشهر.';
  }

  @override
  String get notificationsReminderHint =>
      'اضغط إضافة مصروف، ثم اكتب: المبلغ الملاحظة التاريخ (التاريخ اختياري)';

  @override
  String get notificationsReminderFallbackName => 'مرحبًا';

  @override
  String get notificationsReminderAddExpense => 'إضافة مصروف';

  @override
  String get notificationsReminderViewToday => 'عرض سجلات اليوم';

  @override
  String get notificationsFallbackUser => 'المستخدم';

  @override
  String get mobileLegacyMessagebde18a20 => '・مستبعد من إجمالي الأصول';

  @override
  String get mobileLegacyNoneCreateAsParent => '(لا يوجد، كتصنيف رئيسي)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      'تعرض الصفحة الرئيسية الدخل والمصروفات والصافي وتصنيفات الإنفاق حسب الشهر. بدّل بين الأشهر لترى أين يذهب المال.';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      'تُربط المدفوعات بالكشف الذي تسدده، حتى إذا تم السداد في الدورة التالية بعد الإقفال.';

  @override
  String get mobileLegacy0NoPayment => '0 = لا تسديد';

  @override
  String get mobileLegacyMon => 'الاثنين';

  @override
  String get mobileLegacyStock => 'سهم عادي';

  @override
  String get mobileLegacyStocks => 'أسهم عادية (%)';

  @override
  String get mobileLegacyTue => 'الثلاثاء';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      'حساب الإيداع (مطلوب عند وجود توزيع نقدي)';

  @override
  String get mobileLegacyWed => 'الأربعاء';

  @override
  String get mobileLegacyPreviousStatement => 'كشف الفترة السابقة ';

  @override
  String get mobileLegacyNext => 'التالي';

  @override
  String get mobileLegacyDelisted => 'مشطوب';

  @override
  String get mobileLegacySubcategory => 'التصنيف الفرعي';

  @override
  String get mobileLegacyDeleted => 'تم الحذف';

  @override
  String get mobileLegacyUpdated => 'تم التحديث';

  @override
  String get mobileLegacyLinked => 'مربوط';

  @override
  String get mobileLegacyUnlinked => 'تم إلغاء الربط';

  @override
  String get mobileLegacyTotalRealizedPL => 'إجمالي الربح/الخسارة المحققة';

  @override
  String get mobileLegacyFri => 'الجمعة';

  @override
  String get mobileLegacyStandardRate01 => 'النسبة القياسية: 0.1%';

  @override
  String get mobileLegacyStandardRate03 => 'النسبة القياسية: 0.3%';

  @override
  String get mobileLegacySat => 'السبت';

  @override
  String get mobileLegacyCategoryName => 'اسم التصنيف';

  @override
  String get mobileLegacyFeeOptional => 'العمولة (اختياري)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      'اترك العمولة والضريبة فارغتين ليحسبهما الخادم تلقائيًا';

  @override
  String get mobileLegacyCommissionRate => 'نسبة العمولة (%)';

  @override
  String get mobileLegacyDay => 'الأحد';

  @override
  String get mobileLegacyMonthlyBudget => 'الميزانية الشهرية';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      'التصنيف الرئيسي (عدم الاختيار يعني إنشاء تصنيف رئيسي)';

  @override
  String get mobileLegacyTheme => 'المظهر';

  @override
  String get mobileLegacyThu => 'الخميس';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => 'تصنيف غير معروف';

  @override
  String get mobileLegacyNotLinked => 'غير مربوط';

  @override
  String get mobileLegacyNoTransactionsThisMonth => 'لا توجد معاملات هذا الشهر';

  @override
  String get mobileLegacyNoBudgetThisMonth => 'لا توجد ميزانية لهذا الشهر';

  @override
  String get mobileLegacyNetThisMonth => 'صافي هذا الشهر';

  @override
  String get mobileLegacyPositiveWholeNumber => 'عدد صحيح موجب';

  @override
  String get mobileLegacyDeletePermanently => 'حذف نهائيًا';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      'حذف الحساب وكل البيانات نهائيًا من دون إمكانية استعادة';

  @override
  String get mobileLegacyNoReleaseNotesAvailable =>
      'لا توجد ملاحظات تحديث حاليًا';

  @override
  String get mobileLegacyCurrentDevice => 'الجهاز الحالي';

  @override
  String get mobileLegacyTransactions => 'المعاملات';

  @override
  String get mobileLegacyAll => 'الكل';

  @override
  String get mobileLegacyAllCategories => 'كل التصنيفات';

  @override
  String get mobileLegacyAllAccounts => 'كل الحسابات';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      'مبلغ سداد كل بطاقة (بعملة البطاقة)';

  @override
  String get mobileLegacySyncDividends => 'مزامنة التوزيعات';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      'الاسم (اختياري، يُملأ تلقائيًا إذا تُرك فارغًا)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      'في تبويب الأسهم، أدخل رمزًا مثل 2330 لتتبع الأسعار والربح/الخسارة المحققة وغير المحققة، مع مزامنة التوزيعات تلقائيًا.';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      'من تبويب المعاملات في الأسفل، اضغط + لإضافة دخل أو مصروف. يدعم عدة عملات والتحويل بين الحسابات. اسحب المعاملة لليسار للحذف أو اضغط عليها للتعديل.';

  @override
  String get mobileLegacyNoDataForThisPeriod => 'لا توجد بيانات في هذه الفترة';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      'سيحذف هذا الإجراء حسابك وكل بياناتك نهائيًا، بما في ذلك المعاملات والحسابات والأسهم والإعدادات. لا يمكن التراجع عنه.';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      'تخصيص وقت إرسال تقارير التدفق النقدي الدورية';

  @override
  String get mobileLegacyAutomatic => 'تلقائي';

  @override
  String get mobileLegacyAtLeast8Characters => '8 أحرف على الأقل';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      '8 أحرف على الأقل مع حرف كبير وصغير ورقم ورمز';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      'مديرك المالي الشخصي لتسجيل المصروفات والميزانيات واستثمارات الأسهم التايوانية والتقارير. دقيقة واحدة تكفي للتعرف على الأساسيات.';

  @override
  String get mobileLegacyDeletePasskey => 'حذف Passkey';

  @override
  String get mobileLegacyDeleteCategory => 'حذف التصنيف';

  @override
  String get mobileLegacyDeleteTransaction => 'حذف المعاملة';

  @override
  String get mobileLegacyDeleteDividend => 'حذف التوزيع';

  @override
  String get mobileLegacyDeleteStock => 'حذف السهم';

  @override
  String get mobileLegacyDeleteAccount => 'حذف الحساب';

  @override
  String get mobileLegacyDeleteSchedule => 'حذف الجدولة';

  @override
  String get mobileLegacyDeletePhoto => 'حذف الصورة';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      'حساب الإيداع مطلوب عند وجود توزيع نقدي';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters =>
      'لا توجد معاملات تطابق عوامل التصفية';

  @override
  String get mobileLegacyDiscount01 => 'الخصم (0-1)';

  @override
  String get mobileLegacyImproved => 'تحسين';

  @override
  String get mobileLegacyMore => 'المزيد';

  @override
  String get mobileLegacyUpdatedd9db02d0 => 'تحديث';

  @override
  String get mobileLegacyLastDayOfEachMonth => 'آخر يوم من كل شهر';

  @override
  String get mobileLegacyNoPricesToUpdate => 'لا توجد أسعار قابلة للتحديث';

  @override
  String get mobileLegacyNoNewDividendsToSync =>
      'لا توجد توزيعات جديدة للمزامنة';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      'تم تسجيل خروج المستخدم ومسح تسجيل الدخول المحلي';

  @override
  String get mobileLegacyGettingStarted => 'دليل البدء';

  @override
  String get mobileLegacyExample06MeansA40Discount =>
      'مثال: 0.6 يعني خصمًا بنسبة 40%';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      'مثال: 1.5 تعني 1.5%؛ تُحسب الرسوم تلقائيًا عند الدفع بعملة أجنبية';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      'من المزيد يمكنك ضبط الميزانية الشهرية، مراجعة التقارير، إدارة الحسابات والتصنيفات، وجدولة المعاملات المتكررة وتنبيهات التقارير. عندما تكون جاهزًا، ابدأ التسجيل.';

  @override
  String get mobileLegacyStandardBrokerageRate01425 =>
      'النسبة القياسية للوسيط: 0.1425%';

  @override
  String get mobileLegacyNotSentYet => 'لم يُرسل بعد';

  @override
  String get mobileLegacyNoRealizedReturns => 'لا توجد أرباح/خسائر محققة';

  @override
  String get mobileLegacyNoCategoriesYet => 'لا توجد تصنيفات بعد';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      'لا توجد معاملات بعد. اضغط الزر أسفل اليمين لإضافة واحدة.';

  @override
  String get mobileLegacyNoRecurringTransactions => 'لا توجد معاملات متكررة';

  @override
  String get mobileLegacyNoDividendRecords => 'لا توجد سجلات توزيعات';

  @override
  String get mobileLegacyNoStockTransactions => 'لا توجد معاملات أسهم';

  @override
  String get mobileLegacyNoHoldingsYet => 'لا توجد مراكز بعد';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => 'لا يوجد سجل تسجيل دخول';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      'أكمل التسجيل في المتصفح (يتطلب بصمة أو تعرفًا حيويًا على الجهاز)';

  @override
  String get mobileLegacyNotice => 'تنبيه';

  @override
  String get mobileLegacyDividends => 'التوزيعات';

  @override
  String get mobileLegacyDividendSyncCompleted => 'اكتملت مزامنة التوزيعات';

  @override
  String get mobileLegacyTickerEG2330 => 'رمز السهم (مثل 2330)';

  @override
  String get mobileLegacyStockMarketValue => 'القيمة السوقية للأسهم';

  @override
  String get mobileLegacyHoldings => 'المحفظة';

  @override
  String get mobileLegacyDayOfWeek => 'يوم الأسبوع';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      'عرض الإصدار الحالي وملاحظات التحديث';

  @override
  String get mobileLegacyRename => 'إعادة التسمية';

  @override
  String get mobileLegacyCheckAgain => 'إعادة الفحص';

  @override
  String get mobileLegacyRetry => 'إعادة المحاولة';

  @override
  String get mobileLegacyHome => 'الرئيسية';

  @override
  String get mobileLegacyFixed => 'إصلاح';

  @override
  String get mobileLegacyApply => 'تطبيق';

  @override
  String get mobileLegacyTime => 'الوقت';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      'رسوم معاملة أجنبية TWD (اختياري)';

  @override
  String get mobileLegacyAddTransaction => 'إضافة معاملة';

  @override
  String get mobileLegacyTransactions8084a8ea => 'المعاملات';

  @override
  String get mobileLegacyStartDate => 'تاريخ البداية';

  @override
  String get mobileLegacyTrackTaiwanStocks =>
      'تتبع استثمارات الأسهم التايوانية';

  @override
  String get mobileLegacyStockDividendSharesOptional =>
      'عدد أسهم التوزيع (اختياري)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      'رسوم البطاقة الأجنبية تُنشأ تلقائيًا. عدّل المعاملة الأجنبية المرتبطة بدلًا من ذلك.';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      'يجب ألا تقل كلمة المرور عن 8 أحرف';

  @override
  String get mobileLegacyAccountName => 'اسم الحساب';

  @override
  String get mobileLegacyAccountDeleted => 'تم حذف الحساب';

  @override
  String get mobileLegacyAccountSecurity => 'أمان الحساب';

  @override
  String get mobileLegacyLinkedAccounts => 'الحسابات المرتبطة';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => 'العملات الشائعة';

  @override
  String get mobileLegacyChooseFromGallery => 'اختيار من المعرض';

  @override
  String get mobileLegacyEnabled => 'مفعّل';

  @override
  String get mobileLegacyDark => 'داكن';

  @override
  String get mobileLegacyLight => 'فاتح';

  @override
  String get mobileLegacyClearDates => 'مسح التواريخ';

  @override
  String get mobileLegacyClearFilters => 'مسح الفلاتر';

  @override
  String get mobileLegacyCashDividendTotalOptional =>
      'توزيع نقدي (الإجمالي، اختياري)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      'أدخل توزيعًا نقديًا أو توزيع أسهم';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      'بعد ضبطه تعرض بطاقة الحساب إنفاق الدورة الحالية؛ اتركه فارغًا لعدم الاحتساب';

  @override
  String get mobileLegacyNoteOptional => 'ملاحظة (اختياري)';

  @override
  String get mobileLegacyNoteKeyword => 'كلمة مفتاحية في الملاحظة';

  @override
  String get mobileLegacyMinimumTransactionTax => 'الحد الأدنى لضريبة التداول';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction => 'حتى 5 صور لكل معاملة';

  @override
  String get mobileLegacyReportNotifications => 'إشعارات التقارير';

  @override
  String get mobileLegacySeeYourCompleteCashFlow => 'تابع التدفق النقدي كاملًا';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser => 'تعذر فتح المتصفح';

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
      'انتهت صلاحية تسجيل الدخول. سجّل الدخول مرة أخرى';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      'استجابة تسجيل الدخول لا تحتوي على Cookie المصادقة. تحقق من إعدادات الخادم';

  @override
  String get mobileLegacySignedIn => 'تم تسجيل الدخول';

  @override
  String get mobileLegacySignInHistory => 'سجل تسجيل الدخول';

  @override
  String get mobileLegacySignedInDevices => 'الأجهزة المسجّلة';

  @override
  String get mobileLegacySignInRequestConnectionFailed =>
      'تعذر الاتصال لطلب تسجيل الدخول';

  @override
  String get mobileLegacyEndDate => 'تاريخ النهاية';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      'استجابة التسجيل لا تحتوي على Cookie المصادقة. تحقق من إعدادات الخادم';

  @override
  String get mobileLegacySignUpAndSignIn => 'إنشاء حساب وتسجيل الدخول';

  @override
  String get mobileLegacyBuy => 'شراء';

  @override
  String get mobileLegacyFrequency => 'التكرار';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 =>
      'يجب أن يكون سعر الصرف أكبر من 0';

  @override
  String get mobileLegacyReturns => 'الربح/الخسارة';

  @override
  String get mobileLegacyAddPasskey => 'إضافة Passkey';

  @override
  String get mobileLegacyAddStockTransaction => 'إضافة معاملة سهم';

  @override
  String get mobileLegacyAddSchedule => 'إضافة جدولة';

  @override
  String get mobileLegacyAddReportSchedule => 'إضافة جدولة تقرير';

  @override
  String get mobileLegacyAddPhotosOptional => 'إضافة صور (اختياري)';

  @override
  String get mobileLegacyFailedToLoadPhoto => 'تعذر تحميل الصورة';

  @override
  String get mobileLegacyLink => 'ربط';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      'يتم التفويض للربط في المتصفح. قبل إلغاء الربط، تأكد من توفر طريقة أخرى لتسجيل الدخول.';

  @override
  String get mobileLegacyUnlink => 'إلغاء الربط';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp =>
      'إدارة مالية · تطبيق Android';

  @override
  String get mobileLegacySkip => 'تخطي';

  @override
  String get mobileLegacyMinimumOddLotCommission =>
      'الحد الأدنى لعمولة اللوت الجزئي';

  @override
  String get mobileLegacyIncorrectEmailOrPassword =>
      'البريد الإلكتروني أو كلمة المرور غير صحيحة';

  @override
  String get mobileLegacyDefaultCurrency => 'العملة الافتراضية';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      'العملة الافتراضية والعملات الشائعة';

  @override
  String get mobileLegacyBudgets => 'الميزانيات';

  @override
  String get mobileLegacyBudgetsReportsAndMore =>
      'الميزانيات والتقارير والمزيد';

  @override
  String get mobileLegacyBudgetAmount => 'مبلغ الميزانية';

  @override
  String get mobileLegacyCurrencySettings => 'إعدادات العملة';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage =>
      'لغة التطبيق والإشعارات والويب';

  @override
  String get mobileLegacyBank => 'بنك';

  @override
  String get mobileLegacyBankBalance => 'رصيد البنك';

  @override
  String get mobileLegacyRequiresALinkedLineAccount => 'يتطلب ربط حساب LINE';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      'تحتاج إلى بطاقة ائتمان واحدة وحساب غير بطاقة ائتمان لتسجيل السداد';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      'يجب أن تتضمن حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      'يجب أن تتضمن حرفًا كبيرًا وحرفًا صغيرًا ورقمًا ورمزًا';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      'هل تريد حذف جدولة إشعار التقرير هذه؟';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      'هل تريد حذف هذه الصورة المرفوعة؟ لا يمكن التراجع عن هذا الإجراء.';

  @override
  String get mobileLegacyEditStockTransaction => 'تعديل معاملة سهم';

  @override
  String get mobileLegacyEditReportSchedule => 'تعديل جدولة التقرير';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst =>
      'أكمل التحقق أدناه أولًا';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      'أضف سهمًا من تبويب المراكز أولًا';

  @override
  String get mobileLegacySelectAParentCategoryFirst =>
      'اختر التصنيف الرئيسي أولًا';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      'أدخل مبلغ سداد لبطاقة واحدة على الأقل';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      'اختر طريقة إشعار واحدة على الأقل';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo =>
      'أدخل رقمًا أكبر من أو يساوي 0';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => 'أدخل رقمًا من 1 إلى 31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 => 'أدخل مبلغًا أكبر من 0';

  @override
  String get mobileLegacyEnterATicker => 'أدخل رمز السهم';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber =>
      'أدخل عددًا صحيحًا موجبًا';

  @override
  String get mobileLegacyEnterAName => 'أدخل اسمًا';

  @override
  String get mobileLegacyEnterAValidEmailAddress =>
      'أدخل بريدًا إلكترونيًا صالحًا';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm =>
      'أدخل كلمة المرور للتأكيد';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      'أدخل بريد الحساب للتأكيد';

  @override
  String get mobileLegacyEnterADisplayName => 'أدخل الاسم المعروض';

  @override
  String get mobileLegacySelectASubcategory => 'اختر التصنيف الفرعي';

  @override
  String get mobileLegacySelectACategory => 'اختر تصنيفًا';

  @override
  String get mobileLegacySelectAParentCategory => 'اختر التصنيف الرئيسي';

  @override
  String get mobileLegacySelectAnAccount => 'اختر حسابًا';

  @override
  String get mobileLegacySelectADestinationAccount =>
      'اختر الحساب المحوّل إليه';

  @override
  String get mobileLegacySell => 'بيع';

  @override
  String get mobileLegacyMinimumBoardLotCommission =>
      'الحد الأدنى لعمولة اللوت الكامل';

  @override
  String get mobileLegacyFilter => 'تصفية';

  @override
  String get mobileLegacyFilterTransactions => 'تصفية المعاملات';

  @override
  String get mobileLegacyChooseTheme => 'اختيار المظهر';

  @override
  String get mobileLegacyLogTransactionsInSeconds => 'سجّل معاملة بسرعة';

  @override
  String get mobileLegacyMarketValue => 'إجمالي القيمة السوقية';

  @override
  String get mobileLegacyTotalAssetsInTwd => 'إجمالي الأصول (محولة إلى TWD)';

  @override
  String get mobileLegacyTraditionalChineseEnglish =>
      'الصينية التقليدية / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp =>
      'ليس لديك حساب؟ أنشئ حسابًا';

  @override
  String get mobileLegacyPaymentRecorded => 'تم تسجيل السداد';

  @override
  String get mobileLegacyToAccount => 'الحساب المحوّل إليه';

  @override
  String get mobileLegacyFromAccount => 'الحساب المحوّل منه';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      'لا يمكن أن يكون حسابا التحويل متطابقين';

  @override
  String get mobileLegacyEditTransfersInTheWebApp =>
      'عدّل التحويلات من نسخة الويب';

  @override
  String get mobileLegacyTransactionTaxSell => 'ضريبة التداول (بيع)';

  @override
  String get mobileLegacyTransactionTaxOptional => 'ضريبة التداول (اختياري)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax =>
      'النوع (يؤثر في ضريبة التداول)';

  @override
  String get mobileLegacyWarrants => 'وارنت (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot => 'مرحبًا بك في AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      'سيتم تسجيل خروج الأجهزة الأخرى بعد هذا التغيير.';

  @override
  String get mobileLegacyTestSentryConfiguration => 'اختبار إعدادات Sentry';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'أرجع API الرمز 401؛ انتهت الجلسة وتم مسح تسجيل الدخول المحلي';

  @override
  String get mobileLegacyApiRequestFailed => 'فشل طلب API';

  @override
  String get mobileLegacyApiRequestConnectionFailed => 'تعذر الاتصال بطلب API';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'استجابة التطبيق لا تحتوي على Cookie المصادقة';

  @override
  String get mobileLegacyEmailNotifications => 'إشعارات البريد الإلكتروني';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'استجابة Google لا تحتوي على Cookie المصادقة';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'إشعارات LINE';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'استجابة LINE لا تحتوي على Cookie المصادقة';

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
      'يتم تضمين TWD دائمًا. العملات المحددة تظهر أولًا في قوائم المعاملات والمعاملات المتكررة.';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return 'اليوم $day';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return 'آخر إرسال: $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return 'الإصدار الحالي v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'يتوفر الإصدار v$version';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return 'شهريًا في اليوم $day';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return 'كل $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return 'تم الإنشاء في $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return 'تم تحديث اللغة: $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return 'تعذر التحميل: $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return 'حدث خطأ غير متوقع: $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return 'فشل تسجيل الدخول عبر $provider: $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return 'تعذر تحديث الأسعار: $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return 'تعذرت مزامنة التوزيعات: $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return 'فشل رفع الصورة: $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return 'فشل الطلب (HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return 'فشل تسجيل الدخول (HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return 'تعذر الاتصال بالخادم ($target): $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return 'حذف \"$name\"؟';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return 'إلغاء ربط $provider';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return 'هل تريد إلغاء ربط $provider؟';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return 'ربط $provider';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (الكل)';
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
    return 'تم الاستعلام عن البيانات في $time';
  }

  @override
  String get dashboardAttentionTitle => 'يتطلب الانتباه';

  @override
  String get dashboardAttentionAllClear => 'لا يوجد ما يتطلب انتباهك الآن';

  @override
  String dashboardAttentionRecurring(Object count) {
    return 'تحتاج $count من المعاملات المتكررة إلى المراجعة';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count من المعاملات غير المصنفة · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return 'لا يوجد سعر لـ $count من المراكز المحتفظ بها';
  }

  @override
  String get dashboardDriversTitle => 'أهم 3 عوامل هذا الشهر';

  @override
  String dashboardDriversSubtitle(Object month) {
    return 'أكبر المساهمات في $month';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '$share% من هذا النوع';
  }

  @override
  String get dashboardPersonalizeTrigger => 'تخصيص الصفحة الرئيسية';

  @override
  String get dashboardPersonalizeTitle => 'تخصيص الصفحة الرئيسية';

  @override
  String get dashboardPersonalizeDescription =>
      'اختر الوحدات التي تظهر ورتّبها حسب طريقة استخدامك.';

  @override
  String get dashboardPersonalizeModulesAssets => 'نظرة عامة على الأصول';

  @override
  String get dashboardPersonalizeModulesAttention => 'يتطلب الانتباه';

  @override
  String get dashboardPersonalizeModulesWhyChanged => 'سبب تغير التدفق النقدي';

  @override
  String get dashboardPersonalizeModulesSpending => 'فئات المصروفات';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => 'حالة المحفظة';

  @override
  String get dashboardPersonalizeModulesIncomeRecent =>
      'الدخل والمعاملات الأخيرة';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return 'نقل $module إلى أعلى';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return 'نقل $module إلى أسفل';
  }

  @override
  String get dashboardPersonalizeSaved => 'تم حفظ تخطيط لوحة المعلومات';

  @override
  String get dashboardPersonalizeSaveError => 'تعذر حفظ تخطيط لوحة المعلومات';

  @override
  String get dashboardPersonalizeReset => 'إعادة ضبط';

  @override
  String get dashboardPersonalizeApply => 'تطبيق';

  @override
  String get dashboardComparisonTitle => 'سبب تغير التدفق النقدي';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return 'مقارنة $currentStart–$currentEnd مع $previousStart–$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return 'مقارنة الشهر الكامل مع $previousStart–$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable =>
      'لا توجد فترة سابقة قابلة للمقارنة لهذا الشهر.';

  @override
  String get dashboardComparisonNoChanges =>
      'لم يتغير التدفق النقدي المسجل عن الفترة المقارنة.';

  @override
  String get dashboardComparisonPreviousNet => 'صافي التدفق النقدي السابق';

  @override
  String get dashboardComparisonNetChange => 'تغير صافي التدفق النقدي';

  @override
  String get dashboardComparisonNewThisPeriod => 'جديد في هذه الفترة';

  @override
  String get dashboardComparisonIncreased => 'زاد المبلغ';

  @override
  String get dashboardComparisonDecreased => 'انخفض المبلغ';

  @override
  String get dashboardPortfolioHealthTitle => 'حالة أساس تكلفة المحفظة';

  @override
  String get dashboardPortfolioHealthSubtitle =>
      'مقارنة القيمة الحالية بتكلفة FIFO المتبقية';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      'أضف حيازة لعرض معلومات أساس التكلفة.';

  @override
  String get dashboardPortfolioHealthMissingPrices =>
      'الأسعار الحالية مطلوبة لإظهار هذه المقارنة.';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      'لا تتوفر نسبة مجمعة للحيازات بعملات متعددة.';

  @override
  String get dashboardPortfolioHealthMarketValue => 'القيمة السوقية المسعّرة';

  @override
  String get dashboardPortfolioHealthCost => 'تكلفة الحيازات المسعّرة';

  @override
  String get dashboardPortfolioHealthUnrealizedGross =>
      'إجمالي الربح/الخسارة غير المحققة';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return 'أكبر حيازة: $name · $share% من القيمة المسعّرة';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      'تقارن هذه البيانات الأسعار الحالية بتكلفة FIFO المسجلة. وهي ليست معيار مؤشر سوق أو أداءً مرجحًا زمنيًا.';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return 'تغطية الأسعار: $priced من أصل $total حيازة';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook => 'توقع النقد المجدول';

  @override
  String get dashboardPersonalizeModulesSavingsScenario => 'سيناريو الادخار';

  @override
  String get dashboardCashOutlookTitle =>
      'الثلاثون يومًا القادمة · النقد المجدول';

  @override
  String get dashboardCashOutlookSubtitle =>
      'استنادًا إلى البنود المتكررة المؤكدة';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start–$end · تقدير مجدول';
  }

  @override
  String get dashboardCashOutlookInvalidDate => 'تعذر حساب فترة التقدير.';

  @override
  String get dashboardCashOutlookNoBankAccounts =>
      'أضف حسابًا مصرفيًا مشمولًا قبل تقدير النقد المجدول.';

  @override
  String get dashboardCashOutlookNoSchedules =>
      'أنشئ دخلاً أو مصروفًا متكررًا لرؤية النقد المجدول القادم.';

  @override
  String get dashboardCashOutlookNoCoveredSchedules =>
      'راجع البنود المتكررة واربطها بحسابات مصرفية مشمولة.';

  @override
  String get dashboardCashOutlookStartingBalance =>
      'رصيد الحسابات المصرفية حتى اليوم';

  @override
  String get dashboardCashOutlookScheduledNet => 'صافي التغير المجدول';

  @override
  String get dashboardCashOutlookClosingBalance => 'النقد المقدّر بعد 30 يومًا';

  @override
  String get dashboardCashOutlookLowestBalance => 'أدنى نقد مقدّر';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count بنود مجدولة · الدخل $income · المصروف $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle =>
      'قد ينخفض إجمالي النقد المقدّر دون الصفر';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return 'نحو $date قد يصل التقدير إلى $amount دون الصفر. راجع التواريخ والمبالغ قبل اتخاذ إجراء.';
  }

  @override
  String get dashboardCashOutlookUpcoming => 'البنود المجدولة القادمة';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return 'عرض $shown من $total';
  }

  @override
  String get dashboardCashOutlookNoUpcoming =>
      'لا توجد بنود مجدولة ضمن فترة الثلاثين يومًا هذه.';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return 'تمت تغطية $included من $total بنود متكررة؛ راجع $uncovered.';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      'يجمع التقدير كل الحسابات المصرفية المشمولة باستخدام رصيد اليوم والبنود المتكررة المرتبطة المؤكدة. لا يعرض احتمال السحب على المكشوف في حساب واحد ولا يغيّر الأرصدة الفعلية؛ تُنشأ المعاملات المستحقة عند المعالجة التالية. تستخدم تقديرات TWD أسعار الصرف الحالية بشكل متسق.';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return 'قد ينقص النقد المجدول بمقدار $amount نحو $date';
  }

  @override
  String get dashboardScenarioTitle => 'سيناريو الادخار';

  @override
  String get dashboardScenarioSubtitle =>
      'قدّر الأثر التراكمي لتعديل شهري واحد';

  @override
  String get dashboardScenarioMonthlyAdjustment => 'تعديل الادخار الشهري (TWD)';

  @override
  String get dashboardScenarioDecrease => 'خفض التعديل الشهري بمقدار 500';

  @override
  String get dashboardScenarioIncrease => 'زيادة التعديل الشهري بمقدار 500';

  @override
  String get dashboardScenarioHorizon => 'الفترة الزمنية';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count شهرًا';
  }

  @override
  String get dashboardScenarioDifference => 'الفرق التراكمي';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return 'ينتج عن تعديل شهري قدره $monthly لمدة $months شهرًا فرق تراكمي قدره $difference.';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      'سيناريو بسيط: التعديل الشهري × عدد الأشهر. لا يشمل الفائدة أو عوائد السوق أو التضخم أو الضرائب، ولا يضمن نتيجة مستقبلية.';

  @override
  String get navMcp => 'اتصال MCP';

  @override
  String get settingsMcpTitle => 'إعدادات اتصال MCP';

  @override
  String get settingsMcpDescription =>
      'اربط أدوات الذكاء الاصطناعي المتوافقة مع MCP عبر OAuth، أو أنشئ رمز وصول شخصياً للعملاء الذين يتطلبون بيانات اعتماد يدوية.';

  @override
  String get settingsMcpOauthTitle => 'الاتصال عبر OAuth';

  @override
  String get settingsMcpOauthDescription =>
      'أدخل عنوان الاتصال أدناه في أداة تدعم MCP OAuth. سيفتح AssetPilot صفحة آمنة لتسجيل الدخول والموافقة، ولا حاجة إلى رمز يدوي.';

  @override
  String get settingsMcpCreateNew => 'إنشاء بيانات اعتماد جديدة';

  @override
  String get settingsMcpNameLabel => 'الاسم';

  @override
  String get settingsMcpNamePlaceholder => 'مثال: ChatGPT الخاص بي';

  @override
  String get settingsMcpExpiresAtLabel => 'تاريخ الانتهاء (اختياري)';

  @override
  String get settingsMcpCreateButton => 'إنشاء بيانات الاعتماد';

  @override
  String get settingsMcpCreating => 'جارٍ الإنشاء…';

  @override
  String get settingsMcpCreateFailed => 'فشل إنشاء بيانات الاعتماد';

  @override
  String get settingsMcpNameRequired => 'الاسم مطلوب';

  @override
  String get settingsMcpNameTooLong => 'لا يمكن أن يتجاوز الاسم 100 حرف';

  @override
  String get settingsMcpListTitle => 'بيانات اعتماد MCP الخاصة بي';

  @override
  String get settingsMcpRefresh => 'تحديث';

  @override
  String get settingsMcpNoCredentials => 'لا توجد بيانات اعتماد بعد';

  @override
  String get settingsMcpLoadFailed => 'فشل تحميل بيانات الاعتماد';

  @override
  String get settingsMcpColName => 'الاسم';

  @override
  String get settingsMcpColCreatedAt => 'تاريخ الإنشاء';

  @override
  String get settingsMcpColLastUsedAt => 'آخر استخدام';

  @override
  String get settingsMcpColStatus => 'الحالة';

  @override
  String get settingsMcpColActions => 'الإجراءات';

  @override
  String get settingsMcpNeverUsed => 'لم يُستخدم بعد';

  @override
  String get settingsMcpStatusActive => 'نشط';

  @override
  String get settingsMcpStatusExpired => 'منتهي الصلاحية';

  @override
  String get settingsMcpStatusRevoked => 'ملغى';

  @override
  String get settingsMcpRevokeButton => 'إلغاء';

  @override
  String get settingsMcpRevokeConfirm =>
      'هل تريد إلغاء بيانات الاعتماد هذه؟ سيتم رفض جميع الاستعلامات التي تستخدمها فورًا.';

  @override
  String get settingsMcpRevokeFailed => 'فشل إلغاء بيانات الاعتماد';

  @override
  String get settingsMcpTokenModalTitle => 'رمز وصول MCP';

  @override
  String get settingsMcpTokenWarning =>
      'يظهر هذا الرمز مرة واحدة فقط. انسخه واحفظه بأمان الآن؛ لن تتمكن من عرضه مرة أخرى بعد الإغلاق.';

  @override
  String get settingsMcpTokenLabel => 'رمز الوصول';

  @override
  String get settingsMcpConnectionUrlLabel => 'عنوان اتصال MCP';

  @override
  String get settingsMcpCopyButton => 'نسخ';

  @override
  String get settingsMcpCopied => 'تم النسخ!';

  @override
  String get settingsMcpCloseConfirm => 'لقد نسخته، إغلاق';
}
