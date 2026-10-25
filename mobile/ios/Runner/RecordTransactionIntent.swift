import AppIntents
import Foundation
import UIKit

/// 建立記帳草稿的 App Intent，供 Siri、捷徑與「動作按鈕」使用。
///
/// 設計約束（見 docs/ios-app-development-plan.md 第 5.4 節）：
/// - Intent **只產生草稿並開啟 App**，由使用者確認後才真正入帳。
/// - 不在背景直接寫入交易，避免語音誤判造成錯誤帳目。
/// - 未登入、裝置鎖定或參數不足時不得猜測儲存，應要求使用者開啟 App 補齊。
struct RecordTransactionIntent: AppIntent {
    static var title: LocalizedStringResource = "記一筆帳"
    static var description = IntentDescription(
        "建立一筆 AssetPilot 記帳草稿，開啟 App 後由你確認金額與分類再儲存。"
    )
    static var openAppWhenRun: Bool = true

    /// 金額。以雙精度表示金額，由 App 端換算後交給使用者確認。
    @Parameter(
        title: "金額",
        requestValueDialog: "要記多少錢？"
    )
    var amount: Double

    /// 分類名稱。留空時由 App 端讓使用者挑選。
    @Parameter(
        title: "分類",
        requestValueDialog: "要記在哪個分類？"
    )
    var category: String?

    /// 帳戶名稱。留空時由 App 端讓使用者挑選。
    @Parameter(
        title: "帳戶",
        requestValueDialog: "要記在哪個帳戶？"
    )
    var account: String?

    /// 收支類型：expense（支出）／income（收入）。預設支出。
    @Parameter(
        title: "類型",
        requestValueDialog: "是支出還是收入？"
    )
    var kind: TransactionKind

    static var parameterSummary: some ParameterSummary {
        Summary("記一筆 \(\.$kind) \(\.$amount) 到 \(\.$category)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // 只驗證輸入的合理性；真正的入帳由 App 端在使用者確認後完成。
        guard amount.isFinite, amount > 0, amount < 1_000_000_000 else {
            throw RecordTransactionIntentError.invalidAmount
        }

        let payload = TransactionDraftPayload(
            amount: amount,
            category: category?.trimmingCharacters(in: .whitespacesAndNewlines),
            account: account?.trimmingCharacters(in: .whitespacesAndNewlines),
            kind: kind.rawValue
        )

        // 草稿透過深層連結交給 App。URL 內容只含使用者剛才說出的資訊，
        // 不含任何憑證或帳本資料。
        guard let url = TransactionDraftPayload.deepLink(for: payload) else {
            throw RecordTransactionIntentError.invalidAmount
        }
        await UIApplication.shared.open(url)

        return .result(dialog: "已開啟 AssetPilot，請確認後儲存。")
    }
}

/// 收支類型。
enum TransactionKind: String, AppEnum {
    case expense
    case income

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "收支類型"
    static var caseDisplayRepresentations: [TransactionKind: DisplayRepresentation] = [
        .expense: "支出",
        .income: "收入",
    ]
}

/// Intent 可丟出的錯誤。
enum RecordTransactionIntentError: Error, CustomLocalizedStringResourceConvertible {
    case invalidAmount

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .invalidAmount:
            return "金額必須是正數。"
        }
    }
}

/// 交給 App 的記帳草稿內容。
struct TransactionDraftPayload {
    let amount: Double
    let category: String?
    let account: String?
    let kind: String

    /// 產生深層連結。參數以 query string 傳遞並經 URL 編碼。
    static func deepLink(for payload: TransactionDraftPayload) -> URL? {
        var components = URLComponents()
        components.scheme = "assetpilot"
        components.host = "transaction"
        components.path = "/new"
        var items = [
            URLQueryItem(name: "source", value: "siri"),
            URLQueryItem(name: "type", value: payload.kind),
            URLQueryItem(name: "amount", value: String(payload.amount)),
        ]
        if let category = payload.category, !category.isEmpty {
            items.append(URLQueryItem(name: "category", value: category))
        }
        if let account = payload.account, !account.isEmpty {
            items.append(URLQueryItem(name: "account", value: account))
        }
        components.queryItems = items
        return components.url
    }
}
