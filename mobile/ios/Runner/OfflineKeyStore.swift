import CryptoKit
import Foundation
import Security

/// 提供離線照片加密金鑰的來源。做成協定，方便測試時注入記憶體版本。
protocol OfflineKeyProviding {
  func key() throws -> SymmetricKey
}

/// 把 256 位元金鑰存放在 iOS Keychain。
///
/// - 第一次使用時產生，之後固定讀取同一把。
/// - 存取等級為 `AfterFirstUnlockThisDeviceOnly`：不同步 iCloud 鑰匙圈，
///   也不會隨備份還原到別台裝置。
/// - 只給主 App 使用，Widget 擴充不存取。
/// - **讀取失敗（非「找不到」）時絕不重新產生金鑰**，避免覆蓋掉原本的金鑰，
///   讓既有的加密照片永遠解不開。
final class KeychainOfflineKeyStore: OfflineKeyProviding {
  static let service = "com.assetpilot.offline-photo-key"
  static let account = "v1"

  static let shared = KeychainOfflineKeyStore()
  static let notificationCapture = KeychainOfflineKeyStore(service: "com.assetpilot.notification-capture-key")

  private let service: String
  private let lock = NSLock()
  private var cached: SymmetricKey?

  init(service: String = KeychainOfflineKeyStore.service) {
    self.service = service
  }

  func key() throws -> SymmetricKey {
    lock.lock()
    defer { lock.unlock() }
    if let cached { return cached }

    if let stored = try read() {
      let key = SymmetricKey(data: stored)
      cached = key
      return key
    }

    let fresh = SymmetricKey(size: .bits256)
    let data = fresh.withUnsafeBytes { Data($0) }
    let status = add(data)
    if status == errSecDuplicateItem, let stored = try read() {
      let key = SymmetricKey(data: stored)
      cached = key
      return key
    }
    guard status == errSecSuccess else {
      throw OfflineFileCryptoError.keyUnavailable
    }
    cached = fresh
    return fresh
  }

  private var baseQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: Self.account,
    ]
  }

  private func read() throws -> Data? {
    var query = baseQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    switch status {
    case errSecSuccess:
      guard let data = item as? Data, data.count == 32 else {
        throw OfflineFileCryptoError.keyUnavailable
      }
      return data
    case errSecItemNotFound:
      return nil
    default:
      throw OfflineFileCryptoError.keyUnavailable
    }
  }

  private func add(_ data: Data) -> OSStatus {
    var query = baseQuery
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] =
      kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    query[kSecAttrSynchronizable as String] = false
    return SecItemAdd(query as CFDictionary, nil)
  }
}
