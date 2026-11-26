import CryptoKit
import Foundation
import XCTest
@testable import Runner

final class NotificationCaptureTests: XCTestCase {
  private let sample = "您的卡號末四碼 5678，於星星商店支付 NT$75。"
  private let time = Date(timeIntervalSince1970: 1_795_689_600)

  private struct FixtureKey: OfflineKeyProviding {
    func key() throws -> SymmetricKey { SymmetricKey(data: Data(repeating: 55, count: 32)) }
  }

  private final class Clock: @unchecked Sendable {
    private let lock = NSLock()
    private var date: Date
    init(_ start: Date) { date = start }
    func now() -> Date { lock.withLock { date } }
    func advance(_ seconds: TimeInterval) { lock.withLock { date = date.addingTimeInterval(seconds) } }
  }

  private actor Recognizer {
    var sent: [PaymentNotification] = []
    var codes: [Int]

    init(_ codes: [Int] = [200]) { self.codes = codes }

    func receive(_ notice: PaymentNotification) -> NotificationCaptureResponse {
      sent.append(notice)
      let code = codes.isEmpty ? 200 : codes.removeFirst()
      let value = RecognizedPayment(amount: "75", currency: "TWD", merchant: "星星商店",
        occurredAt: notice.receivedAt, date: "2026-11-26")
      return NotificationCaptureResponse(status: code, retryAfter: code == 429 ? 120 : nil,
        result: code == 200 ? NotificationRecognitionReply(outcome: "draft", draft: value) : nil)
    }
  }

  private func fixture(recognizer: Recognizer, clock: Clock) throws -> (NotificationCaptureService, URL, UserDefaults) {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let domain = "com.assetpilot.capture-test.\(folder.lastPathComponent)"
    let preferences = try XCTUnwrap(UserDefaults(suiteName: domain))
    addTeardownBlock {
      preferences.removePersistentDomain(forName: domain)
      if FileManager.default.fileExists(atPath: folder.path) { try FileManager.default.removeItem(at: folder) }
    }
    return (makeCapture(folder, preferences: preferences, recognizer: recognizer, clock: clock), folder, preferences)
  }

  private func makeCapture(_ folder: URL, preferences: UserDefaults, recognizer: Recognizer, clock: Clock) -> NotificationCaptureService {
    NotificationCaptureService(directory: folder, keys: FixtureKey(), preferences: preferences, clock: { clock.now() }) { notice, _ in
      await recognizer.receive(notice)
    }
  }

  private func enable(_ service: NotificationCaptureService, owner: String = "alice") async throws {
    try await service.bindOwner(owner)
    let binding = NotificationCaptureBinding(token: "fixture-capture-token", revision: "fixture-revision",
      baseURL: URL(string: "https://example.test")!, sources: [
        NotificationCaptureSource(id: "ctbc", name: "中國信託", appNames: ["中國信託行動銀行"]),
        NotificationCaptureSource(id: "line-pay", name: "LINE Pay", appNames: ["LINE Pay"]),
      ])
    let enabled = try await service.enable(for: owner, binding: binding)
    XCTAssertTrue(enabled)
  }

  func testCapturesAllowedAppsAndDistinguishesTwoEqualPurchases() async throws {
    let recognizer = Recognizer()
    let (service, folder, _) = try fixture(recognizer: recognizer, clock: Clock(time))
    try await enable(service)
    for instant in [time, time, time.addingTimeInterval(1)] {
      _ = try await service.capture(appName: "中國信託行動銀行", title: "消費通知", subtitle: nil, body: sample, receivedAt: instant)
    }
    _ = try await service.capture(appName: "ＬＩＮＥ Pay", title: "付款通知", subtitle: nil, body: sample, receivedAt: time)
    _ = try await service.capture(appName: "LINE", title: "付款通知", subtitle: nil, body: sample, receivedAt: time)
    _ = try await service.capture(appName: "LINE Pay", title: "刷卡驗證碼", subtitle: nil, body: "你的刷卡驗證碼 123411", receivedAt: time)
    let sent = await recognizer.sent
    XCTAssertEqual(sent.count, 3)
    XCTAssertTrue(sent.allSatisfy { !$0.body.contains("5678") && $0.body.contains("NT$75") })
    let drafts = try await service.snapshot().drafts
    XCTAssertEqual(drafts.count, 3)
    XCTAssertTrue(drafts.contains { draft in drafts.contains(where: draft.resembles) })
    XCTAssertTrue(drafts.allSatisfy { $0.id.count == 32 && $0.notice == nil })
    let encrypted = try Data(contentsOf: folder.appendingPathComponent("inbox.v1"))
    XCTAssertNil(encrypted.range(of: Data("星星商店".utf8)))
  }

  func testQueueSurvivesRestartAndHonorsRateLimit() async throws {
    let recognizer = Recognizer([429, 200])
    let clock = Clock(time)
    let (service, folder, preferences) = try fixture(recognizer: recognizer, clock: clock)
    try await enable(service)
    _ = try await service.capture(appName: "LINE Pay", title: "付款通知", subtitle: nil, body: sample, receivedAt: time)
    let restarted = makeCapture(folder, preferences: preferences, recognizer: recognizer, clock: clock)
    let before = try await restarted.snapshot()
    XCTAssertEqual(before.drafts.first?.status, .queued)
    XCTAssertEqual(before.lastStatus, "limited")
    clock.advance(60)
    try await restarted.process(ownerId: "alice")
    let limitedAttempts = await recognizer.sent.count
    XCTAssertEqual(limitedAttempts, 1)
    clock.advance(61)
    try await restarted.process(ownerId: "alice")
    let after = try await restarted.snapshot()
    XCTAssertEqual(after.drafts.first?.status, .ready)
    XCTAssertNil(after.drafts.first?.notice)
    XCTAssertEqual(before.drafts.first?.id, after.drafts.first?.id)
  }

  func testDisablingAndChangingAccountsClearPendingText() async throws {
    let recognizer = Recognizer([503])
    let (service, _, _) = try fixture(recognizer: recognizer, clock: Clock(time))
    try await enable(service)
    _ = try await service.capture(appName: "LINE Pay", title: "付款通知", subtitle: nil, body: sample, receivedAt: time)
    try await service.disable(for: "alice")
    let disabled = try await service.capture(appName: "LINE Pay", title: "付款通知", subtitle: nil, body: sample, receivedAt: time)
    XCTAssertEqual(disabled, "disabled")
    let saved = try await service.snapshot().drafts
    XCTAssertEqual(saved.first?.status, .review)
    XCTAssertNil(saved.first?.notice)
    try await service.endSession()
    try await service.bindOwner("bob")
    let bob = try await service.snapshot()
    XCTAssertEqual(bob.ownerId, "bob")
    XCTAssertTrue(bob.drafts.isEmpty)
    try await service.bindOwner("alice")
    let alice = try await service.snapshot()
    XCTAssertEqual(saved.first?.id, alice.drafts.first?.id)
    XCTAssertNil(alice.revision)
  }

  func testExpiryAndNewConsentRemoveQueuedContent() async throws {
    let recognizer = Recognizer([503, 409])
    let clock = Clock(time)
    let (service, _, _) = try fixture(recognizer: recognizer, clock: clock)
    try await enable(service)
    _ = try await service.capture(appName: "LINE Pay", title: "付款通知", subtitle: nil, body: sample, receivedAt: time)
    clock.advance(NotificationCaptureService.retention + 1)
    let expired = try await service.snapshot()
    XCTAssertEqual(expired.lastStatus, "expired")
    XCTAssertNil(expired.drafts.first?.notice)
    _ = try await service.capture(appName: "LINE Pay", title: "付款通知", subtitle: nil, body: sample, receivedAt: clock.now())
    let consent = try await service.snapshot()
    XCTAssertEqual(consent.lastStatus, "consent")
    XCTAssertNil(consent.revision)
    XCTAssertTrue(consent.drafts.allSatisfy { $0.notice == nil })
  }
}
