import AuthenticationServices
import CryptoKit
import Flutter
import UIKit

/// Sign in with Apple 的原生實作。
///
/// 使用 `ASAuthorizationAppleIDProvider` 取得身分令牌（identity token）與
/// 使用者姓名，再透過 platform channel 交給 Flutter 層。
///
/// 伺服器端（lib/appleOAuth.ts）會驗證令牌的簽章、iss、aud、exp 與 nonce，
/// 原生層不做身分判定。
final class AppleAuthChannel: NSObject, FlutterPlugin {
  private static let channelName = "assetpilot/apple_auth"

  static func register(with registrar: FlutterPluginRegistrar?) {
    guard let registrar else { return }
    let channel = FlutterMethodChannel(
      name: channelName,
      binaryMessenger: registrar.messenger()
    )
    let instance = AppleAuthChannel()
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "signIn":
      signIn(call: call, result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func signIn(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let args = call.arguments as? [String: Any] else {
      result(FlutterError(code: "failed", message: "missing arguments", details: nil))
      return
    }
    let clientId = (args["clientId"] as? String) ?? ""
    let nonce = (args["nonce"] as? String) ?? ""
    guard !clientId.isEmpty else {
      result(FlutterError(code: "not_supported", message: "missing client id", details: nil))
      return
    }

    let request = ASAuthorizationAppleIDProvider().createRequest()
    request.requestedScopes = [.fullName, .email]
    if !nonce.isEmpty {
      // Apple 要求把 nonce 以 SHA-256 雜湊後交給系統，避免原始值在授權
      // 視窗中被截聽。
      //
      // **注意**：回傳的 identity token 中的 `nonce` claim 是「未雜湊的
      // 原始值」，因此伺服器端（lib/appleOAuth.ts）要拿 state 記錄的
      // **原始 nonce** 去比對，而不是雜湊值。這是 Apple 平台的既定行為，
      // 不要在伺服器端改成比對雜湊值。
      request.nonce = AppleAuthChannel.sha256Hex(nonce)
    }

    let controller = ASAuthorizationController(authorizationRequests: [request])
    let delegate = AppleAuthDelegate(request: request)
    controller.delegate = delegate
    controller.presentationContextProvider = delegate
    delegate.completion = { outcome in
      switch outcome {
      case .success(let credential):
        guard let token = credential.identityToken,
              let tokenString = String(data: token, encoding: .utf8) else {
        result(FlutterError(code: "failed", message: "missing identity token", details: nil))
        return
        }
        var payload: [String: Any] = ["identityToken": tokenString]
        if let fullName = credential.fullName {
          // Apple 只在首次授權時提供姓名；之後以「姓 名」或「名」組裝。
          // givenName／familyName 皆為選填，故先攤平 nil 再去除空白項。
          let composed = [fullName.givenName, fullName.familyName]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
          if !composed.isEmpty {
            payload["fullName"] = composed
          }
        }
        result(payload)
      case .cancelled:
        result(FlutterError(code: "cancelled", message: "user cancelled", details: nil))
      case .failed(let error):
        result(FlutterError(code: "failed", message: error.localizedDescription, details: nil))
      }
    }
    controller.performRequests()
  }

  /// SHA-256 十六進位字串。Apple 要求 nonce 以 SHA256 雜湊傳遞。
  static func sha256Hex(_ input: String) -> String {
    let digest = SHA256.hash(data: Data(input.utf8))
    return digest.map { String(format: "%02x", $0) }.joined()
  }
}

/// 持有原生授權流程的 delegate，並在完成後回呼 Flutter。
final class AppleAuthDelegate: NSObject, ASAuthorizationControllerDelegate,
  ASAuthorizationControllerPresentationContextProviding
{
  enum Outcome {
    case success(ASAuthorizationAppleIDCredential)
    case cancelled
    case failed(Error)
  }

  private let request: ASAuthorizationAppleIDRequest
  var completion: ((Outcome) -> Void)?

  init(request: ASAuthorizationAppleIDRequest) {
    self.request = request
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    return UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow } ?? ASPresentationAnchor()
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithAuthorization authorization: ASAuthorization
  ) {
    guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
      completion?(.failed(AppleAuthError.missingCredential))
      return
    }
    completion?(.success(credential))
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithError error: Error
  ) {
    if let authError = error as? ASAuthorizationError,
      authError.code == .canceled {
      completion?(.cancelled)
      return
    }
    completion?(.failed(error))
  }
}

enum AppleAuthError: LocalizedError {
  case missingCredential

  var errorDescription: String? {
    switch self {
    case .missingCredential:
      return "Apple 授權未回傳身分憑證"
    }
  }
}
