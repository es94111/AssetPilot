import WidgetKit
import SwiftUI

/// 本月收支摘要 Widget。
///
/// 顯示主 App 寫入的月度摘要。**不顯示即時股價**（Widget 更新受 iOS 排程
/// 限制，顯示會變動的股價容易造成使用者誤解）；只顯示月結算的收支數字
/// 與資料月份、更新時間。
struct AssetPilotMonthlyOverviewEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct AssetPilotMonthlyOverviewProvider: TimelineProvider {
    func placeholder(in context: Context) -> AssetPilotMonthlyOverviewEntry {
        AssetPilotMonthlyOverviewEntry(
            date: Date(),
            snapshot: WidgetSnapshot(
                version: WidgetSnapshot.supportedVersion,
                yearMonth: "2026-01",
                income: 0,
                expense: 0,
                net: 0,
                currency: "TWD",
                ledgerId: "",
                isPersonalLedger: true,
                hideAmounts: true,
                updatedAt: ""
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (AssetPilotMonthlyOverviewEntry) -> Void) {
        completion(AssetPilotMonthlyOverviewEntry(date: Date(), snapshot: WidgetSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AssetPilotMonthlyOverviewEntry>) -> Void) {
        let entry = AssetPilotMonthlyOverviewEntry(date: Date(), snapshot: WidgetSnapshot.load())
        // WidgetKit 對更新頻率有預算限制（每日約 40–70 次），因此採保守的
        // 更新間隔；主 App 在前景取得新資料時會主動要求重載，
        // 但實際顯示時間仍由 iOS 排程決定。
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

struct AssetPilotMonthlyOverviewWidget: Widget {
    let kind = "AssetPilotMonthlyOverviewWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AssetPilotMonthlyOverviewProvider()) { entry in
            AssetPilotMonthlyOverviewView(entry: entry)
                .assetPilotWidgetBackground()
        }
        .configurationDisplayName("本月收支摘要")
        .description("顯示 AssetPilot 本月的收入與支出摘要。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct AssetPilotMonthlyOverviewView: View {
    let entry: AssetPilotMonthlyOverviewEntry

    var body: some View {
        let snapshot = entry.snapshot
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("AssetPilot")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                if let snapshot {
                    Text(snapshot.yearMonth)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            if let snapshot {
                overviewRow(
                    title: "收入",
                    amount: snapshot.income,
                    currency: snapshot.currency,
                    tint: .green,
                    hideAmounts: snapshot.hideAmounts
                )
                overviewRow(
                    title: "支出",
                    amount: snapshot.expense,
                    currency: snapshot.currency,
                    tint: .primary,
                    hideAmounts: snapshot.hideAmounts
                )
                Divider()
                overviewRow(
                    title: "淨額",
                    amount: snapshot.net,
                    currency: snapshot.currency,
                    tint: snapshot.net >= 0 ? .green : .red,
                    hideAmounts: snapshot.hideAmounts
                )
                Spacer(minLength: 0)
                if snapshot.hideAmounts {
                    // 金額預設遮蔽；使用者可在 App 內開啟顯示。
                    Text("金額已隱藏，可在 App 設定中開啟顯示")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Text(updatedLabel(snapshot.updatedAt))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                Spacer()
                Text("開啟 App 取得最新資料")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer()
            }
        }
        .padding(2)
    }

    @ViewBuilder
    private func overviewRow(
        title: String,
        amount: Double,
        currency: String,
        tint: Color,
        hideAmounts: Bool
    ) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer(minLength: 4)
            Text(hideAmounts ? "••••" : formatted(amount, currency: currency))
                .font(.caption)
                .foregroundStyle(tint)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
    }

    private func formatted(_ amount: Double, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        let number = formatter.string(from: NSNumber(value: amount)) ?? "0"
        return "\(number) \(currency)"
    }

    private func updatedLabel(_ iso: String) -> String {
        guard !iso.isEmpty else { return "" }
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: iso) else { return "" }
        let display = DateFormatter()
        display.dateFormat = "MM/dd HH:mm"
        return "更新於 \(display.string(from: date))"
    }
}
