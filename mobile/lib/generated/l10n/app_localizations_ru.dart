// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get commonSave => 'Сохранить';

  @override
  String get commonCancel => 'Отмена';

  @override
  String get commonDelete => 'Удалить';

  @override
  String get commonEdit => 'Изменить';

  @override
  String get commonConfirm => 'Подтвердить';

  @override
  String get commonClose => 'Закрыть';

  @override
  String get commonLoading => 'Загрузка…';

  @override
  String get commonAdd => 'Добавить';

  @override
  String get commonBack => 'Назад';

  @override
  String get commonSearch => 'Поиск';

  @override
  String get commonLanguage => 'Язык';

  @override
  String get commonClear => 'Очистить';

  @override
  String get commonSaving => 'Сохранение...';

  @override
  String get commonConfirmDelete => 'Подтвердить удаление';

  @override
  String get commonPreviousPage => 'Назад';

  @override
  String get commonNextPage => 'Далее';

  @override
  String commonTotalRecords(Object count) {
    return '$count записей';
  }

  @override
  String get commonPerPage => 'На страницу';

  @override
  String commonRecordsUnit(Object count) {
    return '$count записей';
  }

  @override
  String get commonNoData => 'Данных пока нет';

  @override
  String get navSectionsFinance => 'Финансы';

  @override
  String get navSectionsStocks => 'Акции';

  @override
  String get navSectionsSystem => 'Система';

  @override
  String get navDashboard => 'Панель';

  @override
  String get navTransactions => 'Операции';

  @override
  String get navReports => 'Отчеты';

  @override
  String get navBudget => 'Бюджеты';

  @override
  String get navInfoBoard => 'Информационная панель';

  @override
  String get navAccounts => 'Счета';

  @override
  String get navCategories => 'Категории';

  @override
  String get navRecurring => 'Регулярные';

  @override
  String get navStocksPortfolio => 'Портфель';

  @override
  String get navStocksTransactions => 'Операции с акциями';

  @override
  String get navStocksDividends => 'Дивиденды';

  @override
  String get navStocksRealized => 'Реализ. P/L';

  @override
  String get navStocksSettings => 'Настройки акций';

  @override
  String get navExportImport => 'Экспорт / импорт';

  @override
  String get navAccount => 'Аккаунт';

  @override
  String get navApiCredits => 'Доступ API';

  @override
  String get navAdmin => 'Админ';

  @override
  String get navTitleStocks => 'Портфель';

  @override
  String get navTitleStockTransactions => 'Операции с акциями';

  @override
  String get navTitleStockDividends => 'Дивиденды по акциям';

  @override
  String get navTitleStockRealized => 'Реализованная P/L';

  @override
  String get navTitleStockSettings => 'Настройки торговли акциями';

  @override
  String get navTitleApiCredits => 'Использование и доступ API';

  @override
  String get shellFallbackUser => 'Пользователь';

  @override
  String get shellLogout => 'Выйти';

  @override
  String get shellVersionInfo => 'Версия';

  @override
  String get shellOpenMenu => 'Открыть меню';

  @override
  String get shellSkipToContent => 'Перейти к основному содержимому';

  @override
  String get shellThemeLight => 'Светлая';

  @override
  String get shellThemeSystem => 'Система';

  @override
  String get shellThemeDark => 'Темная';

  @override
  String get shellChangelogLoading => 'Загружаем сведения о версии...';

  @override
  String get shellChangelogLoadFailed =>
      'Не удалось загрузить сведения о версии';

  @override
  String get shellChangelogUnknownVersion => 'Неизвестно';

  @override
  String get shellChangelogCurrentVersion => 'Текущая версия';

  @override
  String get shellChangelogUpdatableVersion => 'Доступная версия';

  @override
  String get shellChangelogUpToDate => 'Уже последняя версия';

  @override
  String get shellChangelogUpdatableContent => 'Что можно обновить';

  @override
  String get shellChangelogRecentContent => 'Последние изменения';

  @override
  String get authLoginTab => 'Войти';

  @override
  String get authRegisterTab => 'Создать аккаунт';

  @override
  String get authSubtitleLogin => 'Рады видеть вас снова. Войдите в аккаунт';

  @override
  String get authSubtitleRegister => 'Создайте аккаунт и начните учет';

  @override
  String get authEmailLabel => 'Email';

  @override
  String get authPasswordLabel => 'Пароль';

  @override
  String get authPasswordPlaceholder => 'Введите пароль';

  @override
  String get authDisplayNameLabel => 'Отображаемое имя';

  @override
  String get authDisplayNamePlaceholder => 'Ваше имя или ник';

  @override
  String get authRegisterPasswordPlaceholder =>
      'Минимум 8 символов: строчные, заглавные буквы и цифры';

  @override
  String get authTogglePassword => 'Показать или скрыть пароль';

  @override
  String get authTurnstileAria => 'Проверка Cloudflare Turnstile';

  @override
  String get authLoginButton => 'Войти';

  @override
  String get authLoggingIn => 'Вход…';

  @override
  String get authPasskeyButton => 'Войти с Passkey';

  @override
  String get authPasskeyVerifying => 'Проверка Passkey…';

  @override
  String get authGoogleButton => 'Войти с Google';

  @override
  String get authGoogleVerifying => 'Проверка Google…';

  @override
  String get authLineButton => 'Войти с LINE';

  @override
  String get authLineVerifying => 'Проверка LINE…';

  @override
  String get authRegisterSubmit => 'Создать аккаунт';

  @override
  String get authRegistering => 'Создание аккаунта…';

  @override
  String get authLineCallbackCompleting => 'Завершаем проверку LINE...';

  @override
  String get authLineCallbackMissingCode =>
      'LINE не вернул код авторизации. Попробуйте еще раз.';

  @override
  String get authLineCallbackLinkFailed => 'Не удалось привязать аккаунт LINE';

  @override
  String get authLineCallbackLoginFailed => 'Не удалось войти через LINE';

  @override
  String get authLineCallbackVerifyFailed => 'Проверка LINE не удалась';

  @override
  String get authErrorsTurnstileRequired => 'Сначала пройдите проверку';

  @override
  String get authErrorsLoginFailed => 'Не удалось войти';

  @override
  String get authErrorsRegisterFailed => 'Не удалось создать аккаунт';

  @override
  String get authErrorsGoogleNotConfigured => 'Вход через Google не настроен';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'Компонент входа через Google не загружен';

  @override
  String get authErrorsGoogleStateFailed =>
      'Не удалось создать состояние входа Google';

  @override
  String get authErrorsGoogleNoCode => 'Код авторизации Google не получен';

  @override
  String get authErrorsGoogleFailed => 'Не удалось войти через Google';

  @override
  String get authErrorsGoogleCancelled => 'Вход через Google отменен';

  @override
  String get authErrorsPasskeyUnsupported =>
      'Этот браузер не поддерживает Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'Не удалось создать challenge для входа с Passkey';

  @override
  String get authErrorsPasskeyFailed => 'Не удалось войти с Passkey';

  @override
  String get authErrorsLineNotConfigured => 'Вход через LINE не настроен';

  @override
  String get authErrorsLineFailed => 'Не удалось войти через LINE';

  @override
  String get settingsTitle => 'Настройки';

  @override
  String get settingsLanguageTitle => 'Язык';

  @override
  String get settingsLanguageDescription =>
      'Выберите язык интерфейса и уведомлений (Email / LINE).';

  @override
  String get settingsLanguageSaved => 'Язык обновлен';

  @override
  String get settingsAccountTitle => 'Настройки аккаунта';

  @override
  String get settingsAccountProfileInfo => 'Информация об аккаунте';

  @override
  String get settingsAccountEmail => 'Email';

  @override
  String get settingsAccountDisplayName => 'Отображаемое имя';

  @override
  String get settingsAccountEditDisplayName => 'Изменить имя';

  @override
  String get settingsAccountUpdateName => 'Обновить имя';

  @override
  String get settingsAccountSaving => 'Сохранение...';

  @override
  String get settingsAccountSetLocalPassword => 'Задать локальный пароль';

  @override
  String get settingsAccountChangePassword => 'Сменить пароль';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      'Сейчас этот аккаунт использует только сторонний вход. После задания локального пароля можно будет входить по email и паролю.';

  @override
  String get settingsAccountCurrentPassword => 'Текущий пароль';

  @override
  String get settingsAccountNewPassword => 'Новый пароль';

  @override
  String get settingsAccountConfirmNewPassword => 'Подтвердите новый пароль';

  @override
  String get settingsAccountPasswordPlaceholder =>
      'Минимум 8 символов: заглавная, строчная буква, цифра и символ';

  @override
  String get settingsAccountUpdating => 'Обновление...';

  @override
  String get settingsAccountSetPassword => 'Задать пароль';

  @override
  String get settingsAccountUpdatePassword => 'Обновить пароль';

  @override
  String get settingsAccountThemeTitle => 'Тема';

  @override
  String get settingsAccountThemeSystem => 'Как в системе';

  @override
  String get settingsAccountThemeLight => 'Светлая тема';

  @override
  String get settingsAccountThemeDark => 'Темная тема';

  @override
  String get settingsAccountDefaultCurrency => 'Валюта по умолчанию';

  @override
  String get settingsAccountCurrencyCode => 'Код валюты';

  @override
  String get settingsAccountUpdateDefaultCurrency =>
      'Обновить валюту по умолчанию';

  @override
  String get settingsAccountPasskeyTitle => 'Управление Passkey';

  @override
  String get settingsAccountNoPasskeys => 'Passkey пока не зарегистрированы';

  @override
  String get settingsAccountAddPasskey => '+ Добавить Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Связь с Google';

  @override
  String get settingsAccountLineTitle => 'Связь с LINE';

  @override
  String get settingsAccountStatusPrefix => 'Текущий статус: ';

  @override
  String get settingsAccountLinkedGoogle => 'Аккаунт Google привязан';

  @override
  String get settingsAccountNotLinkedGoogle => 'Аккаунт Google не привязан';

  @override
  String get settingsAccountLinkGoogle => 'Привязать аккаунт Google';

  @override
  String get settingsAccountUnlink => 'Отвязать';

  @override
  String get settingsAccountLinkedLine => 'Аккаунт LINE привязан';

  @override
  String get settingsAccountNotLinkedLine => 'Аккаунт LINE не привязан';

  @override
  String get settingsAccountLinkLine => 'Привязать аккаунт LINE';

  @override
  String get settingsAccountLineVerifying => 'Проверка LINE…';

  @override
  String get settingsAccountSessionsTitle => 'Устройства с входом';

  @override
  String get settingsAccountRefresh => 'Обновить';

  @override
  String get settingsAccountDeviceName => 'Имя устройства';

  @override
  String get settingsAccountLoginTime => 'Время входа';

  @override
  String get settingsAccountLoginIp => 'IP входа';

  @override
  String get settingsAccountActions => 'Действия';

  @override
  String get settingsAccountUnknownDevice => 'Неизвестное устройство';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (это устройство)';

  @override
  String get settingsAccountSignOut => 'Выйти';

  @override
  String get settingsAccountNoSessions =>
      'Записей об устройствах с входом пока нет';

  @override
  String get settingsAccountAuditTitle => 'Журнал входов';

  @override
  String get settingsAccountCountry => 'Страна';

  @override
  String get settingsAccountMethod => 'Метод';

  @override
  String get settingsAccountDevice => 'Устройство';

  @override
  String get settingsAccountAdminLogin => 'Вход администратора';

  @override
  String get settingsAccountYes => 'Да';

  @override
  String get settingsAccountNo => 'Нет';

  @override
  String get settingsAccountDeleteTitle => 'Удалить аккаунт';

  @override
  String get settingsAccountDeleteDescription =>
      'После удаления аккаунта ваши операции, счета, акции, Passkey и настройки будут удалены навсегда и не подлежат восстановлению.';

  @override
  String get settingsAccountDeleteButton => 'Удалить мой аккаунт';

  @override
  String get settingsAccountDeleteModalTitle => 'Подтвердить удаление аккаунта';

  @override
  String get settingsAccountDeleteModalWarning =>
      'Это действие навсегда удалит аккаунт и все данные, включая операции, счета, акции, Passkey и настройки. Восстановить их нельзя.';

  @override
  String get settingsAccountDeletePasswordLabel =>
      'Введите пароль, чтобы подтвердить удаление';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return 'Введите email аккаунта \"$email\", чтобы подтвердить удаление';
  }

  @override
  String get settingsAccountDeleting => 'Удаление...';

  @override
  String get settingsAccountDeletePermanently => 'Удалить аккаунт навсегда';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired =>
      'Введите текущий пароль';

  @override
  String get settingsAccountMessagesNewPasswordRequired =>
      'Введите новый пароль';

  @override
  String get settingsAccountMessagesPasswordTooShort =>
      'Новый пароль должен содержать не менее 8 символов';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      'Новый пароль должен включать заглавную букву, строчную букву, цифру и специальный символ';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      'Два новых пароля не совпадают';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      'Пароль задан. Теперь можно входить с паролем';

  @override
  String get settingsAccountMessagesPasswordUpdated => 'Пароль обновлен';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      'Не удалось обновить пароль';

  @override
  String get settingsAccountMessagesDisplayNameRequired =>
      'Отображаемое имя не может быть пустым';

  @override
  String get settingsAccountMessagesDisplayNameUpdated =>
      'Отображаемое имя обновлено';

  @override
  String get settingsAccountMessagesUpdateFailed => 'Не удалось обновить';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      'Удалить этот Passkey?';

  @override
  String get settingsAccountMessagesCurrencyInvalid =>
      'Валюта должна быть кодом из 3 букв';

  @override
  String get settingsAccountMessagesCurrencyUpdated =>
      'Валюта по умолчанию обновлена';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      'Не удалось обновить валюту по умолчанию';

  @override
  String get settingsAccountMessagesSessionLoggedOut =>
      'Устройство выведено из аккаунта';

  @override
  String get settingsAccountMessagesSessionLogoutFailed =>
      'Не удалось выйти на устройстве';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      'Этот браузер не поддерживает Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Устройство Android';

  @override
  String get settingsAccountMessagesComputerDevice => 'Компьютер';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'Не удалось зарегистрировать Passkey';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      'Вставьте Google ID Token, чтобы имитировать привязку';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Аккаунт Google привязан';

  @override
  String get settingsAccountMessagesGoogleLinkFailed =>
      'Не удалось привязать аккаунт Google';

  @override
  String get settingsAccountMessagesGoogleUnlinked => 'Аккаунт Google отвязан';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'Не удалось отвязать аккаунт Google';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'Вход через LINE не настроен';

  @override
  String get settingsAccountMessagesLineLinkFailed =>
      'Не удалось привязать аккаунт LINE';

  @override
  String get settingsAccountMessagesLineUnlinked => 'Аккаунт LINE отвязан';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'Не удалось отвязать аккаунт LINE';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      'Введите пароль, чтобы подтвердить удаление';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      'Введите правильный email аккаунта, чтобы подтвердить удаление';

  @override
  String get settingsAccountMessagesDeleteFailed =>
      'Не удалось удалить аккаунт';

  @override
  String get dashboardTitle => 'Панель';

  @override
  String dashboardSubtitle(Object month) {
    return 'Доходы, расходы, категории и последние операции за $month.';
  }

  @override
  String get dashboardUncategorized => 'Без категории';

  @override
  String get dashboardKpiTotalIncome => 'Доходы всего';

  @override
  String get dashboardKpiTotalExpense => 'Расходы всего';

  @override
  String get dashboardKpiNet => 'Итог';

  @override
  String get dashboardKpiTodayExpense => 'Расходы сегодня';

  @override
  String get dashboardKpiBankAccounts => 'Банковские счета';

  @override
  String get dashboardKpiStockMarketValue => 'Рыночная стоимость акций';

  @override
  String get dashboardOverviewTitle => 'Месячный обзор денежного потока';

  @override
  String get dashboardOverviewBalance => 'Профицит месяца';

  @override
  String get dashboardOverviewDeficit => 'Дефицит месяца';

  @override
  String get dashboardOverviewIncome => 'Доходы';

  @override
  String get dashboardOverviewExpense => 'Расходы';

  @override
  String get dashboardOverviewNet => 'Итог';

  @override
  String get dashboardRatioTitle => 'Соотношение доходов и расходов';

  @override
  String get dashboardRatioIncomeShare => 'Доля доходов';

  @override
  String get dashboardRatioExpenseShare => 'Доля расходов';

  @override
  String get dashboardSectionsExpenseCategories => 'Категории расходов';

  @override
  String get dashboardSectionsIncomeCategories => 'Категории доходов';

  @override
  String get dashboardSectionsRecentTransactions => 'Последние операции';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return 'Последние $count записей';
  }

  @override
  String get dashboardEmptyNoExpense => 'В этом месяце расходов нет';

  @override
  String get dashboardEmptyNoIncome => 'В этом месяце доходов нет';

  @override
  String get dashboardEmptyNoTransactions => 'В этом месяце операций нет';

  @override
  String get dashboardTableDate => 'Дата';

  @override
  String get dashboardTableCategory => 'Категория';

  @override
  String get dashboardTableNote => 'Заметка';

  @override
  String get dashboardTableAmount => 'Сумма';

  @override
  String get dashboardFiltersPreviousMonth => 'Предыдущий месяц';

  @override
  String get dashboardFiltersNextMonth => 'Следующий месяц';

  @override
  String get dashboardFiltersCurrentMonth => 'Этот месяц';

  @override
  String get publicCommonBackHome => 'На главную';

  @override
  String get publicCommonPrivacy => 'Политика конфиденциальности';

  @override
  String get publicCommonTerms => 'Условия использования';

  @override
  String get publicCommonApiCredits => 'Использование API и благодарности';

  @override
  String publicCommonLastUpdated(Object date) {
    return 'Обновлено: $date';
  }

  @override
  String get publicCommonMetadataTitle =>
      'AssetPilot - центр управления личными финансами';

  @override
  String get publicCommonMetadataDescription =>
      'Самостоятельно размещаемый зашифрованный менеджер личных финансов для расходов, бюджетов, тайваньских акций и аналитики.';

  @override
  String get publicCommonDatesApiCredits => '11 июня 2026';

  @override
  String get publicCommonDatesPrivacy => '17 июня 2026';

  @override
  String get publicCommonDatesTerms => '11 июня 2026';

  @override
  String get publicHomeTagline => 'Центр управления личными финансами';

  @override
  String get publicHomeLogin => 'Войти';

  @override
  String get publicHomeRegister => 'Создать аккаунт';

  @override
  String get publicHomeBadge =>
      'Самостоятельное размещение, шифрование данных, AGPL v3';

  @override
  String get publicHomeHeadline1 => 'Ваш центр управления финансами';

  @override
  String get publicHomeHeadline2 => 'понятный уже с главной страницы';

  @override
  String get publicHomeLeadBefore =>
      'Соберите тайваньские акции, доходы, расходы, бюджеты, отчеты и аудит в одном месте. Все финансовые данные шифруются при хранении с помощью';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      'без привязки к конкретному облаку или подписке. Сначала разберитесь с продуктом, потом входите.';

  @override
  String get publicHomeStartUsing => 'Начать';

  @override
  String get publicHomeCreateFirst => 'Сначала создать аккаунт';

  @override
  String get publicHomeChipsOpenSource => 'Открытый код AGPL v3';

  @override
  String get publicHomeChipsEncrypted => 'Локальное шифрованное хранение';

  @override
  String get publicHomeChipsNoCloudLock => 'Без зависимости от внешнего облака';

  @override
  String get publicHomeChipsDocker => 'Развертывание Docker одной командой';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => 'Ключевые модули';

  @override
  String get publicHomeStatsModulesSublabel =>
      'Учет, акции, отчеты, управление';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => 'Шифрование данных';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => 'Источник котировок';

  @override
  String get publicHomeStatsStockSourceSublabel =>
      'Внутридневные, закрытие и резерв';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => 'Точный расчет';

  @override
  String get publicHomeStatsPrecisionSublabel =>
      'P/L по лотам через decimal.js';

  @override
  String get publicHomePreLoginNote =>
      'Даже без входа можно изучить функции AssetPilot, обработку данных и варианты развертывания, а уже потом решить, входить или создавать аккаунт.';

  @override
  String get publicHomeWhyLabel => 'Почему AssetPilot';

  @override
  String get publicHomeWhyTitle =>
      'Ежедневный учет, инвестиции и контроль данных в одном месте';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot создан для тех, кто сам управляет личными финансами. Он объединяет денежный поток, бюджеты и акции Тайваня, сохраняя экспорт, аудит и самостоятельное размещение под вашим контролем.';

  @override
  String get publicHomePillarsFinanceTitle =>
      'Управление денежным потоком и бюджетом';

  @override
  String get publicHomePillarsFinanceTag => 'Основной учет';

  @override
  String get publicHomePillarsFinanceItemsOne =>
      'Отслеживание балансов нескольких счетов и внутренних переводов';

  @override
  String get publicHomePillarsFinanceItemsTwo =>
      'Контроль месячных и категорийных бюджетов';

  @override
  String get publicHomePillarsFinanceItemsThree =>
      'Автоматическое создание регулярных доходов и расходов';

  @override
  String get publicHomePillarsFinanceItemsFour =>
      'Пакетное изменение категорий, дат и удаление';

  @override
  String get publicHomePillarsStocksTitle => 'Отслеживание тайваньских акций';

  @override
  String get publicHomePillarsStocksTag => 'Модуль акций';

  @override
  String get publicHomePillarsStocksItemsOne =>
      'Котировки TWSE и синхронизация ex-dividend данных';

  @override
  String get publicHomePillarsStocksItemsTwo =>
      'Точный расчет реализованной P/L по FIFO';

  @override
  String get publicHomePillarsStocksItemsThree =>
      'Записи дивидендов и отслеживание поступлений на счет';

  @override
  String get publicHomePillarsStocksItemsFour =>
      'Регулярные инвестиции и отметки о делистинге';

  @override
  String get publicHomePillarsSecurityTitle =>
      'Безопасность и управление данными';

  @override
  String get publicHomePillarsSecurityTag => 'Управление';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'Шифрование данных при хранении ChaCha20-Poly1305';

  @override
  String get publicHomePillarsSecurityItemsTwo =>
      'Вход по паролю, через Google и Passkey';

  @override
  String get publicHomePillarsSecurityItemsThree =>
      'Экспорт/импорт, резервные копии, восстановление и журналы аудита';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'Защита rate limit, CSP и предотвращение CSV-инъекций';

  @override
  String get publicHomePillarsSelfHostedTitle =>
      'Самостоятельное размещение и контракты';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne =>
      'Запуск Docker одной командой';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => 'Поддержка amd64 и arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree =>
      'Документация контракта OpenAPI 3.2';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      'URL-first маршруты для закладок и прямого обновления';

  @override
  String get publicHomeQuickStartLabel => 'Быстрый старт';

  @override
  String get publicHomeQuickStartTitle =>
      'Запустите на своем сервере за 60 секунд';

  @override
  String get publicHomeQuickStartDescription =>
      'Быстро стартуйте с Docker. При первом запуске автоматически создаются ключи JWT и шифрования базы данных. Поддерживаются amd64 и arm64, поэтому подойдет NAS, VPS или ваш Docker-хост.';

  @override
  String get publicHomeQuickStartChipsImage => 'Образ около 180 MB';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => 'Встроенная проверка здоровья';

  @override
  String get publicHomeQuickStartChipsKeys =>
      'Ключи создаются при первом запуске';

  @override
  String get publicHomeTechLabel => 'Технологии';

  @override
  String get publicHomeTechTitle => 'Стек и открытая информация';

  @override
  String get publicHomeTechDescription =>
      'Основные технологии, внешние источники данных и сведения о лицензиях описаны ясно, чтобы перед началом работы было понятно, как устроен сервис.';

  @override
  String get publicHomeFooter =>
      'GNU AGPL v3. Личное управление активами, которое вы размещаете, контролируете и резервируете сами.';

  @override
  String get publicApiCreditsPageTitle => 'Использование API и кредиты';

  @override
  String get publicApiCreditsPageMetadataTitle =>
      'Использование API и кредиты — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => 'Прозрачность внешних API';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot подключается к внешним источникам только тогда, когда это нужно функции. На этой странице перечислены назначения API, лицензионные примечания и объем отправляемых данных для проверки соответствия при самостоятельном размещении.';

  @override
  String get publicApiCreditsPageStatsExternalServices => 'Внешние сервисы';

  @override
  String get publicApiCreditsPageStatsFreeSupported => 'Есть бесплатный план';

  @override
  String get publicApiCreditsPageStatsAttributionRequired =>
      'Требуется указание источника';

  @override
  String get publicApiCreditsPageServiceKindsData => 'Запросы данных';

  @override
  String get publicApiCreditsPageServiceKindsAuth => 'Аутентификация';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Каналы email';

  @override
  String get publicApiCreditsPageServiceKindsBackup => 'Облачные копии';

  @override
  String get publicApiCreditsPageTransparencyTitle => 'Прозрачность данных';

  @override
  String get publicApiCreditsPageTransparencyText =>
      'В следующих сценариях отправляется только минимум данных, необходимых для функции; ваши финансовые детали не передаются сторонним сервисам.';

  @override
  String get publicApiCreditsPageMinNecessary =>
      'Принцип минимально необходимых данных';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => 'Синхронизация курсов';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      'Запрашиваются только публичные данные курсов валют; личные финансовые детали не отправляются.';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle =>
      'Данные тайваньских акций';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      'Отправляются только тикеры и рыночные данные, без счетов, себестоимости позиций и операций.';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => 'Аудит входов';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo используется только для отображения страны в журналах входа.';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle =>
      'Вход через сторонние сервисы';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google и LINE используются только когда вы сами входите или привязываете аккаунт.';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle =>
      'Облачная резервная копия';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4 получает полный файл базы данных только когда администратор явно загружает копию.';

  @override
  String get publicApiCreditsPageServiceListTitle => 'Список внешних сервисов';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return 'Всего $total сервисов: $free поддерживают бесплатный план, $paid предлагают платные планы.';
  }

  @override
  String get publicApiCreditsPageOfficialSite => 'Официальный сайт';

  @override
  String get publicApiCreditsPageFreePlan => 'Бесплатный план';

  @override
  String get publicApiCreditsPagePaidPlan => 'Платный план';

  @override
  String get publicApiCreditsPageSupported => 'Поддерживается';

  @override
  String get publicApiCreditsPageUnavailable => 'Недоступно';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'Глобальные курсы валют в реальном времени с TWD как базовой валютой';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'IP-геолокация для поля страны в журналах аудита входов';

  @override
  String get publicApiCreditsPageDescriptionsTwse =>
      'Котировки в реальном времени, ex-dividend данные и поиск названий акций';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Вход Google SSO';

  @override
  String get publicApiCreditsPageDescriptionsLine =>
      'Вход через LINE и привязка аккаунта';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Email-канал для отчетов администратора об активах через Gmail, Outlook или другой SMTP server';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Email-канал для отчетов администратора об активах через HTTP REST API';

  @override
  String get publicApiCreditsPageDescriptionsResend =>
      'Email-канал для отчетов администратора об активах';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      'S3-совместимое объектное хранилище для полных SQL-копий PostgreSQL администратора';

  @override
  String get publicAppCallbackReturningTitle =>
      'Возвращаемся в приложение AssetPilot...';

  @override
  String get publicAppCallbackReturningBody =>
      'Если возврат не произошел автоматически, убедитесь, что установлена последняя версия AssetPilot для Android.';

  @override
  String get publicAppCallbackPasskeyTitle => 'Вход в AssetPilot с Passkey';

  @override
  String get publicAppCallbackPasskeyStarting => 'Запускаем вход с Passkey...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      'Этот браузер не поддерживает Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'Не удалось создать challenge для входа с Passkey';

  @override
  String get publicAppCallbackPasskeyVerify =>
      'Завершите проверку Passkey на устройстве...';

  @override
  String get publicAppCallbackPasskeyLoginFailed =>
      'Не удалось войти с Passkey';

  @override
  String get publicAppCallbackReturningApp => 'Возвращаемся в приложение...';

  @override
  String get publicAppCallbackAppTicketFailed =>
      'Не удалось создать учетные данные входа для приложения';

  @override
  String get featuresCommonActions => 'Действия';

  @override
  String get featuresCommonAccount => 'Счет';

  @override
  String get featuresCommonAmount => 'Сумма';

  @override
  String get featuresCommonDate => 'Дата';

  @override
  String get featuresCommonEndDate => 'Конец';

  @override
  String get featuresCommonNote => 'Заметка';

  @override
  String get featuresCommonStartDate => 'Начало';

  @override
  String get featuresCommonStatus => 'Статус';

  @override
  String get featuresCommonStock => 'Акция';

  @override
  String get featuresCommonType => 'Тип';

  @override
  String get featuresCommonName => 'Название';

  @override
  String get featuresCommonCurrency => 'Валюта';

  @override
  String get featuresCommonExchangeRate => 'Курс';

  @override
  String get featuresCommonIncome => 'Доход';

  @override
  String get featuresCommonExpense => 'Расход';

  @override
  String get featuresCommonUncategorized => 'Без категории';

  @override
  String get featuresCommonUnspecified => 'Не указано';

  @override
  String get featuresCommonAutoCalculate => 'Рассчитать автоматически';

  @override
  String get featuresCommonExcludeFromStats => 'Не учитывать в статистике';

  @override
  String get featuresCommonTopLevelCategory => '- Верхний уровень -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => 'Категории';

  @override
  String get featuresCategoriesExpenseTab => 'Категории расходов';

  @override
  String get featuresCategoriesIncomeTab => 'Категории доходов';

  @override
  String get featuresCategoriesAddCategory => 'Добавить категорию';

  @override
  String get featuresCategoriesEditCategory => 'Изменить категорию';

  @override
  String get featuresCategoriesNewCategory => 'Добавить категорию';

  @override
  String get featuresCategoriesNameLabel => 'Название *';

  @override
  String get featuresCategoriesTypeLabel => 'Тип';

  @override
  String get featuresCategoriesParentLabel => 'Родительская категория';

  @override
  String get featuresCategoriesColorLabel => 'Цвет';

  @override
  String get featuresCategoriesExpense => 'Расход';

  @override
  String get featuresCategoriesIncome => 'Доход';

  @override
  String get featuresCategoriesDeleteMessage =>
      'Удалить эту категорию? Подкатегории тоже будут удалены.';

  @override
  String get featuresCategoriesMessagesNameRequired =>
      'Введите название категории';

  @override
  String get featuresCategoriesMessagesDeleteFailed => 'Не удалось удалить';

  @override
  String get featuresBudgetTitle => 'Бюджеты';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$month/$year';
  }

  @override
  String get featuresBudgetTotalBudget => 'Общий бюджет месяца';

  @override
  String get featuresBudgetSpent => 'Потрачено';

  @override
  String get featuresBudgetAddBudget => 'Добавить бюджет';

  @override
  String get featuresBudgetEditBudget => 'Изменить бюджет';

  @override
  String get featuresBudgetNewBudget => 'Добавить бюджет';

  @override
  String get featuresBudgetCategoryLabel =>
      'Категория (пусто для общего бюджета)';

  @override
  String get featuresBudgetTotalBudgetOption => '- Общий бюджет -';

  @override
  String get featuresBudgetAmountLabel => 'Сумма бюджета *';

  @override
  String get featuresBudgetTotalBudgetName => '(Общий бюджет)';

  @override
  String get featuresBudgetOverBudget => 'Превышен бюджет';

  @override
  String get featuresBudgetDeleteMessage => 'Удалить этот бюджет?';

  @override
  String get featuresBudgetMessagesAmountRequired =>
      'Введите корректную сумму бюджета';

  @override
  String get featuresReportsTitle => 'Отчеты';

  @override
  String get featuresReportsTabsCategory => 'Разбивка по категориям';

  @override
  String get featuresReportsTabsTrend => 'Анализ тренда';

  @override
  String get featuresReportsTabsDaily => 'Дневные расходы';

  @override
  String get featuresReportsPeriodsThisMonth => 'Этот месяц';

  @override
  String get featuresReportsPeriodsLastMonth => 'Прошлый месяц';

  @override
  String get featuresReportsPeriodsLast3 => 'Последние 3 месяца';

  @override
  String get featuresReportsPeriodsLast6 => 'Последние 6 месяцев';

  @override
  String get featuresReportsPeriodsThisYear => 'Этот год';

  @override
  String get featuresReportsPeriodsCustom => 'Произвольный период';

  @override
  String get featuresReportsPeriodLabel => 'Период';

  @override
  String get featuresReportsStart => 'Начало';

  @override
  String get featuresReportsEnd => 'Конец';

  @override
  String get featuresReportsCurrentTotal => 'Текущий итог';

  @override
  String get featuresReportsComparedPrevious =>
      'По сравнению с предыдущим периодом';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta, в предыдущем периоде нет данных';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return 'Детали: $type';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return 'Итого: $amount';
  }

  @override
  String get featuresReportsSelectedCategory => 'Выбранная категория: ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return ', сумма $amount';
  }

  @override
  String get featuresReportsViewTransactions => 'Посмотреть связанные операции';

  @override
  String get featuresRecurringTitle => 'Регулярные доходы и расходы';

  @override
  String get featuresRecurringAdd => 'Добавить регулярную запись';

  @override
  String get featuresRecurringEdit => 'Изменить регулярную запись';

  @override
  String get featuresRecurringCreate => 'Добавить регулярную запись';

  @override
  String get featuresRecurringAmountLabel => 'Сумма *';

  @override
  String get featuresRecurringFxFeeLabel => 'Зарубежная комиссия (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder =>
      'Пусто: система рассчитает по тарифу карты';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return 'Комиссия карты за зарубежные операции $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return ', рекомендуемое значение NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading =>
      'Запрашиваем последний курс...';

  @override
  String get featuresRecurringCategory => 'Категория';

  @override
  String get featuresRecurringFrequency => 'Периодичность';

  @override
  String get featuresRecurringStartDate => 'Дата начала';

  @override
  String featuresRecurringNextRun(Object date) {
    return 'Следующее выполнение: $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return 'Категория: $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return 'Счет: $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return 'Зарубежная комиссия: NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => 'Удалить эту регулярную запись?';

  @override
  String get featuresRecurringCreatingTransfer => 'Создание...';

  @override
  String get featuresRecurringConfirmTransfer => 'Подтвердить перевод';

  @override
  String get featuresRecurringFrequencyLabelsDaily => 'Ежедневно';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => 'Еженедельно';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => 'Ежемесячно';

  @override
  String get featuresRecurringFrequencyLabelsYearly => 'Ежегодно';

  @override
  String get featuresRecurringMessagesAmountRequired =>
      'Введите корректную сумму';

  @override
  String get featuresDataTransferTitle => 'Экспорт и импорт данных';

  @override
  String get featuresDataTransferExportStartDate => 'Дата начала экспорта';

  @override
  String get featuresDataTransferExportEndDate => 'Дата окончания экспорта';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'Поддерживаются экспорт и импорт CSV. Колонки: $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'Экспорт CSV';

  @override
  String get featuresDataTransferExporting => 'Экспорт...';

  @override
  String get featuresDataTransferChooseCsv => 'Выбрать CSV для импорта';

  @override
  String get featuresDataTransferImporting => 'Импорт...';

  @override
  String featuresDataTransferImported(Object count) {
    return 'Импортировано: $count записей';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return 'Пропущено: $count записей';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return 'Автоматически созданы категории: $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return 'Автоматически созданы счета: $items';
  }

  @override
  String get featuresDataTransferWarning => 'Предупреждение';

  @override
  String get featuresDataTransferError => 'Ошибка';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return 'Строка $row: $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => 'Счета';

  @override
  String get featuresDataTransferModulesTransactions => 'Операции';

  @override
  String get featuresDataTransferModulesCategories => 'Категории';

  @override
  String get featuresDataTransferModulesStockTransactions =>
      'Операции с акциями';

  @override
  String get featuresDataTransferModulesStockDividends => 'Дивиденды';

  @override
  String get featuresDataTransferMessagesExportSuccess => 'Экспорт завершен';

  @override
  String get featuresDataTransferMessagesExportFailed =>
      'Не удалось экспортировать';

  @override
  String get featuresDataTransferMessagesEmptyCsv =>
      'В CSV нет данных для импорта';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return 'Импорт $name завершен';
  }

  @override
  String get featuresDataTransferMessagesImportFailed =>
      'Не удалось импортировать';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      'Полная копия загружена';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      'Не удалось загрузить полную копию';

  @override
  String get featuresDataTransferMessagesRestoreDone =>
      'Восстановление завершено';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      'Не удалось восстановить копию';

  @override
  String get featuresDataTransferMessagesDbExportDone =>
      'Копия базы данных загружена';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      'Не удалось создать копию базы данных';

  @override
  String get featuresDataTransferMessagesDbRestoreDone =>
      'База данных восстановлена';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      'Не удалось восстановить базу данных';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return 'Загружено в $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed =>
      'Ошибка копии MEGA S4';

  @override
  String get featuresDataTransferMessagesRequireOneField =>
      'Заполните хотя бы одно поле';

  @override
  String get featuresDataTransferMessagesSaved => 'Настройки сохранены';

  @override
  String get featuresDataTransferMessagesSaveFailed =>
      'Не удалось сохранить настройки';

  @override
  String get featuresDataTransferBundleTitle =>
      'Полная копия данных (с изображениями)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      'Скачайте одним ZIP все личные данные: операции, счета, категории, бюджеты, циклы, курсы, акции и изображения чеков.';

  @override
  String get featuresDataTransferBundleDescription2 =>
      'Загрузите этот же ZIP для восстановления.';

  @override
  String get featuresDataTransferBundleRestorePrefix =>
      'Восстановление использует';

  @override
  String get featuresDataTransferBundleMergeMode => 'режим объединения';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      ': существующие данные пропускаются, добавляются только недостающие;';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      'текущие данные не удаляются и не перезаписываются';

  @override
  String get featuresDataTransferBundleDownload => 'Скачать полную копию';

  @override
  String get featuresDataTransferBundleDownloading => 'Подготовка загрузки...';

  @override
  String get featuresDataTransferBundleRestore =>
      'Загрузить копию для восстановления';

  @override
  String get featuresDataTransferBundleRestoring => 'Восстановление...';

  @override
  String get featuresDataTransferDatabaseTitle =>
      'Полная копия / восстановление базы';

  @override
  String get featuresDataTransferDatabaseDescription =>
      'Только для администраторов. В режиме SQLite скачивается копия `.db`; в PostgreSQL - `.sql`. Для восстановления загрузите соответствующий формат.';

  @override
  String get featuresDataTransferDatabaseDownload =>
      'Скачать копию базы данных';

  @override
  String get featuresDataTransferDatabaseDownloading => 'Загрузка...';

  @override
  String get featuresDataTransferDatabaseRestore =>
      'Выбрать копию для восстановления';

  @override
  String get featuresDataTransferDatabaseRestoring => 'Восстановление...';

  @override
  String get featuresDataTransferMegaTitle => 'Облачная копия MEGA S4';

  @override
  String get featuresDataTransferMegaDescription =>
      'Загружает текущую полную копию SQLite как объект в bucket MEGA S4. Подключение задается переменными окружения сервера; ключи не вводятся и не показываются в браузере.';

  @override
  String get featuresDataTransferMegaState => 'Статус: ';

  @override
  String get featuresDataTransferMegaConfigured => 'Настроено';

  @override
  String get featuresDataTransferMegaNotConfigured => 'Настройка неполная';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket: ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return 'Отсутствуют переменные окружения: $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'Загрузить копию в MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => 'Загрузка...';

  @override
  String get featuresDataTransferMegaConfigure => 'Настроить';

  @override
  String get featuresDataTransferMegaCancelConfigure => 'Отменить настройку';

  @override
  String get featuresDataTransferMegaFormHelp =>
      'Настройки записываются в постоянный файл на сервере и применяются сразу. Поля ключей нужно ввести заново; они не заполняются автоматически.';

  @override
  String get featuresDataTransferMegaBucketName => 'Имя bucket';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefix (необязательно)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (необязательно, пусто для автоподбора)';

  @override
  String get featuresDataTransferMegaSaveSettings => 'Сохранить настройки';

  @override
  String get featuresAccountsTitle => 'Счета';

  @override
  String get featuresAccountsTypeLabelsBank => 'Банковский счет';

  @override
  String get featuresAccountsTypeLabelsCredit_card => 'Кредитная карта';

  @override
  String get featuresAccountsTypeLabelsCash => 'Наличные';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => 'Цифровой кошелек';

  @override
  String get featuresAccountsTypeLabelsOther => 'Другое';

  @override
  String get featuresAccountsTotalAssets => 'Активы всего';

  @override
  String get featuresAccountsCreditOutstanding => 'Задолженность по карте';

  @override
  String get featuresAccountsAddAccount => 'Добавить счет';

  @override
  String get featuresAccountsEditAccount => 'Изменить счет';

  @override
  String get featuresAccountsNewAccount => 'Добавить счет';

  @override
  String get featuresAccountsAccountName => 'Название счета *';

  @override
  String get featuresAccountsInitialBalance => 'Начальный баланс';

  @override
  String get featuresAccountsInitialBalanceEdit =>
      'Начальный баланс / текущая настройка';

  @override
  String get featuresAccountsLinkedBank => 'Банк';

  @override
  String get featuresAccountsUngrouped => 'Без группы';

  @override
  String get featuresAccountsOverseasFeeRate =>
      'Комиссия за зарубежные операции (%)';

  @override
  String get featuresAccountsStatementClosingDay =>
      'День закрытия выписки (1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      'Например: 15. Оставьте пустым, чтобы не считать текущий цикл.';

  @override
  String get featuresAccountsExcludeFromTotal => 'Не включать в активы всего';

  @override
  String get featuresAccountsOtherAccounts => 'Другие счета';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return 'Итого после конвертации: $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return 'Связанный банк: $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return 'Комиссия за зарубежные операции: $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return 'День закрытия месяца: $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return 'Расходы текущего цикла: $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => 'Предыдущая выписка: ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return 'Расходы $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return 'Оплачено $amount';
  }

  @override
  String get featuresAccountsViewCycles => 'Смотреть детали циклов ›';

  @override
  String get featuresAccountsRepaymentTitle => 'Платеж по кредитной карте';

  @override
  String get featuresAccountsRepaymentPaymentAccount => 'Счет оплаты';

  @override
  String get featuresAccountsRepaymentPaymentDate => 'Дата платежа';

  @override
  String get featuresAccountsRepaymentNoLinkedCards =>
      'У этого банка нет привязанных карт';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return 'Текущий баланс: $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => 'Сумма платежа';

  @override
  String get featuresAccountsRepaymentConfirm => 'Подтвердить платеж';

  @override
  String get featuresAccountsDeleteMessage => 'Удалить этот счет?';

  @override
  String get featuresAccountsCyclesTitle => 'Детали циклов выписки';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name день закрытия месяца $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      'Платежи привязываются к выписке, которую закрывают. Суммы, оплаченные после закрытия, относятся к этому циклу.';

  @override
  String get featuresAccountsCyclesPeriod => 'Период';

  @override
  String get featuresAccountsCyclesSpending => 'Расходы';

  @override
  String get featuresAccountsCyclesPayment => 'Фактический платеж';

  @override
  String get featuresAccountsCyclesCurrent => 'Текущий';

  @override
  String get featuresAccountsFxTitle => 'Управление курсами';

  @override
  String get featuresAccountsFxAutoUpdate => 'Автоматически обновлять курсы';

  @override
  String get featuresAccountsFxSyncNow => 'Синхронизировать сейчас';

  @override
  String get featuresAccountsFxSyncing => 'Синхронизация...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return 'Последняя синхронизация: $date';
  }

  @override
  String get featuresAccountsFxCurrency => 'Валюта';

  @override
  String get featuresAccountsFxUnitToTwd => '1 единица = TWD';

  @override
  String get featuresAccountsFxEmpty =>
      'Курсы иностранных валют пока не настроены';

  @override
  String get featuresAccountsFxCurrencyLabel => 'Валюта (например USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'Курс к TWD';

  @override
  String get featuresAccountsFxAddOrUpdate => 'Добавить / обновить';

  @override
  String get featuresAccountsMessagesNameRequired => 'Введите название счета';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired =>
      'Выберите счет оплаты';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      'Введите платеж хотя бы по одной карте';

  @override
  String get featuresAccountsMessagesCurrencyInvalid =>
      'Валюта должна быть кодом из 3 букв';

  @override
  String get featuresAccountsMessagesRateInvalid => 'Введите корректный курс';

  @override
  String get featuresAccountsMessagesSaved => 'Сохранено';

  @override
  String get featuresAccountsMessagesSaveFailed => 'Не удалось сохранить';

  @override
  String get featuresAccountsMessagesDeleteFailed => 'Не удалось удалить';

  @override
  String get featuresAccountsMessagesRatesUpdated => 'Курсы обновлены';

  @override
  String get featuresAccountsMessagesSyncFailed =>
      'Не удалось синхронизировать';

  @override
  String get featuresAccountsMessagesLoadFailed => 'Не удалось загрузить';

  @override
  String get featuresTransactionsTitle => 'Операции';

  @override
  String get featuresTransactionsSearchPlaceholder => 'Поиск по заметкам...';

  @override
  String get featuresTransactionsAllTypes => 'Все типы';

  @override
  String get featuresTransactionsAllAccounts => 'Все счета';

  @override
  String get featuresTransactionsAllCategories => 'Все категории';

  @override
  String get featuresTransactionsTransfer => 'Перевод';

  @override
  String get featuresTransactionsFuture => 'Будущие операции';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (все)';
  }

  @override
  String get featuresTransactionsStartDateTitle => 'Дата начала';

  @override
  String get featuresTransactionsEndDateTitle => 'Дата окончания';

  @override
  String get featuresTransactionsAdd => 'Добавить операцию';

  @override
  String get featuresTransactionsEdit => 'Изменить операцию';

  @override
  String get featuresTransactionsCreate => 'Добавить операцию';

  @override
  String get featuresTransactionsAccountTransfer => 'Перевод между счетами';

  @override
  String get featuresTransactionsBatchCategory => 'Пакетно изменить категорию';

  @override
  String get featuresTransactionsBatchDate => 'Пакетно изменить дату';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return 'Удалить выбранные ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => 'Доходы на странице';

  @override
  String get featuresTransactionsPageExpense => 'Расходы на странице';

  @override
  String get featuresTransactionsPageTotal => 'Итого на странице';

  @override
  String get featuresTransactionsPageSummaryAria =>
      'Сводка операций на странице';

  @override
  String get featuresTransactionsEmpty => 'Подходящих операций нет';

  @override
  String featuresTransactionsSource(Object name) {
    return 'Источник: $name';
  }

  @override
  String get featuresTransactionsFxFee => 'Комиссия за зарубежную карту';

  @override
  String get featuresTransactionsPhotoOne => 'Фото 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count фото';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => 'Дата *';

  @override
  String get featuresTransactionsAmountRequiredLabel => 'Сумма *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return 'Курс (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder =>
      'Пусто: использовать системный курс';

  @override
  String get featuresTransactionsLatestRateLoading =>
      'Запрашиваем последний курс...';

  @override
  String get featuresTransactionsFxFeePlaceholder =>
      'Пусто: система рассчитает по тарифу карты';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return 'Комиссия карты за зарубежные операции $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return ', предлагается NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => 'Фото';

  @override
  String get featuresTransactionsLoadingPhotos => 'Загрузка фото...';

  @override
  String get featuresTransactionsTakePhoto => 'Сделать фото';

  @override
  String get featuresTransactionsChooseImage => 'Выбрать изображение';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return 'На телефоне можно сделать фото или выбрать из галереи. До 5 изображений, каждое до $maxMb MB.';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return 'Новые фото $count';
  }

  @override
  String get featuresTransactionsRemove => 'Удалить';

  @override
  String get featuresTransactionsChoosePhoto => 'Выбрать фото';

  @override
  String get featuresTransactionsTransferOut => 'Счет списания *';

  @override
  String get featuresTransactionsTransferIn => 'Счет зачисления *';

  @override
  String get featuresTransactionsSelectPlaceholder => 'Выбрать';

  @override
  String get featuresTransactionsCreating => 'Создание...';

  @override
  String get featuresTransactionsConfirmTransfer => 'Подтвердить перевод';

  @override
  String get featuresTransactionsBatchCategoryTitle =>
      'Пакетно изменить категорию';

  @override
  String get featuresTransactionsBatchDateTitle => 'Пакетно изменить дату';

  @override
  String get featuresTransactionsNewCategory => 'Новая категория';

  @override
  String get featuresTransactionsNewDate => 'Новая дата';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return 'Применить к $count записям';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      'Удалить эту операцию? Действие нельзя отменить.';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return 'Удалить выбранные операции: $count?';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return 'Операция обновлена, но $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return 'Операция создана, но $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      'Переводы нужно удалить и создать заново';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      'Комиссия за зарубежную карту создается автоматически. Измените связанную операцию в иностранной валюте; комиссия синхронизируется после этого.';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed =>
      'Не удалось загрузить фото';

  @override
  String get featuresTransactionsMessagesDateRequired => 'Выберите дату';

  @override
  String get featuresTransactionsMessagesAmountRequired =>
      'Введите корректную сумму';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      'Выберите счет списания и счет зачисления';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      'Счет списания и зачисления не могут совпадать';

  @override
  String get featuresTransactionsTypeLabelsIncome => 'Доход';

  @override
  String get featuresTransactionsTypeLabelsExpense => 'Расход';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => 'Входящий перевод';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => 'Исходящий перевод';

  @override
  String get featuresStocksTabsPortfolio => 'Портфель';

  @override
  String get featuresStocksTabsTransactions => 'Операции';

  @override
  String get featuresStocksTabsDividends => 'Дивиденды';

  @override
  String get featuresStocksTabsRealized => 'Реализованная P/L';

  @override
  String get featuresStocksTabsSettings => 'Настройки торговли';

  @override
  String get featuresStocksCommonStockLabel => 'Акция';

  @override
  String get featuresStocksCommonStockRequired => 'Акция *';

  @override
  String get featuresStocksCommonStockTypeStock => 'Акция';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => 'Варрант';

  @override
  String get featuresStocksCommonDate => 'Дата';

  @override
  String get featuresStocksCommonShares => 'Акции';

  @override
  String get featuresStocksCommonPrice => 'Цена';

  @override
  String get featuresStocksCommonTotal => 'Итого';

  @override
  String get featuresStocksCommonReturnRate => 'Доходность';

  @override
  String get featuresStocksCommonOverallReturnRate => 'Общая доходность';

  @override
  String get featuresStocksCommonEstimatedPL => 'Оценочная P/L';

  @override
  String get featuresStocksCommonRealizedPL => 'Реализованная P/L';

  @override
  String get featuresStocksCommonTotalRealizedPL => 'Реализованная P/L всего';

  @override
  String get featuresStocksCommonYearRealizedPL => 'Реализованная P/L за год';

  @override
  String get featuresStocksCommonRealizedCount => 'Реализованных записей';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count записей';
  }

  @override
  String get featuresStocksCommonSellAverage => 'Средняя цена продажи';

  @override
  String get featuresStocksCommonCostAverage => 'Средняя себестоимость';

  @override
  String get featuresStocksCommonFeeAndTax => 'Комиссии + налог';

  @override
  String get featuresStocksCommonCashDividend => 'Денежный дивиденд';

  @override
  String get featuresStocksCommonStockDividend => 'Дивиденд акциями';

  @override
  String get featuresStocksCommonStockSymbol => 'Тикер *';

  @override
  String get featuresStocksCommonStockName => 'Название акции';

  @override
  String get featuresStocksCommonSearching => 'Поиск...';

  @override
  String get featuresStocksCommonCancelAccounting =>
      '- Не зачислять (только дивиденд акциями) -';

  @override
  String get featuresStocksCommonAutoCalculate => 'Рассчитать автоматически';

  @override
  String get featuresStocksCommonBuy => 'Купить';

  @override
  String get featuresStocksCommonSell => 'Продать';

  @override
  String get featuresStocksPortfolioTitle => 'Портфель';

  @override
  String get featuresStocksPortfolioTotalMarketValue =>
      'Общая рыночная стоимость';

  @override
  String get featuresStocksPortfolioTotalCost => 'Общая стоимость вложений';

  @override
  String get featuresStocksPortfolioTotalDividend => 'Дивиденды всего';

  @override
  String get featuresStocksPortfolioAddStock => 'Добавить акцию';

  @override
  String get featuresStocksPortfolioEditStock => 'Изменить акцию';

  @override
  String get featuresStocksPortfolioNewStock => 'Добавить акцию';

  @override
  String get featuresStocksPortfolioUpdatePrices => 'Обновить цены';

  @override
  String get featuresStocksPortfolioBatchUpdate => 'Пакетное автообновление';

  @override
  String get featuresStocksPortfolioUpdating => 'Обновление...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'AssetPilot сначала запрашивает публичный API TWSE из браузера. Если запрос заблокирован, используется прокси пользовательского API после входа, затем позиции обновляются.';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return 'Обновление завершено: успешно $updated.';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return 'Обновление завершено: успешно $updated, ошибок $failed.';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      'Не удалось получить данные TWSE из браузера';

  @override
  String get featuresStocksPortfolioHeldShares => 'Акций в портфеле';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count акций';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => 'Текущая цена';

  @override
  String get featuresStocksPortfolioMarketValue => 'Рыночная стоимость';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired => 'Введите тикер';

  @override
  String get featuresStocksTransactionsTitle => 'Операции с акциями';

  @override
  String get featuresStocksTransactionsAddTransaction => 'Добавить операцию';

  @override
  String get featuresStocksTransactionsEditTransaction => 'Изменить операцию';

  @override
  String get featuresStocksTransactionsNewTransaction => 'Добавить операцию';

  @override
  String get featuresStocksTransactionsTypeLabel => 'Тип';

  @override
  String get featuresStocksTransactionsDateLabel => 'Дата *';

  @override
  String get featuresStocksTransactionsSharesLabel => 'Акции *';

  @override
  String get featuresStocksTransactionsPriceLabel => 'Цена за единицу *';

  @override
  String get featuresStocksTransactionsFeeLabel => 'Комиссия';

  @override
  String get featuresStocksTransactionsTaxLabel => 'Налог на операцию';

  @override
  String get featuresStocksTransactionsDeleteMessage => 'Удалить эту операцию?';

  @override
  String get featuresStocksTransactionsMessagesStockRequired =>
      'Выберите акцию';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      'Введите корректное количество акций';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired =>
      'Введите корректную цену';

  @override
  String get featuresStocksDividendsTitle => 'Дивиденды';

  @override
  String get featuresStocksDividendsAddDividend => 'Добавить дивиденд';

  @override
  String get featuresStocksDividendsEditDividend => 'Изменить дивиденд';

  @override
  String get featuresStocksDividendsNewDividend => 'Добавить дивиденд';

  @override
  String get featuresStocksDividendsSyncExDividends =>
      'Синхронизировать ex-dividend';

  @override
  String get featuresStocksDividendsSyncDescription =>
      'Автоматически синхронизирует исторические ex-dividend данные TWSE на основе ваших позиций.';

  @override
  String get featuresStocksDividendsSyncStart => 'Начать синхронизацию';

  @override
  String get featuresStocksDividendsSyncing => 'Синхронизация...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return 'Добавлено $synced, пропущено $skipped.';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return 'Добавлено $synced, пропущено $skipped, ошибок $failed.';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel =>
      'Денежный дивиденд (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel => 'Дивиденд акциями';

  @override
  String get featuresStocksDividendsDepositAccount => 'Счет зачисления';

  @override
  String get featuresStocksDividendsDeleteMessage => 'Удалить этот дивиденд?';

  @override
  String get featuresStocksDividendsMessagesStockRequired => 'Выберите акцию';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      'Введите денежный дивиденд или дивиденд акциями';

  @override
  String get featuresStocksRealizedTitle => 'Реализованная P/L';

  @override
  String get featuresStocksSettingsTitle => 'Настройки торговли';

  @override
  String get featuresStocksSettingsFeeTitle => 'Комиссии / налог на операции';

  @override
  String get featuresStocksSettingsFeeRate => 'Ставка комиссии';

  @override
  String get featuresStocksSettingsFeeDiscount => 'Скидка (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot =>
      'Минимальная комиссия (полный лот)';

  @override
  String get featuresStocksSettingsFeeMinOdd =>
      'Минимальная комиссия (неполный лот)';

  @override
  String get featuresStocksSettingsSellTaxRateStock =>
      'Налог при продаже (акции)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => 'Налог при продаже (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant =>
      'Налог при продаже (варрант)';

  @override
  String get featuresStocksSettingsSellTaxMin =>
      'Минимальный налог на операцию';

  @override
  String get featuresStocksSettingsSaveSettings => 'Сохранить настройки';

  @override
  String get featuresStocksSettingsStockStatusTitle => 'Статус акций';

  @override
  String get featuresStocksSettingsCurrentPrice => 'Текущая цена';

  @override
  String get featuresStocksSettingsNormalTracking => 'Обычное отслеживание';

  @override
  String get featuresStocksSettingsDelisted => 'Делистинг';

  @override
  String get featuresStocksSettingsRestoreTracking =>
      'Возобновить отслеживание';

  @override
  String get featuresStocksSettingsMarkDelisted => 'Отметить делистинг';

  @override
  String get featuresStocksSettingsRecurringTitle =>
      'Регулярные инвестиции в акции';

  @override
  String get featuresStocksSettingsAddRecurringShort => 'Добавить';

  @override
  String get featuresStocksSettingsEditRecurring =>
      'Изменить регулярную инвестицию';

  @override
  String get featuresStocksSettingsNewRecurring =>
      'Добавить регулярную инвестицию';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => 'Сумма (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => 'Периодичность';

  @override
  String get featuresStocksSettingsStartDate => 'Дата начала';

  @override
  String get featuresStocksSettingsLastGenerated => 'Последнее создание';

  @override
  String get featuresStocksSettingsActive => 'Активно';

  @override
  String get featuresStocksSettingsInactive => 'Отключено';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm =>
      'Удалить эту регулярную инвестицию?';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => 'Ежедневно';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => 'Еженедельно';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => 'Ежемесячно';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => 'Ежегодно';

  @override
  String get featuresStocksSettingsMessagesSaved => 'Настройки сохранены';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return 'Не удалось сохранить: $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired => 'Выберите акцию';

  @override
  String get featuresStocksSettingsMessagesAmountRequired =>
      'Введите корректную сумму';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol: статус $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus =>
      'восстановлено обычное отслеживание';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus =>
      'отмечен делистинг';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      'Не удалось обновить статус делистинга';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily =>
      'Ежедневный отчет о денежном потоке';

  @override
  String get notificationsReportTypeWeekly =>
      'Еженедельный отчет о денежном потоке';

  @override
  String get notificationsReportTypeMonthly =>
      'Ежемесячный отчет о денежном потоке';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return 'Ежедневный отчет о денежном потоке｜$date ($weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return 'Еженедельный отчет о денежном потоке｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return 'Ежемесячный отчет о денежном потоке｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name, денежный поток за $date ($weekday)';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name, денежный поток за $start ~ $end';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name, денежный поток за $month';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 Дата отчета $date　·　Отправлено $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 Период отчета $start ~ $end　·　Отправлено $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 Месяц отчета $month　·　Отправлено $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return 'Сводка за весь вчерашний день ($date, $weekday); отправлено сегодня ($sendDate)';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return 'Сводка за последние 7 дней ($start ~ $end); отправлено сегодня ($sendDate)';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return 'Сводка за прошлый месяц ($month, $start ~ $end); отправлено в этом месяце ($sendDate)';
  }

  @override
  String get notificationsLeadDaily => 'Вчера';

  @override
  String get notificationsLeadWeekly => 'Эта неделя';

  @override
  String get notificationsLeadMonthly => 'Прошлый месяц';

  @override
  String notificationsKpiIncome(Object lead) {
    return 'Доходы: $lead';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return 'Расходы: $lead';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return 'Итог: $lead';
  }

  @override
  String get notificationsCompareLabelDaily => 'к предыдущему дню';

  @override
  String get notificationsCompareLabelWeekly => 'к прошлой неделе';

  @override
  String get notificationsCompareLabelMonthly => 'к прошлому месяцу';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return 'вчера ($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return 'последние 7 дней ($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return 'прошлый месяц ($month)';
  }

  @override
  String get notificationsSectionsBalance => 'Балансы счетов';

  @override
  String get notificationsSectionsTopCategories =>
      'Топ-5 расходов этого месяца';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return 'Топ-5 расходов за $month';
  }

  @override
  String get notificationsSectionsDailyDetail => 'Детализация по дням';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return 'Накопительно за месяц ($month)';
  }

  @override
  String get notificationsSectionsStock => 'Инвестиции в акции';

  @override
  String get notificationsSectionsRecentDaily => 'Вчерашние операции';

  @override
  String get notificationsSectionsRecentWeekly => 'Операции этой недели';

  @override
  String get notificationsSectionsRecentMonthly => 'Операции прошлого месяца';

  @override
  String get notificationsLabelsIncome => 'Доходы';

  @override
  String get notificationsLabelsExpense => 'Расходы';

  @override
  String get notificationsLabelsNet => 'Итог';

  @override
  String get notificationsLabelsCost => 'Общая стоимость';

  @override
  String get notificationsLabelsMarketValue => 'Рыночная стоимость';

  @override
  String get notificationsLabelsUnrealizedPL => 'Нереализованная P/L';

  @override
  String get notificationsLabelsReturnRate => 'Доходность';

  @override
  String get notificationsLabelsUncategorized => 'Без категории';

  @override
  String get notificationsTableDate => 'Дата';

  @override
  String get notificationsEmptyNoAccount => 'Счетов пока нет';

  @override
  String get notificationsEmptyNoExpense => 'Расходов пока нет';

  @override
  String notificationsEmptyNoTx(Object label) {
    return 'Нет операций за $label';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return 'Акции: рыночная стоимость $marketValue, нереализованная P/L $pl';
  }

  @override
  String get notificationsCtaViewFullReport => 'Открыть полный отчет';

  @override
  String get notificationsCtaViewLineRecord => 'Открыть записи LINE';

  @override
  String get notificationsReminderAltText => 'Напоминание о расходах';

  @override
  String get notificationsReminderTitle =>
      'Не забудьте записать сегодняшние расходы';

  @override
  String notificationsReminderBody(Object name) {
    return '$name, потратьте 10 секунд на запись сегодняшних расходов, чтобы в конце месяца ничего не потерялось.';
  }

  @override
  String get notificationsReminderHint =>
      'Нажмите Добавить расход и введите: сумма заметка дата (дата необязательна)';

  @override
  String get notificationsReminderFallbackName => 'привет';

  @override
  String get notificationsReminderAddExpense => 'Добавить расход';

  @override
  String get notificationsReminderViewToday => 'Посмотреть записи за сегодня';

  @override
  String get notificationsFallbackUser => 'Пользователь';

  @override
  String get mobileLegacyMessagebde18a20 => '・Не входит в активы всего';

  @override
  String get mobileLegacyNoneCreateAsParent =>
      '(Нет, создать как верхний уровень)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      'Главная показывает доходы, расходы, итог и категории расходов по месяцам. Переключайте месяцы и сразу понимайте, куда уходят деньги.';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      'Платежи привязываются к выписке, которую они закрывают, даже если оплачены в следующем цикле после закрытия.';

  @override
  String get mobileLegacy0NoPayment => '0 = не платить';

  @override
  String get mobileLegacyMon => 'Пн';

  @override
  String get mobileLegacyStock => 'Обычная акция';

  @override
  String get mobileLegacyStocks => 'Обычные акции (%)';

  @override
  String get mobileLegacyTue => 'Вт';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      'Счет зачисления (обязателен для денежного дивиденда)';

  @override
  String get mobileLegacyWed => 'Ср';

  @override
  String get mobileLegacyPreviousStatement => 'Предыдущая выписка ';

  @override
  String get mobileLegacyNext => 'Далее';

  @override
  String get mobileLegacyDelisted => 'Делистинг';

  @override
  String get mobileLegacySubcategory => 'Подкатегория';

  @override
  String get mobileLegacyDeleted => 'Удалено';

  @override
  String get mobileLegacyUpdated => 'Обновлено';

  @override
  String get mobileLegacyLinked => 'Привязано';

  @override
  String get mobileLegacyUnlinked => 'Отвязано';

  @override
  String get mobileLegacyTotalRealizedPL => 'Реализованная P/L всего';

  @override
  String get mobileLegacyFri => 'Пт';

  @override
  String get mobileLegacyStandardRate01 => 'Стандартная ставка: 0,1%';

  @override
  String get mobileLegacyStandardRate03 => 'Стандартная ставка: 0,3%';

  @override
  String get mobileLegacySat => 'Сб';

  @override
  String get mobileLegacyCategoryName => 'Название категории';

  @override
  String get mobileLegacyFeeOptional => 'Комиссия (необязательно)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      'Оставьте комиссию и налог пустыми, чтобы сервер рассчитал их автоматически';

  @override
  String get mobileLegacyCommissionRate => 'Ставка комиссии (%)';

  @override
  String get mobileLegacyDay => 'Вс';

  @override
  String get mobileLegacyMonthlyBudget => 'Месячный бюджет';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      'Родительская категория (не выбирайте, чтобы создать верхний уровень)';

  @override
  String get mobileLegacyTheme => 'Тема';

  @override
  String get mobileLegacyThu => 'Чт';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => 'Неизвестная категория';

  @override
  String get mobileLegacyNotLinked => 'Не привязано';

  @override
  String get mobileLegacyNoTransactionsThisMonth =>
      'В этом месяце операций нет';

  @override
  String get mobileLegacyNoBudgetThisMonth => 'В этом месяце бюджетов нет';

  @override
  String get mobileLegacyNetThisMonth => 'Итог месяца';

  @override
  String get mobileLegacyPositiveWholeNumber => 'Положительное целое число';

  @override
  String get mobileLegacyDeletePermanently => 'Удалить навсегда';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      'Навсегда удалить аккаунт и все данные';

  @override
  String get mobileLegacyNoReleaseNotesAvailable =>
      'Сведений об обновлении пока нет';

  @override
  String get mobileLegacyCurrentDevice => 'Текущее устройство';

  @override
  String get mobileLegacyTransactions => 'Операции';

  @override
  String get mobileLegacyAll => 'Все';

  @override
  String get mobileLegacyAllCategories => 'Все категории';

  @override
  String get mobileLegacyAllAccounts => 'Все счета';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      'Платеж по каждой карте (в валюте карты)';

  @override
  String get mobileLegacySyncDividends => 'Синхронизировать дивиденды';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      'Название (необязательно, заполнится автоматически)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      'На вкладке Акции введите тикер, например 2330, чтобы отслеживать цены, реализованную и нереализованную P/L, а также автоматически синхронизировать дивиденды.';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      'На вкладке Операции нажмите +, чтобы добавить доход или расход. Поддерживаются разные валюты и переводы между счетами. Смахните влево для удаления или коснитесь для изменения.';

  @override
  String get mobileLegacyNoDataForThisPeriod => 'За этот период данных нет';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      'Это действие навсегда удалит аккаунт и все данные, включая операции, счета, акции и настройки. Восстановить их нельзя.';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      'Настроить время отправки регулярных отчетов';

  @override
  String get mobileLegacyAutomatic => 'Автоматически';

  @override
  String get mobileLegacyAtLeast8Characters => 'Не менее 8 символов';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      'Не менее 8 символов: заглавные и строчные буквы, цифры и символы';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      'Ваш помощник по личным финансам для операций, бюджетов, акций Тайваня и отчетов. Потратьте минуту, чтобы познакомиться с основными возможностями.';

  @override
  String get mobileLegacyDeletePasskey => 'Удалить Passkey';

  @override
  String get mobileLegacyDeleteCategory => 'Удалить категорию';

  @override
  String get mobileLegacyDeleteTransaction => 'Удалить операцию';

  @override
  String get mobileLegacyDeleteDividend => 'Удалить дивиденд';

  @override
  String get mobileLegacyDeleteStock => 'Удалить акцию';

  @override
  String get mobileLegacyDeleteAccount => 'Удалить счет';

  @override
  String get mobileLegacyDeleteSchedule => 'Удалить расписание';

  @override
  String get mobileLegacyDeletePhoto => 'Удалить фото';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      'Для денежного дивиденда нужен счет зачисления';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters =>
      'Операций по этим фильтрам нет';

  @override
  String get mobileLegacyDiscount01 => 'Скидка (0-1)';

  @override
  String get mobileLegacyImproved => 'Улучшено';

  @override
  String get mobileLegacyMore => 'Еще';

  @override
  String get mobileLegacyUpdatedd9db02d0 => 'Обновлено';

  @override
  String get mobileLegacyLastDayOfEachMonth => 'Последний день каждого месяца';

  @override
  String get mobileLegacyNoPricesToUpdate => 'Нет цен для обновления';

  @override
  String get mobileLegacyNoNewDividendsToSync =>
      'Нет новых дивидендов для синхронизации';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      'Пользователь вышел, локальный вход очищен';

  @override
  String get mobileLegacyGettingStarted => 'Начало работы';

  @override
  String get mobileLegacyExample06MeansA40Discount =>
      'Например, 0,6 означает скидку 40%';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      'Например, 1.5 означает 1,5%; комиссия считается автоматически при оплате в иностранной валюте';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      'В разделе Еще можно настроить месячные бюджеты, смотреть отчеты, управлять счетами и категориями, а также расписанием регулярных операций и отчетов. Готовы? Начинайте записывать.';

  @override
  String get mobileLegacyStandardBrokerageRate01425 =>
      'Стандартная ставка брокера: 0,1425%';

  @override
  String get mobileLegacyNotSentYet => 'Еще не отправлено';

  @override
  String get mobileLegacyNoRealizedReturns => 'Реализованной P/L пока нет';

  @override
  String get mobileLegacyNoCategoriesYet => 'Категорий пока нет';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      'Операций пока нет. Нажмите кнопку внизу справа, чтобы добавить первую.';

  @override
  String get mobileLegacyNoRecurringTransactions =>
      'Регулярных операций пока нет';

  @override
  String get mobileLegacyNoDividendRecords => 'Записей дивидендов пока нет';

  @override
  String get mobileLegacyNoStockTransactions => 'Операций с акциями пока нет';

  @override
  String get mobileLegacyNoHoldingsYet => 'Позиций пока нет';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => 'Журнал входов пока пуст';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      'Завершите регистрацию в браузере (требуется биометрия устройства)';

  @override
  String get mobileLegacyNotice => 'Внимание';

  @override
  String get mobileLegacyDividends => 'Дивиденды';

  @override
  String get mobileLegacyDividendSyncCompleted => 'Дивиденды синхронизированы';

  @override
  String get mobileLegacyTickerEG2330 => 'Тикер (например 2330)';

  @override
  String get mobileLegacyStockMarketValue => 'Рыночная стоимость акций';

  @override
  String get mobileLegacyHoldings => 'Портфель';

  @override
  String get mobileLegacyDayOfWeek => 'День недели';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      'Посмотреть текущую версию и изменения';

  @override
  String get mobileLegacyRename => 'Переименовать';

  @override
  String get mobileLegacyCheckAgain => 'Проверить снова';

  @override
  String get mobileLegacyRetry => 'Повторить';

  @override
  String get mobileLegacyHome => 'Главная';

  @override
  String get mobileLegacyFixed => 'Исправлено';

  @override
  String get mobileLegacyApply => 'Применить';

  @override
  String get mobileLegacyTime => 'Время';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      'Комиссия за зарубежную операцию в TWD (необязательно)';

  @override
  String get mobileLegacyAddTransaction => 'Добавить операцию';

  @override
  String get mobileLegacyTransactions8084a8ea => 'Операции';

  @override
  String get mobileLegacyStartDate => 'Дата начала';

  @override
  String get mobileLegacyTrackTaiwanStocks => 'Отслеживайте акции Тайваня';

  @override
  String get mobileLegacyStockDividendSharesOptional =>
      'Дивиденд акциями (необязательно)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      'Комиссия за зарубежную карту создается автоматически. Измените связанную операцию в иностранной валюте.';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      'Пароль должен содержать не менее 8 символов';

  @override
  String get mobileLegacyAccountName => 'Название счета';

  @override
  String get mobileLegacyAccountDeleted => 'Аккаунт удален';

  @override
  String get mobileLegacyAccountSecurity => 'Безопасность аккаунта';

  @override
  String get mobileLegacyLinkedAccounts => 'Связанные аккаунты';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies =>
      'Часто используемые валюты';

  @override
  String get mobileLegacyChooseFromGallery => 'Выбрать из галереи';

  @override
  String get mobileLegacyEnabled => 'Включено';

  @override
  String get mobileLegacyDark => 'Темная';

  @override
  String get mobileLegacyLight => 'Светлая';

  @override
  String get mobileLegacyClearDates => 'Очистить даты';

  @override
  String get mobileLegacyClearFilters => 'Очистить фильтры';

  @override
  String get mobileLegacyCashDividendTotalOptional =>
      'Денежный дивиденд (итого, необязательно)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      'Введите денежный дивиденд или дивиденд акциями';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      'После настройки карточка счета показывает расходы текущего цикла; пусто — не считать';

  @override
  String get mobileLegacyNoteOptional => 'Заметка (необязательно)';

  @override
  String get mobileLegacyNoteKeyword => 'Ключевое слово заметки';

  @override
  String get mobileLegacyMinimumTransactionTax =>
      'Минимальный налог на операцию';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction =>
      'До 5 фото на одну операцию';

  @override
  String get mobileLegacyReportNotifications => 'Уведомления об отчетах';

  @override
  String get mobileLegacySeeYourCompleteCashFlow =>
      'Видите всю картину денежного потока';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser => 'Не удалось открыть браузер';

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
      'Срок входа истек. Войдите снова';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      'Ответ входа не содержит cookie аутентификации. Проверьте настройки backend';

  @override
  String get mobileLegacySignedIn => 'Вход выполнен';

  @override
  String get mobileLegacySignInHistory => 'Журнал входов';

  @override
  String get mobileLegacySignedInDevices => 'Устройства с входом';

  @override
  String get mobileLegacySignInRequestConnectionFailed =>
      'Не удалось подключиться для входа';

  @override
  String get mobileLegacyEndDate => 'Дата окончания';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      'Ответ регистрации не содержит cookie аутентификации. Проверьте настройки backend';

  @override
  String get mobileLegacySignUpAndSignIn => 'Зарегистрироваться и войти';

  @override
  String get mobileLegacyBuy => 'Купить';

  @override
  String get mobileLegacyFrequency => 'Периодичность';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 =>
      'Курс должен быть больше 0';

  @override
  String get mobileLegacyReturns => 'P/L';

  @override
  String get mobileLegacyAddPasskey => 'Добавить Passkey';

  @override
  String get mobileLegacyAddStockTransaction => 'Добавить операцию с акциями';

  @override
  String get mobileLegacyAddSchedule => 'Добавить расписание';

  @override
  String get mobileLegacyAddReportSchedule => 'Добавить расписание отчета';

  @override
  String get mobileLegacyAddPhotosOptional => 'Добавить фото (необязательно)';

  @override
  String get mobileLegacyFailedToLoadPhoto => 'Не удалось загрузить фото';

  @override
  String get mobileLegacyLink => 'Привязать';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      'Привязка подтверждается в браузере. Перед отвязкой убедитесь, что доступен другой способ входа.';

  @override
  String get mobileLegacyUnlink => 'Отвязать';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp =>
      'Личные финансы · Android-приложение';

  @override
  String get mobileLegacySkip => 'Пропустить';

  @override
  String get mobileLegacyMinimumOddLotCommission =>
      'Минимальная комиссия за неполный лот';

  @override
  String get mobileLegacyIncorrectEmailOrPassword =>
      'Неверный email или пароль';

  @override
  String get mobileLegacyDefaultCurrency => 'Валюта по умолчанию';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      'Валюта по умолчанию и частые валюты';

  @override
  String get mobileLegacyBudgets => 'Бюджеты';

  @override
  String get mobileLegacyBudgetsReportsAndMore => 'Бюджеты, отчеты и другое';

  @override
  String get mobileLegacyBudgetAmount => 'Сумма бюджета';

  @override
  String get mobileLegacyCurrencySettings => 'Настройки валют';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage =>
      'Язык приложения, уведомлений и веб-версии';

  @override
  String get mobileLegacyBank => 'Банк';

  @override
  String get mobileLegacyBankBalance => 'Баланс банка';

  @override
  String get mobileLegacyRequiresALinkedLineAccount =>
      'Нужен привязанный аккаунт LINE';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      'Для платежа нужна хотя бы одна кредитная карта и один счет не-карта';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      'Добавьте заглавные и строчные буквы, цифры и символы';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      'Добавьте заглавные и строчные буквы, цифры и символы';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      'Удалить это расписание уведомлений об отчете?';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      'Удалить загруженное фото? Это действие нельзя отменить.';

  @override
  String get mobileLegacyEditStockTransaction => 'Изменить операцию с акциями';

  @override
  String get mobileLegacyEditReportSchedule => 'Изменить расписание отчета';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst =>
      'Сначала пройдите проверку ниже';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      'Сначала добавьте акцию на вкладке Портфель';

  @override
  String get mobileLegacySelectAParentCategoryFirst =>
      'Сначала выберите родительскую категорию';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      'Введите платеж хотя бы по одной карте';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      'Выберите хотя бы один способ уведомления';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo =>
      'Введите число не меньше 0';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => 'Введите значение от 1 до 31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 => 'Введите сумму больше 0';

  @override
  String get mobileLegacyEnterATicker => 'Введите тикер';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber =>
      'Введите положительное целое число';

  @override
  String get mobileLegacyEnterAName => 'Введите название';

  @override
  String get mobileLegacyEnterAValidEmailAddress => 'Введите корректный email';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm =>
      'Введите пароль для подтверждения';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      'Введите email аккаунта для подтверждения';

  @override
  String get mobileLegacyEnterADisplayName => 'Введите отображаемое имя';

  @override
  String get mobileLegacySelectASubcategory => 'Выберите подкатегорию';

  @override
  String get mobileLegacySelectACategory => 'Выберите категорию';

  @override
  String get mobileLegacySelectAParentCategory =>
      'Выберите родительскую категорию';

  @override
  String get mobileLegacySelectAnAccount => 'Выберите счет';

  @override
  String get mobileLegacySelectADestinationAccount =>
      'Выберите счет зачисления';

  @override
  String get mobileLegacySell => 'Продать';

  @override
  String get mobileLegacyMinimumBoardLotCommission =>
      'Минимальная комиссия за полный лот';

  @override
  String get mobileLegacyFilter => 'Фильтр';

  @override
  String get mobileLegacyFilterTransactions => 'Фильтр операций';

  @override
  String get mobileLegacyChooseTheme => 'Выбрать тему';

  @override
  String get mobileLegacyLogTransactionsInSeconds =>
      'Записывайте операции за секунды';

  @override
  String get mobileLegacyMarketValue => 'Общая рыночная стоимость';

  @override
  String get mobileLegacyTotalAssetsInTwd => 'Активы всего (в TWD)';

  @override
  String get mobileLegacyTraditionalChineseEnglish =>
      'Традиционный китайский / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp =>
      'Нет аккаунта? Зарегистрируйтесь';

  @override
  String get mobileLegacyPaymentRecorded => 'Платеж записан';

  @override
  String get mobileLegacyToAccount => 'Счет зачисления';

  @override
  String get mobileLegacyFromAccount => 'Счет списания';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      'Счета списания и зачисления не могут совпадать';

  @override
  String get mobileLegacyEditTransfersInTheWebApp =>
      'Изменяйте переводы в веб-версии';

  @override
  String get mobileLegacyTransactionTaxSell => 'Налог на операцию (продажа)';

  @override
  String get mobileLegacyTransactionTaxOptional =>
      'Налог на операцию (необязательно)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax =>
      'Тип (влияет на налог на операцию)';

  @override
  String get mobileLegacyWarrants => 'Варранты (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot => 'Добро пожаловать в AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      'После изменения другие устройства будут выведены из аккаунта.';

  @override
  String get mobileLegacyTestSentryConfiguration =>
      'Проверить настройки Sentry';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'API вернул 401; сессия истекла, локальный вход очищен';

  @override
  String get mobileLegacyApiRequestFailed => 'Запрос API завершился ошибкой';

  @override
  String get mobileLegacyApiRequestConnectionFailed =>
      'Не удалось подключиться к API';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'Ответ приложения не содержит cookie аутентификации';

  @override
  String get mobileLegacyEmailNotifications => 'Уведомления по email';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'Ответ Google не содержит cookie аутентификации';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'Уведомления LINE';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'Ответ LINE не содержит cookie аутентификации';

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
      'TWD всегда включена. Отмеченные валюты будут показаны первыми в списках операций и регулярных операций.';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return '$day-й день';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return 'Последняя отправка: $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return 'Текущая версия v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'Доступна версия v$version';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return 'Ежемесячно, день $day';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return 'Каждую неделю: $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return 'Создано: $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return 'Язык обновлен: $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return 'Не удалось загрузить: $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return 'Непредвиденная ошибка: $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return 'Не удалось войти через $provider: $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return 'Не удалось обновить цены: $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return 'Не удалось синхронизировать дивиденды: $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return 'Не удалось загрузить фото: $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return 'Ошибка запроса (HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return 'Не удалось войти (HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return 'Не удалось подключиться к серверу ($target): $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return 'Удалить «$name»?';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return 'Отвязать $provider';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return 'Отвязать $provider?';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return 'Привязка $provider';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (все)';
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
    return 'Данные запрошены в $time';
  }

  @override
  String get dashboardAttentionTitle => 'Требует внимания';

  @override
  String get dashboardAttentionAllClear =>
      'Сейчас ничего не требует вашего внимания';

  @override
  String dashboardAttentionRecurring(Object count) {
    return 'Периодические операции для проверки: $count';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return 'Операции без категории: $count · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return 'Позиций без цены: $count';
  }

  @override
  String get dashboardDriversTitle => 'Топ-3 факторов месяца';

  @override
  String dashboardDriversSubtitle(Object month) {
    return 'Наибольший вклад за $month';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '$share% этого типа';
  }

  @override
  String get dashboardPersonalizeTrigger => 'Настроить главную';

  @override
  String get dashboardPersonalizeTitle => 'Настроить главную';

  @override
  String get dashboardPersonalizeDescription =>
      'Выберите модули и расположите их в удобном порядке.';

  @override
  String get dashboardPersonalizeModulesAssets => 'Обзор активов';

  @override
  String get dashboardPersonalizeModulesAttention => 'Требует внимания';

  @override
  String get dashboardPersonalizeModulesWhyChanged =>
      'Почему изменился денежный поток';

  @override
  String get dashboardPersonalizeModulesSpending => 'Категории расходов';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => 'Состояние портфеля';

  @override
  String get dashboardPersonalizeModulesIncomeRecent =>
      'Доходы и недавние операции';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return 'Переместить $module вверх';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return 'Переместить $module вниз';
  }

  @override
  String get dashboardPersonalizeSaved => 'Макет панели сохранён';

  @override
  String get dashboardPersonalizeSaveError =>
      'Не удалось сохранить макет панели';

  @override
  String get dashboardPersonalizeReset => 'Сбросить';

  @override
  String get dashboardPersonalizeApply => 'Применить';

  @override
  String get dashboardComparisonTitle => 'Почему изменился денежный поток';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart–$currentEnd в сравнении с $previousStart–$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return 'Полный месяц в сравнении с $previousStart–$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable =>
      'Для этого месяца нет сопоставимого предыдущего периода.';

  @override
  String get dashboardComparisonNoChanges =>
      'Учтённый денежный поток не изменился относительно сопоставимого периода.';

  @override
  String get dashboardComparisonPreviousNet =>
      'Предыдущий чистый денежный поток';

  @override
  String get dashboardComparisonNetChange =>
      'Изменение чистого денежного потока';

  @override
  String get dashboardComparisonNewThisPeriod => 'Новое в этом периоде';

  @override
  String get dashboardComparisonIncreased => 'Сумма увеличилась';

  @override
  String get dashboardComparisonDecreased => 'Сумма уменьшилась';

  @override
  String get dashboardPortfolioHealthTitle =>
      'Состояние себестоимости портфеля';

  @override
  String get dashboardPortfolioHealthSubtitle =>
      'Текущая стоимость и остаточная стоимость FIFO';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      'Добавьте позицию, чтобы увидеть анализ себестоимости.';

  @override
  String get dashboardPortfolioHealthMissingPrices =>
      'Для сравнения нужны текущие цены.';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      'Общий процент недоступен для позиций в разных валютах.';

  @override
  String get dashboardPortfolioHealthMarketValue =>
      'Рыночная стоимость с ценой';

  @override
  String get dashboardPortfolioHealthCost => 'Стоимость позиций с ценой';

  @override
  String get dashboardPortfolioHealthUnrealizedGross =>
      'Валовая нереализованная прибыль/убыток';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return 'Крупнейшая позиция: $name · $share% оценённой стоимости';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      'Сравниваются текущие цены и учтённая стоимость FIFO. Это не рыночный индекс и не взвешенная по времени доходность.';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return 'Покрытие ценами: $priced из $total позиций';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook =>
      'Прогноз запланированных средств';

  @override
  String get dashboardPersonalizeModulesSavingsScenario =>
      'Сценарий накоплений';

  @override
  String get dashboardCashOutlookTitle =>
      'Следующие 30 дней · запланированные средства';

  @override
  String get dashboardCashOutlookSubtitle =>
      'На основе подтверждённых регулярных операций';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start–$end · Плановая оценка';
  }

  @override
  String get dashboardCashOutlookInvalidDate =>
      'Не удалось рассчитать период оценки.';

  @override
  String get dashboardCashOutlookNoBankAccounts =>
      'Добавьте учитываемый банковский счёт для оценки запланированных средств.';

  @override
  String get dashboardCashOutlookNoSchedules =>
      'Создайте регулярный доход или расход, чтобы увидеть будущие операции.';

  @override
  String get dashboardCashOutlookNoCoveredSchedules =>
      'Проверьте регулярные операции и свяжите их с учитываемыми банковскими счетами.';

  @override
  String get dashboardCashOutlookStartingBalance =>
      'Баланс банковских счетов на сегодня';

  @override
  String get dashboardCashOutlookScheduledNet =>
      'Запланированное чистое изменение';

  @override
  String get dashboardCashOutlookClosingBalance =>
      'Оценка средств через 30 дней';

  @override
  String get dashboardCashOutlookLowestBalance => 'Минимальная оценка средств';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return 'Запланировано: $count · Доходы $income · Расходы $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle =>
      'Общая оценка средств может стать отрицательной';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return 'Примерно $date оценка будет ниже нуля на $amount. Перед действием проверьте даты и суммы.';
  }

  @override
  String get dashboardCashOutlookUpcoming =>
      'Ближайшие запланированные операции';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return 'Показано $shown из $total';
  }

  @override
  String get dashboardCashOutlookNoUpcoming =>
      'В этом 30-дневном периоде нет запланированных операций.';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return 'Учтено $included из $total регулярных операций; проверьте $uncovered.';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      'Оценка объединяет все учитываемые банковские счета, сегодняшний баланс и подтверждённые связанные регулярные операции. Она не показывает возможный овердрафт отдельного счёта и не меняет фактические балансы; наступившие операции создаются при следующей обработке. Для оценок TWD последовательно используются текущие курсы.';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return 'Примерно $date может не хватить $amount запланированных средств';
  }

  @override
  String get dashboardScenarioTitle => 'Сценарий накоплений';

  @override
  String get dashboardScenarioSubtitle =>
      'Оцените накопительный эффект ежемесячного изменения';

  @override
  String get dashboardScenarioMonthlyAdjustment =>
      'Ежемесячное изменение накоплений (TWD)';

  @override
  String get dashboardScenarioDecrease =>
      'Уменьшить ежемесячное изменение на 500';

  @override
  String get dashboardScenarioIncrease =>
      'Увеличить ежемесячное изменение на 500';

  @override
  String get dashboardScenarioHorizon => 'Период';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count мес.';
  }

  @override
  String get dashboardScenarioDifference => 'Накопительная разница';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return 'Ежемесячное изменение $monthly в течение $months мес. даёт накопительную разницу $difference.';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      'Простой сценарий: ежемесячное изменение × месяцы. Без процентов, рыночной доходности, инфляции и налогов; будущий результат не гарантируется.';
}
