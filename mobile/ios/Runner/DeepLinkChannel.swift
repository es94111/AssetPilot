import Flutter
import UIKit

/// 把系統送來的深層連結（`assetpilot://…`）轉送給 Flutter 層。
///
/// ## 為什麼需要自己實作
///
/// `app_links` 套件在 iOS 上有兩個已知限制，會讓 Widget／Siri 開啟的
/// 連結送不到 Dart 端：
///
/// 1. **註冊時機晚於場景連線。** 套件透過 `registrar.addSceneDelegate(...)`
///    註冊自己的場景代理，而本專案使用 `FlutterImplicitEngineDelegate`，
///    插件是在 `didInitializeImplicitFlutterEngine` 才註冊的——那時場景早已
///    連線完成，冷啟動時帶在 `connectionOptions.urlContexts` 的連結因此
///    不會被套件看見。
/// 2. **事件通道尚未訂閱時直接丟棄。** 套件的 `handleLink(url:)` 在
///    `eventSink == nil`（Dart 端還沒訂閱）時直接 return，連結就消失了。
///
/// 這裡改以自己的事件通道轉送，並保留一份「待處理連結」，
/// 讓 Dart 端隨時可以取回冷啟動的那一筆。
///
/// ## 通道名稱為何分成兩個
///
/// `FlutterMethodChannel` 與 `FlutterEventChannel` 底層都用
/// `setMessageHandlerOnChannel:` 註冊處理器，而 Flutter 官方文件的說明是
/// 「identically named channels interfere with each other's communication」。
/// 若兩者共用同一個名稱，後註冊的事件通道會覆蓋方法通道的處理器，
/// 結果是 `takePendingLink` 永遠收不到回應。因此這裡刻意分成：
///
/// - 方法通道 `assetpilot/deep_link`：取回冷啟動連結。
/// - 事件通道 `assetpilot/deep_link/events`：推播即時連結。
///
/// ## 為什麼待處理連結要「依 host 分取」
///
/// 本 App 有兩類互不相干的連結消費者：
///
/// - 記帳入口（`transaction`／`ledger`）：Widget 與 Siri 捷徑。
/// - 登入回呼（`google-callback`／`line-callback`／`auth-ticket`）。
///
/// 若待處理連結只有一格，任一方先取走就會讓另一方永遠收不到冷啟動連結。
/// 因此 `takePendingLink` 支援以 host 過濾：記帳入口只取 `transaction`／
/// `ledger`，登入流程只取自己那一種回呼，兩者互不干擾。
///
/// ## 支援的連結
///
/// - `assetpilot://transaction/new?…` — 開啟記帳表單（Widget 與 Siri 共用）。
/// - `assetpilot://ledger/invite?token=…` — 共享帳本邀請。
/// - `assetpilot://google-callback?…` — Google 登入回呼。
/// - `assetpilot://line-callback?…` — LINE 登入回呼。
/// - `assetpilot://auth-ticket?ticket=…` — Passkey 登入回呼。
///
/// 連結只帶參數，不含任何憑證；憑證一律留在後端與瀏覽器端。
final class DeepLinkChannel: NSObject, FlutterPlugin, FlutterStreamHandler {
  /// 方法通道名稱（與 `lib/platform/app_link_service.dart` 一致）。
  static let methodChannelName = "assetpilot/deep_link"

  /// 事件通道名稱（與 `lib/platform/app_link_service.dart` 一致）。
  static let eventChannelName = "assetpilot/deep_link/events"

  /// 待處理連結與歷史記錄（規則見 `DeepLinkQueue`）。
  private static var queue = DeepLinkQueue()

  /// 目前的事件接收器。Dart 端訂閱後才會有值。
  private static var eventSink: FlutterEventSink?

  static func register(with registrar: FlutterPluginRegistrar?) {
    guard let registrar else { return }
    let methodChannel = FlutterMethodChannel(
      name: methodChannelName,
      binaryMessenger: registrar.messenger()
    )
    let eventChannel = FlutterEventChannel(
      name: eventChannelName,
      binaryMessenger: registrar.messenger()
    )
    let instance = DeepLinkChannel()
    registrar.addMethodCallDelegate(instance, channel: methodChannel)
    eventChannel.setStreamHandler(instance)
  }

  // MARK: - Method channel

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "takePendingLink":
      // 取走一筆待處理的連結（取走後即移除，避免重複投遞）。
      // 可用 hosts 過濾，讓不同用途的消費者互不干擾。
      result(
        DeepLinkChannel.queue.takePending(hosts: DeepLinkChannel.hosts(from: call))
      )
    case "getInitialLink":
      // 讀取（不清除）最近一筆符合條件的連結。
      result(
        DeepLinkChannel.queue.latest(hosts: DeepLinkChannel.hosts(from: call))
      )
    case "clearPendingLinks":
      // 清除待處理的捷徑輸入（計畫書 5.2 步驟 7：登出／切換帳號時
      // 不得把上一個帳號的待處理連結帶到下一個帳號）。
      // 歷史記錄刻意保留，供 OAuth 回呼比對重複投遞。
      DeepLinkChannel.queue.clearPending()
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  /// 從方法呼叫參數取出 host 過濾條件。
  ///
  /// Dart 端傳入 `{"hosts": ["transaction", "ledger"]}`；未傳則不過濾。
  private static func hosts(from call: FlutterMethodCall) -> [String]? {
    guard let args = call.arguments as? [String: Any],
          let hosts = args["hosts"] as? [String],
          !hosts.isEmpty
    else { return nil }
    return hosts
  }

  // MARK: - Event channel

  func onListen(
    withArguments arguments: Any?,
    eventSink events: @escaping FlutterEventSink
  ) -> FlutterError? {
    DeepLinkChannel.eventSink = events
    // Dart 端剛訂閱時若已有待處理連結，立即補送，避免冷啟動時序造成遺漏。
    for link in DeepLinkChannel.queue.drainPending() {
      events(link)
    }
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    DeepLinkChannel.eventSink = nil
    return nil
  }

  // MARK: - 連結入口

  /// 記錄並投遞一個深層連結。
  ///
  /// 這是所有入口（場景連線、場景開啟 URL、AppDelegate 回呼、繼續
  /// 使用者活動）的唯一收斂點，確保不論從哪裡進來，連結都會送到 Dart。
  static func handle(url: URL) {
    // 只處理本 App 自己的 scheme，避免把其他 App 的連結也送進來。
    guard url.scheme == "assetpilot" else { return }
    let link = url.absoluteString
    let hasListener = eventSink != nil
    queue.record(link, hasListener: hasListener)
    if let sink = eventSink {
      sink(link)
    }
  }

  /// 由 `SceneDelegate`／`AppDelegate` 呼叫，轉送一批 URL。
  static func handle(urls: [URL]) {
    for url in urls {
      handle(url: url)
    }
  }

  // MARK: - 測試用

  /// 清空佇列狀態（僅供單元測試使用）。
  static func resetForTesting() {
    queue.reset()
    eventSink = nil
  }

  /// 目前的待處理連結數量（僅供單元測試使用）。
  static var pendingCountForTesting: Int { queue.pending.count }

  /// 最近收到的連結（僅供單元測試使用）。
  ///
  /// 用來驗證「連結真的從作業系統抵達了」——不只是單純測佇列的規則，
  /// 而是確認 `scene(_:openURLContexts:)` 等入口有把連結交給本通道。
  static var receivedLinksForTesting: [String] { queue.recent }
}
