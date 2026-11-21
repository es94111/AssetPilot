import CryptoKit
import XCTest

@testable import Runner

/// 離線草稿照片加密的原生端單元測試。
///
/// 驗證 AES-256-GCM 的加解密契約：內容一致、nonce 不重複、
/// 竄改／換金鑰／標頭不符都必須失敗，而且絕不回傳半份資料。
final class OfflineFileCryptoTests: XCTestCase {

  private final class InMemoryKeyStore: OfflineKeyProviding {
    private let stored: SymmetricKey
    init(_ key: SymmetricKey = SymmetricKey(size: .bits256)) { stored = key }
    func key() throws -> SymmetricKey { stored }
  }

  private final class UnavailableKeyStore: OfflineKeyProviding {
    func key() throws -> SymmetricKey {
      throw OfflineFileCryptoError.keyUnavailable
    }
  }

  private var workDirectory: URL!

  override func setUpWithError() throws {
    try super.setUpWithError()
    workDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("offline-crypto-\(UUID().uuidString)")
    try FileManager.default.createDirectory(
      at: workDirectory,
      withIntermediateDirectories: true
    )
  }

  override func tearDownWithError() throws {
    try? FileManager.default.removeItem(at: workDirectory)
    try super.tearDownWithError()
  }

  func testRoundTripRestoresOriginalBytes() throws {
    let key = SymmetricKey(size: .bits256)
    let plain = Data((0..<4096).map { UInt8($0 % 251) })
    let blob = try OfflineFileCrypto.encrypt(plain, key: key)
    XCTAssertEqual(try OfflineFileCrypto.decrypt(blob, key: key), plain)
  }

  func testEncryptedBlobStartsWithHeaderAndHidesPlaintext() throws {
    let key = SymmetricKey(size: .bits256)
    let plain = Data("hello-receipt-photo".utf8)
    let blob = try OfflineFileCrypto.encrypt(plain, key: key)
    XCTAssertEqual(blob.prefix(4), Data("APE1".utf8))
    XCTAssertNil(blob.range(of: plain))
  }

  func testEmptyContentRoundTrips() throws {
    let key = SymmetricKey(size: .bits256)
    let blob = try OfflineFileCrypto.encrypt(Data(), key: key)
    XCTAssertEqual(blob.count, OfflineFileCrypto.minimumLength)
    XCTAssertEqual(try OfflineFileCrypto.decrypt(blob, key: key), Data())
  }

  func testSamePlaintextEncryptsToDifferentBlobs() throws {
    let key = SymmetricKey(size: .bits256)
    let plain = Data("same-input".utf8)
    let first = try OfflineFileCrypto.encrypt(plain, key: key)
    let second = try OfflineFileCrypto.encrypt(plain, key: key)
    XCTAssertNotEqual(first, second)
  }

  func testTamperingAnyByteAfterHeaderFailsDecryption() throws {
    let key = SymmetricKey(size: .bits256)
    let blob = try OfflineFileCrypto.encrypt(Data("tamper-me".utf8), key: key)
    for index in OfflineFileCrypto.header.count..<blob.count {
      var corrupted = blob
      corrupted[index] ^= 0x01
      XCTAssertThrowsError(try OfflineFileCrypto.decrypt(corrupted, key: key)) {
        XCTAssertEqual($0 as? OfflineFileCryptoError, .decryptionFailed)
      }
    }
  }

  func testWrongKeyFailsDecryption() throws {
    let blob = try OfflineFileCrypto.encrypt(
      Data("secret".utf8),
      key: SymmetricKey(size: .bits256)
    )
    XCTAssertThrowsError(
      try OfflineFileCrypto.decrypt(blob, key: SymmetricKey(size: .bits256))
    ) {
      XCTAssertEqual($0 as? OfflineFileCryptoError, .decryptionFailed)
    }
  }

  func testWrongHeaderIsRejectedAsInvalidFormat() throws {
    let key = SymmetricKey(size: .bits256)
    var blob = try OfflineFileCrypto.encrypt(Data("x".utf8), key: key)
    blob.replaceSubrange(0..<4, with: Data("ZZZZ".utf8))
    XCTAssertThrowsError(try OfflineFileCrypto.decrypt(blob, key: key)) {
      XCTAssertEqual($0 as? OfflineFileCryptoError, .invalidFormat)
    }
  }

  func testTooShortBlobIsRejectedAsInvalidFormat() {
    let key = SymmetricKey(size: .bits256)
    XCTAssertThrowsError(
      try OfflineFileCrypto.decrypt(Data("APE1".utf8), key: key)
    ) {
      XCTAssertEqual($0 as? OfflineFileCryptoError, .invalidFormat)
    }
    XCTAssertThrowsError(try OfflineFileCrypto.decrypt(Data(), key: key)) {
      XCTAssertEqual($0 as? OfflineFileCryptoError, .invalidFormat)
    }
  }

  func testFileRoundTripWritesEncryptedFileAndRestoresPlaintext() throws {
    let keys = InMemoryKeyStore()
    let plain = Data("receipt-bytes".utf8)
    let source = workDirectory.appendingPathComponent("receipt.jpg")
    let encrypted = workDirectory.appendingPathComponent("vault/1_receipt.jpg.enc")
    let restored = workDirectory.appendingPathComponent("tmp/receipt.jpg")
    try plain.write(to: source)

    try OfflineFileCrypto.encryptFile(at: source, to: encrypted, keys: keys)
    let onDisk = try Data(contentsOf: encrypted)
    XCTAssertNotEqual(onDisk, plain)
    XCTAssertNil(onDisk.range(of: plain))

    try OfflineFileCrypto.decryptFile(at: encrypted, to: restored, keys: keys)
    XCTAssertEqual(try Data(contentsOf: restored), plain)
  }

  func testMissingSourceFileIsReportedAndNothingIsWritten() {
    let destination = workDirectory.appendingPathComponent("out.enc")
    XCTAssertThrowsError(
      try OfflineFileCrypto.encryptFile(
        at: workDirectory.appendingPathComponent("missing.jpg"),
        to: destination,
        keys: InMemoryKeyStore()
      )
    ) {
      XCTAssertEqual($0 as? OfflineFileCryptoError, .fileUnreadable)
    }
    XCTAssertFalse(FileManager.default.fileExists(atPath: destination.path))
  }

  func testUnavailableKeyAbortsWithoutWritingPlaintext() throws {
    let source = workDirectory.appendingPathComponent("receipt.jpg")
    let destination = workDirectory.appendingPathComponent("out.enc")
    try Data("receipt".utf8).write(to: source)
    XCTAssertThrowsError(
      try OfflineFileCrypto.encryptFile(
        at: source,
        to: destination,
        keys: UnavailableKeyStore()
      )
    ) {
      XCTAssertEqual($0 as? OfflineFileCryptoError, .keyUnavailable)
    }
    XCTAssertFalse(FileManager.default.fileExists(atPath: destination.path))
  }

  func testFailedDecryptionLeavesNoOutputFile() throws {
    let source = workDirectory.appendingPathComponent("receipt.jpg")
    let encrypted = workDirectory.appendingPathComponent("receipt.jpg.enc")
    let restored = workDirectory.appendingPathComponent("restored.jpg")
    try Data("receipt".utf8).write(to: source)
    try OfflineFileCrypto.encryptFile(
      at: source,
      to: encrypted,
      keys: InMemoryKeyStore()
    )
    XCTAssertThrowsError(
      try OfflineFileCrypto.decryptFile(
        at: encrypted,
        to: restored,
        keys: InMemoryKeyStore()
      )
    )
    XCTAssertFalse(FileManager.default.fileExists(atPath: restored.path))
  }
}
