// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get commonSave => 'Guardar';

  @override
  String get commonCancel => 'Cancelar';

  @override
  String get commonDelete => 'Eliminar';

  @override
  String get commonEdit => 'Editar';

  @override
  String get commonConfirm => 'Confirmar';

  @override
  String get commonClose => 'Cerrar';

  @override
  String get commonLoading => 'Cargando…';

  @override
  String get commonAdd => 'Añadir';

  @override
  String get commonBack => 'Volver';

  @override
  String get commonSearch => 'Buscar';

  @override
  String get commonLanguage => 'Idioma';

  @override
  String get commonClear => 'Borrar';

  @override
  String get commonSaving => 'Guardando...';

  @override
  String get commonConfirmDelete => 'Confirmar eliminación';

  @override
  String get commonPreviousPage => 'Anterior';

  @override
  String get commonNextPage => 'Siguiente';

  @override
  String commonTotalRecords(Object count) {
    return '$count registros';
  }

  @override
  String get commonPerPage => 'Por página';

  @override
  String commonRecordsUnit(Object count) {
    return '$count registros';
  }

  @override
  String get commonNoData => 'Aún no hay datos';

  @override
  String get navSectionsFinance => 'Finanzas';

  @override
  String get navSectionsStocks => 'Acciones';

  @override
  String get navSectionsSystem => 'Sistema';

  @override
  String get navDashboard => 'Panel';

  @override
  String get navTransactions => 'Transacciones';

  @override
  String get navReports => 'Informes';

  @override
  String get navBudget => 'Presupuestos';

  @override
  String get navInfoBoard => 'Panel informativo';

  @override
  String get navAccounts => 'Cuentas';

  @override
  String get navCategories => 'Categorías';

  @override
  String get navRecurring => 'Recurrentes';

  @override
  String get navStocksPortfolio => 'Cartera';

  @override
  String get navStocksTransactions => 'Transacciones de acciones';

  @override
  String get navStocksDividends => 'Dividendos';

  @override
  String get navStocksRealized => 'Gan./pérd. realizada';

  @override
  String get navStocksSettings => 'Ajustes de acciones';

  @override
  String get navExportImport => 'Exportar / importar';

  @override
  String get navAccount => 'Cuenta';

  @override
  String get navApiCredits => 'Acceso API';

  @override
  String get navAdmin => 'Admin';

  @override
  String get navTitleStocks => 'Cartera';

  @override
  String get navTitleStockTransactions => 'Transacciones de acciones';

  @override
  String get navTitleStockDividends => 'Dividendos de acciones';

  @override
  String get navTitleStockRealized => 'Gan./pérd. realizada';

  @override
  String get navTitleStockSettings => 'Ajustes de trading';

  @override
  String get navTitleApiCredits => 'Uso y acceso API';

  @override
  String get shellFallbackUser => 'Usuario';

  @override
  String get shellLogout => 'Cerrar sesión';

  @override
  String get shellVersionInfo => 'Información de versión';

  @override
  String get shellOpenMenu => 'Abrir menú';

  @override
  String get shellSkipToContent => 'Ir al contenido principal';

  @override
  String get shellThemeLight => 'Claro';

  @override
  String get shellThemeSystem => 'Sistema';

  @override
  String get shellThemeDark => 'Oscuro';

  @override
  String get shellChangelogLoading => 'Cargando versión…';

  @override
  String get shellChangelogLoadFailed => 'No se pudo cargar la versión';

  @override
  String get shellChangelogUnknownVersion => 'Desconocida';

  @override
  String get shellChangelogCurrentVersion => 'Versión actual';

  @override
  String get shellChangelogUpdatableVersion => 'Versión disponible';

  @override
  String get shellChangelogUpToDate => 'Todo actualizado';

  @override
  String get shellChangelogUpdatableContent => 'Novedades';

  @override
  String get shellChangelogRecentContent => 'Cambios recientes';

  @override
  String get authLoginTab => 'Iniciar sesión';

  @override
  String get authRegisterTab => 'Crear cuenta';

  @override
  String get authSubtitleLogin =>
      'Qué bueno verte de nuevo. Inicia sesión en tu cuenta';

  @override
  String get authSubtitleRegister =>
      'Crea tu cuenta y empieza a llevar el control';

  @override
  String get authEmailLabel => 'Correo electrónico';

  @override
  String get authPasswordLabel => 'Contraseña';

  @override
  String get authPasswordPlaceholder => 'Introduce tu contraseña';

  @override
  String get authDisplayNameLabel => 'Nombre visible';

  @override
  String get authDisplayNamePlaceholder => 'Tu nombre o apodo';

  @override
  String get authRegisterPasswordPlaceholder =>
      'Mínimo 8 caracteres, con mayúsculas, minúsculas y números';

  @override
  String get authTogglePassword => 'Mostrar u ocultar contraseña';

  @override
  String get authTurnstileAria => 'Verificación humana de Cloudflare Turnstile';

  @override
  String get authLoginButton => 'Iniciar sesión';

  @override
  String get authLoggingIn => 'Iniciando sesión…';

  @override
  String get authPasskeyButton => 'Entrar con Passkey';

  @override
  String get authPasskeyVerifying => 'Verificando Passkey…';

  @override
  String get authGoogleButton => 'Entrar con Google';

  @override
  String get authGoogleVerifying => 'Verificando Google…';

  @override
  String get authLineButton => 'Entrar con LINE';

  @override
  String get authLineVerifying => 'Verificando LINE…';

  @override
  String get authRegisterSubmit => 'Crear cuenta';

  @override
  String get authRegistering => 'Creando cuenta…';

  @override
  String get authLineCallbackCompleting =>
      'Completando la verificación de LINE...';

  @override
  String get authLineCallbackMissingCode =>
      'LINE no devolvió un código de autorización. Inténtalo de nuevo.';

  @override
  String get authLineCallbackLinkFailed =>
      'No se pudo vincular la cuenta de LINE';

  @override
  String get authLineCallbackLoginFailed =>
      'No se pudo iniciar sesión con LINE';

  @override
  String get authLineCallbackVerifyFailed => 'Falló la verificación de LINE';

  @override
  String get authErrorsTurnstileRequired =>
      'Completa primero la verificación humana';

  @override
  String get authErrorsLoginFailed => 'No se pudo iniciar sesión';

  @override
  String get authErrorsRegisterFailed => 'No se pudo crear la cuenta';

  @override
  String get authErrorsGoogleNotConfigured =>
      'El inicio de sesión con Google no está configurado';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'El componente de Google aún no se ha cargado';

  @override
  String get authErrorsGoogleStateFailed =>
      'No se pudo crear el estado de inicio de sesión de Google';

  @override
  String get authErrorsGoogleNoCode =>
      'No se recibió el código de autorización de Google';

  @override
  String get authErrorsGoogleFailed => 'No se pudo iniciar sesión con Google';

  @override
  String get authErrorsGoogleCancelled =>
      'Inicio de sesión con Google cancelado';

  @override
  String get authErrorsPasskeyUnsupported => 'Este navegador no admite Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'No se pudo crear el desafío de Passkey';

  @override
  String get authErrorsPasskeyFailed => 'No se pudo iniciar sesión con Passkey';

  @override
  String get authErrorsLineNotConfigured =>
      'El inicio de sesión con LINE no está configurado';

  @override
  String get authErrorsLineFailed => 'No se pudo iniciar sesión con LINE';

  @override
  String get settingsTitle => 'Ajustes';

  @override
  String get settingsLanguageTitle => 'Idioma';

  @override
  String get settingsLanguageDescription =>
      'Elige el idioma de la interfaz y de las notificaciones (Email / LINE).';

  @override
  String get settingsLanguageSaved => 'Preferencia de idioma actualizada';

  @override
  String get settingsAccountTitle => 'Ajustes de la cuenta';

  @override
  String get settingsAccountProfileInfo => 'Información de la cuenta';

  @override
  String get settingsAccountEmail => 'Correo electrónico';

  @override
  String get settingsAccountDisplayName => 'Nombre visible';

  @override
  String get settingsAccountEditDisplayName => 'Editar nombre visible';

  @override
  String get settingsAccountUpdateName => 'Actualizar nombre';

  @override
  String get settingsAccountSaving => 'Guardando...';

  @override
  String get settingsAccountSetLocalPassword => 'Definir contraseña local';

  @override
  String get settingsAccountChangePassword => 'Cambiar contraseña';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      'Esta cuenta usa solo inicio de sesión externo. Al definir una contraseña local, también podrás entrar con correo y contraseña.';

  @override
  String get settingsAccountCurrentPassword => 'Contraseña actual';

  @override
  String get settingsAccountNewPassword => 'Contraseña nueva';

  @override
  String get settingsAccountConfirmNewPassword => 'Confirmar contraseña nueva';

  @override
  String get settingsAccountPasswordPlaceholder =>
      'Mínimo 8 caracteres, con mayúsculas, minúsculas, número y símbolo';

  @override
  String get settingsAccountUpdating => 'Actualizando...';

  @override
  String get settingsAccountSetPassword => 'Definir contraseña';

  @override
  String get settingsAccountUpdatePassword => 'Actualizar contraseña';

  @override
  String get settingsAccountThemeTitle => 'Tema visual';

  @override
  String get settingsAccountThemeSystem => 'Seguir el sistema';

  @override
  String get settingsAccountThemeLight => 'Modo claro';

  @override
  String get settingsAccountThemeDark => 'Modo oscuro';

  @override
  String get settingsAccountDefaultCurrency => 'Moneda predeterminada';

  @override
  String get settingsAccountCurrencyCode => 'Código de moneda';

  @override
  String get settingsAccountUpdateDefaultCurrency =>
      'Actualizar moneda predeterminada';

  @override
  String get settingsAccountPasskeyTitle => 'Gestión de Passkeys';

  @override
  String get settingsAccountNoPasskeys => 'Aún no hay Passkeys registradas';

  @override
  String get settingsAccountAddPasskey => '+ Añadir Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Vinculación con Google';

  @override
  String get settingsAccountLineTitle => 'Vinculación con LINE';

  @override
  String get settingsAccountStatusPrefix => 'Estado actual: ';

  @override
  String get settingsAccountLinkedGoogle => 'Cuenta de Google vinculada';

  @override
  String get settingsAccountNotLinkedGoogle => 'Cuenta de Google no vinculada';

  @override
  String get settingsAccountLinkGoogle => 'Vincular cuenta de Google';

  @override
  String get settingsAccountUnlink => 'Desvincular';

  @override
  String get settingsAccountLinkedLine => 'Cuenta de LINE vinculada';

  @override
  String get settingsAccountNotLinkedLine => 'Cuenta de LINE no vinculada';

  @override
  String get settingsAccountLinkLine => 'Vincular cuenta de LINE';

  @override
  String get settingsAccountLineVerifying => 'Verificando LINE...';

  @override
  String get settingsAccountSessionsTitle => 'Dispositivos con sesión iniciada';

  @override
  String get settingsAccountRefresh => 'Actualizar';

  @override
  String get settingsAccountDeviceName => 'Nombre del dispositivo';

  @override
  String get settingsAccountLoginTime => 'Hora de inicio de sesión';

  @override
  String get settingsAccountLoginIp => 'IP de inicio de sesión';

  @override
  String get settingsAccountActions => 'Acciones';

  @override
  String get settingsAccountUnknownDevice => 'Dispositivo desconocido';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (este dispositivo)';

  @override
  String get settingsAccountSignOut => 'Cerrar sesión';

  @override
  String get settingsAccountNoSessions => 'No hay registros de dispositivos';

  @override
  String get settingsAccountAuditTitle => 'Registro de accesos';

  @override
  String get settingsAccountCountry => 'País';

  @override
  String get settingsAccountMethod => 'Método';

  @override
  String get settingsAccountDevice => 'Dispositivo';

  @override
  String get settingsAccountAdminLogin => 'Acceso de administrador';

  @override
  String get settingsAccountYes => 'Sí';

  @override
  String get settingsAccountNo => 'No';

  @override
  String get settingsAccountDeleteTitle => 'Eliminar cuenta';

  @override
  String get settingsAccountDeleteDescription =>
      'Al eliminar tu cuenta, tus transacciones, cuentas, acciones, Passkeys y ajustes se borrarán de forma permanente.';

  @override
  String get settingsAccountDeleteButton => 'Eliminar mi cuenta';

  @override
  String get settingsAccountDeleteModalTitle =>
      'Confirmar eliminación de cuenta';

  @override
  String get settingsAccountDeleteModalWarning =>
      'Esta acción eliminará permanentemente tu cuenta y todos tus datos. No se puede deshacer.';

  @override
  String get settingsAccountDeletePasswordLabel =>
      'Introduce tu contraseña para confirmar';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return 'Introduce el correo de la cuenta \"$email\" para confirmar';
  }

  @override
  String get settingsAccountDeleting => 'Eliminando...';

  @override
  String get settingsAccountDeletePermanently =>
      'Eliminar cuenta permanentemente';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired =>
      'Introduce tu contraseña actual';

  @override
  String get settingsAccountMessagesNewPasswordRequired =>
      'Introduce una contraseña nueva';

  @override
  String get settingsAccountMessagesPasswordTooShort =>
      'La contraseña nueva debe tener al menos 8 caracteres';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      'La contraseña nueva debe incluir mayúscula, minúscula, número y carácter especial';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      'Las dos contraseñas nuevas no coinciden';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      'Contraseña definida. Ya puedes iniciar sesión con contraseña';

  @override
  String get settingsAccountMessagesPasswordUpdated => 'Contraseña actualizada';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      'No se pudo actualizar la contraseña';

  @override
  String get settingsAccountMessagesDisplayNameRequired =>
      'El nombre visible no puede quedar vacío';

  @override
  String get settingsAccountMessagesDisplayNameUpdated =>
      'Nombre visible actualizado';

  @override
  String get settingsAccountMessagesUpdateFailed => 'No se pudo actualizar';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      '¿Eliminar esta Passkey?';

  @override
  String get settingsAccountMessagesCurrencyInvalid =>
      'La moneda debe ser un código de 3 letras';

  @override
  String get settingsAccountMessagesCurrencyUpdated =>
      'Moneda predeterminada actualizada';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      'No se pudo actualizar la moneda predeterminada';

  @override
  String get settingsAccountMessagesSessionLoggedOut =>
      'Dispositivo desconectado';

  @override
  String get settingsAccountMessagesSessionLogoutFailed =>
      'No se pudo cerrar la sesión del dispositivo';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      'Este navegador no admite Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Dispositivo Android';

  @override
  String get settingsAccountMessagesComputerDevice => 'Computadora';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'No se pudo registrar la Passkey';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      'Pega un Google ID Token para simular la vinculación';

  @override
  String get settingsAccountMessagesGoogleLinked =>
      'Cuenta de Google vinculada';

  @override
  String get settingsAccountMessagesGoogleLinkFailed =>
      'No se pudo vincular la cuenta de Google';

  @override
  String get settingsAccountMessagesGoogleUnlinked =>
      'Cuenta de Google desvinculada';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'No se pudo desvincular la cuenta de Google';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'El inicio de sesión con LINE no está configurado';

  @override
  String get settingsAccountMessagesLineLinkFailed =>
      'No se pudo vincular la cuenta de LINE';

  @override
  String get settingsAccountMessagesLineUnlinked =>
      'Cuenta de LINE desvinculada';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'No se pudo desvincular la cuenta de LINE';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      'Introduce tu contraseña para confirmar la eliminación';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      'Introduce el correo correcto de la cuenta para confirmar la eliminación';

  @override
  String get settingsAccountMessagesDeleteFailed =>
      'No se pudo eliminar la cuenta';

  @override
  String get dashboardTitle => 'Panel';

  @override
  String dashboardSubtitle(Object month) {
    return 'Ingresos, gastos, categorías y transacciones recientes de $month.';
  }

  @override
  String get dashboardUncategorized => 'Sin categoría';

  @override
  String get dashboardKpiTotalIncome => 'Ingresos totales';

  @override
  String get dashboardKpiTotalExpense => 'Gastos totales';

  @override
  String get dashboardKpiNet => 'Neto';

  @override
  String get dashboardKpiTodayExpense => 'Gasto de hoy';

  @override
  String get dashboardKpiBankAccounts => 'Cuentas bancarias';

  @override
  String get dashboardKpiStockMarketValue => 'Valor de mercado de acciones';

  @override
  String get dashboardOverviewTitle => 'Resumen mensual de flujo de caja';

  @override
  String get dashboardOverviewBalance => 'Superávit mensual';

  @override
  String get dashboardOverviewDeficit => 'Déficit mensual';

  @override
  String get dashboardOverviewIncome => 'Ingresos';

  @override
  String get dashboardOverviewExpense => 'Gastos';

  @override
  String get dashboardOverviewNet => 'Neto';

  @override
  String get dashboardRatioTitle => 'Relación ingresos / gastos';

  @override
  String get dashboardRatioIncomeShare => 'Peso de ingresos';

  @override
  String get dashboardRatioExpenseShare => 'Peso de gastos';

  @override
  String get dashboardSectionsExpenseCategories => 'Categorías de gasto';

  @override
  String get dashboardSectionsIncomeCategories => 'Categorías de ingreso';

  @override
  String get dashboardSectionsRecentTransactions => 'Transacciones recientes';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return 'Últimos $count registros';
  }

  @override
  String get dashboardEmptyNoExpense => 'Sin gastos este mes';

  @override
  String get dashboardEmptyNoIncome => 'Sin ingresos este mes';

  @override
  String get dashboardEmptyNoTransactions => 'Sin transacciones este mes';

  @override
  String get dashboardTableDate => 'Fecha';

  @override
  String get dashboardTableCategory => 'Categoría';

  @override
  String get dashboardTableNote => 'Nota';

  @override
  String get dashboardTableAmount => 'Importe';

  @override
  String get dashboardFiltersPreviousMonth => 'Mes anterior';

  @override
  String get dashboardFiltersNextMonth => 'Mes siguiente';

  @override
  String get dashboardFiltersCurrentMonth => 'Este mes';

  @override
  String get publicCommonBackHome => 'Volver al inicio';

  @override
  String get publicCommonPrivacy => 'Política de privacidad';

  @override
  String get publicCommonTerms => 'Términos de servicio';

  @override
  String get publicCommonApiCredits => 'Uso de API y créditos';

  @override
  String publicCommonLastUpdated(Object date) {
    return 'Última actualización: $date';
  }

  @override
  String get publicCommonMetadataTitle =>
      'AssetPilot - Centro de control de finanzas personales';

  @override
  String get publicCommonMetadataDescription =>
      'Gestor financiero personal cifrado y autohospedable para gastos, presupuestos, acciones taiwanesas y análisis.';

  @override
  String get publicCommonDatesApiCredits => '11 de junio de 2026';

  @override
  String get publicCommonDatesPrivacy => '17 de junio de 2026';

  @override
  String get publicCommonDatesTerms => '11 de junio de 2026';

  @override
  String get publicHomeTagline => 'Centro de control de finanzas personales';

  @override
  String get publicHomeLogin => 'Iniciar sesión';

  @override
  String get publicHomeRegister => 'Crear cuenta';

  @override
  String get publicHomeBadge => 'Autohospedado, datos cifrados, AGPL v3';

  @override
  String get publicHomeHeadline1 => 'Tu centro de control financiero';

  @override
  String get publicHomeHeadline2 => 'claro antes de iniciar sesión';

  @override
  String get publicHomeLeadBefore =>
      'Gestiona acciones de Taiwán, ingresos, gastos, presupuestos, informes y auditoría en un solo lugar. Los datos financieros se cifran en reposo con';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      'sin depender de una nube concreta ni de una suscripción, para que entiendas el producto antes de entrar.';

  @override
  String get publicHomeStartUsing => 'Empezar';

  @override
  String get publicHomeCreateFirst => 'Crear una cuenta primero';

  @override
  String get publicHomeChipsOpenSource => 'Código abierto AGPL v3';

  @override
  String get publicHomeChipsEncrypted => 'Almacenamiento local cifrado';

  @override
  String get publicHomeChipsNoCloudLock => 'Sin dependencia de nube externa';

  @override
  String get publicHomeChipsDocker => 'Despliegue Docker con un comando';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => 'Módulos clave';

  @override
  String get publicHomeStatsModulesSublabel =>
      'Registros, acciones, informes y control';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => 'Datos cifrados';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => 'Fuente bursátil';

  @override
  String get publicHomeStatsStockSourceSublabel =>
      'Intradiario, cierre y respaldo';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => 'Cálculo preciso';

  @override
  String get publicHomeStatsPrecisionSublabel => 'P/L por lote con decimal.js';

  @override
  String get publicHomePreLoginNote =>
      'Antes de iniciar sesión puedes revisar las funciones de AssetPilot, cómo trata los datos y cómo se despliega; luego decides si entrar o crear una cuenta.';

  @override
  String get publicHomeWhyLabel => 'Por qué AssetPilot';

  @override
  String get publicHomeWhyTitle =>
      'Registro diario, inversión y control de datos en un solo lugar';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot está pensado para quienes gestionan sus propias finanzas. Centraliza flujo de caja, presupuestos y acciones de Taiwán, sin renunciar a exportación, auditoría ni autohospedaje.';

  @override
  String get publicHomePillarsFinanceTitle =>
      'Gestión de flujo de caja y presupuestos';

  @override
  String get publicHomePillarsFinanceTag => 'Núcleo contable';

  @override
  String get publicHomePillarsFinanceItemsOne =>
      'Seguimiento de saldos en varias cuentas y transferencias internas';

  @override
  String get publicHomePillarsFinanceItemsTwo =>
      'Control de avance mensual y por categoría';

  @override
  String get publicHomePillarsFinanceItemsThree =>
      'Generación automática de ingresos y gastos recurrentes';

  @override
  String get publicHomePillarsFinanceItemsFour =>
      'Cambios por lote de categoría, fecha y eliminación';

  @override
  String get publicHomePillarsStocksTitle =>
      'Seguimiento de acciones de Taiwán';

  @override
  String get publicHomePillarsStocksTag => 'Módulo bursátil';

  @override
  String get publicHomePillarsStocksItemsOne =>
      'Consulta de precios TWSE y sincronización de ex-dividendos';

  @override
  String get publicHomePillarsStocksItemsTwo =>
      'Cálculo FIFO de P/L realizado con precisión completa';

  @override
  String get publicHomePillarsStocksItemsThree =>
      'Registro de dividendos y depósitos en cuenta';

  @override
  String get publicHomePillarsStocksItemsFour =>
      'Inversiones recurrentes y marcas de exclusión de bolsa';

  @override
  String get publicHomePillarsSecurityTitle => 'Seguridad y gobierno de datos';

  @override
  String get publicHomePillarsSecurityTag => 'Gobernanza';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'Cifrado en reposo con ChaCha20-Poly1305';

  @override
  String get publicHomePillarsSecurityItemsTwo =>
      'Inicio de sesión con contraseña, Google y Passkey';

  @override
  String get publicHomePillarsSecurityItemsThree =>
      'Exportación, importación, restauración y bitácoras de auditoría';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'Protección con rate limit, CSP y mitigación de inyección CSV';

  @override
  String get publicHomePillarsSelfHostedTitle => 'Autohospedaje y contratos';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne =>
      'Arranque Docker con un comando';

  @override
  String get publicHomePillarsSelfHostedItemsTwo =>
      'Compatibilidad con amd64 y arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree =>
      'Contrato documentado en OpenAPI 3.2';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      'Rutas URL-first para marcadores y recargas directas';

  @override
  String get publicHomeQuickStartLabel => 'Inicio rápido';

  @override
  String get publicHomeQuickStartTitle =>
      'Corre en tu propio servidor en 60 segundos';

  @override
  String get publicHomeQuickStartDescription =>
      'Arranca rápido con Docker. En la primera ejecución se generan automáticamente las claves JWT y de cifrado de base de datos. Compatible con amd64 y arm64, ideal para NAS, VPS o tu propio host Docker.';

  @override
  String get publicHomeQuickStartChipsImage => 'Imagen de aprox. 180 MB';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => 'Health check integrado';

  @override
  String get publicHomeQuickStartChipsKeys =>
      'Claves generadas en el primer arranque';

  @override
  String get publicHomeTechLabel => 'Stack técnico';

  @override
  String get publicHomeTechTitle => 'Tecnología e información pública';

  @override
  String get publicHomeTechDescription =>
      'Las tecnologías principales, las fuentes externas de datos y la información de licencia están explicadas con claridad para que sepas cómo funciona el servicio antes de usarlo.';

  @override
  String get publicHomeFooter =>
      'GNU AGPL v3. Gestión de patrimonio personal que autohospedas, controlas y respaldas.';

  @override
  String get publicApiCreditsPageTitle => 'Uso de API y créditos';

  @override
  String get publicApiCreditsPageMetadataTitle =>
      'Uso de API y créditos — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => 'Transparencia de API externas';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot solo se conecta a fuentes externas cuando una función lo necesita. Aquí se indican el propósito de cada API, sus notas de licencia y el alcance de los datos enviados para revisar el cumplimiento al autohospedar.';

  @override
  String get publicApiCreditsPageStatsExternalServices => 'Servicios externos';

  @override
  String get publicApiCreditsPageStatsFreeSupported => 'Con plan gratis';

  @override
  String get publicApiCreditsPageStatsAttributionRequired =>
      'Requiere atribución';

  @override
  String get publicApiCreditsPageServiceKindsData => 'Consultas de datos';

  @override
  String get publicApiCreditsPageServiceKindsAuth => 'Autenticación';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Canales de email';

  @override
  String get publicApiCreditsPageServiceKindsBackup => 'Copia en la nube';

  @override
  String get publicApiCreditsPageTransparencyTitle => 'Transparencia de datos';

  @override
  String get publicApiCreditsPageTransparencyText =>
      'Los escenarios siguientes envían solo los datos mínimos necesarios para completar la función y no entregan tus detalles financieros a terceros.';

  @override
  String get publicApiCreditsPageMinNecessary =>
      'Principio de datos mínimos necesarios';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle =>
      'Sincronización de tipos de cambio';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      'Solo se consultan datos públicos de tipos de cambio; no se envían detalles financieros personales.';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle =>
      'Datos de acciones taiwanesas';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      'Solo se envían códigos bursátiles y datos de mercado, no cuentas, costes de posición ni transacciones.';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => 'Auditoría de acceso';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo se usa únicamente para mostrar el país en los registros de acceso.';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle =>
      'Inicio de sesión externo';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google y LINE se activan solo cuando inicias sesión o vinculas una cuenta de forma explícita.';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle =>
      'Copia de seguridad en la nube';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4 recibe el archivo completo de base de datos solo cuando un administrador sube una copia manualmente.';

  @override
  String get publicApiCreditsPageServiceListTitle =>
      'Lista de servicios externos';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return 'Hay $total servicios en total. $free admiten un plan gratuito y $paid ofrecen planes de pago.';
  }

  @override
  String get publicApiCreditsPageOfficialSite => 'Sitio oficial';

  @override
  String get publicApiCreditsPageFreePlan => 'Plan gratuito';

  @override
  String get publicApiCreditsPagePaidPlan => 'Plan de pago';

  @override
  String get publicApiCreditsPageSupported => 'Compatible';

  @override
  String get publicApiCreditsPageUnavailable => 'No disponible';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'Tipos de cambio globales en tiempo real con TWD como moneda base';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'Geolocalización de IP para el campo de país en la auditoría de accesos';

  @override
  String get publicApiCreditsPageDescriptionsTwse =>
      'Cotizaciones en tiempo real, datos ex-dividendo y búsqueda de nombres de acciones';

  @override
  String get publicApiCreditsPageDescriptionsGoogle =>
      'Inicio de sesión SSO con Google';

  @override
  String get publicApiCreditsPageDescriptionsLine =>
      'Inicio de sesión con LINE y vinculación de cuenta';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Canal de envío de email para informes de activos del administrador mediante Gmail, Outlook u otro servidor SMTP';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Canal de envío de email para informes de activos del administrador mediante HTTP REST API';

  @override
  String get publicApiCreditsPageDescriptionsResend =>
      'Canal de envío de email para informes de activos del administrador';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      'Destino de almacenamiento compatible con S3 para copias SQL completas de PostgreSQL del administrador';

  @override
  String get publicAppCallbackReturningTitle =>
      'Volviendo a la app AssetPilot...';

  @override
  String get publicAppCallbackReturningBody =>
      'Si no vuelves automáticamente, confirma que tienes instalada la versión más reciente de AssetPilot para Android.';

  @override
  String get publicAppCallbackPasskeyTitle =>
      'Inicio de sesión con Passkey en AssetPilot';

  @override
  String get publicAppCallbackPasskeyStarting =>
      'Iniciando sesión con Passkey...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      'Este navegador no admite Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'No se pudo crear el desafío de inicio con Passkey';

  @override
  String get publicAppCallbackPasskeyVerify =>
      'Completa la verificación de Passkey en tu dispositivo...';

  @override
  String get publicAppCallbackPasskeyLoginFailed =>
      'No se pudo iniciar sesión con Passkey';

  @override
  String get publicAppCallbackReturningApp => 'Volviendo a la app...';

  @override
  String get publicAppCallbackAppTicketFailed =>
      'No se pudo crear la credencial de inicio para la app';

  @override
  String get featuresCommonActions => 'Acciones';

  @override
  String get featuresCommonAccount => 'Cuenta';

  @override
  String get featuresCommonAmount => 'Importe';

  @override
  String get featuresCommonDate => 'Fecha';

  @override
  String get featuresCommonEndDate => 'Fin';

  @override
  String get featuresCommonNote => 'Nota';

  @override
  String get featuresCommonStartDate => 'Inicio';

  @override
  String get featuresCommonStatus => 'Estado';

  @override
  String get featuresCommonStock => 'Acción';

  @override
  String get featuresCommonType => 'Tipo';

  @override
  String get featuresCommonName => 'Nombre';

  @override
  String get featuresCommonCurrency => 'Moneda';

  @override
  String get featuresCommonExchangeRate => 'Tipo de cambio';

  @override
  String get featuresCommonIncome => 'Ingreso';

  @override
  String get featuresCommonExpense => 'Gasto';

  @override
  String get featuresCommonUncategorized => 'Sin categoría';

  @override
  String get featuresCommonUnspecified => 'Sin especificar';

  @override
  String get featuresCommonAutoCalculate => 'Calcular automáticamente';

  @override
  String get featuresCommonExcludeFromStats => 'Excluir de estadísticas';

  @override
  String get featuresCommonTopLevelCategory => '- Categoría principal -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => 'Gestión de categorías';

  @override
  String get featuresCategoriesExpenseTab => 'Categorías de gasto';

  @override
  String get featuresCategoriesIncomeTab => 'Categorías de ingreso';

  @override
  String get featuresCategoriesAddCategory => 'Añadir categoría';

  @override
  String get featuresCategoriesEditCategory => 'Editar categoría';

  @override
  String get featuresCategoriesNewCategory => 'Añadir categoría';

  @override
  String get featuresCategoriesNameLabel => 'Nombre *';

  @override
  String get featuresCategoriesTypeLabel => 'Tipo';

  @override
  String get featuresCategoriesParentLabel => 'Categoría superior';

  @override
  String get featuresCategoriesColorLabel => 'Color';

  @override
  String get featuresCategoriesExpense => 'Gasto';

  @override
  String get featuresCategoriesIncome => 'Ingreso';

  @override
  String get featuresCategoriesDeleteMessage =>
      '¿Eliminar esta categoría? También se eliminarán sus subcategorías.';

  @override
  String get featuresCategoriesMessagesNameRequired =>
      'Introduce el nombre de la categoría';

  @override
  String get featuresCategoriesMessagesDeleteFailed => 'No se pudo eliminar';

  @override
  String get featuresBudgetTitle => 'Presupuestos';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$month/$year';
  }

  @override
  String get featuresBudgetTotalBudget => 'Presupuesto total del mes';

  @override
  String get featuresBudgetSpent => 'Gastado';

  @override
  String get featuresBudgetAddBudget => 'Añadir presupuesto';

  @override
  String get featuresBudgetEditBudget => 'Editar presupuesto';

  @override
  String get featuresBudgetNewBudget => 'Añadir presupuesto';

  @override
  String get featuresBudgetCategoryLabel =>
      'Categoría (vacío para presupuesto total)';

  @override
  String get featuresBudgetTotalBudgetOption => '- Presupuesto total -';

  @override
  String get featuresBudgetAmountLabel => 'Importe del presupuesto *';

  @override
  String get featuresBudgetTotalBudgetName => '(Presupuesto total)';

  @override
  String get featuresBudgetOverBudget => 'Sobre presupuesto';

  @override
  String get featuresBudgetDeleteMessage => '¿Eliminar este presupuesto?';

  @override
  String get featuresBudgetMessagesAmountRequired =>
      'Introduce un importe de presupuesto válido';

  @override
  String get featuresReportsTitle => 'Informes';

  @override
  String get featuresReportsTabsCategory => 'Desglose por categoría';

  @override
  String get featuresReportsTabsTrend => 'Análisis de tendencia';

  @override
  String get featuresReportsTabsDaily => 'Gasto diario';

  @override
  String get featuresReportsPeriodsThisMonth => 'Este mes';

  @override
  String get featuresReportsPeriodsLastMonth => 'Mes pasado';

  @override
  String get featuresReportsPeriodsLast3 => 'Últimos 3 meses';

  @override
  String get featuresReportsPeriodsLast6 => 'Últimos 6 meses';

  @override
  String get featuresReportsPeriodsThisYear => 'Este año';

  @override
  String get featuresReportsPeriodsCustom => 'Personalizado';

  @override
  String get featuresReportsPeriodLabel => 'Periodo';

  @override
  String get featuresReportsStart => 'Inicio';

  @override
  String get featuresReportsEnd => 'Fin';

  @override
  String get featuresReportsCurrentTotal => 'Total actual';

  @override
  String get featuresReportsComparedPrevious =>
      'Comparado con el periodo anterior';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta; el periodo anterior no tiene datos';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return 'Detalle de $type';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return 'Total: $amount';
  }

  @override
  String get featuresReportsSelectedCategory => 'Categoría seleccionada: ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return ', importe $amount';
  }

  @override
  String get featuresReportsViewTransactions =>
      'Ver transacciones relacionadas';

  @override
  String get featuresRecurringTitle => 'Transacciones recurrentes';

  @override
  String get featuresRecurringAdd => 'Añadir recurrente';

  @override
  String get featuresRecurringEdit => 'Editar recurrente';

  @override
  String get featuresRecurringCreate => 'Añadir recurrente';

  @override
  String get featuresRecurringAmountLabel => 'Importe *';

  @override
  String get featuresRecurringFxFeeLabel => 'Comisión extranjera (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder =>
      'En blanco: el sistema la calcula según la comisión de la tarjeta';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return 'Comisión extranjera de la tarjeta $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return ', valor sugerido NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading =>
      'Consultando el tipo de cambio más reciente...';

  @override
  String get featuresRecurringCategory => 'Categoría';

  @override
  String get featuresRecurringFrequency => 'Frecuencia';

  @override
  String get featuresRecurringStartDate => 'Fecha de inicio';

  @override
  String featuresRecurringNextRun(Object date) {
    return 'Próxima ejecución: $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return 'Categoría: $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return 'Cuenta: $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return 'Comisión extranjera: NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage =>
      '¿Eliminar esta transacción recurrente?';

  @override
  String get featuresRecurringCreatingTransfer => 'Creando...';

  @override
  String get featuresRecurringConfirmTransfer => 'Confirmar transferencia';

  @override
  String get featuresRecurringFrequencyLabelsDaily => 'Diaria';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => 'Semanal';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => 'Mensual';

  @override
  String get featuresRecurringFrequencyLabelsYearly => 'Anual';

  @override
  String get featuresRecurringMessagesAmountRequired =>
      'Introduce un importe válido';

  @override
  String get featuresDataTransferTitle => 'Exportar e importar datos';

  @override
  String get featuresDataTransferExportStartDate =>
      'Fecha inicial de exportación';

  @override
  String get featuresDataTransferExportEndDate => 'Fecha final de exportación';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'CSV compatible para exportar e importar. Columnas: $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'Exportar CSV';

  @override
  String get featuresDataTransferExporting => 'Exportando...';

  @override
  String get featuresDataTransferChooseCsv => 'Elegir CSV para importar';

  @override
  String get featuresDataTransferImporting => 'Importando...';

  @override
  String featuresDataTransferImported(Object count) {
    return 'Importación correcta: $count registros';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return 'Omitidos: $count registros';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return 'Categorías creadas automáticamente: $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return 'Cuentas creadas automáticamente: $items';
  }

  @override
  String get featuresDataTransferWarning => 'Advertencia';

  @override
  String get featuresDataTransferError => 'Error';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return 'Fila $row: $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => 'Cuentas';

  @override
  String get featuresDataTransferModulesTransactions => 'Transacciones';

  @override
  String get featuresDataTransferModulesCategories => 'Categorías';

  @override
  String get featuresDataTransferModulesStockTransactions =>
      'Transacciones de acciones';

  @override
  String get featuresDataTransferModulesStockDividends => 'Dividendos';

  @override
  String get featuresDataTransferMessagesExportSuccess =>
      'Exportación completada';

  @override
  String get featuresDataTransferMessagesExportFailed => 'No se pudo exportar';

  @override
  String get featuresDataTransferMessagesEmptyCsv =>
      'El CSV no contiene datos importables';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return 'Importación de $name completada';
  }

  @override
  String get featuresDataTransferMessagesImportFailed => 'No se pudo importar';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      'Copia completa descargada';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      'No se pudo descargar la copia completa';

  @override
  String get featuresDataTransferMessagesRestoreDone =>
      'Restauración completada';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      'No se pudo restaurar la copia';

  @override
  String get featuresDataTransferMessagesDbExportDone =>
      'Copia de base de datos descargada';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      'No se pudo hacer la copia de base de datos';

  @override
  String get featuresDataTransferMessagesDbRestoreDone =>
      'Base de datos restaurada';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      'No se pudo restaurar la base de datos';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return 'Subido a $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed =>
      'Falló la copia en MEGA S4';

  @override
  String get featuresDataTransferMessagesRequireOneField =>
      'Completa al menos un campo';

  @override
  String get featuresDataTransferMessagesSaved => 'Ajustes guardados';

  @override
  String get featuresDataTransferMessagesSaveFailed =>
      'No se pudieron guardar los ajustes';

  @override
  String get featuresDataTransferBundleTitle =>
      'Copia completa de datos (incluye imágenes)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      'Descarga en un solo ZIP todos tus datos personales: transacciones, cuentas, categorías, presupuestos, ciclos, tipos de cambio, acciones e imágenes de comprobantes.';

  @override
  String get featuresDataTransferBundleDescription2 =>
      'Sube ese mismo ZIP para restaurar.';

  @override
  String get featuresDataTransferBundleRestorePrefix => 'La restauración usa';

  @override
  String get featuresDataTransferBundleMergeMode => 'modo de combinación';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      ': los datos existentes se omiten automáticamente y solo se completan los faltantes;';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      'no se eliminan ni sobrescriben tus datos actuales';

  @override
  String get featuresDataTransferBundleDownload => 'Descargar copia completa';

  @override
  String get featuresDataTransferBundleDownloading =>
      'Empaquetando descarga...';

  @override
  String get featuresDataTransferBundleRestore => 'Subir copia para restaurar';

  @override
  String get featuresDataTransferBundleRestoring => 'Restaurando...';

  @override
  String get featuresDataTransferDatabaseTitle =>
      'Copia / restauración completa de base de datos';

  @override
  String get featuresDataTransferDatabaseDescription =>
      'Solo administradores. En modo SQLite se descarga una copia `.db`; en PostgreSQL, una copia `.sql`. Para restaurar, sube el formato correspondiente.';

  @override
  String get featuresDataTransferDatabaseDownload =>
      'Descargar copia de base de datos';

  @override
  String get featuresDataTransferDatabaseDownloading => 'Descargando...';

  @override
  String get featuresDataTransferDatabaseRestore =>
      'Elegir copia para restaurar';

  @override
  String get featuresDataTransferDatabaseRestoring => 'Restaurando...';

  @override
  String get featuresDataTransferMegaTitle => 'Copia en la nube MEGA S4';

  @override
  String get featuresDataTransferMegaDescription =>
      'Sube la copia completa actual de SQLite como objeto a un bucket de MEGA S4. La conexión se define con variables de entorno del servidor; las claves no se introducen ni se muestran en el navegador.';

  @override
  String get featuresDataTransferMegaState => 'Estado: ';

  @override
  String get featuresDataTransferMegaConfigured => 'Configurado';

  @override
  String get featuresDataTransferMegaNotConfigured =>
      'Configuración incompleta';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket: ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return 'Variables de entorno faltantes: $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'Subir copia a MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => 'Subiendo...';

  @override
  String get featuresDataTransferMegaConfigure => 'Configurar';

  @override
  String get featuresDataTransferMegaCancelConfigure =>
      'Cancelar configuración';

  @override
  String get featuresDataTransferMegaFormHelp =>
      'La configuración se guarda en un archivo persistente del servidor y entra en vigor de inmediato. Vuelve a introducir las claves; no se rellenan automáticamente.';

  @override
  String get featuresDataTransferMegaBucketName => 'Nombre del bucket';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefijo (opcional)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (opcional; vacío para calcularlo automáticamente)';

  @override
  String get featuresDataTransferMegaSaveSettings => 'Guardar ajustes';

  @override
  String get featuresAccountsTitle => 'Cuentas';

  @override
  String get featuresAccountsTypeLabelsBank => 'Cuenta bancaria';

  @override
  String get featuresAccountsTypeLabelsCredit_card => 'Tarjeta de crédito';

  @override
  String get featuresAccountsTypeLabelsCash => 'Efectivo';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => 'Monedero digital';

  @override
  String get featuresAccountsTypeLabelsOther => 'Otra';

  @override
  String get featuresAccountsTotalAssets => 'Activos totales';

  @override
  String get featuresAccountsCreditOutstanding => 'Saldo pendiente de tarjeta';

  @override
  String get featuresAccountsAddAccount => 'Añadir cuenta';

  @override
  String get featuresAccountsEditAccount => 'Editar cuenta';

  @override
  String get featuresAccountsNewAccount => 'Añadir cuenta';

  @override
  String get featuresAccountsAccountName => 'Nombre de la cuenta *';

  @override
  String get featuresAccountsInitialBalance => 'Saldo inicial';

  @override
  String get featuresAccountsInitialBalanceEdit =>
      'Saldo inicial / ajuste actual';

  @override
  String get featuresAccountsLinkedBank => 'Banco';

  @override
  String get featuresAccountsUngrouped => 'Sin agrupar';

  @override
  String get featuresAccountsOverseasFeeRate => 'Comisión extranjera (%)';

  @override
  String get featuresAccountsStatementClosingDay => 'Día de cierre (1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      'Ejemplo: 15. En blanco no calcula el gasto del ciclo actual.';

  @override
  String get featuresAccountsExcludeFromTotal => 'Excluir del patrimonio total';

  @override
  String get featuresAccountsOtherAccounts => 'Otras cuentas';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return 'Total convertido: $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return 'Banco vinculado: $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return 'Comisión extranjera: $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return 'Día de cierre mensual: $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return 'Gasto del ciclo actual: $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => 'Estado anterior: ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return 'Gasto $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return 'Pagado $amount';
  }

  @override
  String get featuresAccountsViewCycles => 'Ver detalle por ciclo ›';

  @override
  String get featuresAccountsRepaymentTitle => 'Pago de tarjeta de crédito';

  @override
  String get featuresAccountsRepaymentPaymentAccount => 'Cuenta de pago';

  @override
  String get featuresAccountsRepaymentPaymentDate => 'Fecha de pago';

  @override
  String get featuresAccountsRepaymentNoLinkedCards =>
      'Esta cuenta pagadora no tiene tarjetas de crédito para pago; confirme que la tarjeta tenga un banco vinculado y que sea esta cuenta pagadora';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return 'Saldo actual: $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => 'Importe del pago';

  @override
  String get featuresAccountsRepaymentConfirm => 'Confirmar pago';

  @override
  String get featuresAccountsRepaymentTotalAmount => 'Monto total de pago';

  @override
  String get featuresAccountsRepaymentTotalAmountHint =>
      'Ingrese un número entero en la moneda de la cuenta pagadora; el sistema asigna proporcionalmente según la deuda de cada tarjeta';

  @override
  String featuresAccountsRepaymentTotalDebt(Object amount) {
    return 'Total a pagar: $amount';
  }

  @override
  String get featuresAccountsRepaymentAllocationPreviewTitle =>
      'Vista previa de asignación';

  @override
  String get featuresAccountsRepaymentColCard => 'Tarjeta';

  @override
  String get featuresAccountsRepaymentColAllocated => 'Asignado';

  @override
  String get featuresAccountsRepaymentColBalanceAfter => 'Saldo después';

  @override
  String get featuresAccountsRepaymentPrepaidBadge => 'Prepagado';

  @override
  String featuresAccountsRepaymentPrepaidAmount(Object amount) {
    return 'Prepagado $amount';
  }

  @override
  String get featuresAccountsRepaymentResultTitle => 'Pago completado';

  @override
  String get featuresAccountsRepaymentResultDone => 'Listo';

  @override
  String get featuresAccountsDeleteMessage => '¿Eliminar esta cuenta?';

  @override
  String get featuresAccountsCyclesTitle => 'Detalle de ciclos de estado';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name día de cierre mensual $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      'Los pagos se asignan al estado que liquidan. Los importes pagados después del cierre cuentan para ese ciclo.';

  @override
  String get featuresAccountsCyclesPeriod => 'Periodo';

  @override
  String get featuresAccountsCyclesSpending => 'Gasto';

  @override
  String get featuresAccountsCyclesPayment => 'Pago real';

  @override
  String get featuresAccountsCyclesCurrent => 'Actual';

  @override
  String get featuresAccountsFxTitle => 'Gestión de tipos de cambio';

  @override
  String get featuresAccountsFxAutoUpdate => 'Actualizar tipos automáticamente';

  @override
  String get featuresAccountsFxSyncNow => 'Sincronizar ahora';

  @override
  String get featuresAccountsFxSyncing => 'Sincronizando...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return 'Última sincronización: $date';
  }

  @override
  String get featuresAccountsFxCurrency => 'Moneda';

  @override
  String get featuresAccountsFxUnitToTwd => '1 unidad = TWD';

  @override
  String get featuresAccountsFxEmpty =>
      'Aún no hay tipos de cambio configurados';

  @override
  String get featuresAccountsFxCurrencyLabel => 'Moneda (p. ej., USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'Tipo frente a TWD';

  @override
  String get featuresAccountsFxAddOrUpdate => 'Añadir / actualizar';

  @override
  String get featuresAccountsMessagesNameRequired =>
      'Introduce el nombre de la cuenta';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired =>
      'Selecciona la cuenta de pago';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      'Introduce el pago de al menos una tarjeta';

  @override
  String get featuresAccountsMessagesRepaymentTotalAmountInvalid =>
      'El monto total de pago debe ser un número entero mayor que 0';

  @override
  String featuresAccountsMessagesRepaymentTotalAmountTooSmall(Object min) {
    return 'Monto demasiado pequeño; se necesita al menos $min para que cada tarjeta reciba una asignación';
  }

  @override
  String get featuresAccountsMessagesCurrencyInvalid =>
      'La moneda debe ser un código de 3 letras';

  @override
  String get featuresAccountsMessagesRateInvalid =>
      'Introduce un tipo de cambio válido';

  @override
  String get featuresAccountsMessagesSaved => 'Guardado';

  @override
  String get featuresAccountsMessagesSaveFailed => 'No se pudo guardar';

  @override
  String get featuresAccountsMessagesDeleteFailed => 'No se pudo eliminar';

  @override
  String get featuresAccountsMessagesRatesUpdated =>
      'Tipos de cambio actualizados';

  @override
  String get featuresAccountsMessagesSyncFailed => 'No se pudo sincronizar';

  @override
  String get featuresAccountsMessagesLoadFailed => 'No se pudo cargar';

  @override
  String get featuresTransactionsTitle => 'Transacciones';

  @override
  String get featuresTransactionsSearchPlaceholder => 'Buscar en notas...';

  @override
  String get featuresTransactionsAllTypes => 'Todos los tipos';

  @override
  String get featuresTransactionsAllAccounts => 'Todas las cuentas';

  @override
  String get featuresTransactionsAllCategories => 'Todas las categorías';

  @override
  String get featuresTransactionsTransfer => 'Transferencia';

  @override
  String get featuresTransactionsFuture => 'Transacciones futuras';

  @override
  String get featuresTransactionsExcludeTransfer => 'Excluir transferencias';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (todo)';
  }

  @override
  String get featuresTransactionsStartDateTitle => 'Fecha inicial';

  @override
  String get featuresTransactionsEndDateTitle => 'Fecha final';

  @override
  String get featuresTransactionsAdd => 'Añadir transacción';

  @override
  String get featuresTransactionsEdit => 'Editar transacción';

  @override
  String get featuresTransactionsCreate => 'Añadir transacción';

  @override
  String get featuresTransactionsAccountTransfer =>
      'Transferencia entre cuentas';

  @override
  String get featuresTransactionsBatchCategory => 'Cambiar categoría por lote';

  @override
  String get featuresTransactionsBatchDate => 'Cambiar fecha por lote';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return 'Eliminar seleccionadas ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => 'Ingresos de la página';

  @override
  String get featuresTransactionsPageExpense => 'Gastos de la página';

  @override
  String get featuresTransactionsPageTotal => 'Total de la página';

  @override
  String get featuresTransactionsPageSummaryAria =>
      'Resumen de transacciones de la página';

  @override
  String get featuresTransactionsEmpty => 'No hay transacciones coincidentes';

  @override
  String featuresTransactionsSource(Object name) {
    return 'Origen: $name';
  }

  @override
  String get featuresTransactionsFxFee => 'Comisión por compra extranjera';

  @override
  String get featuresTransactionsAiCreated => 'Creado por IA';

  @override
  String get featuresTransactionsNoteAiModified => 'Nota editada por IA';

  @override
  String get featuresTransactionsRestoreCreated => 'Deshacer creación';

  @override
  String get featuresTransactionsRestoreNote => 'Restaurar nota';

  @override
  String get featuresTransactionsViewRepaymentAllocation =>
      'Ver asignación de pago';

  @override
  String get featuresTransactionsRepaymentSummaryTitle =>
      'Resumen de asignación de pago';

  @override
  String get featuresTransactionsRepaymentSummaryTotal =>
      'Monto total ingresado';

  @override
  String get featuresTransactionsRepaymentSummaryStale =>
      'Este resumen ya no coincide con el estado actual';

  @override
  String get featuresTransactionsRepaymentSummaryStatusIntact => 'Consistente';

  @override
  String get featuresTransactionsRepaymentSummaryStatusModified => 'Modificado';

  @override
  String get featuresTransactionsRepaymentSummaryStatusDeleted => 'Eliminado';

  @override
  String get featuresTransactionsRestoreCreatedTitle =>
      'Restaurar transacción creada por IA';

  @override
  String get featuresTransactionsRestoreCreatedMessage =>
      'Restaurar eliminará esta transacción, incluida cualquier transferencia vinculada o transacción de comisión, y no se puede deshacer. ¿Continuar?';

  @override
  String get featuresTransactionsRestoreNoteTitle => 'Restaurar nota';

  @override
  String get featuresTransactionsRestoreNoteConfirmMessage =>
      'Restaurar revertirá la nota a su contenido antes de la edición de la IA y no se puede deshacer. ¿Continuar?';

  @override
  String get featuresTransactionsRestoreNoteCurrentLabel => 'Nota actual';

  @override
  String get featuresTransactionsRestoreNotePreviewLabel =>
      'Nota después de restaurar';

  @override
  String get featuresTransactionsPhotoOne => 'Foto 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count fotos';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => 'Fecha *';

  @override
  String get featuresTransactionsAmountRequiredLabel => 'Importe *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return 'Tipo de cambio (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder =>
      'En blanco usa el tipo del sistema';

  @override
  String get featuresTransactionsLatestRateLoading =>
      'Consultando el último tipo de cambio...';

  @override
  String get featuresTransactionsFxFeePlaceholder =>
      'En blanco el sistema calcula según la comisión de la tarjeta';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return 'Comisión extranjera de tarjeta $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return ', sugerido NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => 'Fotos';

  @override
  String get featuresTransactionsLoadingPhotos => 'Cargando fotos...';

  @override
  String get featuresTransactionsTakePhoto => 'Tomar foto';

  @override
  String get featuresTransactionsChooseImage => 'Elegir imagen';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return 'En móvil puedes tomar una foto o elegirla de la galería. Hasta 5 imágenes, $maxMb MB cada una.';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return 'Fotos nuevas $count';
  }

  @override
  String get featuresTransactionsRemove => 'Quitar';

  @override
  String get featuresTransactionsChoosePhoto => 'Elegir foto';

  @override
  String get featuresTransactionsTransferOut => 'Cuenta origen *';

  @override
  String get featuresTransactionsTransferIn => 'Cuenta destino *';

  @override
  String get featuresTransactionsSelectPlaceholder => 'Seleccionar';

  @override
  String get featuresTransactionsCreating => 'Creando...';

  @override
  String get featuresTransactionsConfirmTransfer => 'Confirmar transferencia';

  @override
  String get featuresTransactionsBatchCategoryTitle =>
      'Cambiar categoría por lote';

  @override
  String get featuresTransactionsBatchDateTitle => 'Cambiar fecha por lote';

  @override
  String get featuresTransactionsNewCategory => 'Categoría nueva';

  @override
  String get featuresTransactionsNewDate => 'Fecha nueva';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return 'Aplicar a $count registros';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      '¿Eliminar esta transacción? Esta acción no se puede deshacer.';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return '¿Eliminar las $count transacciones seleccionadas?';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return 'Transacción actualizada, pero $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return 'Transacción creada, pero $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      'Las transferencias se eliminan y se vuelven a crear';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      'La comisión extranjera se genera automáticamente. Edita la transacción en moneda extranjera relacionada; la comisión se sincronizará después.';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed =>
      'No se pudo subir la foto';

  @override
  String get featuresTransactionsMessagesDateRequired => 'Selecciona una fecha';

  @override
  String get featuresTransactionsMessagesAmountRequired =>
      'Introduce un importe válido';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      'Selecciona la cuenta origen y la cuenta destino';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      'La cuenta origen y destino no pueden ser la misma';

  @override
  String get featuresTransactionsTypeLabelsIncome => 'Ingreso';

  @override
  String get featuresTransactionsTypeLabelsExpense => 'Gasto';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in =>
      'Transferencia recibida';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out =>
      'Transferencia enviada';

  @override
  String get featuresStocksTabsPortfolio => 'Cartera';

  @override
  String get featuresStocksTabsTransactions => 'Transacciones';

  @override
  String get featuresStocksTabsDividends => 'Dividendos';

  @override
  String get featuresStocksTabsRealized => 'Gan./pérd. realizada';

  @override
  String get featuresStocksTabsSettings => 'Ajustes de trading';

  @override
  String get featuresStocksCommonStockLabel => 'Acción';

  @override
  String get featuresStocksCommonStockRequired => 'Acción *';

  @override
  String get featuresStocksCommonStockTypeStock => 'Acción';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => 'Warrant';

  @override
  String get featuresStocksCommonDate => 'Fecha';

  @override
  String get featuresStocksCommonShares => 'Acciones';

  @override
  String get featuresStocksCommonPrice => 'Precio';

  @override
  String get featuresStocksCommonTotal => 'Total';

  @override
  String get featuresStocksCommonReturnRate => 'Rentabilidad';

  @override
  String get featuresStocksCommonOverallReturnRate => 'Rentabilidad total';

  @override
  String get featuresStocksCommonEstimatedPL => 'Gan./pérd. estimada';

  @override
  String get featuresStocksCommonRealizedPL => 'Gan./pérd. realizada';

  @override
  String get featuresStocksCommonTotalRealizedPL =>
      'Gan./pérd. realizada total';

  @override
  String get featuresStocksCommonYearRealizedPL =>
      'Gan./pérd. realizada del año';

  @override
  String get featuresStocksCommonRealizedCount => 'Registros realizados';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count registros';
  }

  @override
  String get featuresStocksCommonSellAverage => 'Precio medio de venta';

  @override
  String get featuresStocksCommonCostAverage => 'Coste medio';

  @override
  String get featuresStocksCommonFeeAndTax => 'Comisión + impuesto';

  @override
  String get featuresStocksCommonCashDividend => 'Dividendo en efectivo';

  @override
  String get featuresStocksCommonStockDividend => 'Dividendo en acciones';

  @override
  String get featuresStocksCommonStockSymbol => 'Código bursátil *';

  @override
  String get featuresStocksCommonStockName => 'Nombre de acción';

  @override
  String get featuresStocksCommonSearching => 'Buscando...';

  @override
  String get featuresStocksCommonCancelAccounting =>
      '- No depositar (solo dividendo en acciones) -';

  @override
  String get featuresStocksCommonAutoCalculate => 'Calcular automáticamente';

  @override
  String get featuresStocksCommonBuy => 'Comprar';

  @override
  String get featuresStocksCommonSell => 'Vender';

  @override
  String get featuresStocksPortfolioTitle => 'Cartera';

  @override
  String get featuresStocksPortfolioTotalMarketValue =>
      'Valor total de mercado';

  @override
  String get featuresStocksPortfolioTotalCost => 'Coste invertido total';

  @override
  String get featuresStocksPortfolioTotalDividend => 'Dividendos totales';

  @override
  String get featuresStocksPortfolioAddStock => 'Añadir acción';

  @override
  String get featuresStocksPortfolioEditStock => 'Editar acción';

  @override
  String get featuresStocksPortfolioNewStock => 'Añadir acción';

  @override
  String get featuresStocksPortfolioUpdatePrices => 'Actualizar precios';

  @override
  String get featuresStocksPortfolioBatchUpdate =>
      'Actualización automática por lote';

  @override
  String get featuresStocksPortfolioUpdating => 'Actualizando...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'AssetPilot consulta primero la API pública de TWSE desde tu navegador. Si el navegador bloquea la solicitud, usa el proxy de API del usuario autenticado y actualiza tus posiciones.';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return 'Actualización completada: $updated correctas.';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return 'Actualización completada: $updated correctas, $failed fallidas.';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      'No se pudieron obtener datos de TWSE desde el navegador';

  @override
  String get featuresStocksPortfolioHeldShares => 'Acciones mantenidas';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count acciones';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => 'Precio actual';

  @override
  String get featuresStocksPortfolioMarketValue => 'Valor de mercado';

  @override
  String featuresStocksPortfolioDividendMonths(Object months) {
    return 'Meses de dividendo: $months';
  }

  @override
  String get featuresStocksPortfolioDividendMonthsEmpty =>
      'Aún no hay historial de dividendos';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired =>
      'Introduce el código bursátil';

  @override
  String get featuresStocksTransactionsTitle => 'Transacciones de acciones';

  @override
  String get featuresStocksTransactionsAddTransaction => 'Añadir transacción';

  @override
  String get featuresStocksTransactionsEditTransaction => 'Editar transacción';

  @override
  String get featuresStocksTransactionsNewTransaction => 'Añadir transacción';

  @override
  String get featuresStocksTransactionsTypeLabel => 'Tipo';

  @override
  String get featuresStocksTransactionsDateLabel => 'Fecha *';

  @override
  String get featuresStocksTransactionsSharesLabel => 'Acciones *';

  @override
  String get featuresStocksTransactionsPriceLabel => 'Precio unitario *';

  @override
  String get featuresStocksTransactionsFeeLabel => 'Comisión';

  @override
  String get featuresStocksTransactionsTaxLabel => 'Impuesto de transacción';

  @override
  String get featuresStocksTransactionsDeleteMessage =>
      '¿Eliminar esta transacción?';

  @override
  String get featuresStocksTransactionsMessagesStockRequired =>
      'Selecciona una acción';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      'Introduce una cantidad válida de acciones';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired =>
      'Introduce un precio válido';

  @override
  String get featuresStocksDividendsTitle => 'Dividendos';

  @override
  String get featuresStocksDividendsAddDividend => 'Añadir dividendo';

  @override
  String get featuresStocksDividendsEditDividend => 'Editar dividendo';

  @override
  String get featuresStocksDividendsNewDividend => 'Añadir dividendo';

  @override
  String get featuresStocksDividendsSyncExDividends =>
      'Sincronizar ex-dividendos';

  @override
  String get featuresStocksDividendsSyncDescription =>
      'Sincroniza automáticamente datos históricos de ex-dividendos desde TWSE según tus posiciones.';

  @override
  String get featuresStocksDividendsSyncStart => 'Iniciar sincronización';

  @override
  String get featuresStocksDividendsSyncing => 'Sincronizando...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return 'Añadidos $synced, omitidos $skipped.';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return 'Añadidos $synced, omitidos $skipped, fallidos $failed.';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel =>
      'Dividendo en efectivo (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel =>
      'Dividendo en acciones';

  @override
  String get featuresStocksDividendsDepositAccount => 'Cuenta de depósito';

  @override
  String get featuresStocksDividendsDeleteMessage =>
      '¿Eliminar este dividendo?';

  @override
  String get featuresStocksDividendsMessagesStockRequired =>
      'Selecciona una acción';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      'Introduce dividendo en efectivo o en acciones';

  @override
  String get featuresStocksRealizedTitle => 'Gan./pérd. realizada';

  @override
  String get featuresStocksSettingsTitle => 'Ajustes de trading';

  @override
  String get featuresStocksSettingsFeeTitle => 'Comisiones / impuestos';

  @override
  String get featuresStocksSettingsFeeRate => 'Tasa de comisión';

  @override
  String get featuresStocksSettingsFeeDiscount => 'Descuento (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot =>
      'Comisión mínima (lote completo)';

  @override
  String get featuresStocksSettingsFeeMinOdd => 'Comisión mínima (lote impar)';

  @override
  String get featuresStocksSettingsSellTaxRateStock =>
      'Impuesto de venta (acción)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => 'Impuesto de venta (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant =>
      'Impuesto de venta (warrant)';

  @override
  String get featuresStocksSettingsSellTaxMin =>
      'Impuesto mínimo de transacción';

  @override
  String get featuresStocksSettingsSaveSettings => 'Guardar ajustes';

  @override
  String get featuresStocksSettingsStockStatusTitle => 'Estado de acciones';

  @override
  String get featuresStocksSettingsCurrentPrice => 'Precio actual';

  @override
  String get featuresStocksSettingsNormalTracking => 'En seguimiento';

  @override
  String get featuresStocksSettingsDelisted => 'Retirada de bolsa';

  @override
  String get featuresStocksSettingsRestoreTracking => 'Restaurar seguimiento';

  @override
  String get featuresStocksSettingsMarkDelisted => 'Marcar como retirada';

  @override
  String get featuresStocksSettingsRecurringTitle =>
      'Inversión recurrente en acciones';

  @override
  String get featuresStocksSettingsAddRecurringShort => 'Añadir';

  @override
  String get featuresStocksSettingsEditRecurring =>
      'Editar inversión recurrente';

  @override
  String get featuresStocksSettingsNewRecurring =>
      'Añadir inversión recurrente';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => 'Importe (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => 'Frecuencia';

  @override
  String get featuresStocksSettingsStartDate => 'Fecha de inicio';

  @override
  String get featuresStocksSettingsLastGenerated => 'Última generación';

  @override
  String get featuresStocksSettingsActive => 'Activa';

  @override
  String get featuresStocksSettingsInactive => 'Inactiva';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm =>
      '¿Eliminar esta inversión recurrente?';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => 'Diario';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => 'Semanal';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => 'Mensual';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => 'Anual';

  @override
  String get featuresStocksSettingsMessagesSaved => 'Ajustes guardados';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return 'No se pudo guardar: $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired =>
      'Selecciona una acción';

  @override
  String get featuresStocksSettingsMessagesAmountRequired =>
      'Introduce un importe válido';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol se actualizó: $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus =>
      'restaurada a seguimiento normal';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus =>
      'marcada como retirada de bolsa';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      'No se pudo actualizar el estado de retirada';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => 'Informe diario de flujo de caja';

  @override
  String get notificationsReportTypeWeekly =>
      'Informe semanal de flujo de caja';

  @override
  String get notificationsReportTypeMonthly =>
      'Informe mensual de flujo de caja';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return 'Informe diario de flujo de caja｜$date ($weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return 'Informe semanal de flujo de caja｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return 'Informe mensual de flujo de caja｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name, flujo de caja de $date ($weekday)';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name, flujo de caja de $start ~ $end';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name, flujo de caja de $month';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 Fecha del informe $date　·　Enviado $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 Periodo del informe $start ~ $end　·　Enviado $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 Mes del informe $month　·　Enviado $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return 'Resumen de todo ayer ($date, $weekday); enviado hoy ($sendDate)';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return 'Resumen de los últimos 7 días ($start ~ $end); enviado hoy ($sendDate)';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return 'Resumen del mes pasado ($month, $start ~ $end); enviado este mes ($sendDate)';
  }

  @override
  String get notificationsLeadDaily => 'Ayer';

  @override
  String get notificationsLeadWeekly => 'Esta semana';

  @override
  String get notificationsLeadMonthly => 'El mes pasado';

  @override
  String notificationsKpiIncome(Object lead) {
    return 'Ingresos de $lead';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return 'Gastos de $lead';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return 'Neto de $lead';
  }

  @override
  String get notificationsCompareLabelDaily => 'vs. día anterior';

  @override
  String get notificationsCompareLabelWeekly => 'vs. semana anterior';

  @override
  String get notificationsCompareLabelMonthly => 'vs. mes anterior';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return 'ayer ($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return 'últimos 7 días ($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return 'mes pasado ($month)';
  }

  @override
  String get notificationsSectionsBalance => 'Saldos de cuentas';

  @override
  String get notificationsSectionsTopCategories => 'Top 5 gastos de este mes';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return 'Top 5 gastos de $month';
  }

  @override
  String get notificationsSectionsDailyDetail => 'Detalle diario';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return 'Acumulado del mes ($month)';
  }

  @override
  String get notificationsSectionsStock => 'Inversiones en acciones';

  @override
  String get notificationsSectionsRecentDaily => 'Transacciones de ayer';

  @override
  String get notificationsSectionsRecentWeekly =>
      'Transacciones de esta semana';

  @override
  String get notificationsSectionsRecentMonthly =>
      'Transacciones del mes pasado';

  @override
  String get notificationsLabelsIncome => 'Ingresos';

  @override
  String get notificationsLabelsExpense => 'Gastos';

  @override
  String get notificationsLabelsNet => 'Neto';

  @override
  String get notificationsLabelsCost => 'Coste total';

  @override
  String get notificationsLabelsMarketValue => 'Valor de mercado';

  @override
  String get notificationsLabelsUnrealizedPL => 'Gan./pérd. no realizada';

  @override
  String get notificationsLabelsReturnRate => 'Rentabilidad';

  @override
  String get notificationsLabelsUncategorized => 'Sin categoría';

  @override
  String get notificationsTableDate => 'Fecha';

  @override
  String get notificationsEmptyNoAccount => 'Aún no hay cuentas';

  @override
  String get notificationsEmptyNoExpense => 'Aún no hay gastos';

  @override
  String notificationsEmptyNoTx(Object label) {
    return 'No hay transacciones para $label';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return 'Acciones: valor de mercado $marketValue, P/L no realizada $pl';
  }

  @override
  String get notificationsCtaViewFullReport => 'Ver informe completo';

  @override
  String get notificationsCtaViewLineRecord => 'Ver registros de LINE';

  @override
  String get notificationsReminderAltText => 'Recordatorio de gasto';

  @override
  String get notificationsReminderTitle =>
      'No olvides registrar los gastos de hoy';

  @override
  String notificationsReminderBody(Object name) {
    return '$name, dedica 10 segundos a registrar los gastos de hoy para no perderlos al cerrar el mes.';
  }

  @override
  String get notificationsReminderHint =>
      'Toca Añadir gasto y escribe: importe nota fecha (la fecha es opcional)';

  @override
  String get notificationsReminderFallbackName => 'hola';

  @override
  String get notificationsReminderAddExpense => 'Añadir gasto';

  @override
  String get notificationsReminderViewToday => 'Ver registros de hoy';

  @override
  String get notificationsFallbackUser => 'Usuario';

  @override
  String get mobileLegacyMessagebde18a20 => '・Excluido del patrimonio total';

  @override
  String get mobileLegacyNoneCreateAsParent =>
      '(Ninguna, crear como principal)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      'Inicio muestra ingresos, gastos, neto y categorías por mes. Cambia de mes deslizando y ve en qué se va el dinero.';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      'Los pagos se asignan al estado que liquidan, incluso si se pagan en el ciclo siguiente.';

  @override
  String get mobileLegacy0NoPayment => '0 = no pagar';

  @override
  String get mobileLegacyMon => 'Lun';

  @override
  String get mobileLegacyStock => 'Acción común';

  @override
  String get mobileLegacyStocks => 'Acciones comunes (%)';

  @override
  String get mobileLegacyTue => 'Mar';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      'Cuenta de depósito (obligatoria si hay dividendo en efectivo)';

  @override
  String get mobileLegacyWed => 'Mié';

  @override
  String get mobileLegacyPreviousStatement => 'Estado anterior ';

  @override
  String get mobileLegacyNext => 'Siguiente';

  @override
  String get mobileLegacyDelisted => 'Deslistada';

  @override
  String get mobileLegacySubcategory => 'Subcategoría';

  @override
  String get mobileLegacyDeleted => 'Eliminado';

  @override
  String get mobileLegacyUpdated => 'Actualizado';

  @override
  String get mobileLegacyLinked => 'Vinculado';

  @override
  String get mobileLegacyUnlinked => 'Desvinculado';

  @override
  String get mobileLegacyTotalRealizedPL => 'P/L realizado total';

  @override
  String get mobileLegacyFri => 'Vie';

  @override
  String get mobileLegacyStandardRate01 => 'Tasa estándar: 0,1%';

  @override
  String get mobileLegacyStandardRate03 => 'Tasa estándar: 0,3%';

  @override
  String get mobileLegacySat => 'Sáb';

  @override
  String get mobileLegacyCategoryName => 'Nombre de categoría';

  @override
  String get mobileLegacyFeeOptional => 'Comisión (opcional)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      'Deja comisión e impuesto en blanco para calcularlos automáticamente';

  @override
  String get mobileLegacyCommissionRate => 'Tasa de comisión (%)';

  @override
  String get mobileLegacyDay => 'Dom';

  @override
  String get mobileLegacyMonthlyBudget => 'Presupuesto mensual';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      'Categoría principal (sin seleccionar = crear principal)';

  @override
  String get mobileLegacyTheme => 'Tema';

  @override
  String get mobileLegacyThu => 'Jue';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => 'Categoría desconocida';

  @override
  String get mobileLegacyNotLinked => 'No vinculado';

  @override
  String get mobileLegacyNoTransactionsThisMonth =>
      'No hay transacciones este mes';

  @override
  String get mobileLegacyNoBudgetThisMonth => 'No hay presupuesto este mes';

  @override
  String get mobileLegacyNetThisMonth => 'Neto del mes';

  @override
  String get mobileLegacyPositiveWholeNumber => 'Número entero positivo';

  @override
  String get mobileLegacyDeletePermanently => 'Eliminar permanentemente';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      'Eliminar cuenta y datos de forma permanente';

  @override
  String get mobileLegacyNoReleaseNotesAvailable =>
      'No hay notas de actualización';

  @override
  String get mobileLegacyCurrentDevice => 'Dispositivo actual';

  @override
  String get mobileLegacyTransactions => 'Transacciones';

  @override
  String get mobileLegacyAll => 'Todo';

  @override
  String get mobileLegacyAllCategories => 'Todas las categorías';

  @override
  String get mobileLegacyAllAccounts => 'Todas las cuentas';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      'Pago de cada tarjeta (en su moneda)';

  @override
  String get mobileLegacySyncDividends => 'Sincronizar dividendos';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      'Nombre (opcional; se completa automáticamente)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      'En Acciones, introduce un ticker como 2330 para seguir precios, ganancias realizadas y no realizadas, y sincronizar dividendos automáticamente.';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      'En la pestaña Transacciones, toca + para añadir ingresos o gastos. Admite varias monedas y transferencias entre cuentas. Desliza a la izquierda para borrar o toca para editar.';

  @override
  String get mobileLegacyNoDataForThisPeriod => 'No hay datos en este período';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      'Esto eliminará de forma permanente tu cuenta y todos los datos, incluidas transacciones, cuentas, acciones y ajustes. No se puede deshacer.';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      'Personalizar el envío programado de informes';

  @override
  String get mobileLegacyAutomatic => 'Automático';

  @override
  String get mobileLegacyAtLeast8Characters => 'Al menos 8 caracteres';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      'Al menos 8 caracteres con mayúsculas, minúsculas, números y símbolos';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      'Tu gestor de finanzas personales para gastos, presupuestos, acciones de Taiwán e informes. Dedica un minuto a conocer lo esencial.';

  @override
  String get mobileLegacyDeletePasskey => 'Eliminar Passkey';

  @override
  String get mobileLegacyDeleteCategory => 'Eliminar categoría';

  @override
  String get mobileLegacyDeleteTransaction => 'Eliminar transacción';

  @override
  String get mobileLegacyDeleteDividend => 'Eliminar dividendo';

  @override
  String get mobileLegacyDeleteStock => 'Eliminar acción';

  @override
  String get mobileLegacyDeleteAccount => 'Eliminar cuenta';

  @override
  String get mobileLegacyDeleteSchedule => 'Eliminar programación';

  @override
  String get mobileLegacyDeletePhoto => 'Eliminar foto';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      'Si hay dividendo en efectivo, la cuenta de depósito es obligatoria';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters =>
      'No hay transacciones con estos filtros';

  @override
  String get mobileLegacyDiscount01 => 'Descuento (0-1)';

  @override
  String get mobileLegacyImproved => 'Mejorado';

  @override
  String get mobileLegacyMore => 'Más';

  @override
  String get mobileLegacyUpdatedd9db02d0 => 'Actualizado';

  @override
  String get mobileLegacyLastDayOfEachMonth => 'Último día de cada mes';

  @override
  String get mobileLegacyNoPricesToUpdate => 'No hay precios para actualizar';

  @override
  String get mobileLegacyNoNewDividendsToSync =>
      'No hay dividendos nuevos para sincronizar';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      'Usuario desconectado; se borró el acceso local';

  @override
  String get mobileLegacyGettingStarted => 'Primeros pasos';

  @override
  String get mobileLegacyExample06MeansA40Discount =>
      'Ejemplo: 0,6 equivale a 40% de descuento';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      'Ejemplo: 1.5 significa 1.5%; se calcula automáticamente al pagar en moneda extranjera';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      'En Más puedes fijar presupuestos, ver informes, gestionar cuentas y categorías, programar movimientos recurrentes y avisos de informes. Cuando quieras, empieza a registrar.';

  @override
  String get mobileLegacyStandardBrokerageRate01425 =>
      'Tarifa estándar de bróker: 0,1425%';

  @override
  String get mobileLegacyNotSentYet => 'Aún no enviado';

  @override
  String get mobileLegacyNoRealizedReturns => 'No hay P/L realizado';

  @override
  String get mobileLegacyNoCategoriesYet => 'Aún no hay categorías';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      'No hay transacciones. Toca el botón inferior derecho para añadir una.';

  @override
  String get mobileLegacyNoRecurringTransactions =>
      'No hay movimientos recurrentes';

  @override
  String get mobileLegacyNoDividendRecords => 'No hay registros de dividendos';

  @override
  String get mobileLegacyNoStockTransactions =>
      'No hay transacciones de acciones';

  @override
  String get mobileLegacyNoHoldingsYet => 'Aún no hay posiciones';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory =>
      'No hay historial de inicio de sesión';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      'Completa el registro en el navegador (requiere biometría del dispositivo)';

  @override
  String get mobileLegacyNotice => 'Aviso';

  @override
  String get mobileLegacyDividends => 'Dividendos';

  @override
  String get mobileLegacyDividendSyncCompleted => 'Dividendos sincronizados';

  @override
  String get mobileLegacyTickerEG2330 => 'Ticker (p. ej., 2330)';

  @override
  String get mobileLegacyStockMarketValue => 'Valor de mercado de acciones';

  @override
  String get mobileLegacyHoldings => 'Cartera';

  @override
  String get mobileLegacyDayOfWeek => 'Día de la semana';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      'Ver la versión actual y notas de actualización';

  @override
  String get mobileLegacyRename => 'Cambiar nombre';

  @override
  String get mobileLegacyCheckAgain => 'Volver a comprobar';

  @override
  String get mobileLegacyRetry => 'Reintentar';

  @override
  String get mobileLegacyHome => 'Inicio';

  @override
  String get mobileLegacyFixed => 'Corregido';

  @override
  String get mobileLegacyApply => 'Aplicar';

  @override
  String get mobileLegacyTime => 'Hora';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      'Comisión extranjera en TWD (opcional)';

  @override
  String get mobileLegacyAddTransaction => 'Añadir transacción';

  @override
  String get mobileLegacyTransactions8084a8ea => 'Transacciones';

  @override
  String get mobileLegacyStartDate => 'Fecha inicial';

  @override
  String get mobileLegacyTrackTaiwanStocks =>
      'Sigue inversiones en acciones de Taiwán';

  @override
  String get mobileLegacyStockDividendSharesOptional =>
      'Acciones recibidas como dividendo (opcional)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      'Las comisiones de tarjeta extranjera se generan automáticamente. Edita la transacción extranjera relacionada.';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      'La contraseña debe tener al menos 8 caracteres';

  @override
  String get mobileLegacyAccountName => 'Nombre de cuenta';

  @override
  String get mobileLegacyAccountDeleted => 'Cuenta eliminada';

  @override
  String get mobileLegacyAccountSecurity => 'Seguridad de la cuenta';

  @override
  String get mobileLegacyLinkedAccounts => 'Cuentas vinculadas';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => 'Monedas frecuentes';

  @override
  String get mobileLegacyChooseFromGallery => 'Elegir de la galería';

  @override
  String get mobileLegacyEnabled => 'Activado';

  @override
  String get mobileLegacyDark => 'Oscuro';

  @override
  String get mobileLegacyLight => 'Claro';

  @override
  String get mobileLegacyClearDates => 'Borrar fechas';

  @override
  String get mobileLegacyClearFilters => 'Borrar filtros';

  @override
  String get mobileLegacyCashDividendTotalOptional =>
      'Dividendo en efectivo (total, opcional)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      'Introduce dividendo en efectivo o en acciones';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      'Al definirlo, la tarjeta de cuenta muestra el gasto del ciclo actual; vacío no se calcula';

  @override
  String get mobileLegacyNoteOptional => 'Nota (opcional)';

  @override
  String get mobileLegacyNoteKeyword => 'Palabra clave de nota';

  @override
  String get mobileLegacyMinimumTransactionTax => 'Impuesto bursátil mínimo';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction =>
      'Hasta 5 fotos por transacción';

  @override
  String get mobileLegacyReportNotifications => 'Notificaciones de informes';

  @override
  String get mobileLegacySeeYourCompleteCashFlow =>
      'Ve tu flujo de dinero completo';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser => 'No se pudo abrir el navegador';

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
      'La sesión caducó. Vuelve a iniciar sesión';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      'La respuesta de inicio de sesión no incluyó la cookie de autenticación. Revisa la configuración del backend';

  @override
  String get mobileLegacySignedIn => 'Sesión iniciada';

  @override
  String get mobileLegacySignInHistory => 'Historial de inicio de sesión';

  @override
  String get mobileLegacySignedInDevices => 'Dispositivos con sesión';

  @override
  String get mobileLegacySignInRequestConnectionFailed =>
      'No se pudo conectar para iniciar sesión';

  @override
  String get mobileLegacyEndDate => 'Fecha final';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      'La respuesta de registro no incluyó la cookie de autenticación. Revisa la configuración del backend';

  @override
  String get mobileLegacySignUpAndSignIn => 'Registrarse e iniciar sesión';

  @override
  String get mobileLegacyBuy => 'Comprar';

  @override
  String get mobileLegacyFrequency => 'Frecuencia';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 =>
      'El tipo de cambio debe ser mayor que 0';

  @override
  String get mobileLegacyReturns => 'Resultados';

  @override
  String get mobileLegacyAddPasskey => 'Añadir Passkey';

  @override
  String get mobileLegacyAddStockTransaction =>
      'Añadir transacción de acciones';

  @override
  String get mobileLegacyAddSchedule => 'Añadir programación';

  @override
  String get mobileLegacyAddReportSchedule => 'Añadir programación de informe';

  @override
  String get mobileLegacyAddPhotosOptional => 'Añadir fotos (opcional)';

  @override
  String get mobileLegacyFailedToLoadPhoto => 'No se pudo cargar la foto';

  @override
  String get mobileLegacyLink => 'Vincular';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      'La vinculación se autoriza en el navegador. Antes de desvincular, confirma que aún puedes iniciar sesión de otra forma.';

  @override
  String get mobileLegacyUnlink => 'Desvincular';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp =>
      'Gestión financiera · App Android';

  @override
  String get mobileLegacySkip => 'Omitir';

  @override
  String get mobileLegacyMinimumOddLotCommission =>
      'Comisión mínima por lote fraccionado';

  @override
  String get mobileLegacyIncorrectEmailOrPassword =>
      'Correo o contraseña incorrectos';

  @override
  String get mobileLegacyDefaultCurrency => 'Moneda predeterminada';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      'Moneda predeterminada y frecuentes';

  @override
  String get mobileLegacyBudgets => 'Presupuestos';

  @override
  String get mobileLegacyBudgetsReportsAndMore =>
      'Presupuestos, informes y más';

  @override
  String get mobileLegacyBudgetAmount => 'Importe del presupuesto';

  @override
  String get mobileLegacyCurrencySettings => 'Configuración de moneda';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage =>
      'Idioma de la app, notificaciones y web';

  @override
  String get mobileLegacyBank => 'Banco';

  @override
  String get mobileLegacyBankBalance => 'Saldo bancario';

  @override
  String get mobileLegacyRequiresALinkedLineAccount =>
      'Requiere una cuenta LINE vinculada';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      'Necesitas al menos una tarjeta de crédito y una cuenta que no sea tarjeta para registrar el pago';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      'Incluye mayúsculas, minúsculas, números y símbolos';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      'Incluye mayúsculas, minúsculas, números y símbolos';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      '¿Eliminar esta programación de informes?';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      '¿Eliminar esta foto subida? Esta acción no se puede deshacer.';

  @override
  String get mobileLegacyEditStockTransaction =>
      'Editar transacción de acciones';

  @override
  String get mobileLegacyEditReportSchedule => 'Editar programación de informe';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst =>
      'Completa primero la verificación de abajo';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      'Añade una acción en la pestaña Posiciones primero';

  @override
  String get mobileLegacySelectAParentCategoryFirst =>
      'Selecciona primero una categoría principal';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      'Introduce el pago de al menos una tarjeta';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      'Selecciona al menos un método de notificación';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo =>
      'Introduce un número mayor o igual a 0';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => 'Introduce un valor de 1 a 31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 =>
      'Introduce un importe mayor que 0';

  @override
  String get mobileLegacyEnterATicker => 'Introduce un ticker';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber =>
      'Introduce un número entero positivo';

  @override
  String get mobileLegacyEnterAName => 'Introduce un nombre';

  @override
  String get mobileLegacyEnterAValidEmailAddress => 'Introduce un email válido';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm =>
      'Introduce tu contraseña para confirmar';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      'Introduce el email de la cuenta para confirmar';

  @override
  String get mobileLegacyEnterADisplayName => 'Introduce un nombre visible';

  @override
  String get mobileLegacySelectASubcategory => 'Selecciona una subcategoría';

  @override
  String get mobileLegacySelectACategory => 'Selecciona una categoría';

  @override
  String get mobileLegacySelectAParentCategory =>
      'Selecciona una categoría principal';

  @override
  String get mobileLegacySelectAnAccount => 'Selecciona una cuenta';

  @override
  String get mobileLegacySelectADestinationAccount =>
      'Selecciona una cuenta de destino';

  @override
  String get mobileLegacySell => 'Vender';

  @override
  String get mobileLegacyMinimumBoardLotCommission =>
      'Comisión mínima por lote completo';

  @override
  String get mobileLegacyFilter => 'Filtrar';

  @override
  String get mobileLegacyFilterTransactions => 'Filtrar transacciones';

  @override
  String get mobileLegacyChooseTheme => 'Elegir tema';

  @override
  String get mobileLegacyLogTransactionsInSeconds =>
      'Registra movimientos al instante';

  @override
  String get mobileLegacyMarketValue => 'Valor de mercado total';

  @override
  String get mobileLegacyTotalAssetsInTwd => 'Activos totales (en TWD)';

  @override
  String get mobileLegacyTraditionalChineseEnglish =>
      'Chino tradicional / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp =>
      '¿No tienes cuenta? Regístrate';

  @override
  String get mobileLegacyPaymentRecorded => 'Pago registrado';

  @override
  String get mobileLegacyToAccount => 'Cuenta de destino';

  @override
  String get mobileLegacyFromAccount => 'Cuenta de origen';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      'La cuenta de origen y destino no pueden ser iguales';

  @override
  String get mobileLegacyEditTransfersInTheWebApp =>
      'Edita las transferencias en la versión web';

  @override
  String get mobileLegacyTransactionTaxSell => 'Impuesto bursátil (venta)';

  @override
  String get mobileLegacyTransactionTaxOptional =>
      'Impuesto bursátil (opcional)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax =>
      'Tipo (afecta al impuesto bursátil)';

  @override
  String get mobileLegacyWarrants => 'Warrants (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot =>
      'Te damos la bienvenida a AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      'Los demás dispositivos cerrarán sesión después del cambio.';

  @override
  String get mobileLegacyTestSentryConfiguration =>
      'Probar configuración de Sentry';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'La API respondió 401; la sesión caducó y se borró el acceso local';

  @override
  String get mobileLegacyApiRequestFailed => 'Falló la solicitud a la API';

  @override
  String get mobileLegacyApiRequestConnectionFailed =>
      'No se pudo conectar con la API';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'La respuesta de la app no incluyó la cookie de autenticación';

  @override
  String get mobileLegacyEmailNotifications => 'Notificaciones por email';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'La respuesta de Google no incluyó la cookie de autenticación';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'Notificaciones por LINE';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'La respuesta de LINE no incluyó la cookie de autenticación';

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
      'TWD siempre está incluido. Las monedas marcadas aparecerán primero en las listas de transacciones y recurrentes.';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return 'Día $day';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return 'Último envío: $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return 'Versión actual v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'La versión v$version está disponible';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return 'Mensual el día $day';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return 'Cada $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return 'Creado el $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return 'Idioma actualizado: $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return 'No se pudo cargar: $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return 'Error inesperado: $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return 'No se pudo iniciar sesión con $provider: $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return 'No se pudieron actualizar los precios: $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return 'No se pudieron sincronizar dividendos: $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return 'No se pudo subir la foto: $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return 'Falló la solicitud (HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return 'No se pudo iniciar sesión (HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return 'No se pudo conectar con el servidor ($target): $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return '¿Eliminar “$name”?';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return 'Desvincular $provider';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return '¿Desvincular $provider?';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return 'Vinculación de $provider';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (todo)';
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
    return 'Datos consultados a las $time';
  }

  @override
  String get dashboardAttentionTitle => 'Requiere atención';

  @override
  String get dashboardAttentionAllClear =>
      'No hay nada que requiera tu atención ahora';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count transacciones recurrentes requieren revisión';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count transacciones sin categoría · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count posiciones en cartera no tienen precio';
  }

  @override
  String get dashboardDriversTitle => '3 principales factores del mes';

  @override
  String dashboardDriversSubtitle(Object month) {
    return 'Lo que más contribuye en $month';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '$share% de este tipo';
  }

  @override
  String get dashboardPersonalizeTrigger => 'Personalizar inicio';

  @override
  String get dashboardPersonalizeTitle => 'Personalizar inicio';

  @override
  String get dashboardPersonalizeDescription =>
      'Elige qué módulos aparecen y ordénalos según cómo los utilizas.';

  @override
  String get dashboardPersonalizeModulesAssets => 'Resumen de activos';

  @override
  String get dashboardPersonalizeModulesAttention => 'Requiere atención';

  @override
  String get dashboardPersonalizeModulesWhyChanged =>
      'Por qué cambió el flujo de efectivo';

  @override
  String get dashboardPersonalizeModulesSpending => 'Categorías de gastos';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth =>
      'Estado de la cartera';

  @override
  String get dashboardPersonalizeModulesIncomeRecent =>
      'Ingresos y transacciones recientes';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return 'Subir $module';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return 'Bajar $module';
  }

  @override
  String get dashboardPersonalizeSaved => 'Diseño del panel guardado';

  @override
  String get dashboardPersonalizeSaveError =>
      'No se pudo guardar el diseño del panel';

  @override
  String get dashboardPersonalizeReset => 'Restablecer';

  @override
  String get dashboardPersonalizeApply => 'Aplicar';

  @override
  String get dashboardComparisonTitle => 'Por qué cambió el flujo de efectivo';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart–$currentEnd frente a $previousStart–$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return 'Mes completo frente a $previousStart–$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable =>
      'No hay un período anterior comparable para este mes.';

  @override
  String get dashboardComparisonNoChanges =>
      'El flujo de efectivo registrado no cambió respecto al período comparable.';

  @override
  String get dashboardComparisonPreviousNet =>
      'Flujo de efectivo neto anterior';

  @override
  String get dashboardComparisonNetChange =>
      'Cambio del flujo de efectivo neto';

  @override
  String get dashboardComparisonNewThisPeriod => 'Nuevo en este período';

  @override
  String get dashboardComparisonIncreased => 'El importe aumentó';

  @override
  String get dashboardComparisonDecreased => 'El importe disminuyó';

  @override
  String get dashboardPortfolioHealthTitle => 'Estado de costos de la cartera';

  @override
  String get dashboardPortfolioHealthSubtitle =>
      'Valor actual frente al costo FIFO restante';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      'Añade una posición para ver información de costos.';

  @override
  String get dashboardPortfolioHealthMissingPrices =>
      'Se necesitan precios actuales para mostrar esta comparación.';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      'No hay un porcentaje combinado para posiciones en varias divisas.';

  @override
  String get dashboardPortfolioHealthMarketValue =>
      'Valor de mercado con precio';

  @override
  String get dashboardPortfolioHealthCost => 'Costo de posiciones con precio';

  @override
  String get dashboardPortfolioHealthUnrealizedGross =>
      'Ganancia/pérdida bruta no realizada';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return 'Mayor posición: $name · $share% del valor con precio';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      'Compara los precios actuales con el costo FIFO registrado. No es un índice de mercado ni un rendimiento ponderado por tiempo.';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return 'Cobertura de precios: $priced de $total posiciones';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook =>
      'Previsión de efectivo programado';

  @override
  String get dashboardPersonalizeModulesSavingsScenario =>
      'Escenario de ahorro';

  @override
  String get dashboardCashOutlookTitle =>
      'Próximos 30 días · efectivo programado';

  @override
  String get dashboardCashOutlookSubtitle =>
      'Basado en operaciones recurrentes confirmadas';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start–$end · Estimación programada';
  }

  @override
  String get dashboardCashOutlookInvalidDate =>
      'No se pudo calcular el período estimado.';

  @override
  String get dashboardCashOutlookNoBankAccounts =>
      'Añade una cuenta bancaria incluida antes de estimar el efectivo programado.';

  @override
  String get dashboardCashOutlookNoSchedules =>
      'Crea un ingreso o gasto recurrente para ver el efectivo programado.';

  @override
  String get dashboardCashOutlookNoCoveredSchedules =>
      'Revisa las operaciones recurrentes y vincúlalas a cuentas bancarias incluidas.';

  @override
  String get dashboardCashOutlookStartingBalance =>
      'Saldo bancario a día de hoy';

  @override
  String get dashboardCashOutlookScheduledNet => 'Cambio neto programado';

  @override
  String get dashboardCashOutlookClosingBalance =>
      'Efectivo estimado tras 30 días';

  @override
  String get dashboardCashOutlookLowestBalance => 'Efectivo mínimo estimado';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count operaciones programadas · Ingresos $income · Gastos $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle =>
      'El efectivo combinado estimado puede quedar bajo cero';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return 'Alrededor del $date, la estimación queda $amount bajo cero. Revisa fechas e importes antes de actuar.';
  }

  @override
  String get dashboardCashOutlookUpcoming => 'Próximas operaciones programadas';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return 'Mostrando $shown de $total';
  }

  @override
  String get dashboardCashOutlookNoUpcoming =>
      'No hay operaciones programadas en este período de 30 días.';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return 'Se cubren $included de $total operaciones recurrentes; revisa $uncovered.';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      'La estimación combina todas las cuentas bancarias incluidas con el saldo de hoy y operaciones recurrentes vinculadas confirmadas. No muestra posibles sobregiros de una sola cuenta ni cambia saldos reales; las operaciones vencidas se crean cuando el servicio vuelve a procesarlas. Las estimaciones en TWD usan de forma coherente los tipos actuales.';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return 'El efectivo programado puede faltar por $amount alrededor del $date';
  }

  @override
  String get dashboardScenarioTitle => 'Escenario de ahorro';

  @override
  String get dashboardScenarioSubtitle =>
      'Estima el efecto acumulado de un ajuste mensual';

  @override
  String get dashboardScenarioMonthlyAdjustment =>
      'Ajuste mensual de ahorro (TWD)';

  @override
  String get dashboardScenarioDecrease => 'Reducir el ajuste mensual en 500';

  @override
  String get dashboardScenarioIncrease => 'Aumentar el ajuste mensual en 500';

  @override
  String get dashboardScenarioHorizon => 'Horizonte temporal';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count meses';
  }

  @override
  String get dashboardScenarioDifference => 'Diferencia acumulada';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return 'Un ajuste mensual de $monthly durante $months meses produce una diferencia acumulada de $difference.';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      'Escenario simple: ajuste mensual × meses. Excluye intereses, rentabilidad, inflación e impuestos y no garantiza resultados futuros.';

  @override
  String get navMcp => 'Conexión MCP';

  @override
  String get navMcpConnections => 'Herramientas de IA conectadas';

  @override
  String get settingsMcpTitle => 'Configuración de conexión MCP';

  @override
  String get settingsMcpDescription =>
      'Conecta herramientas de IA compatibles con MCP mediante OAuth o crea un token personal para clientes que requieran credenciales manuales.';

  @override
  String get settingsMcpOauthTitle => 'Conectar con OAuth';

  @override
  String get settingsMcpOauthDescription =>
      'Introduce la URL de conexión en una herramienta compatible con MCP OAuth. AssetPilot abrirá una página segura de inicio de sesión y consentimiento; no necesitas crear un token manualmente.';

  @override
  String get settingsMcpCreateNew => 'Crear nueva credencial';

  @override
  String get settingsMcpNameLabel => 'Nombre';

  @override
  String get settingsMcpNamePlaceholder => 'p. ej. Mi ChatGPT';

  @override
  String get settingsMcpExpiresAtLabel => 'Fecha de caducidad (opcional)';

  @override
  String get settingsMcpCreateButton => 'Crear credencial';

  @override
  String get settingsMcpCreating => 'Creando…';

  @override
  String get settingsMcpCreateFailed => 'Error al crear la credencial';

  @override
  String get settingsMcpNameRequired => 'El nombre es obligatorio';

  @override
  String get settingsMcpNameTooLong =>
      'El nombre no puede superar los 100 caracteres';

  @override
  String get settingsMcpListTitle => 'Mis credenciales MCP';

  @override
  String get settingsMcpRefresh => 'Actualizar';

  @override
  String get settingsMcpNoCredentials => 'Aún no hay credenciales';

  @override
  String get settingsMcpLoadFailed => 'Error al cargar las credenciales';

  @override
  String get settingsMcpColName => 'Nombre';

  @override
  String get settingsMcpColCreatedAt => 'Creado';

  @override
  String get settingsMcpColLastUsedAt => 'Último uso';

  @override
  String get settingsMcpColStatus => 'Estado';

  @override
  String get settingsMcpColActions => 'Acciones';

  @override
  String get settingsMcpNeverUsed => 'Nunca usado';

  @override
  String get settingsMcpStatusActive => 'Activo';

  @override
  String get settingsMcpStatusExpired => 'Caducado';

  @override
  String get settingsMcpStatusRevoked => 'Revocado';

  @override
  String get settingsMcpRevokeButton => 'Revocar';

  @override
  String get settingsMcpRevokeConfirm =>
      '¿Revocar esta credencial? Todas las consultas que la usen serán rechazadas de inmediato.';

  @override
  String get settingsMcpRevokeFailed => 'Error al revocar la credencial';

  @override
  String get settingsMcpTokenModalTitle => 'Token de acceso MCP';

  @override
  String get settingsMcpTokenWarning =>
      'Este token solo se muestra una vez. Cópialo y guárdalo de forma segura ahora; no podrás verlo de nuevo después de cerrar.';

  @override
  String get settingsMcpTokenLabel => 'Token de acceso';

  @override
  String get settingsMcpConnectionUrlLabel => 'URL de conexión MCP';

  @override
  String get settingsMcpCopyButton => 'Copiar';

  @override
  String get settingsMcpCopied => '¡Copiado!';

  @override
  String get settingsMcpCloseConfirm => 'Ya lo copié, cerrar';

  @override
  String get settingsMcpConnectionsTitle => 'Herramientas de IA conectadas';

  @override
  String get settingsMcpConnectionsDescription =>
      'Gestiona si cada herramienta de IA conectada mediante OAuth de MCP puede crear transacciones en tu nombre.';

  @override
  String get settingsMcpConnectionsListTitle => 'Herramientas de IA conectadas';

  @override
  String get settingsMcpConnectionsRefresh => 'Actualizar';

  @override
  String get settingsMcpConnectionsColClientName => 'Herramienta de IA';

  @override
  String get settingsMcpConnectionsColFirstConnectedAt => 'Primera conexión';

  @override
  String get settingsMcpConnectionsColLastUsedAt => 'Último uso';

  @override
  String get settingsMcpConnectionsColAllowCreate => 'Permitir crear datos';

  @override
  String get settingsMcpConnectionsAllowCreateLabel => 'Permitir crear datos';

  @override
  String get settingsMcpConnectionsNoConnections =>
      'Aún no hay herramientas de IA conectadas';

  @override
  String get settingsMcpConnectionsLoadFailed =>
      'Error al cargar las herramientas conectadas';

  @override
  String get settingsMcpConnectionsUpdateFailed =>
      'Error al actualizar el permiso';

  @override
  String get settingsMcpConnectionsColAllowUpdateNote =>
      'Permitir actualizar notas';

  @override
  String get settingsMcpConnectionsAllowUpdateNoteLabel =>
      'Permitir actualizar notas';

  @override
  String get settingsMcpConnectionsAllowUpdateNoteUpdateFailed =>
      'Error al actualizar el permiso de notas';

  @override
  String get settingsMcpColAllowCreate => 'Permitir crear datos';

  @override
  String get settingsMcpAllowCreateLabel => 'Permitir crear datos';

  @override
  String get settingsMcpAllowCreateUpdateFailed =>
      'Error al actualizar el permiso';

  @override
  String get settingsMcpColAllowUpdateNote => 'Permitir actualizar notas';

  @override
  String get settingsMcpAllowUpdateNoteLabel => 'Permitir actualizar notas';

  @override
  String get settingsMcpAllowUpdateNoteUpdateFailed =>
      'Error al actualizar el permiso de notas';

  @override
  String get adminSystemSettingsTitle => 'Configuración del sistema';

  @override
  String get adminUsersTitle => 'Gestión de usuarios';

  @override
  String get adminLoginAuditTitle => 'Auditoría de inicio de sesión';

  @override
  String get adminPublicRegistration => 'Registro público';

  @override
  String get adminLineLoginEnabled => 'Inicio de sesión con LINE';

  @override
  String get adminAllowedRegistrationEmails =>
      'Emails de registro permitidos (uno por línea)';

  @override
  String get adminAdminIpAllowlist =>
      'Lista blanca de IP de administrador (una por línea)';

  @override
  String get adminRouteAuditMode => 'Modo de auditoría';

  @override
  String get adminRouteAuditSecurity => 'Seguridad';

  @override
  String get adminRouteAuditExtended => 'Extendido';

  @override
  String get adminRouteAuditMinimal => 'Mínimo';

  @override
  String get adminTransactionPhotoStorage =>
      'Almacenamiento de fotos de transacciones';

  @override
  String get adminPhotoStorageDefault => 'Predeterminado';

  @override
  String get adminPhotoStorageLocal => 'Local';

  @override
  String get adminPhotoStorageS3 => 'S3';

  @override
  String get adminTransactionPhotoMaxMb =>
      'Límite de fotos de transacciones (MB)';

  @override
  String get adminStockAutoUpdateEnabled =>
      'Actualización automática de precios';

  @override
  String get adminStockAutoUpdateIntervalMin =>
      'Intervalo de actualización (minutos)';

  @override
  String get adminSaved => 'Guardado';

  @override
  String get adminOperationsTitle => 'Operaciones';

  @override
  String get adminRunStockUpdate => 'Actualizar precios ahora';

  @override
  String get adminCompressPhotos => 'Comprimir fotos';

  @override
  String get adminEncryptPhotos => 'Cifrar fotos';

  @override
  String get adminServerTime => 'Hora del servidor';

  @override
  String get adminNtpSync => 'Sincronización NTP';

  @override
  String adminStockUpdateResult(Object updated) {
    return 'Se actualizaron $updated precios';
  }

  @override
  String adminPhotoCompressResult(Object recompressed) {
    return 'Se comprimieron $recompressed fotos';
  }

  @override
  String adminPhotoEncryptResult(Object encrypted) {
    return 'Se cifraron $encrypted fotos';
  }

  @override
  String adminNtpSynced(Object offset) {
    return 'Sincronizado, desfase $offset ms';
  }

  @override
  String get adminAddUser => 'Añadir usuario';

  @override
  String get adminUserCreated => 'Usuario creado';

  @override
  String get adminResetPassword => 'Restablecer contraseña';

  @override
  String get adminPasswordReset => 'Contraseña restablecida';

  @override
  String get adminRoleChanged => 'Rol actualizado';

  @override
  String get adminDeleteUser => 'Eliminar usuario';

  @override
  String adminDeleteUserConfirm(Object email) {
    return '¿Eliminar a \"$email\"?';
  }

  @override
  String get adminUserDeleted => 'Usuario eliminado';

  @override
  String get adminNoUsers => 'Aún no hay usuarios';

  @override
  String get adminRemoveAdmin => 'Quitar administrador';

  @override
  String get adminMakeAdmin => 'Hacer administrador';

  @override
  String get adminPasswordTooShort =>
      'La contraseña debe tener al menos 8 caracteres';

  @override
  String get adminNoLoginAudit => 'Aún no hay registros de inicio de sesión';

  @override
  String get adminLoginSuccess => 'Éxito';

  @override
  String get adminLoginFailed => 'Falló';

  @override
  String get adminScreenSubtitle =>
      'Configuración del sistema y gestión de usuarios';
}
