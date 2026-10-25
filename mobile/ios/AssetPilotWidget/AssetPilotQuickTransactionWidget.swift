import WidgetKit
import SwiftUI

/// 快速記帳入口 Widget。
///
/// 點擊後以深層連結開啟 App 的記帳畫面（`assetpilot://transaction/new`），
/// **不在 Widget 內直接寫入任何交易**；實際入帳一律在 App 內由使用者確認。
struct AssetPilotQuickTransactionEntry: TimelineEntry {
    let date: Date
}

struct AssetPilotQuickTransactionProvider: TimelineProvider {
    func placeholder(in context: Context) -> AssetPilotQuickTransactionEntry {
        AssetPilotQuickTransactionEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (AssetPilotQuickTransactionEntry) -> Void) {
        completion(AssetPilotQuickTransactionEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AssetPilotQuickTransactionEntry>) -> Void) {
        let entry = AssetPilotQuickTransactionEntry(date: Date())
        // 快速記帳 Widget 不含隨時間變動的資料，但 WidgetKit 仍需時間軸；
        // 採每日更新即可，避免無謂的耗電與更新預算消耗。
        let nextRefresh = Calendar.current.date(byAdding: .hour, value: 6, to: Date()) ?? Date().addingTimeInterval(21600)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

struct AssetPilotQuickTransactionWidget: Widget {
    let kind = "AssetPilotQuickTransactionWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AssetPilotQuickTransactionProvider()) { entry in
            AssetPilotQuickTransactionView(entry: entry)
                .assetPilotWidgetBackground()
                .widgetURL(URL(string: AssetPilotConstants.quickEntryURL))
        }
        .configurationDisplayName("快速記帳")
        .description("一鍵開啟 AssetPilot 記帳畫面。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct AssetPilotQuickTransactionView: View {
    let entry: AssetPilotQuickTransactionEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("AssetPilot")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            Spacer(minLength: 0)
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 34))
                .foregroundStyle(.tint)
            Text("快速記帳")
                .font(.headline)
            Text("點擊後在 App 內確認")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
