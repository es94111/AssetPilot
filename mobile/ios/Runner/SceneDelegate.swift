import Flutter
import UIKit

/// App 的 UISceneDelegate。
///
/// ## 為什麼要自己轉送深層連結
///
/// Widget 與 Siri 捷徑都靠 `assetpilot://` 自訂 URL scheme 開啟 App，
/// 但 `app_links` 套件預設是透過 `registrar.addSceneDelegate(...)`
/// 註冊自己的 `UISceneDelegate` 來接收連結。在本專案的啟動流程中
/// （`FlutterImplicitEngineDelegate` + `didInitializeImplicitFlutterEngine`），
/// 插件註冊的時機晚於 App 已經啟動、場景已經連線的時刻，
/// 導致冷啟動時帶在 `connectionOptions.urlContexts` 的連結不會送達 Dart 端。
///
/// 因此在這裡明確攔截三個入口，統一交給 `DeepLinkChannel`：
///
/// 1. `scene(_:willConnectTo:options:)` 的 `connectionOptions.urlContexts`
///    —— **冷啟動**（App 尚未執行就被 Widget／Siri 喚醒）。
/// 2. `scene(_:openURLContexts:)` —— App 已在前景時再收到連結。
/// 3. `scene(_:continue:)` 的 `userActivities` —— Universal Links。
///
/// 同時也保留 `super` 的行為，避免影響其他插件的場景生命週期。
class SceneDelegate: FlutterSceneDelegate {

  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    // 冷啟動：連結隨場景連線一起送來。此時 Flutter 引擎尚未就緒，
    // DeepLinkChannel 會先把它存成「待處理連結」，等 Dart 端取回。
    var urls = connectionOptions.urlContexts.map { $0.url }
    // Universal Links 在冷啟動時以使用者活動的形式送來。
    urls.append(contentsOf: connectionOptions.userActivities.compactMap { $0.webpageURL })
    SceneDelegate.routeDeepLinks(urls)
    super.scene(scene, willConnectTo: session, options: connectionOptions)
  }

  /// FlutterSceneDelegate 的 `openURLContexts` 回傳 `void`
  /// （對應 FlutterSceneLifeCycle.h 中 `FlutterPluginSceneLifeCycleDelegate`
  /// 的宣告），並會把事件轉送給已註冊的插件場景代理。
  override func scene(
    _ scene: UIScene,
    openURLContexts URLContexts: Set<UIOpenURLContext>
  ) {
    SceneDelegate.routeDeepLinks(URLContexts.map { $0.url })
    // 交給 super，讓 Flutter 把事件轉送給其他插件的場景生命週期代理。
    super.scene(scene, openURLContexts: URLContexts)
  }

  /// Universal Links（`https://asset.shao.one/…`）以使用者活動的形式送來。
  override func scene(
    _ scene: UIScene,
    continue userActivity: NSUserActivity
  ) {
    if let url = userActivity.webpageURL {
      SceneDelegate.routeDeepLinks([url])
    }
    super.scene(scene, continue: userActivity)
  }

  /// 把場景收到的連結交給深層連結通道。
  ///
  /// 抽成獨立的 static 函式有兩個原因：
  ///
  /// 1. **可測試。** `UIScene`、`UIScene.ConnectionOptions` 與
  ///    `UIOpenURLContext` 的 `init` 在 SDK 中皆標示為 `NS_UNAVAILABLE`，
  ///    測試無法直接構造，因此無法在單元測試裡呼叫上面的三個
  ///    場景方法。把「取出的連結交給通道」這一步獨立出來後，
  ///    就能在 `ios/RunnerTests/DeepLinkDeliveryTests.swift` 直接驗證。
  /// 2. **單一收斂點。** 三個場景入口共用同一段轉送邏輯，
  ///    連結的處理規則只存在一份。
  static func routeDeepLinks(_ urls: [URL]) {
    DeepLinkChannel.handle(urls: urls)
  }
}
