import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app_widget_sync.dart';
import '../models.dart';
import 'app_group_store.dart';

/// iOS WidgetKit 快照服務：把主 App 已取得的 Dashboard 摘要寫入 App Group，
/// 供 Widget 擴充唯讀顯示「本月收支摘要」。
///
/// 設計約束（見 docs/ios-app-development-plan.md 第 5.3 節）：
/// - 只放最小摘要：月份、收支數字、幣別、資料時間、帳本識別。
/// - 不含憑證、附件、交易備註或完整明細。
/// - Android 不受影響（Android 已有自己的 AppWidget 機制）。
class WidgetSnapshotService {
  WidgetSnapshotService._();

  /// 快照欄位名稱（與 iOS 擴充端讀取的 key 保持一致）。
  static const keyYearMonth = 'yearMonth';
  static const keyIncome = 'income';
  static const keyExpense = 'expense';
  static const keyNet = 'net';
  static const keyCurrency = 'currency';
  static const keyLedgerId = 'ledgerId';
  static const keyIsPersonalLedger = 'isPersonalLedger';
  static const keyHideAmounts = 'hideAmounts';
  static const keyUpdatedAt = 'updatedAt';

  /// 預設顯示幣別。App 支援多幣別，Widget 以帳本主要幣別顯示；
  /// 後續若要支援多幣別 Widget，可再擴充為 per-currency 快照。
  static const defaultCurrency = 'TWD';

  /// 是否遮蔽 Widget 金額的偏好設定鍵。
  ///
  /// 計畫書 5.3／第 10 節：金額**預設遮蔽**，由使用者主動開啟顯示。
  /// 偏好本身存在 Dart 端的 SharedPreferences（不含財務內容），
  /// 實際顯示遮蔽与否由寫入快照的 `hideAmounts` 欄位決定，
  /// Widget 擴充只需讀快照即可。
  static const hideAmountsKey = 'widgetHideAmounts';

  /// 讀取「遮蔽金額」偏好；未設定時回傳 true（預設遮蔽）。
  static Future<bool> readHideAmounts() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(hideAmountsKey) ?? true;
    } catch (_) {
      return true;
    }
  }

  /// 設定「遮蔽金額」偏好，並重載 Widget 讓變更即時生效。
  static Future<void> setHideAmounts(bool hide) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(hideAmountsKey, hide);
    } catch (_) {
      // 偏好寫入失敗不影響 App 主流程；下次寫入快照時會帶上目前值。
    }
    await WidgetReloader.requestReload();
  }

  /// 依 Dashboard 摘要更新 iOS Widget 快照。
  ///
  /// 回傳是否成功寫入。非 iOS 平台直接回傳 false，不做任何事，
  /// 保持 Android 既有行為不變。
  static Future<bool> updateFromDashboard(
    Dashboard dashboard, {
    String? ledgerId,
    bool isPersonalLedger = true,
  }) async {
    if (!AppWidgetSync.supportsIOSWidget) return false;
    final written = await AppGroupStore.writeSnapshot({
      keyYearMonth: dashboard.yearMonth.isEmpty
          ? _currentYearMonth()
          : dashboard.yearMonth,
      keyIncome: dashboard.income.toDouble(),
      keyExpense: dashboard.expense.toDouble(),
      keyNet: dashboard.net.toDouble(),
      keyCurrency: defaultCurrency,
      keyLedgerId: ledgerId ?? '',
      keyIsPersonalLedger: isPersonalLedger,
      keyHideAmounts: await readHideAmounts(),
    });
    if (written) {
      // 快照更新後請 WidgetKit 重載；實際顯示時間仍由 iOS 排程決定
      // （計畫書 5.3：不保證即時更新）。
      await WidgetReloader.requestReload();
    }
    return written;
  }

  /// 清除快照（登出、帳號或帳本切換時呼叫）。
  static Future<bool> clear() async {
    if (!AppWidgetSync.supportsIOSWidget) return false;
    final cleared = await AppGroupStore.clearSnapshot();
    if (cleared) await WidgetReloader.requestReload();
    return cleared;
  }

  static String _currentYearMonth() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-'
        '${now.month.toString().padLeft(2, '0')}';
  }
}

/// 請 WidgetKit 重載 Widget。
///
/// WidgetKit 對更新頻率有預算限制（每日約 40–70 次），因此只在
/// 「主 App 取得新資料後」呼叫，不做輪詢式更新。
class WidgetReloader {
  WidgetReloader._();

  static const _channel = MethodChannel('assetpilot/widget_reload');

  /// 請系統重載 AssetPilot 的 Widget。失敗時靜默忽略（Widget 不顯示不影響
  /// App 本身的功能）。
  static Future<bool> requestReload() async {
    if (!AppWidgetSync.supportsIOSWidget) return false;
    try {
      final result = await _channel.invokeMethod<bool>('reloadAll');
      return result ?? false;
    } catch (_) {
      return false;
    }
  }
}
