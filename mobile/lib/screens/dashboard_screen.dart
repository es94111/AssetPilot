import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app_widget_sync.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late DateTime _month;
  late Future<Dashboard> _future;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _future = _load(_yearMonth(_month));
  }

  static String _yearMonth(DateTime month) =>
      '${month.year}-${month.month.toString().padLeft(2, '0')}';

  String get _ym => _yearMonth(_month);

  Future<Dashboard> _load(String yearMonth) async {
    final json = await ApiClient.instance.dashboard(yearMonth);
    final dashboard = Dashboard.fromJson(json);
    await AppWidgetSync.updateDashboard(dashboard);
    unawaited(_refreshSecondaryWidgetSnapshots(yearMonth));
    return dashboard;
  }

  Future<void> _refreshSecondaryWidgetSnapshots(String yearMonth) async {
    try {
      final api = ApiClient.instance;
      final stocksJson = await api.stocks();
      await AppWidgetSync.updatePortfolio(
        PortfolioSummary.fromJson(
          (stocksJson['portfolioSummary'] as Map? ?? {})
              .cast<String, dynamic>(),
        ),
      );

      final rawBudgets = await api.budgets(yearMonth);
      final rawCategories = await api.categories();
      final rawRecurring = await api.recurring();
      final rawAccounts = await api.accounts();
      final budgets = rawBudgets
          .map((e) => Budget.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      final categories = rawCategories
          .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      final recurring = rawRecurring
          .map((e) => Recurring.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      final accounts = rawAccounts
          .map((e) => Account.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      final categoryNames = {
        for (final category in categories) category.id: category.name,
      };
      final accountNames = {
        for (final account in accounts) account.id: account.name,
      };
      await AppWidgetSync.updateBudgetAlerts(
        yearMonth: yearMonth,
        budgets: budgets,
        categoryNames: categoryNames,
      );
      await AppWidgetSync.updateRecurringReminders(
        recurring: recurring,
        categoryNames: categoryNames,
        accountNames: accountNames,
        accounts: accounts,
      );
    } catch (_) {
      // 第二批小工具的背景同步失敗不應影響 Dashboard 顯示。
    }
  }

  void _reload() {
    final yearMonth = _ym;
    setState(() => _future = _load(yearMonth));
  }

  void _shiftMonth(int delta) {
    final nextMonth = DateTime(_month.year, _month.month + delta);
    final yearMonth = _yearMonth(nextMonth);
    setState(() {
      _month = nextMonth;
      _future = _load(yearMonth);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('AssetPilot'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: _MonthSelector(
            label: _ym,
            onPrev: () => _shiftMonth(-1),
            onNext: () => _shiftMonth(1),
          ),
        ),
      ),
      body: AsyncView<Dashboard>(
        key: ValueKey(_ym),
        future: _future,
        onRetry: _reload,
        builder: (context, d) => RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _SummaryGrid(d: d),
              SizedBox(height: 16),
              _AssetRow(d: d),
              SizedBox(height: 24),
              _CategoryPie(nodes: d.catBreakdown),
              SizedBox(height: 24),
              Text(
                trKey('dashboardSectionsRecentTransactions'),
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              if (d.recent.isEmpty)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(trKey('mobileLegacyNoTransactionsThisMonth')),
                  ),
                )
              else
                ...d.recent.take(10).map((t) => _RecentTile(t: t)),
            ],
          ),
        ),
      ),
    );
  }
}

class _MonthSelector extends StatelessWidget {
  final String label;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  const _MonthSelector({
    required this.label,
    required this.onPrev,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(onPressed: onPrev, icon: Icon(Icons.chevron_left)),
          Text(label, style: Theme.of(context).textTheme.titleMedium),
          IconButton(onPressed: onNext, icon: Icon(Icons.chevron_right)),
        ],
      ),
    );
  }
}

class _SummaryGrid extends StatelessWidget {
  final Dashboard d;
  const _SummaryGrid({required this.d});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            label: trKey('dashboardOverviewIncome'),
            value: twd(d.income),
            color: Colors.green,
          ),
        ),
        SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            label: trKey('dashboardOverviewExpense'),
            value: twd(d.expense),
            color: Colors.red,
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AssetRow extends StatelessWidget {
  final Dashboard d;
  const _AssetRow({required this.d});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              trKey('mobileLegacyNetThisMonth'),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
            SizedBox(height: 4),
            Text(
              signed(d.net),
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
            Divider(height: 24),
            Row(
              children: [
                Expanded(
                  child: _MiniStat(
                    label: trKey('mobileLegacyBankBalance'),
                    value: twd(d.bankBalance),
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    label: trKey('mobileLegacyStockMarketValue'),
                    value: twd(d.stockMarketValue),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onPrimaryContainer,
          ),
        ),
        Text(
          value,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.onPrimaryContainer,
          ),
        ),
      ],
    );
  }
}

/// 父分類彙總後的扇區（與 Web dashboard 的 groupCategoryRows 對應）。
class _CatGroup {
  final String name;
  final String color;
  num total;
  _CatGroup({required this.name, required this.color, this.total = 0});
}

class _CategoryPie extends StatelessWidget {
  final List<CatNode> nodes;
  const _CategoryPie({required this.nodes});

  /// 與 Web 儀表板「支出分類」相同的邏輯：API 回傳的子分類節點依父分類彙總，
  /// 父分類金額為其子分類總和，再依金額由大到小排序。
  List<_CatGroup> _groupByParent() {
    final groups = <String, _CatGroup>{};
    for (final n in nodes) {
      final g = groups.putIfAbsent(
        n.parentId,
        () => _CatGroup(name: n.parentName, color: n.parentColor),
      );
      g.total += n.total;
    }
    return groups.values.toList()..sort((a, b) => b.total.compareTo(a.total));
  }

  @override
  Widget build(BuildContext context) {
    if (nodes.isEmpty) return const SizedBox.shrink();
    final shown = _groupByParent();
    final total = shown.fold<num>(0, (s, n) => s + n.total);
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              trKey('dashboardSectionsExpenseCategories'),
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            SizedBox(
              height: 180,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 40,
                  sections: [
                    for (final n in shown)
                      PieChartSectionData(
                        value: n.total.toDouble(),
                        color: parseColor(n.color),
                        title: total > 0
                            ? '${(n.total / total * 100).round()}%'
                            : '',
                        radius: 50,
                        titleStyle: TextStyle(
                          fontSize: 11,
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: [
                for (final n in shown)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: parseColor(n.color),
                          shape: BoxShape.circle,
                        ),
                      ),
                      SizedBox(width: 4),
                      Text(
                        // 父分類佔總支出百分比，保留小數點第一位。
                        total > 0
                            ? '${n.name}　${twd(n.total)}　${(n.total / total * 100).toStringAsFixed(1)}%'
                            : '${n.name}　${twd(n.total)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentTile extends StatelessWidget {
  final Txn t;
  const _RecentTile({required this.t});

  @override
  Widget build(BuildContext context) {
    final isIncome = t.type == 'income';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: CircleAvatar(
        backgroundColor: (isIncome ? Colors.green : Colors.red).withValues(
          alpha: 0.15,
        ),
        child: Icon(
          isIncome ? Icons.south_west : Icons.north_east,
          color: isIncome ? Colors.green : Colors.red,
          size: 18,
        ),
      ),
      title: Text(
        t.catName?.isNotEmpty == true
            ? t.catName!
            : (t.note.isEmpty ? trKey('dashboardUncategorized') : t.note),
      ),
      subtitle: Text(t.date),
      trailing: Text(
        // 外幣交易顯示原幣別金額，TWD 交易維持台幣金額。
        (isIncome ? '+' : '-') + money(t.originalAmount, t.currency),
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: isIncome ? Colors.green : Colors.red,
        ),
      ),
    );
  }
}
