import AppIntents

/// 讓 App 的動作出現在捷徑 App 與 Siri 的建議清單。
struct AssetPilotAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: RecordTransactionIntent(),
            phrases: [
                "用 \(.applicationName) 記一筆帳",
                "在 \(.applicationName) 記帳",
                "\(.applicationName) 記帳"
            ],
            shortTitle: "記一筆帳",
            systemImageName: "plus.circle"
        )
    }
}
