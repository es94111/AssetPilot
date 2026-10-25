import Foundation

/// 深層連結的待處理佇列。
///
/// 把「連結進來之後要怎麼存、怎麼取」從 `DeepLinkChannel`（Flutter 通道）
/// 拆出來，好處有二：
///
/// 1. **可獨立測試。** 通道本身需要 Flutter 引擎才能運作，但佇列的規則
///    （依 host 分取、取走即移除、歷史記錄上限）純粹是資料結構，
///    可以在 `ios/RunnerTests/DeepLinkQueueTests.swift` 直接驗證，
///    不必啟動 App。
/// 2. **通道只負責傳遞。** `DeepLinkChannel` 變成單純的轉接層，
///    規則改動時不必碰通道註冊與事件投遞的程式碼。
///
/// ## 為什麼需要「待處理」與「歷史」兩份
///
/// - **待處理（pending）**：Dart 端尚未訂閱事件通道時抵達的連結。
///   取出後即移除，確保同一筆連結不會被投遞兩次。
/// - **歷史（recent）**：最近收到的連結（含已投遞者），供 OAuth 流程
///   比對「這次的回呼是不是新產生的」。取出時不移除。
struct DeepLinkQueue {
  /// 等待 Dart 端取用的連結（依收到順序）。
  private(set) var pending: [String] = []

  /// 最近收到的連結（依收到順序，最多保留 `historyLimit` 筆）。
  private(set) var recent: [String] = []

  /// 最近連結的保留筆數。
  var historyLimit: Int = 20

  /// 記錄一個新收到的連結。
  ///
  /// - Parameters:
  ///   - link: 連結的完整字串。
  ///   - hasListener: Dart 端是否已經在監聽。為 false 時連結會留在
  ///     [pending]，等 Dart 端訂閱或呼叫取回時才交出。
  mutating func record(_ link: String, hasListener: Bool) {
    recent.append(link)
    if recent.count > historyLimit {
      recent.removeFirst(recent.count - historyLimit)
    }
    if !hasListener {
      pending.append(link)
    }
  }

  /// 取出並移除第一筆符合 host 條件的待處理連結。
  ///
  /// - Parameter hosts: 要過濾的 host（例如 `["transaction", "ledger"]`）。
  ///   傳 `nil` 代表不過濾，取第一筆即可。
  mutating func takePending(hosts: [String]?) -> String? {
    guard !pending.isEmpty else { return nil }
    guard let hosts else { return pending.removeFirst() }
    guard let index = pending.firstIndex(where: { hosts.contains(DeepLinkQueue.host(of: $0)) })
    else { return nil }
    return pending.remove(at: index)
  }

  /// 讀取最近一筆符合 host 條件的連結（不移除）。
  func latest(hosts: [String]?) -> String? {
    guard let hosts else { return recent.last }
    return recent.last(where: { hosts.contains(DeepLinkQueue.host(of: $0)) })
  }

  /// 取出並清空所有待處理連結。
  ///
  /// Dart 端剛訂閱事件通道時呼叫，讓原生層把冷啟動期間收到的連結補送出去。
  mutating func drainPending() -> [String] {
    let links = pending
    pending = []
    return links
  }

  /// 清空全部狀態（測試用）。
  mutating func reset() {
    pending = []
    recent = []
  }

  /// 清空待處理連結，但保留歷史記錄。
  ///
  /// 登出時呼叫：計畫書 5.2 步驟 7 要求「登出、切換帳號、權限失效時，
  /// 同步清除或隔離 Widget 快照、離線草稿與**待處理的捷徑輸入**」。
  /// 若不清除，上一個帳號在登出前收到的捷徑連結會在下次登入後被取出，
  /// 以新帳號的身分開啟記帳表單——那既是隱私問題，也是資料錯置。
  ///
  /// 歷史記錄刻意保留：`recent` 供 OAuth 回呼比對「這次的回呼是不是
  /// 新產生的」，與帳號權限無關，清掉反而會讓重複回呼防護失效。
  mutating func clearPending() {
    pending = []
  }

  /// 取出連結的 host（`assetpilot://transaction/new` → `transaction`）。
  static func host(of link: String) -> String {
    guard let url = URL(string: link) else { return "" }
    return url.host ?? ""
  }
}
