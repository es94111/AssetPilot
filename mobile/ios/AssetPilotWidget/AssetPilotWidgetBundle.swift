import WidgetKit
import SwiftUI

@main
struct AssetPilotWidgetBundle: WidgetBundle {
    var body: some Widget {
        AssetPilotMonthlyOverviewWidget()
        AssetPilotQuickTransactionWidget()
    }
}
