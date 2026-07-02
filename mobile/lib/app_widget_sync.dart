import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'format.dart';
import 'models.dart';

/// 將 App 內已取得的 Dashboard 快照同步給 Android 桌面小工具。
///
/// 小工具只讀本機快照，不在背景直接打 API；這樣可沿用 App 既有登入流程，
/// 也避免把 httpOnly cookie 或 API 認證邏輯複製到原生小工具。
class AppWidgetSync {
  static const _channel = MethodChannel('assetpilot/widgets');

  static Future<void> updateDashboard(Dashboard dashboard) async {
    if (!Platform.isAndroid) return;

    final progress = _expenseProgress(dashboard.income, dashboard.expense);
    final updatedAt = DateTime.now();
    try {
      await _channel.invokeMethod('updateDashboard', {
        'period': dashboard.yearMonth.isEmpty
            ? _currentYearMonth()
            : dashboard.yearMonth,
        'incomeLabel': twd(dashboard.income),
        'expenseLabel': twd(dashboard.expense),
        'netLabel': _signedTwd(dashboard.net),
        'todayExpenseLabel': twd(dashboard.todayExpense),
        'bankBalanceLabel': twd(dashboard.bankBalance),
        'stockMarketValueLabel': twd(dashboard.stockMarketValue),
        'totalAssetLabel': twd(
          dashboard.bankBalance + dashboard.stockMarketValue,
        ),
        'expenseProgress': progress,
        'progressLabel': _progressLabel(
          income: dashboard.income,
          expense: dashboard.expense,
          progress: progress,
        ),
        'updatedAtLabel':
            '${updatedAt.hour.toString().padLeft(2, '0')}:${updatedAt.minute.toString().padLeft(2, '0')} 更新',
        'netPositive': dashboard.net >= 0,
      });
    } catch (e) {
      debugPrint('Failed to update Android widgets: $e');
    }
  }

  static Future<void> updatePortfolio(PortfolioSummary summary) async {
    if (!Platform.isAndroid) return;

    try {
      await _channel.invokeMethod('updatePortfolio', {
        'portfolioPlLabel': _signedTwd(summary.totalPL),
        'portfolioReturnLabel': summary.totalReturnRate == null
            ? '報酬率 --'
            : '報酬率 ${summary.totalReturnRate!.toStringAsFixed(2)}%',
        'portfolioPlPositive': summary.totalPL >= 0,
        'portfolioUpdatedAtLabel': '${_timeLabel()} 更新',
      });
    } catch (e) {
      debugPrint('Failed to update Android portfolio widgets: $e');
    }
  }

  static Future<void> updateBudgetAlerts({
    required String yearMonth,
    required List<Budget> budgets,
    required Map<String, String> categoryNames,
  }) async {
    if (!Platform.isAndroid) return;

    final shown = [...budgets]
      ..sort((a, b) => b.progress.compareTo(a.progress));
    final top = shown.take(3).toList();
    final args = <String, Object>{
      'budgetPeriod': yearMonth,
      'budgetUpdatedAtLabel': '${_timeLabel()} 更新',
      'budgetCount': top.length,
    };
    for (var i = 0; i < top.length; i++) {
      final budget = top[i];
      final progress = (budget.progress * 100).round();
      args['budgetName$i'] =
          budget.categoryId == null ? '月度總預算' : (categoryNames[budget.categoryId] ?? '未知分類');
      args['budgetDetail$i'] = '${twd(budget.used)} / ${twd(budget.amount)}';
      args['budgetPercent$i'] = '$progress%';
      args['budgetProgress$i'] = progress.clamp(0, 100);
      args['budgetStatus$i'] = _budgetStatus(budget.progress);
    }

    try {
      await _channel.invokeMethod('updateBudgetAlerts', args);
    } catch (e) {
      debugPrint('Failed to update Android budget widgets: $e');
    }
  }

  static Future<void> clearDashboard() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod('clearDashboard');
    } catch (e) {
      debugPrint('Failed to clear Android widgets: $e');
    }
  }

  static int _expenseProgress(num income, num expense) {
    if (income <= 0) return expense > 0 ? 100 : 0;
    return math.min(100, (expense / income * 100).round());
  }

  static String _progressLabel({
    required num income,
    required num expense,
    required int progress,
  }) {
    if (income > 0) return '支出為收入的 $progress%';
    if (expense > 0) return '本月已有支出';
    return '本月尚無支出';
  }

  static int _budgetStatus(double progress) {
    if (progress >= 1) return 2;
    if (progress >= 0.9) return 1;
    return 0;
  }

  static String _signedTwd(num value) =>
      value < 0 ? '-${twd(value.abs())}' : '+${twd(value)}';

  static String _timeLabel() {
    final now = DateTime.now();
    return '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  }

  static String _currentYearMonth() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}';
  }
}
