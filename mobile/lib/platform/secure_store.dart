import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'platform_info.dart';

/// 平台適當的加密憑證儲存。
///
/// - Android：Keystore-backed `EncryptedSharedPreferences`（[AndroidOptions]）。
/// - iOS：Keychain（[IOSOptions]），可設為「裝置首次解鎖後可用」，
///   避免在裝置鎖定時讀取憑證失敗。
/// - 其他平台：沿用套件預設。
///
/// 原本的呼叫只帶 `aOptions`，在 iOS 上會被忽略而退回套件預設；
/// 這裡明確依平台選擇，讓憑證儲存行為在兩個平台都可預期，
/// 並讓「iOS 用 Keychain」這件事在程式碼中可見。
class SecureStore {
  SecureStore._();

  static final FlutterSecureStorage _instance = FlutterSecureStorage(
    aOptions: const AndroidOptions(),
    iOptions: const IOSOptions(
      accessibility: KeychainAccessibility.first_unlock,
    ),
  );

  /// 目前平台實際使用的儲存後端說明（供設定頁顯示與除錯）。
  static String get backendDescription {
    if (PlatformInfo.isAndroid) return 'Android Keystore';
    if (PlatformInfo.isIOS) return 'iOS Keychain';
    return 'Platform default';
  }

  static Future<String?> read(String key) => _instance.read(key: key);

  static Future<void> write(String key, String value) =>
      _instance.write(key: key, value: value);

  static Future<void> delete(String key) => _instance.delete(key: key);
}
