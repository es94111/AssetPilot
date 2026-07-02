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
  static const _recentLimit = 5;
  static const _reminderLimit = 5;

  static Future<void> updateDashboard(Dashboard dashboard) async {
    if (!Platform.isAndroid) return;

    final progress = _expenseProgress(dashboard.income, dashboard.expense);
    final updatedAt = DateTime.now();
    final recent = dashboard.recent.take(_recentLimit).toList();
    final args = <String, Object>{
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
      'recentCount': recent.length,
    };
    for (var i = 0; i < recent.length; i++) {
      final tx = recent[i];
      args['recentTitle$i'] = _transactionTitle(tx);
      args['recentSubtitle$i'] = _transactionSubtitle(tx);
      args['recentAmount$i'] = _transactionAmount(tx);
      args['recentTone$i'] = _transactionTone(tx);
    }

    try {
      await _channel.invokeMethod('updateDashboard', args);
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

  static Future<void> updateRecurringReminders({
    required List<Recurring> recurring,
    required Map<String, String> categoryNames,
    required Map<String, String> accountNames,
    required List<Account> accounts,
  }) async {
    if (!Platform.isAndroid) return;

    final today = _todayDate();
    final reminders = <_WidgetReminder>[];
    for (final item in recurring) {
      if (!item.isActive || item.type != 'expense') continue;
      final dueDate = _nextRecurringDate(item, today);
      if (dueDate == null) continue;
      final title = item.note.trim().isNotEmpty
          ? item.note.trim()
          : (categoryNames[item.categoryId] ?? '固定支出');
      final account = accountNames[item.accountId] ?? '未指定帳戶';
      final detail = '${_frequencyLabel(item.frequency)}・$account';
      reminders.add(
        _WidgetReminder(
          title: title,
          detail: detail,
          amount: '-${money(item.amount, item.currency)}',
          dateLabel: '${_relativeDateLabel(today, dueDate)}扣款',
          dueDate: dueDate,
          status: _reminderStatus(today, dueDate),
        ),
      );
    }

    for (final account in accounts) {
      final reminder = _creditCardPaymentReminder(account, today);
      if (reminder != null) reminders.add(reminder);
    }

    reminders.sort((a, b) {
      final byDate = a.dueDate.compareTo(b.dueDate);
      if (byDate != 0) return byDate;
      return b.status.compareTo(a.status);
    });

    final top = reminders.take(_reminderLimit).toList();
    final args = <String, Object>{
      'reminderUpdatedAtLabel': '${_timeLabel()} 更新',
      'reminderCount': top.length,
    };
    for (var i = 0; i < top.length; i++) {
      final item = top[i];
      args['reminderTitle$i'] = item.title;
      args['reminderDetail$i'] = item.detail;
      args['reminderAmount$i'] = item.amount;
      args['reminderDate$i'] = item.dateLabel;
      args['reminderStatus$i'] = item.status;
    }

    try {
      await _channel.invokeMethod('updateRecurringReminders', args);
    } catch (e) {
      debugPrint('Failed to update Android recurring reminder widgets: $e');
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

  static String _transactionTitle(Txn tx) {
    final category = tx.catName?.trim() ?? '';
    if (category.isNotEmpty) return category;
    if (tx.note.trim().isNotEmpty) return tx.note.trim();
    switch (tx.type) {
      case 'income':
        return '收入';
      case 'expense':
        return '支出';
      case 'transfer_in':
      case 'transfer_out':
      case 'transfer':
        return '轉帳';
      default:
        return '未分類';
    }
  }

  static String _transactionSubtitle(Txn tx) {
    final date = _mdLabel(tx.date);
    final note = tx.note.trim();
    if (note.isEmpty || note == _transactionTitle(tx)) return date;
    return '$date・$note';
  }

  static String _transactionAmount(Txn tx) {
    final sign = tx.type == 'income' || tx.type == 'transfer_in'
        ? '+'
        : (tx.type == 'expense' || tx.type == 'transfer_out' ? '-' : '');
    return '$sign${money(tx.originalAmount, tx.currency)}';
  }

  static int _transactionTone(Txn tx) {
    if (tx.type == 'income' || tx.type == 'transfer_in') return 1;
    if (tx.type == 'expense' || tx.type == 'transfer_out') return 2;
    return 0;
  }

  static _WidgetReminder? _creditCardPaymentReminder(
    Account account,
    DateTime today,
  ) {
    if (account.category != 'credit_card' ||
        account.statementClosingDay == null ||
        account.lastCycleSpending == null) {
      return null;
    }
    final unpaid = account.lastCycleSpending! - (account.lastCyclePayment ?? 0);
    if (unpaid <= 0) return null;
    final dueDate = _parseDate(account.cycleEnd);
    if (dueDate == null) return null;

    final start = account.lastCycleStart;
    final end = account.lastCycleEnd;
    final period = start != null && end != null
        ? '上期帳單 ${_mdLabel(start)}-${_mdLabel(end)}'
        : '上期帳單未繳';
    return _WidgetReminder(
      title: '${account.name} 繳款',
      detail: period,
      amount: money(unpaid, account.currency),
      dateLabel: '${_relativeDateLabel(today, dueDate)}截止',
      dueDate: dueDate,
      status: _reminderStatus(today, dueDate),
    );
  }

  static DateTime? _nextRecurringDate(Recurring item, DateTime today) {
    final start = _parseDate(item.startDate);
    if (start == null) return null;
    if (!start.isBefore(today)) return start;

    final elapsedDays = today.difference(start).inDays;
    switch (item.frequency) {
      case 'daily':
        return today;
      case 'weekly':
        final weeks = ((elapsedDays + 6) ~/ 7).clamp(1, 5200).toInt();
        final next = start.add(Duration(days: weeks * 7));
        return next.isBefore(today) ? next.add(const Duration(days: 7)) : next;
      case 'yearly':
        final years = math.max(1, today.year - start.year);
        var next = _addMonthsClamped(start, years * 12);
        var guard = 0;
        while (next.isBefore(today) && guard < 8) {
          next = _addMonthsClamped(start, (years + guard + 1) * 12);
          guard++;
        }
        return next;
      case 'monthly':
      default:
        final months = math.max(
          1,
          (today.year - start.year) * 12 + today.month - start.month,
        );
        var next = _addMonthsClamped(start, months);
        var offset = months;
        var guard = 0;
        while (next.isBefore(today) && guard < 24) {
          offset++;
          next = _addMonthsClamped(start, offset);
          guard++;
        }
        return next;
    }
  }

  static DateTime _addMonthsClamped(DateTime date, int months) {
    final zeroBased = date.month - 1 + months;
    final year = date.year + zeroBased ~/ 12;
    final month = zeroBased % 12 + 1;
    final day = math.min(date.day, DateTime(year, month + 1, 0).day);
    return DateTime(year, month, day);
  }

  static int _reminderStatus(DateTime today, DateTime dueDate) {
    final days = dueDate.difference(today).inDays;
    if (days <= 0) return 2;
    if (days <= 3) return 1;
    return 0;
  }

  static String _relativeDateLabel(DateTime today, DateTime dueDate) {
    final days = dueDate.difference(today).inDays;
    if (days < 0) return '已逾期 ${days.abs()} 天';
    if (days == 0) return '今天';
    if (days == 1) return '明天';
    if (days <= 7) return '$days 天後';
    return _mdFromDate(dueDate);
  }

  static String _frequencyLabel(String frequency) {
    switch (frequency) {
      case 'daily':
        return '每日';
      case 'weekly':
        return '每週';
      case 'monthly':
        return '每月';
      case 'yearly':
        return '每年';
      default:
        return frequency;
    }
  }

  static DateTime _todayDate() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  static DateTime? _parseDate(String? value) {
    if (value == null || value.length < 10) return null;
    final parsed = DateTime.tryParse(value.substring(0, 10));
    if (parsed == null) return null;
    return DateTime(parsed.year, parsed.month, parsed.day);
  }

  static String _mdLabel(String value) {
    final parsed = _parseDate(value);
    if (parsed == null) return value;
    return _mdFromDate(parsed);
  }

  static String _mdFromDate(DateTime date) => '${date.month}/${date.day}';

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

class _WidgetReminder {
  final String title;
  final String detail;
  final String amount;
  final String dateLabel;
  final DateTime dueDate;
  final int status;

  const _WidgetReminder({
    required this.title,
    required this.detail,
    required this.amount,
    required this.dateLabel,
    required this.dueDate,
    required this.status,
  });
}
