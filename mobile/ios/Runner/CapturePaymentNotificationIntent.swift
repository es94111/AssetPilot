import AppIntents
import Foundation

@available(iOS 27.0, *)
struct CapturePaymentNotificationIntent: AppIntent {
  static var title: LocalizedStringResource = "Capture a payment notification"
  static var description = IntentDescription("Send a payment alert from the selected app to AssetPilot for draft review.")
  #if compiler(>=6.2)
  static var supportedModes: IntentModes { .background }
  #else
  static var openAppWhenRun: Bool { false }
  #endif
  #if compiler(>=6.4)
  static var allowedExecutionTargets: IntentExecutionTargets { .main }
  #endif
  static var authenticationPolicy: IntentAuthenticationPolicy { .alwaysAllowed }

  @Parameter(title: "Source app name")
  var sourceApp: String

  @Parameter(title: "Notification title")
  var notificationTitle: String?

  @Parameter(title: "Notification subtitle")
  var notificationSubtitle: String?

  @Parameter(title: "Notification body")
  var notificationBody: String?

  @Parameter(title: "Notification date")
  var notificationDate: Date?

  func perform() async throws -> some IntentResult {
    _ = try await NotificationCaptureService.shared.capture(appName: sourceApp, title: notificationTitle,
      subtitle: notificationSubtitle, body: notificationBody, receivedAt: notificationDate)
    return .result()
  }
}
