import Flutter
import UIKit

/// 設定 App 的顯示語言（iOS 對應 Android 的 per-app language）。
///
/// Android 以 `AppCompatDelegate.setApplicationLocales` 寫入系統語言存放區，
/// iOS 沒有等價 API；這裡改以 `UserDefaults` 記錄使用者選擇，並在啟動時
/// 套用到 `AppleLanguages`，讓「設定 → 語言」在 iOS 上同樣持久生效。
///
/// 語言代碼沿用 Android 的 BCP-47 tag（見 shared/i18n/locales.json 的
/// `androidTag`），以維持兩平台的語系設定一致。
final class LocaleChannel: NSObject, FlutterPlugin {
  private static let channelName = "assetpilot/locale"
  private static let languageKey = "assetpilot.appLanguage"
  private static let defaults = UserDefaults.standard

  static func register(with registrar: FlutterPluginRegistrar?) {
    guard let registrar else { return }
    let channel = FlutterMethodChannel(
      name: channelName,
      binaryMessenger: registrar.messenger()
    )
    let instance = LocaleChannel()
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "setLocale":
      guard let args = call.arguments as? [String: Any],
            let tag = args["tag"] as? String else {
        result(FlutterError(code: "invalid_arguments",
                            message: "missing tag", details: nil))
        return
      }
      LocaleChannel.applyLanguageTag(tag)
      result(nil)
    case "getLocale":
      result(LocaleChannel.currentLanguageTag())
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  /// 寫入使用者選擇的語言，並同步更新 AppleLanguages。
  static func applyLanguageTag(_ tag: String) {
    let normalized = tag.trimmingCharacters(in: .whitespacesAndNewlines)
    if normalized.isEmpty {
      defaults.removeObject(forKey: languageKey)
      defaults.removeObject(forKey: "AppleLanguages")
    } else {
      defaults.set(normalized, forKey: languageKey)
      defaults.set([normalized], forKey: "AppleLanguages")
    }
    defaults.synchronize()
  }

  /// 目前生效的語言標籤；未設定時回傳空字串（代表跟隨系統語言）。
  static func currentLanguageTag() -> String {
    return defaults.string(forKey: languageKey) ?? ""
  }
}
