import CryptoKit
import Foundation

/// 離線照片加解密可能發生的錯誤。任何錯誤都不會回傳半份資料。
enum OfflineFileCryptoError: Error, Equatable {
  /// 檔案標頭不符或長度不足，不是本 App 產生的加密檔。
  case invalidFormat
  /// 金鑰不對或內容被竄改，AES-GCM 驗證失敗。
  case decryptionFailed
  /// 無法取得 Keychain 金鑰（例如裝置開機後尚未首次解鎖）。
  case keyUnavailable
  /// 來源檔案不存在或無法讀取。
  case fileUnreadable
  /// 目的檔案無法寫入。
  case fileUnwritable
}

/// 離線草稿照片的加解密。
///
/// 檔案格式：4 位元組標頭 `APE1` + `AES.GCM.SealedBox.combined`
/// （12 位元組 nonce、密文、16 位元組驗證標籤）。
/// 只使用 Apple CryptoKit，不引入第三方加密套件。
enum OfflineFileCrypto {
  static let header = Data("APE1".utf8)

  /// 最短的合法加密檔：標頭 + nonce(12) + tag(16)，對應空內容。
  static let minimumLength = header.count + 12 + 16

  static func encrypt(_ plain: Data, key: SymmetricKey) throws -> Data {
    let box = try AES.GCM.seal(plain, using: key)
    guard let combined = box.combined else {
      throw OfflineFileCryptoError.invalidFormat
    }
    return header + combined
  }

  static func decrypt(_ blob: Data, key: SymmetricKey) throws -> Data {
    guard blob.count >= minimumLength,
          blob.prefix(header.count) == header else {
      throw OfflineFileCryptoError.invalidFormat
    }
    let payload = Data(blob.dropFirst(header.count))
    do {
      let box = try AES.GCM.SealedBox(combined: payload)
      return try AES.GCM.open(box, using: key)
    } catch {
      throw OfflineFileCryptoError.decryptionFailed
    }
  }

  /// 讀取 `source`，加密後以 atomic 方式寫入 `destination`，
  /// 並把 `destination` 標記為不納入備份（金鑰不隨備份轉移，備份了也解不開）。
  static func encryptFile(
    at source: URL,
    to destination: URL,
    keys: OfflineKeyProviding
  ) throws {
    guard let plain = try? Data(contentsOf: source) else {
      throw OfflineFileCryptoError.fileUnreadable
    }
    let blob = try encrypt(plain, key: try keys.key())
    try write(blob, to: destination)
    var target = destination
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try? target.setResourceValues(values)
  }

  /// 讀取加密檔 `source`，解密後以 atomic 方式寫入 `destination`。
  static func decryptFile(
    at source: URL,
    to destination: URL,
    keys: OfflineKeyProviding
  ) throws {
    guard let blob = try? Data(contentsOf: source) else {
      throw OfflineFileCryptoError.fileUnreadable
    }
    let plain = try decrypt(blob, key: try keys.key())
    try write(plain, to: destination)
  }

  private static func write(_ data: Data, to url: URL) throws {
    do {
      try FileManager.default.createDirectory(
        at: url.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      try data.write(to: url, options: [.atomic])
    } catch {
      throw OfflineFileCryptoError.fileUnwritable
    }
  }
}
