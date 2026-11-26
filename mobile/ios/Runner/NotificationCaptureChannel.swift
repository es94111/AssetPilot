import Flutter
import UIKit

final class NotificationCaptureChannel: NSObject, FlutterPlugin {
  private let channel: FlutterMethodChannel
  private var observer: NSObjectProtocol?
  private let capture = NotificationCaptureService.shared

  private init(channel: FlutterMethodChannel) {
    self.channel = channel
    super.init()
    observer = NotificationCenter.default.addObserver(forName: .notificationCaptureChanged, object: nil, queue: nil) { [weak self] _ in
      DispatchQueue.main.async { self?.channel.invokeMethod("changed", arguments: nil) }
    }
  }

  deinit {
    if let observer { NotificationCenter.default.removeObserver(observer) }
  }

  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(name: "assetpilot/notification_capture", binaryMessenger: registrar.messenger())
    registrar.addMethodCallDelegate(NotificationCaptureChannel(channel: channel), channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    if call.method == "isSupported" {
      if #available(iOS 27.0, *) { result(UIDevice.current.userInterfaceIdiom == .phone) }
      else { result(false) }
      return
    }
    let arguments = call.arguments as? [String: Any] ?? [:]
    Task { @MainActor in
      do {
        switch call.method {
        case "snapshot":
          result(Self.serialize(try await capture.snapshot()))
        case "bindOwner":
          try await capture.bindOwner(try Self.required("ownerId", in: arguments))
          result(nil)
        case "enable":
          let owner = try Self.required("ownerId", in: arguments)
          let base = try Self.required("baseURL", in: arguments)
          let token = try Self.required("token", in: arguments)
          let revision = try Self.required("revision", in: arguments)
          guard let url = URL(string: base), url.scheme == "https", url.host != nil,
            url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
            token.range(of: #"^ap_notice_[\w-]{43}$"#, options: .regularExpression) != nil,
            let rows = arguments["sources"] as? [[String: Any]] else { throw ChannelError.invalidArguments }
          let sources = try JSONDecoder().decode([NotificationCaptureSource].self, from: JSONSerialization.data(withJSONObject: rows))
          result(try await capture.enable(for: owner, binding: NotificationCaptureBinding(token: token, revision: revision, baseURL: url, sources: sources)))
        case "disable":
          try await capture.disable(for: try Self.required("ownerId", in: arguments))
          result(nil)
        case "endSession":
          try await capture.endSession()
          result(nil)
        case "clearUser":
          try await capture.clearUser(try Self.required("ownerId", in: arguments))
          result(nil)
        case "process":
          try await capture.process(ownerId: try Self.required("ownerId", in: arguments))
          result(nil)
        case "discard":
          try await capture.discard(ownerId: try Self.required("ownerId", in: arguments), draftId: try Self.required("draftId", in: arguments))
          result(nil)
        case "saveEdits":
          guard let data = arguments["edits"] as? [String: Any] else { throw ChannelError.invalidArguments }
          let json = try JSONSerialization.data(withJSONObject: data)
          guard json.count <= 8192 else { throw ChannelError.invalidArguments }
          let edits = try JSONDecoder().decode(NotificationDraftEdits.self, from: json)
          result(try await capture.saveEdits(edits, ownerId: try Self.required("ownerId", in: arguments),
            draftId: try Self.required("draftId", in: arguments)))
        case "openShortcuts":
          guard let url = URL(string: "shortcuts://") else { result(false); return }
          result(await UIApplication.shared.open(url))
        default:
          result(FlutterMethodNotImplemented)
        }
      } catch {
        result(FlutterError(code: "notification_capture_error", message: nil, details: nil))
      }
    }
  }

  private enum ChannelError: Error { case invalidArguments }

  private static func required(_ key: String, in arguments: [String: Any]) throws -> String {
    guard let value = arguments[key] as? String, !value.isEmpty, value.count <= 256 else { throw ChannelError.invalidArguments }
    return value
  }

  private static func serialize(_ snapshot: NotificationCaptureSnapshot) -> [String: Any] {
    let drafts: [[String: Any]] = snapshot.drafts.map { draft in
      var row: [String: Any] = [
        "id": draft.id, "sourceId": draft.sourceId, "sourceName": draft.sourceName,
        "receivedAt": notificationTimestamp(draft.receivedAt), "status": draft.status.rawValue,
        "possibleDuplicate": snapshot.drafts.contains(where: draft.resembles),
      ]
      if let amount = draft.fields?.amount { row["amount"] = amount }
      if let currency = draft.fields?.currency { row["currency"] = currency }
      if let merchant = draft.fields?.merchant { row["merchant"] = merchant }
      if let date = draft.fields?.date { row["date"] = date }
      if let occurredAt = draft.fields?.occurredAt { row["occurredAt"] = occurredAt }
      if let edits = draft.edits, let json = try? JSONEncoder().encode(edits) {
        row["edits"] = try? JSONSerialization.jsonObject(with: json)
      }
      return row
    }
    var result: [String: Any] = ["drafts": drafts]
    if let ownerId = snapshot.ownerId { result["ownerId"] = ownerId }
    if let revision = snapshot.revision { result["revision"] = revision }
    if let status = snapshot.lastStatus { result["lastStatus"] = status }
    if let time = snapshot.lastReceivedAt { result["lastReceivedAt"] = notificationTimestamp(time) }
    return result
  }
}
