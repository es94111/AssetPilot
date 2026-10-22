import XCTest

@testable import Runner

/// 深層連結佇列的原生端單元測試。
///
/// 這組測試對應 `docs/ios-app-development-plan.md` 第 5.4 節
/// （Siri／捷徑深層連結）的連結交接規則。重點驗證三件事：
///
/// 1. 冷啟動時抵達的連結（Dart 端尚未監聽）不會遺失。
/// 2. 記帳入口與登入回呼可以「依 host 分取」，互不搶走對方的連結。
/// 3. 同一筆連結取出後即移除，不會被重複投遞（避免產生兩筆交易）。
class DeepLinkQueueTests: XCTestCase {

  private var queue = DeepLinkQueue()

  override func setUp() {
    super.setUp()
    queue = DeepLinkQueue()
  }

  // MARK: - 基本行為

  func testDart端尚未監聽時連結會留在待處理佇列() {
    queue.record("assetpilot://transaction/new?amount=120", hasListener: false)

    XCTAssertEqual(queue.pending.count, 1)
    XCTAssertEqual(
      queue.takePending(hosts: nil),
      "assetpilot://transaction/new?amount=120"
    )
  }

  func testDart端已在監聽時連結不進待處理佇列() {
    // 已即時投遞的連結不該再排隊，否則 Dart 端會收到兩次。
    queue.record("assetpilot://transaction/new?amount=120", hasListener: true)

    XCTAssertTrue(queue.pending.isEmpty)
    XCTAssertEqual(
      queue.latest(hosts: nil),
      "assetpilot://transaction/new?amount=120"
    )
  }

  func test取出後連結即從佇列移除() {
    queue.record("assetpilot://transaction/new", hasListener: false)

    XCTAssertNotNil(queue.takePending(hosts: nil))
    XCTAssertNil(queue.takePending(hosts: nil))
    XCTAssertTrue(queue.pending.isEmpty)
  }

  func test空佇列取回回傳nil() {
    XCTAssertNil(queue.takePending(hosts: nil))
    XCTAssertNil(queue.latest(hosts: nil))
  }

  // MARK: - 依 host 分取

  func test依Host過濾只取回對應類別的連結() {
    queue.record("assetpilot://google-callback?code=abc", hasListener: false)
    queue.record("assetpilot://transaction/new?amount=50", hasListener: false)
    queue.record("assetpilot://line-callback?code=xyz", hasListener: false)

    // 記帳入口只取 transaction／ledger，不會把登入回呼一起取走。
    XCTAssertEqual(
      queue.takePending(hosts: ["transaction", "ledger"]),
      "assetpilot://transaction/new?amount=50"
    )
    // 登入流程各自取自己的那一種回呼。
    XCTAssertEqual(
      queue.takePending(hosts: ["google-callback"]),
      "assetpilot://google-callback?code=abc"
    )
    XCTAssertEqual(
      queue.takePending(hosts: ["line-callback"]),
      "assetpilot://line-callback?code=xyz"
    )
    XCTAssertTrue(queue.pending.isEmpty)
  }

  func test過濾條件不符時不取走任何連結() {
    queue.record("assetpilot://google-callback?code=abc", hasListener: false)

    // 記帳入口不該取走登入回呼，連結必須留在佇列裡等登入流程來取。
    XCTAssertNil(queue.takePending(hosts: ["transaction", "ledger"]))
    XCTAssertEqual(queue.pending.count, 1)
  }

  func testHistory不受取回影響() {
    // latest() 是「讀取」而非「取走」：OAuth 流程需要在開啟瀏覽器前後
    // 各比對一次，才能分辨本次新產生的回呼與上次殘留的舊回呼。
    queue.record("assetpilot://google-callback?code=first", hasListener: false)
    _ = queue.takePending(hosts: ["google-callback"])

    XCTAssertEqual(
      queue.latest(hosts: ["google-callback"]),
      "assetpilot://google-callback?code=first"
    )
  }

  func testHistory依Host取最近一筆相符的連結() {
    queue.record("assetpilot://google-callback?code=first", hasListener: false)
    queue.record("assetpilot://line-callback?code=second", hasListener: false)
    queue.record("assetpilot://google-callback?code=third", hasListener: false)

    XCTAssertEqual(
      queue.latest(hosts: ["google-callback"]),
      "assetpilot://google-callback?code=third"
    )
    XCTAssertEqual(
      queue.latest(hosts: ["line-callback"]),
      "assetpilot://line-callback?code=second"
    )
  }

  // MARK: - 補送與歷史上限

  func test訂閱時補送所有待處理連結() {
    // Dart 端訂閱事件通道的那一刻，原生層要把冷啟動期間收到的連結補送出去，
    // 否則冷啟動喚醒 App 的那一筆連結會遺失。
    queue.record("assetpilot://transaction/new?amount=1", hasListener: false)
    queue.record("assetpilot://transaction/new?amount=2", hasListener: false)

    let drained = queue.drainPending()

    XCTAssertEqual(drained.count, 2)
    XCTAssertEqual(drained.first, "assetpilot://transaction/new?amount=1")
    XCTAssertTrue(queue.pending.isEmpty)
  }

  func test補送後佇列清空不會重複補送() {
    queue.record("assetpilot://transaction/new?amount=1", hasListener: false)

    XCTAssertEqual(queue.drainPending().count, 1)
    XCTAssertTrue(queue.drainPending().isEmpty)
  }

  func test歷史記錄不超過上限() {
    queue.historyLimit = 3
    for index in 0..<5 {
      queue.record("assetpilot://transaction/new?amount=\(index)", hasListener: true)
    }

    XCTAssertEqual(queue.recent.count, 3)
    // 保留的是「最近」的三筆。
    XCTAssertEqual(
      queue.latest(hosts: nil),
      "assetpilot://transaction/new?amount=4"
    )
  }

  // MARK: - host 解析

  func test解析連結的Host() {
    XCTAssertEqual(
      DeepLinkQueue.host(of: "assetpilot://transaction/new"),
      "transaction"
    )
    XCTAssertEqual(
      DeepLinkQueue.host(of: "assetpilot://google-callback?code=abc"),
      "google-callback"
    )
    XCTAssertEqual(DeepLinkQueue.host(of: "not a url"), "")
  }
}
