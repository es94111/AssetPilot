import CryptoKit
import Foundation

struct PaymentNotification: Codable, Sendable {
  let sourceId: String
  let title: String
  let subtitle: String
  let body: String
  let receivedAt: String

  static func prepare(sourceId: String, title: String?, subtitle: String?, body: String?, receivedAt: Date) -> Self? {
    guard [title, subtitle, body].allSatisfy({ ($0?.utf8.count ?? 0) <= 16_384 }) else { return nil }
    let title = (title ?? "").precomposedStringWithCompatibilityMapping
    let subtitle = (subtitle ?? "").precomposedStringWithCompatibilityMapping
    let body = (body ?? "").precomposedStringWithCompatibilityMapping
    let text = "\(title)\n\(subtitle)\n\(body)"
    guard !matches(nonPurchase, in: text), matches(purchaseClue, in: text) else { return nil }
    return Self(
      sourceId: sourceId,
      title: bounded(redact(title), units: 240, bytes: 720),
      subtitle: bounded(redact(subtitle), units: 240, bytes: 720),
      body: bounded(redact(body), units: 2100, bytes: 4300),
      receivedAt: notificationTimestamp(receivedAt)
    )
  }

  private static func bounded(_ value: String?, units: Int, bytes: Int) -> String {
    let sized = String(decoding: (value ?? "").utf16.prefix(units), as: UTF16.self)
    return String(decoding: sized.utf8.prefix(bytes), as: UTF8.self)
  }

  // Match common sensitive events before persisting or contacting the backend.
  // The backend independently screens and redacts input from the device.
  private static let nonPurchase = #"\b(?:OTP|one[- ]time (?:code|password)|verification code|login alert|payment (?:failed|declined)|refund(?:ed)?|cash withdrawal|funds transfer|statement reminder)\b|(?:一次性|動態|簡訊|授權|交易|消費|刷卡)驗證碼|驗證碼\s*[:：]?\s*\d|您的驗證碼|登入(?:成功|通知|提醒|異常|驗證)|優惠活動|限時優惠|抽獎|付款失敗|交易失敗|消費失敗|交易拒絕|刷卡失敗|授權失敗|授權未成功|退(?:款|刷|貨)(?:成功|完成|通知|金額|[:：])|(?:完成|已)退(?:款|刷|貨)|轉帳(?:成功|完成|通知|金額|[:：])|(?:完成|已)轉帳|扣繳|繳款(?:成功|完成|期限|提醒)|帳單(?:提醒|已出帳)|存款(?:通知|成功)|提款(?:通知|成功)"#
  private static let purchaseClue = #"消費|刷卡|交易|付款|支付|扣款|授權|\b(?:purchase|paid|payment|transaction|card spend|debited)\b"#

  private static let redactions: [(String, String)] = [
    (#"https?://\S+"#, "[連結已遮蔽]"),
    (#"[\w.%+-]+@[\w.-]+\.[a-z]{2,}"#, "[信箱已遮蔽]"),
    (#"(?:卡號|信用卡|金融卡|帳號|帳戶|賬號|card(?: number)?|account(?: number)?)(?:\s*(?:末[四4]碼|末碼|尾號|ending in|last four))?\s*[:：#]?\s*(?:[x*•-]+\s*)?\d(?:[ \t-]?\d){3,18}(?![\d.])"#, "[識別資料已遮蔽]"),
    (#"(?:末[四4]碼|尾號|ending in)\s*[:：]?\s*\d{4}(?!\d)"#, "[末碼已遮蔽]"),
    (#"(?<!\d)(?:\d[ \t-]?){11,18}\d(?!\d)"#, "[識別資料已遮蔽]"),
    (#"\b[A-Z][12]\d{8}\b"#, "[識別資料已遮蔽]"),
    (#"(?<!\d)09\d{2}[ \t-]?\d{3}[ \t-]?\d{3}(?!\d)"#, "[電話已遮蔽]"),
    (#"[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}]"#, " "),
  ]

  private static func matches(_ expression: String, in text: String) -> Bool {
    text.range(of: expression, options: [.regularExpression, .caseInsensitive]) != nil
  }

  private static func redact(_ value: String) -> String {
    redactions.reduce(value) { value, redaction in
      value.replacingOccurrences(of: redaction.0, with: redaction.1, options: [.regularExpression, .caseInsensitive])
    }.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  var fingerprint: String {
    let input = [sourceId, receivedAt, title, subtitle, body].joined(separator: "\u{1F}")
    return SHA256.hash(data: Data(input.utf8)).prefix(16).map { String(format: "%02x", $0) }.joined()
  }
}

func normalizedNotificationAppName(_ name: String) -> String {
  let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.folding(options: [.caseInsensitive, .widthInsensitive], locale: Locale(identifier: "en_US_POSIX"))
    .split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
}

func notificationTimestamp(_ date: Date) -> String {
  let format = ISO8601DateFormatter()
  format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return format.string(from: date)
}

struct RecognizedPayment: Codable, Sendable {
  var amount: String?
  var currency: String?
  var merchant: String?
  var occurredAt: String?
  var date: String?
}

struct NotificationRecognitionReply: Decodable, Sendable {
  let outcome: String
  let draft: RecognizedPayment?
}

struct NotificationDraftEdits: Codable, Sendable {
  let amount: String
  let currency: String
  let note: String
  let date: String?
  let accountId: String?
  let categoryId: String?
  let fxRate: String
  let fxFee: String
  let excludeFromStats: Bool
}

struct NotificationCaptureDraft: Codable, Sendable {
  enum Status: String, Codable { case queued, ready, review }

  let id: String
  let sourceId: String
  let sourceName: String
  let receivedAt: Date
  let queuedAt: Date
  var status: Status = .queued
  var notice: PaymentNotification?
  var fields: RecognizedPayment?
  var edits: NotificationDraftEdits?
  var attempts = 0
  var retryAt: Date?

  func resembles(_ other: Self) -> Bool {
    guard id != other.id, sourceId != other.sourceId,
          let amount = fields?.amount, let currency = fields?.currency,
          let merchant = fields?.merchant, let otherMerchant = other.fields?.merchant else { return false }
    return amount == other.fields?.amount && currency == other.fields?.currency
      && normalizedNotificationAppName(merchant) == normalizedNotificationAppName(otherMerchant)
      && abs(receivedAt.timeIntervalSince(other.receivedAt)) <= 5 * 60
  }
}

struct NotificationCaptureSource: Codable, Sendable {
  let id: String
  let name: String
  let appNames: [String]
}
