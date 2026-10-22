import Flutter
import UIKit
import WidgetKit

/// 請 WidgetKit 重載 AssetPilot 的 Widget。
///
/// 主 App 寫入 App Group 快照後呼叫本 channel，要求系統重載 Widget。
/// WidgetKit 對更新頻率有預算限制（每日約 40–70 次），因此 Dart 端只在
/// 「主 App 取得新資料後」呼叫一次，不做輪詢。
final class WidgetReloadChannel: NSObject, FlutterPlugin {
  private static let channelName = "assetpilot/widget_reload"

  /// Widget 的 kind 識別（需與 AssetPilotWidgetBundle 中的 Widget 一致）。
  private static let widgetKinds = [
    "AssetPilotMonthlyOverviewWidget",
    "AssetPilotQuickTransactionWidget",
  ]

  static func register(with registrar: FlutterPluginRegistrar?) {
    guard let registrar else { return }
    let channel = FlutterMethodChannel(
      name: channelName,
      binaryMessenger: registrar.messenger()
    )
    let instance = WidgetReloadChannel()
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "reloadAll":
      WidgetReloadChannel.widgetKinds.forEach { kind in
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
      }
      result(true)
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
