import Flutter
import UIKit
import XCTest

@testable import Runner

/// 深層連結「從作業系統到原生通道」的實際交付路徑測試。
///
/// 與 `DeepLinkQueueTests` 互補：那組測的是佇列的**規則**，
/// 這組測的是**連結真的進得來**——也就是場景代理的各個入口，
/// 有沒有把連結交給 `DeepLinkChannel`。
///
/// 這是先前在模擬器上無法驗收的部分：headless 模擬器的 SpringBoard
/// 會對外部 `openurl` 顯示「要在『AssetPilot』中打開嗎？」的確認提示，
/// 沒有 UI 宿主可點「打開」，連結因此送不到 App。
/// 本測試改由 App 內部直接觸發轉送點，繞開 SpringBoard 的提示，
/// 驗證 App 自己的那一段接線是正確的。
///
/// 註：`UIScene`、`UIScene.ConnectionOptions` 與 `UIOpenURLContext`
/// 的 `init` 在 SDK 中皆標示為 `NS_UNAVAILABLE`，無法在測試中直接構造，
/// 因此這裡測的是 `SceneDelegate.routeDeepLinks`（三個場景入口共用的
/// 轉送點）與 `DeepLinkChannel.handle` 的行為。
class DeepLinkDeliveryTests: XCTestCase {

  override func setUp() {
    super.setUp()
    DeepLinkChannel.resetForTesting()
  }

  override func tearDown() {
    DeepLinkChannel.resetForTesting()
    super.tearDown()
  }

  // MARK: - 通道本身

  func test非本App的Scheme不會被轉送() {
    // 系統可能把其他 App 的連結轉給本 App（例如「在別的 App 開啟」）。
    // 只接受 assetpilot://，避免把不相關的連結送進 Dart 層。
    DeepLinkChannel.handle(url: URL(string: "https://example.com/transaction/new")!)

    XCTAssertTrue(DeepLinkChannel.receivedLinksForTesting.isEmpty)
  }

  func test本App的Scheme會被轉送() {
    DeepLinkChannel.handle(url: URL(string: "assetpilot://transaction/new?amount=120")!)

    XCTAssertEqual(
      DeepLinkChannel.receivedLinksForTesting,
      ["assetpilot://transaction/new?amount=120"]
    )
  }

  func testDart端未監聽時連結會留在待處理佇列() {
    // 冷啟動情境：連結在 Flutter 引擎就緒前抵達。
    DeepLinkChannel.handle(url: URL(string: "assetpilot://transaction/new")!)

    XCTAssertEqual(DeepLinkChannel.pendingCountForTesting, 1)
  }

  // MARK: - 場景代理的轉送點

  func test場景轉送點會把連結送進通道() {
    SceneDelegate.routeDeepLinks([
      URL(string: "assetpilot://transaction/new?type=expense&amount=99")!
    ])

    XCTAssertEqual(
      DeepLinkChannel.receivedLinksForTesting,
      ["assetpilot://transaction/new?type=expense&amount=99"]
    )
  }

  func test場景轉送點會轉送多個連結() {
    SceneDelegate.routeDeepLinks([
      URL(string: "assetpilot://transaction/new?amount=1")!,
      URL(string: "assetpilot://transaction/new?amount=2")!
    ])

    XCTAssertEqual(DeepLinkChannel.receivedLinksForTesting.count, 2)
  }

  func test場景轉送點會忽略非本App的連結() {
    SceneDelegate.routeDeepLinks([
      URL(string: "https://example.com/x")!,
      URL(string: "assetpilot://transaction/new")!
    ])

    XCTAssertEqual(
      DeepLinkChannel.receivedLinksForTesting,
      ["assetpilot://transaction/new"]
    )
  }

  // MARK: - 與記帳入口的相容性

  func test記帳入口連結的欄位可被Dart端解析() {
    // Dart 端（lib/app.dart）讀的是 host == 'transaction'、path == '/new'，
    // 參數是 type／amount／category／account。原生端轉送時必須原封不動，
    // 不能改寫或丟棄 query。
    let link = "assetpilot://transaction/new?type=expense&amount=120&category=餐費"
    SceneDelegate.routeDeepLinks([URL(string: link)!])

    guard let received = DeepLinkChannel.receivedLinksForTesting.first,
          let url = URL(string: received) else {
      return XCTFail("連結未成功轉送")
    }
    XCTAssertEqual(url.scheme, "assetpilot")
    XCTAssertEqual(url.host, "transaction")
    XCTAssertEqual(url.path, "/new")

    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let query = components?.queryItems ?? []
    XCTAssertEqual(query.first(where: { $0.name == "type" })?.value, "expense")
    XCTAssertEqual(query.first(where: { $0.name == "amount" })?.value, "120")
    XCTAssertEqual(query.first(where: { $0.name == "category" })?.value, "餐費")
  }

  func testSiri捷徑的連結格式與Widget一致() {
    // Widget 與 Siri 都走 assetpilot://transaction/new，只是 query 不同。
    // 兩者都必須能被同一個 Dart 端入口辨識。
    let widgetLink = "assetpilot://transaction/new?source=widget"
    let siriLink = "assetpilot://transaction/new?source=siri&type=expense&amount=120"

    SceneDelegate.routeDeepLinks([URL(string: widgetLink)!, URL(string: siriLink)!])

    XCTAssertEqual(DeepLinkChannel.receivedLinksForTesting.count, 2)
    for received in DeepLinkChannel.receivedLinksForTesting {
      let url = URL(string: received)!
      XCTAssertEqual(url.scheme, "assetpilot")
      XCTAssertEqual(url.host, "transaction")
      XCTAssertEqual(url.path, "/new")
    }
  }

  // MARK: - 與登入回呼的隔離

  func test登入回呼與記帳入口可以依Host分取() {
    // 冷啟動時可能同時有登入回呼與記帳入口的連結待處理；
    // 兩者必須能各自取回自己那一種。
    SceneDelegate.routeDeepLinks([
      URL(string: "assetpilot://google-callback?code=abc")!,
      URL(string: "assetpilot://transaction/new?amount=50")!
    ])

    XCTAssertEqual(DeepLinkChannel.pendingCountForTesting, 2)
  }
}
