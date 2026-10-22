import CryptoKit
import XCTest

@testable import Runner

/// Sign in with Apple 原生通道的測試。
///
/// 重點在 **nonce 的雜湊方向**——這是最容易寫錯、且錯了會讓所有
/// Apple 登入失敗的地方：
///
/// - **送給 Apple 的**是 SHA-256 雜湊值（避免原始 nonce 在授權視窗被截聽）。
/// - **Apple 回傳的 identity token 裡，`nonce` claim 是未雜湊的原始值**。
///
/// 因此伺服器端（`lib/appleOAuth.ts`）必須拿 **原始 nonce** 去比對，
/// 若改成比對雜湊值，登入會全部失敗。這裡把 SHA-256 的實作釘住，
/// 避免日後改動時意外改變輸出格式。
class AppleAuthChannelTests: XCTestCase {

  func testSHA256Hex產生標準小寫十六進位字串() {
    let hash = AppleAuthChannel.sha256Hex("hello")

    XCTAssertEqual(hash.count, 64, "SHA-256 應為 32 bytes＝64 個十六進位字元")
    XCTAssertEqual(hash, hash.lowercased(), "雜湊值必須為小寫")
    XCTAssertTrue(
      hash.allSatisfy { $0.isHexDigit },
      "雜湊值只能包含十六進位字元"
    )
  }

  func testSHA256Hex與標準函式庫一致() {
    // 用 CryptoKit 獨立算一次，確保實作沒有偏差。
    let input = "assetpilot-nonce-12345"
    let expected = SHA256.hash(data: Data(input.utf8))
      .map { String(format: "%02x", $0) }
      .joined()

    XCTAssertEqual(AppleAuthChannel.sha256Hex(input), expected)
  }

  func testSHA256Hex對相同輸入產生相同結果() {
    // nonce 雜湊必須是確定性的：同一次登入流程中，重複呼叫要得到相同值。
    let input = "deterministic-nonce"
    XCTAssertEqual(
      AppleAuthChannel.sha256Hex(input),
      AppleAuthChannel.sha256Hex(input)
    )
  }

  func testSHA256Hex對不同輸入產生不同結果() {
    XCTAssertNotEqual(
      AppleAuthChannel.sha256Hex("nonce-a"),
      AppleAuthChannel.sha256Hex("nonce-b")
    )
  }

  func testSHA256Hex可處理空字串() {
    // 空字串的 SHA-256 是已知常數；雜湊函式不該因此拋錯。
    XCTAssertEqual(
      AppleAuthChannel.sha256Hex(""),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
  }
}
