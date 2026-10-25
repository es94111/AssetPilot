import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// 目前執行平台。集中管理，避免各處直接判斷 `Platform.isAndroid`／`isIOS`
/// 造成平台邏輯散落、難以在非目標平台驗證。
enum AppPlatform { android, ios, other }

class PlatformInfo {
  PlatformInfo._();

  /// 取得目前平台。Web 版（kIsWeb）視為 [AppPlatform.other]，
  /// 因為 `dart:io` 在 Web 上不可用。
  static AppPlatform get current {
    if (kIsWeb) return AppPlatform.other;
    if (Platform.isAndroid) return AppPlatform.android;
    if (Platform.isIOS) return AppPlatform.ios;
    return AppPlatform.other;
  }

  static bool get isAndroid => current == AppPlatform.android;

  static bool get isIOS => current == AppPlatform.ios;

  /// 是否為 iOS 裝置（不包含 Web／桌面）。WidgetKit 與 App Intents 僅 iOS 可用。
  static bool get isApple => current == AppPlatform.ios;

  /// 供後端登入稽核辨識來源的 User-Agent 平台標記。
  static String get userAgentPlatform {
    switch (current) {
      case AppPlatform.android:
        return 'Android';
      case AppPlatform.ios:
        return 'iOS';
      case AppPlatform.other:
        return Platform.operatingSystem;
    }
  }
}
