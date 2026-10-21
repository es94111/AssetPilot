import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    let registry = engineBridge.pluginRegistry
    GeneratedPluginRegistrant.register(with: registry)
    AppGroupChannel.register(with: registry.registrar(forPlugin: "AppGroupChannel"))
    AppleAuthChannel.register(with: registry.registrar(forPlugin: "AppleAuthChannel"))
    LocaleChannel.register(with: registry.registrar(forPlugin: "LocaleChannel"))
    WidgetReloadChannel.register(with: registry.registrar(forPlugin: "WidgetReloadChannel"))
    DeepLinkChannel.register(with: registry.registrar(forPlugin: "DeepLinkChannel"))
  }

  /// 舊式（無場景）的 URL 回呼入口。
  ///
  /// 本專案使用 `UIScene`（`SceneDelegate`），正常情況下連結會走場景代理；
  /// 但系統仍可能以 AppDelegate 的方式送達（例如 App 尚未建立場景時）。
  /// 這裡統一交給 `DeepLinkChannel`，確保兩條路徑都不漏。
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    DeepLinkChannel.handle(url: url)
    return super.application(app, open: url, options: options)
  }
}

/// 提供 App Group container 路徑給 Flutter 層（platform/app_group_store.dart）。
///
/// Flutter 套件未直接暴露 App Group container API，因此在此以 platform channel
/// 提供解析結果。只有在 App 已加入 App Group entitlement 時才會成功；
/// 失敗時回傳 nil，由 Dart 端退回 App 私有目錄。
final class AppGroupChannel: NSObject, FlutterPlugin {
  private static let channelName = "assetpilot/app_group"
  private static let appGroupId = "group.com.assetpilot.assetpilot"

  static func register(with registrar: FlutterPluginRegistrar?) {
    guard let registrar else { return }
    let channel = FlutterMethodChannel(
      name: channelName,
      binaryMessenger: registrar.messenger()
    )
    let instance = AppGroupChannel()
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "containerPath":
      guard let url = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: AppGroupChannel.appGroupId
      ) else {
        result(nil)
        return
      }
      result(url.path)
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
