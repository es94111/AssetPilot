import Foundation

extension Notification.Name {
  static let notificationCaptureChanged = Notification.Name("assetpilot.notificationCaptureChanged")
}

struct NotificationCaptureBinding: Codable, Sendable {
  let token: String
  let revision: String
  let baseURL: URL
  let sources: [NotificationCaptureSource]
}

struct NotificationCaptureResponse: Sendable {
  let status: Int
  let retryAfter: TimeInterval?
  let result: NotificationRecognitionReply?
}

private final class CaptureRedirectPolicy: NSObject, URLSessionTaskDelegate {
  func urlSession(_ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }
}

private let captureSession: URLSession = {
  let config = URLSessionConfiguration.ephemeral
  config.httpShouldSetCookies = false
  config.timeoutIntervalForRequest = 15
  config.timeoutIntervalForResource = 15
  return URLSession(configuration: config, delegate: CaptureRedirectPolicy(), delegateQueue: nil)
}()

func submitNotificationForRecognition(_ notice: PaymentNotification, with binding: NotificationCaptureBinding) async throws -> NotificationCaptureResponse {
  let url = binding.baseURL.appendingPathComponent("api/app/notification-capture/parse")
  var request = URLRequest(url: url)
  request.httpMethod = "POST"
  request.setValue("application/json", forHTTPHeaderField: "Content-Type")
  request.setValue("Bearer \(binding.token)", forHTTPHeaderField: "Authorization")
  request.httpBody = try JSONEncoder().encode(notice)
  let (data, response) = try await captureSession.data(for: request)
  guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
  let result = http.statusCode == 200 ? try JSONDecoder().decode(NotificationRecognitionReply.self, from: data) : nil
  return NotificationCaptureResponse(
    status: http.statusCode, retryAfter: http.value(forHTTPHeaderField: "Retry-After").flatMap(Double.init), result: result
  )
}

private struct NotificationInbox: Codable {
  var drafts: [String: NotificationCaptureDraft] = [:]
  var seen: [String: Date] = [:]
  var lastReceivedAt: Date?
  var lastEventId: String?
  var lastStatus: String?

  mutating func clearWaiting() {
    for id in drafts.keys where drafts[id]?.status == .queued {
      drafts[id]?.status = .review
      drafts[id]?.notice = nil
      drafts[id]?.retryAt = nil
    }
  }

  mutating func prune(now: Date, ttl: TimeInterval) -> Bool {
    let previousSeen = seen.count
    seen = seen.filter { now.timeIntervalSince($0.value) < ttl }
    var changed = seen.count != previousSeen
    // Older versions saved a timestamp even when the invocation had no event ID.
    if lastEventId == nil, lastReceivedAt != nil {
      let latestDraft = drafts.values.max { $0.queuedAt < $1.queuedAt }
      lastEventId = latestDraft?.id
      lastReceivedAt = latestDraft?.queuedAt
      if lastStatus != "consent", lastStatus != "session" {
        lastStatus = latestDraft?.status.rawValue
      }
      changed = true
    }
    for id in drafts.keys where drafts[id]?.status == .queued {
      guard let entry = drafts[id], now.timeIntervalSince(entry.queuedAt) >= ttl
        || now.timeIntervalSince(entry.receivedAt) >= ttl else { continue }
      drafts[id]?.notice = nil
      drafts[id]?.status = .review
      drafts[id]?.retryAt = nil
      if lastEventId == id { lastStatus = "expired" }
      changed = true
    }
    return changed
  }
}

private struct NotificationCaptureArchive: Codable {
  var ownerId: String?
  var binding: NotificationCaptureBinding?
  var inboxes: [String: NotificationInbox] = [:]
}

struct NotificationCaptureSnapshot: Sendable {
  let ownerId: String?
  let revision: String?
  let drafts: [NotificationCaptureDraft]
  let lastStatus: String?
  let lastReceivedAt: Date?
  let nextRetryAt: Date?
}

/// Serializes file mutations across Flutter and background Shortcuts runs. A
/// reply is applied only if its draft, owner and capture credential still exist.
actor NotificationCaptureService {
  static let shared = NotificationCaptureService()
  static let retention: TimeInterval = 7 * 24 * 60 * 60
  private let maxDrafts = 250
  private let maxSeen = 2000
  private let activationKey = "assetpilot.notificationCaptureActive"
  private let directory: URL?
  private let preferences: UserDefaults
  private let keys: OfflineKeyProviding
  private let clock: @Sendable () -> Date
  private let post: @Sendable (PaymentNotification, NotificationCaptureBinding) async throws -> NotificationCaptureResponse
  private var inFlight: Set<String> = []

  init(directory: URL? = nil, keys: OfflineKeyProviding = KeychainOfflineKeyStore.notificationCapture,
       preferences: UserDefaults = .standard,
       clock: @escaping @Sendable () -> Date = { Date() },
       post: @escaping @Sendable (PaymentNotification, NotificationCaptureBinding) async throws -> NotificationCaptureResponse = {
         try await submitNotificationForRecognition($0, with: $1)
       }) {
    self.directory = directory
    self.preferences = preferences
    self.keys = keys
    self.clock = clock
    self.post = post
  }

  private func archiveURL() throws -> URL {
    let folder = try directory ?? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
      appropriateFor: nil, create: false).appendingPathComponent("NotificationCapture", isDirectory: true)
    return folder.appendingPathComponent("inbox.v1")
  }

  private func read() throws -> NotificationCaptureArchive {
    let url = try archiveURL()
    do {
      let encrypted = try Data(contentsOf: url)
      let bytes = try OfflineFileCrypto.decrypt(encrypted, key: keys.key())
      return try JSONDecoder().decode(NotificationCaptureArchive.self, from: bytes)
    } catch CocoaError.fileReadNoSuchFile {
      return NotificationCaptureArchive()
    }
  }

  private func write(_ state: NotificationCaptureArchive) throws {
    let url = try archiveURL()
    var folder = url.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    var metadata = URLResourceValues()
    metadata.isExcludedFromBackup = true
    try folder.setResourceValues(metadata)
    let bytes = try JSONEncoder().encode(state)
    try OfflineFileCrypto.encrypt(bytes, key: keys.key()).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    NotificationCenter.default.post(name: .notificationCaptureChanged, object: nil)
  }

  func bindOwner(_ ownerId: String) throws {
    var state = try read()
    guard state.ownerId != ownerId else { return }
    preferences.set(false, forKey: activationKey)
    if let previous = state.ownerId { state.inboxes[previous]?.clearWaiting() }
    state.ownerId = ownerId
    state.binding = nil
    try write(state)
  }

  func enable(for ownerId: String, binding: NotificationCaptureBinding) throws -> Bool {
    var state = try read()
    guard state.ownerId == ownerId else { return false }
    if state.binding?.revision != binding.revision {
      state.inboxes[ownerId]?.clearWaiting()
      if let status = state.inboxes[ownerId]?.lastStatus, status == "consent" || status == "session" {
        state.inboxes[ownerId]?.lastStatus = nil
      }
    }
    state.binding = binding
    try write(state)
    preferences.set(true, forKey: activationKey)
    return true
  }

  func disable(for ownerId: String) throws {
    var state = try read()
    guard state.ownerId == ownerId else { return }
    preferences.set(false, forKey: activationKey)
    state.binding = nil
    state.inboxes[ownerId]?.clearWaiting()
    try write(state)
  }

  func endSession() throws {
    // This also stops the automation if rewriting the encrypted archive fails.
    preferences.set(false, forKey: activationKey)
    var state = try read()
    guard let owner = state.ownerId else { return }
    state.inboxes[owner]?.clearWaiting()
    state.binding = nil
    state.ownerId = nil
    try write(state)
  }

  func clearUser(_ ownerId: String) throws {
    var state = try read()
    state.inboxes.removeValue(forKey: ownerId)
    if state.ownerId == ownerId {
      preferences.set(false, forKey: activationKey)
      state.ownerId = nil
      state.binding = nil
    }
    try write(state)
  }

  func snapshot() throws -> NotificationCaptureSnapshot {
    var state = try read()
    let owner = state.ownerId
    var inbox = owner.flatMap { state.inboxes[$0] } ?? NotificationInbox()
    if let owner, inbox.prune(now: clock(), ttl: Self.retention) {
      state.inboxes[owner] = inbox
      try write(state)
    }
    let revision = preferences.bool(forKey: activationKey) ? state.binding?.revision : nil
    let nextRetryAt = revision.flatMap { _ in
      inbox.drafts.values.lazy.filter { entry in
        entry.status == .queued && entry.notice != nil && !self.inFlight.contains("\(owner ?? "")/\(entry.id)")
      }.map { $0.retryAt ?? $0.queuedAt }.min()
    }
    return NotificationCaptureSnapshot(ownerId: owner, revision: revision,
      drafts: inbox.drafts.values.sorted { $0.receivedAt > $1.receivedAt },
      lastStatus: inbox.lastStatus, lastReceivedAt: inbox.lastReceivedAt, nextRetryAt: nextRetryAt)
  }

  func discard(ownerId: String, draftId: String) throws {
    var state = try read()
    guard state.ownerId == ownerId, state.inboxes[ownerId]?.drafts.removeValue(forKey: draftId) != nil else { return }
    try write(state)
  }

  func saveEdits(_ edits: NotificationDraftEdits, ownerId: String, draftId: String) throws -> Bool {
    var state = try read()
    guard state.ownerId == ownerId, let draft = state.inboxes[ownerId]?.drafts[draftId], draft.status != .queued else { return false }
    state.inboxes[ownerId]?.drafts[draftId]?.edits = edits
    try write(state)
    return true
  }

  func capture(appName: String, title: String?, subtitle: String?, body: String?, receivedAt: Date?) async throws -> String {
    var state = try read()
    guard preferences.bool(forKey: activationKey), let owner = state.ownerId, let binding = state.binding else { return "disabled" }
    let now = clock()
    let captureTime = receivedAt ?? now
    var inbox = state.inboxes[owner] ?? NotificationInbox()
    _ = inbox.prune(now: now, ttl: Self.retention)
    let status: String
    var id: String?
    let cleanApp = normalizedNotificationAppName(appName)
    let source = binding.sources.first { $0.appNames.contains { normalizedNotificationAppName($0) == cleanApp } }
    if let source, now.timeIntervalSince(captureTime) < Self.retention,
      captureTime.timeIntervalSince(now) < 5 * 60,
      let (notice, eventId) = PaymentNotification.prepare(sourceId: source.id, title: title, subtitle: subtitle,
        body: body, receivedAt: captureTime, identityKey: try keys.key()) {
      id = eventId
      if inbox.seen[eventId] != nil || inbox.drafts[eventId] != nil {
        status = "duplicate"
      } else if inbox.drafts.count >= maxDrafts || inbox.seen.count >= maxSeen {
        status = "full"
      } else {
        inbox.seen[eventId] = now
        inbox.drafts[eventId] = NotificationCaptureDraft(id: eventId, sourceId: source.id,
          sourceName: source.name, receivedAt: captureTime, queuedAt: now, notice: notice)
        status = "queued"
      }
    } else if source == nil {
      status = "source"
    } else if [title, subtitle, body].allSatisfy({ ($0 ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
      status = "empty"
    } else {
      status = "ignored"
    }
    if let id {
      inbox.lastReceivedAt = now
      inbox.lastEventId = id
      inbox.lastStatus = status
    }
    state.inboxes[owner] = inbox
    // Commit the queue before awaiting the network or returning to Shortcuts.
    try write(state)
    try await process(ownerId: owner, limit: 2)
    guard let id, let updated = try read().inboxes[owner], updated.lastEventId == id else { return status }
    return updated.lastStatus ?? status
  }

  func process(ownerId: String, limit: Int = 8) async throws {
    for _ in 0..<limit {
      if Task.isCancelled { return }
      var state = try read()
      guard preferences.bool(forKey: activationKey), state.ownerId == ownerId, let binding = state.binding,
            var inbox = state.inboxes[ownerId] else { return }
      let now = clock()
      if inbox.prune(now: now, ttl: Self.retention) {
        state.inboxes[ownerId] = inbox
        try write(state)
      }
      let next = inbox.drafts.values.filter {
        $0.status == .queued && $0.notice != nil && ($0.retryAt ?? $0.queuedAt) <= now
          && !inFlight.contains("\(ownerId)/\($0.id)")
      }.min(by: { $0.queuedAt < $1.queuedAt })
      guard let draft = next, let notice = draft.notice else { return }
      let flightId = "\(ownerId)/\(draft.id)"
      inFlight.insert(flightId)
      let response = try? await post(notice, binding)
      inFlight.remove(flightId)
      try apply(response, draftId: draft.id, ownerId: ownerId, token: binding.token)
    }
  }

  private func apply(_ response: NotificationCaptureResponse?, draftId: String, ownerId: String, token: String) throws {
    var state = try read()
    guard preferences.bool(forKey: activationKey), state.ownerId == ownerId, state.binding?.token == token,
          var inbox = state.inboxes[ownerId],
          var draft = inbox.drafts[draftId], draft.status == .queued else { return }

    let status: String
    switch response?.status ?? 0 {
    case 200 where response?.result?.outcome == "ignored":
      inbox.drafts.removeValue(forKey: draftId)
      status = "ignored"
    case 200 where response?.result?.draft != nil:
      draft.status = response?.result?.outcome == "draft" ? .ready : .review
      draft.fields = response?.result?.draft
      draft.notice = nil
      draft.retryAt = nil
      inbox.drafts[draftId] = draft
      status = draft.status.rawValue
    case 401, 403, 409:
      preferences.set(false, forKey: activationKey)
      state.binding = nil
      inbox.clearWaiting()
      status = response?.status == 409 ? "consent" : "session"
    case 400, 413:
      draft.status = .review
      draft.notice = nil
      draft.retryAt = nil
      inbox.drafts[draftId] = draft
      status = "review"
    default:
      draft.attempts += 1
      let backoff = 15.0 * pow(2.0, Double(min(draft.attempts - 1, 8)))
      draft.retryAt = clock().addingTimeInterval(min(max(response?.retryAfter ?? 0, backoff), 3600))
      inbox.drafts[draftId] = draft
      status = response?.status == 429 ? "limited" : "retry"
    }
    if inbox.lastEventId == draftId || status == "consent" || status == "session" { inbox.lastStatus = status }
    state.inboxes[ownerId] = inbox
    try write(state)
  }
}
