import XCTest

@testable import Runner

/// 登出時清除「待處理捷徑輸入」的行為（計畫書 5.2 步驟 7）。
///
/// 情境：使用者 A 在 App 前景時用 Widget／Siri 產生一筆
/// `assetpilot://transaction/new` 連結，但此時 Dart 端尚未訂閱事件通道，
/// 連結留在原生層的待處理佇列。若使用者 A 登出、改用使用者 B 登入，
/// 那筆連結不得在 B 的畫面上被取出——否則等於把 A 的輸入帶進 B 的帳本。
class DeepLinkQueueLogoutTests: XCTestCase {

  func testclearPending會移除待處理連結() {
    var queue = DeepLinkQueue()
    queue.record("assetpilot://transaction/new?amount=100", hasListener: false)

    XCTAssertEqual(queue.pending.count, 1)

    queue.clearPending()

    XCTAssertTrue(queue.pending.isEmpty, "登出後不得留下待處理的捷徑輸入")
  }

  func testclearPending保留歷史記錄() {
    var queue = DeepLinkQueue()
    queue.record("assetpilot://transaction/new?amount=100", hasListener: true)

    queue.clearPending()

    // 歷史記錄供 OAuth 流程比對「這次回呼是不是新產生的」，
    // 與帳號權限無關，不應因登出而清掉。
    XCTAssertEqual(queue.recent.count, 1, "登出不應清除歷史記錄")
    XCTAssertEqual(
      queue.latest(hosts: ["transaction"]),
      "assetpilot://transaction/new?amount=100"
    )
  }

  func testclearPending後取出回傳nil() {
    var queue = DeepLinkQueue()
    queue.record("assetpilot://transaction/new", hasListener: false)

    queue.clearPending()

    XCTAssertNil(
      queue.takePending(hosts: ["transaction"]),
      "清除後不得再取回該連結"
    )
  }

  func testclearPending只影響pending不影響recent順序() {
    var queue = DeepLinkQueue()
    queue.record("assetpilot://transaction/a", hasListener: false)
    queue.record("assetpilot://transaction/b", hasListener: false)

    queue.clearPending()

    XCTAssertTrue(queue.pending.isEmpty)
    XCTAssertEqual(queue.recent.count, 2, "歷史記錄順序與內容不受影響")
    XCTAssertEqual(queue.latest(hosts: ["transaction"]), "assetpilot://transaction/b")
  }

  func testclearPending可重複呼叫() {
    var queue = DeepLinkQueue()
    queue.clearPending()
    queue.clearPending()
    XCTAssertTrue(queue.pending.isEmpty)
    XCTAssertTrue(queue.recent.isEmpty)
  }

  func testclearPending後仍可記錄新連結() {
    var queue = DeepLinkQueue()
    queue.record("assetpilot://transaction/a", hasListener: false)
    queue.clearPending()

    queue.record("assetpilot://transaction/b", hasListener: false)

    XCTAssertEqual(queue.pending.count, 1)
    XCTAssertEqual(
      queue.takePending(hosts: ["transaction"]),
      "assetpilot://transaction/b"
    )
  }
}
