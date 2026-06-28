import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'generated/app_locales.dart';
import 'generated/shared_translations.dart';

/// Legacy key. Older builds stored the chosen language only here, which shadowed
/// the Android per-app language. The OS per-app locale is now the single source
/// of truth; this key is read once to migrate existing users, then removed.
const _localePreferenceKey = 'appLocale';

/// Bridge to [MainActivity], which forwards to
/// `AppCompatDelegate.setApplicationLocales` so the in-app picker and the system
/// "App info → Language" screen write to the same per-app locale store.
const _localeChannel = MethodChannel('assetpilot/locale');

const supportedAppLocales = kSupportedAppLocales;
const appLocaleLabels = kAppLocaleLabels;

String normalizeAppLocale(String? value) {
  final s = (value ?? '').trim().replaceAll('_', '-').toLowerCase();
  if (s.isEmpty) return kDefaultAppLocale;
  for (final locale in kSupportedAppLocales) {
    if (s == locale.toLowerCase()) return locale;
  }
  for (final alias in kLocalePrefixAliases) {
    if (s == alias.prefix || s.startsWith('${alias.prefix}-')) {
      return alias.locale;
    }
  }
  return kDefaultAppLocale;
}

Locale flutterLocaleFor(String locale) {
  final normalized = normalizeAppLocale(locale);
  return (kFlutterLocaleParts[normalized] ??
          kFlutterLocaleParts[kDefaultAppLocale]!)
      .toLocale();
}

/// BCP-47 tag passed to `AppCompatDelegate.setApplicationLocales`. These must
/// match the entries in `res/xml/locale_config.xml` so the system "App info →
/// Language" screen highlights the same language the in-app picker selected.
String androidLocaleTag(String locale) {
  final normalized = normalizeAppLocale(locale);
  return kAndroidLocaleTags[normalized] ?? normalized;
}

/// Push [locale] into the Android per-app language store. No-op (and harmless)
/// on platforms/engines without the channel; the in-memory [appLocale] still
/// drives the Flutter UI for the current session in that case.
Future<void> _applyPlatformLocale(String locale) async {
  try {
    await _localeChannel.invokeMethod<void>('setLocale', {
      'tag': androidLocaleTag(locale),
    });
  } on MissingPluginException {
    // Non-Android platform or older host without the handler — ignore.
  } catch (error, stack) {
    FlutterError.reportError(
      FlutterErrorDetails(exception: error, stack: stack),
    );
  }
}

String appIntlLocaleTag([String? locale]) {
  final normalized = normalizeAppLocale(locale ?? appLocale.value);
  return kAppIntlLocaleTags[normalized] ??
      kAppIntlLocaleTags[kDefaultAppLocale]!;
}

/// The locale used by the native app. Chinese remains the source language so
/// existing user-created data is never rewritten when the interface changes.
final ValueNotifier<String> appLocale = ValueNotifier('zh-TW');

bool get isEnglish => appLocale.value == 'en';
bool get isChineseLocale =>
    appLocale.value == 'zh-TW' || appLocale.value == 'zh-CN';

Future<void> loadAppLocale() async {
  final osLocale = normalizeAppLocale(
    PlatformDispatcher.instance.locale.toLanguageTag(),
  );

  // One-time migration: carry a pre-update in-app choice into the OS per-app
  // language store, then forget the key so the system locale alone wins from now
  // on. We only re-apply when it differs from the device locale, to avoid an
  // unnecessary activity recreation on launch.
  final preferences = await SharedPreferences.getInstance();
  final legacy = preferences.getString(_localePreferenceKey);
  if (legacy != null) {
    await preferences.remove(_localePreferenceKey);
    final normalized = normalizeAppLocale(legacy);
    if (supportedAppLocales.contains(normalized) && normalized != osLocale) {
      appLocale.value = normalized;
      await _applyPlatformLocale(normalized);
      return;
    }
  }

  appLocale.value = osLocale;
}

/// Apply [locale] as the Android per-app language. The OS persists it and (on
/// API 33+) reflects it in the system "App info → Language" screen; the runtime
/// locale observer keeps [appLocale] in sync when the OS recreates the activity.
Future<void> setAppLocale(String locale) async {
  final normalized = normalizeAppLocale(locale);
  appLocale.value = normalized;
  await _applyPlatformLocale(normalized);
}

/// Follows runtime system-locale changes (e.g. the user switches language in the
/// OS "App info → Language" screen) so the Flutter UI updates without a manual
/// restart, in addition to the activity recreation Android performs.
class _AppLocaleObserver with WidgetsBindingObserver {
  @override
  void didChangeLocales(List<Locale>? locales) {
    final tag = (locales != null && locales.isNotEmpty)
        ? locales.first.toLanguageTag()
        : PlatformDispatcher.instance.locale.toLanguageTag();
    appLocale.value = normalizeAppLocale(tag);
  }
}

final _appLocaleObserver = _AppLocaleObserver();

/// Registers the runtime locale observer. Call once after the binding is ready.
void initAppLocaleObserver() {
  WidgetsBinding.instance.removeObserver(_appLocaleObserver);
  WidgetsBinding.instance.addObserver(_appLocaleObserver);
}

/// Best-effort translation for legacy server/API messages that may still arrive
/// as already-localized text. New UI strings must use stable ARB keys through
/// [trKey] or generated AppLocalizations APIs instead.
String translateLegacyServerMessage(String source) {
  final locale = normalizeAppLocale(appLocale.value);
  if (locale == 'zh-TW') return source;
  return lookupSharedTranslation(locale, source) ??
      _translateDynamic(source, locale) ??
      lookupSharedTranslation('en', source) ??
      _translateDynamic(source, 'en') ??
      source;
}

/// Translates a stable shared ARB key. New Flutter code should prefer generated
/// AppLocalizations where a BuildContext is available, or this helper for
/// non-widget code that still follows the shared key space.
String trKey(String key, [Map<String, Object?>? vars]) {
  final locale = normalizeAppLocale(appLocale.value);
  return lookupSharedTranslationByKey(locale, key, vars) ??
      lookupSharedTranslationByKey('en', key, vars) ??
      key;
}

String? _translateDynamic(String source, [String? locale]) {
  final loc = normalizeAppLocale(locale ?? appLocale.value);
  Match? match;
  if ((match = RegExp(r'^(\d+) 號$').firstMatch(source)) != null) {
    return _dayOfMonth(loc, match![1]!);
  }
  if ((match = RegExp(r'^上次寄送 (.+)$').firstMatch(source)) != null) {
    return _lastSent(loc, match![1]!);
  }
  if ((match = RegExp(r'^目前版本 v(.+)$').firstMatch(source)) != null) {
    return _currentVersion(loc, match![1]!);
  }
  if ((match = RegExp(r'^有新版本 v(.+) 可更新$').firstMatch(source)) != null) {
    return _versionAvailable(loc, match![1]!);
  }
  if ((match = RegExp(r'^每月 (.+) 號$').firstMatch(source)) != null) {
    return _monthlyOnDay(loc, match![1]!);
  }
  if ((match = RegExp(r'^每週(.+)$').firstMatch(source)) != null) {
    return _everyWeekday(loc, match![1]!);
  }
  if ((match = RegExp(r'^星期(.+)$').firstMatch(source)) != null) {
    return _weekday(loc, match![1]!);
  }
  if ((match = RegExp(r'^建立於 (.+)$').firstMatch(source)) != null) {
    return _createdAt(loc, match![1]!);
  }
  if ((match = RegExp(r'^已更新語言：(.+)$').firstMatch(source)) != null) {
    return _languageUpdated(loc, match![1]!);
  }
  if ((match = RegExp(r'^載入失敗：(.+)$').firstMatch(source)) != null) {
    return _failedToLoad(loc, match![1]!);
  }
  if ((match = RegExp(r'^發生未預期的錯誤：(.+)$').firstMatch(source)) != null) {
    return _unexpectedError(loc, match![1]!);
  }
  if ((match = RegExp(r'^(.+) 登入失敗：(.+)$').firstMatch(source)) != null) {
    final m = match!;
    return _providerLoginFailed(loc, m[1]!, m[2]!);
  }
  if ((match = RegExp(r'^更新股價失敗：(.+)$').firstMatch(source)) != null) {
    return _failedUpdatePrices(loc, match![1]!);
  }
  if ((match = RegExp(r'^同步股利失敗：(.+)$').firstMatch(source)) != null) {
    return _failedSyncDividends(loc, match![1]!);
  }
  if ((match = RegExp(r'^照片上傳失敗：(.+)$').firstMatch(source)) != null) {
    return _photoUploadFailed(loc, match![1]!);
  }
  if ((match = RegExp(r'^請求失敗（HTTP (.+)）$').firstMatch(source)) != null) {
    return _requestFailed(loc, match![1]!);
  }
  if ((match = RegExp(r'^登入失敗（HTTP (.+)）$').firstMatch(source)) != null) {
    return _loginHttpFailed(loc, match![1]!);
  }
  if ((match = RegExp(r'^無法連線到後端（(.+)）：(.+)$').firstMatch(source)) != null) {
    final m = match!;
    return _backendConnectFailed(loc, m[1]!, m[2]!);
  }
  if ((match = RegExp(r'^確定刪除「(.+)」？$').firstMatch(source)) != null) {
    return _confirmDeleteNamed(loc, match![1]!);
  }
  if ((match = RegExp(r'^解除 (.+) 綁定$').firstMatch(source)) != null) {
    return _unlinkProvider(loc, match![1]!);
  }
  if ((match = RegExp(r'^確定解除與 (.+) 的綁定？$').firstMatch(source)) != null) {
    return _confirmUnlinkProvider(loc, match![1]!);
  }
  if ((match = RegExp(r'^(.+) 綁定$').firstMatch(source)) != null) {
    return _providerBinding(loc, match![1]!);
  }
  if ((match = RegExp(r'^(.+)（全部）$').firstMatch(source)) != null) {
    return _allForName(loc, match![1]!);
  }
  return null;
}

String? _dynamicMessage(String loc, String key, Map<String, Object?> vars) =>
    lookupSharedTranslationByKey(loc, key, vars) ??
    lookupSharedTranslationByKey('en', key, vars) ??
    lookupSharedTranslationByKey(kDefaultAppLocale, key, vars);

String _dayOfMonth(String loc, String day) =>
    _dynamicMessage(loc, 'mobileDynamicDayOfMonth', {'day': day}) ?? '$day 號';

String _lastSent(String loc, String value) =>
    _dynamicMessage(loc, 'mobileDynamicLastSent', {'value': value}) ??
    '上次寄送 $value';

String _currentVersion(String loc, String version) =>
    _dynamicMessage(loc, 'mobileDynamicCurrentVersion', {'version': version}) ??
    '目前版本 v$version';

String _versionAvailable(String loc, String version) =>
    _dynamicMessage(loc, 'mobileDynamicVersionAvailable', {
      'version': version,
    }) ??
    '有新版本 v$version 可更新';

String _monthlyOnDay(String loc, String day) =>
    _dynamicMessage(loc, 'mobileDynamicMonthlyOnDay', {'day': day}) ??
    '每月 $day 號';

String _everyWeekday(String loc, String weekday) =>
    _dynamicMessage(loc, 'mobileDynamicEveryWeekday', {'weekday': weekday}) ??
    '每週$weekday';

String _weekday(String loc, String weekday) =>
    _dynamicMessage(loc, 'mobileDynamicWeekday', {'weekday': weekday}) ??
    '星期$weekday';

String _createdAt(String loc, String value) =>
    _dynamicMessage(loc, 'mobileDynamicCreatedAt', {'value': value}) ??
    '建立於 $value';

String _languageUpdated(String loc, String value) =>
    _dynamicMessage(loc, 'mobileDynamicLanguageUpdated', {'value': value}) ??
    '已更新語言：$value';

String _failedToLoad(String loc, String value) =>
    _dynamicMessage(loc, 'mobileDynamicFailedToLoad', {'value': value}) ??
    '載入失敗：$value';

String _unexpectedError(String loc, String value) =>
    _dynamicMessage(loc, 'mobileDynamicUnexpectedError', {'value': value}) ??
    '發生未預期的錯誤：$value';

String _providerLoginFailed(String loc, String provider, String error) =>
    _dynamicMessage(loc, 'mobileDynamicProviderLoginFailed', {
      'provider': provider,
      'error': error,
    }) ??
    '$provider 登入失敗：$error';

String _failedUpdatePrices(String loc, String value) =>
    _dynamicMessage(loc, 'mobileDynamicFailedUpdatePrices', {'value': value}) ??
    '更新股價失敗：$value';

String _failedSyncDividends(String loc, String value) =>
    _dynamicMessage(loc, 'mobileDynamicFailedSyncDividends', {
      'value': value,
    }) ??
    '同步股利失敗：$value';

String _photoUploadFailed(String loc, String value) =>
    _dynamicMessage(loc, 'mobileDynamicPhotoUploadFailed', {'value': value}) ??
    '照片上傳失敗：$value';

String _requestFailed(String loc, String code) =>
    _dynamicMessage(loc, 'mobileDynamicRequestFailed', {'code': code}) ??
    '請求失敗（HTTP $code）';

String _loginHttpFailed(String loc, String code) =>
    _dynamicMessage(loc, 'mobileDynamicLoginHttpFailed', {'code': code}) ??
    '登入失敗（HTTP $code）';

String _backendConnectFailed(String loc, String target, String error) =>
    _dynamicMessage(loc, 'mobileDynamicBackendConnectFailed', {
      'target': target,
      'error': error,
    }) ??
    '無法連線到後端（$target）：$error';

String _confirmDeleteNamed(String loc, String name) =>
    _dynamicMessage(loc, 'mobileDynamicConfirmDeleteNamed', {'name': name}) ??
    '確定刪除「$name」？';

String _unlinkProvider(String loc, String provider) =>
    _dynamicMessage(loc, 'mobileDynamicUnlinkProvider', {
      'provider': provider,
    }) ??
    '解除 $provider 綁定';

String _confirmUnlinkProvider(String loc, String provider) =>
    _dynamicMessage(loc, 'mobileDynamicConfirmUnlinkProvider', {
      'provider': provider,
    }) ??
    '確定解除與 $provider 的綁定？';

String _providerBinding(String loc, String provider) =>
    _dynamicMessage(loc, 'mobileDynamicProviderBinding', {
      'provider': provider,
    }) ??
    '$provider 綁定';

String _allForName(String loc, String name) =>
    _dynamicMessage(loc, 'mobileDynamicAllForName', {'name': name}) ??
    '$name（全部）';
