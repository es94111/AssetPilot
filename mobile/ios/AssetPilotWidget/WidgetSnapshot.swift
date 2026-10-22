import Foundation

/// WidgetKit 擴充讀取的最小摘要快照。
///
/// 由主 App 寫入 App Group container（`widget_snapshot.json`），
/// 欄位名稱與 `mobile/lib/platform/widget_snapshot_service.dart` 保持一致。
///
/// **只包含顯示所需最小摘要**：不含憑證、附件、交易備註或完整明細。
struct WidgetSnapshot: Codable {
    /// 快照結構版本；格式不符時視為無資料。
    let version: Int
    /// 資料月份，格式 `yyyy-MM`。
    let yearMonth: String
    /// 本月收入。
    let income: Double
    /// 本月支出。
    let expense: Double
    /// 本月淨額。
    let net: Double
    /// 顯示幣別。
    let currency: String
    /// 帳本識別；空字串代表個人帳本。
    let ledgerId: String
    /// 是否為個人帳本。共享帳本不寫入快照，因此正常情況下為 true。
    let isPersonalLedger: Bool
    /// 是否遮蔽金額。預設為 `true`（計畫書 5.3／第 10 節：金額預設遮蔽，
    /// 由使用者主動開啟顯示），避免桌面 Widget 洩漏財務資訊。
    let hideAmounts: Bool
    /// 快照寫入時間（ISO-8601，UTC）。
    let updatedAt: String

    /// 目前專案支援的快照版本。
    static let supportedVersion = 1

    /// 讀取 App Group 內的快照；不存在或格式不符時回傳 nil。
    static func load() -> WidgetSnapshot? {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: AssetPilotConstants.appGroupId
        ) else {
            return nil
        }
        let fileURL = container.appendingPathComponent(
            AssetPilotConstants.snapshotFileName
        )
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        // 快照可能由較舊版本 App 寫出（缺少新欄位），因此先嘗試完整解碼，
        // 失敗時退回「以預設值補齊缺欄位」的寬鬆解碼。
        if let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) {
            guard snapshot.version <= WidgetSnapshot.supportedVersion else { return nil }
            return snapshot
        }
        guard var raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        guard let version = raw["version"] as? Int,
              version <= WidgetSnapshot.supportedVersion else { return nil }
        // 缺少遮蔽欄位的舊快照一律視為「遮蔽金額」，確保隱私是預設值。
        if raw["hideAmounts"] == nil { raw["hideAmounts"] = true }
        guard let data = try? JSONSerialization.data(withJSONObject: raw),
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
            return nil
        }
        return snapshot
    }
}

/// 主 App 與擴充共用的常數。值與 Dart 端保持一致。
enum AssetPilotConstants {
    static let appGroupId = "group.com.assetpilot.assetpilot"
    static let snapshotFileName = "widget_snapshot.json"
    /// 快速記帳深層連結（與 mobile/lib/app.dart 的 _isNewTransactionLink 一致）。
    static let quickEntryURL = "assetpilot://transaction/new?source=widget"
}
