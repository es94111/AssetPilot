import SwiftUI
import WidgetKit

extension View {
    /// Widget 背景的跨版本處理。
    ///
    /// iOS 17 起，Widget **必須**以 `containerBackground(_:for:)` 指定背景，
    /// 否則系統會在「Always On Display」與鎖定畫面顯示時改用預設背景
    /// （並在 Debug 模式提出警告）。
    ///
    /// iOS 16 由系統直接提供 Widget 背景，沒有這個 API，
    /// 因此需要版本判斷；否則編譯會因 deployment target 是 16.0 而失敗。
    ///
    /// 專案最低支援 iOS 16.0（App Intents 所需），因此兩種系統都要能編譯。
    @ViewBuilder
    func assetPilotWidgetBackground() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(.fill.tertiary, for: .widget)
        } else {
            self
        }
    }
}
