import Flutter
import Foundation

/// 供 Flutter 層（platform/offline_photo_vault.dart）加解密離線草稿照片。
///
/// - `encryptFile`：讀取 `src`、以 AES-256-GCM 加密後寫入 `dest`。
/// - `decryptFile`：讀取加密檔 `path`、解密後寫入 `dest`（暫存檔）。
///
/// 檔案 I/O 與加解密在背景佇列執行，結果回到主執行緒回覆。
final class OfflineFileCryptoChannel: NSObject, FlutterPlugin {
  private static let channelName = "assetpilot/file_crypto"
  private static let queue = DispatchQueue(
    label: "com.assetpilot.offline-file-crypto",
    qos: .userInitiated
  )

  static func register(with registrar: FlutterPluginRegistrar?) {
    guard let registrar else { return }
    let channel = FlutterMethodChannel(
      name: channelName,
      binaryMessenger: registrar.messenger()
    )
    let instance = OfflineFileCryptoChannel()
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "encryptFile":
      run(call, result: result, sourceKey: "src") { source, destination in
        try OfflineFileCrypto.encryptFile(
          at: source,
          to: destination,
          keys: KeychainOfflineKeyStore.shared
        )
      }
    case "decryptFile":
      run(call, result: result, sourceKey: "path") { source, destination in
        try OfflineFileCrypto.decryptFile(
          at: source,
          to: destination,
          keys: KeychainOfflineKeyStore.shared
        )
      }
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func run(
    _ call: FlutterMethodCall,
    result: @escaping FlutterResult,
    sourceKey: String,
    work: @escaping (URL, URL) throws -> Void
  ) {
    guard let args = call.arguments as? [String: Any],
          let sourcePath = args[sourceKey] as? String,
          let destinationPath = args["dest"] as? String,
          !sourcePath.isEmpty, !destinationPath.isEmpty else {
      result(FlutterError(
        code: "invalid_arguments",
        message: "missing \(sourceKey) or dest",
        details: nil
      ))
      return
    }
    let source = URL(fileURLWithPath: sourcePath)
    let destination = URL(fileURLWithPath: destinationPath)
    Self.queue.async {
      do {
        try work(source, destination)
        DispatchQueue.main.async { result(true) }
      } catch {
        let code = (error as? OfflineFileCryptoError).map { "\($0)" } ?? "crypto_failed"
        DispatchQueue.main.async {
          result(FlutterError(code: code, message: "\(error)", details: nil))
        }
      }
    }
  }
}
