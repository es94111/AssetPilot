import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app_widget_sync.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';
import '../theme.dart';
import 'accounts_screen.dart';
import 'budgets_screen.dart';
import 'transaction_form_screen.dart';
import 'transactions_screen.dart';

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
        title: Text(trKey('dashboardTitle')),
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
        loadingBuilder: (_) => ListView(
          padding: const EdgeInsets.fromLTRB(
            ApSpace.xl,
            ApSpace.lg,
            ApSpace.xl,
            ApSpace.xxl,
          ),
          children: const [SkeletonSummary()],
        ),
        builder: (context, d) => RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              ApSpace.xl,
              ApSpace.md,
              ApSpace.xl,
              ApSpace.xxl,
            ),
            children: [
              _DashboardContext(month: _ym),
              const SizedBox(height: ApSpace.lg),
              _AssetRow(d: d),
              const SizedBox(height: ApSpace.lg),
              _SummaryGrid(d: d),
              const SizedBox(height: ApSpace.lg),
              _QuickAccess(onAddTxn: () => _openNewTxn()),
              const SizedBox(height: ApSpace.xl),
              _CategoryPie(nodes: d.catBreakdown),
              const SizedBox(height: ApSpace.xl),
              SectionHeader(
                title: trKey('dashboardSectionsRecentTransactions'),
                trailing: Text(
                  trKey('dashboardSectionsRecentCount', {
                    'count': d.recent.take(10).length,
                  }),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              const SizedBox(height: ApSpace.sm),
              if (d.recent.isEmpty)
                LedgerCard(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: ApSpace.lg),
                    child: Center(
                      child: Text(trKey('dashboardEmptyNoTransactions')),
                    ),
                  ),
                )
              else
                ...d.recent
                    .take(10)
                    .toList()
                    .asMap()
                    .entries
                    .map((e) => StaggerIn(index: e.key, child: _RecentTile(t: e.value))),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openNewTxn() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const TransactionFormScreen()),
    );
    if (changed == true) _reload();
  }
}

class _DashboardContext extends StatelessWidget {
  final String month;

  const _DashboardContext({required this.month});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = apTokens(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ApSpace.lg,
        vertical: ApSpace.md + 2,
      ),
      decoration: BoxDecoration(
        color: tokens.glassTint,
        borderRadius: ApRadius.rMd,
        border: Border.all(color: tokens.glassBorder),
      ),
      child: Row(
        children: [
          Icon(Icons.calendar_month_outlined, color: theme.colorScheme.primary),
          const SizedBox(width: ApSpace.md),
          Expanded(
            child: Text(
              trKey('dashboardSubtitle', {'month': month}),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
          ),
        ],
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
      padding: const EdgeInsets.only(bottom: ApSpace.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            tooltip: trKey('dashboardFiltersPreviousMonth'),
            onPressed: onPrev,
            icon: const Icon(Icons.chevron_left),
          ),
          AnimatedTextSwap(
            text: label,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          IconButton(
            tooltip: trKey('dashboardFiltersNextMonth'),
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

/// 快速入口：把埋在「更多」的高頻功能（帳戶、預算、報表、記一筆）
/// 提升到 Dashboard，降低點擊深度。
class _QuickAccess extends StatelessWidget {
  final VoidCallback onAddTxn;
  const _QuickAccess({required this.onAddTxn});

  @override
  Widget build(BuildContext context) {
    final tokens = apTokens(context);
    final scheme = Theme.of(context).colorScheme;
    final items = <(IconData, String, Color, VoidCallback)>[
      (
        Icons.add_circle_outline,
        trKey('mobileLegacyAddTransaction'),
        scheme.primary,
        onAddTxn,
      ),
      (
        Icons.account_balance_wallet_outlined,
        trKey('featuresCommonAccount'),
        tokens.net,
        () => _push(context, AccountsScreen()),
      ),
      (
        Icons.savings_outlined,
        trKey('mobileLegacyBudgets'),
        tokens.warning,
        () => _push(context, BudgetsScreen()),
      ),
      (
        Icons.receipt_long_outlined,
        trKey('mobileLegacyTransactions8084a8ea'),
        tokens.income,
        () => _push(context, TransactionsScreen()),
      ),
    ];
    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: ApSpace.sm),
          Expanded(
            child: _QuickTile(
              icon: items[i].$1,
              label: items[i].$2,
              color: items[i].$3,
              onTap: items[i].$4,
            ),
          ),
        ],
      ],
    );
  }

  void _push(BuildContext context, Widget page) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));
}

class _QuickTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: ApRadius.rMd,
          child: Ink(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: ApRadius.rMd,
              border: Border.all(color: apTokens(context).glassBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: ApSpace.md),
              child: Column(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.14),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, size: 20, color: color),
                  ),
                  const SizedBox(height: ApSpace.xs),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ],
              ),
            ),
          ),
        ),
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
            color: flowColor(income: true, context: context),
            icon: Icons.south_west,
          ),
        ),
        const SizedBox(width: ApSpace.md),
        Expanded(
          child: _StatCard(
            label: trKey('dashboardOverviewExpense'),
            value: twd(d.expense),
            color: flowColor(income: false, context: context),
            icon: Icons.north_east,
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
  final IconData icon;
  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return LedgerCard(
      padding: const EdgeInsets.all(ApSpace.lg - 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: ApSpace.md),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: ApSpace.xs),
          AnimatedTextSwap(
            text: value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
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
    final tokens = apTokens(context);
    return Container(
      padding: const EdgeInsets.all(ApSpace.xl),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: tokens.heroGradient,
        ),
        borderRadius: ApRadius.rXl,
        border: Border.all(color: tokens.glassBorder),
        boxShadow: [
          BoxShadow(
            color: tokens.shadow,
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            trKey('mobileLegacyNetThisMonth'),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: ApSpace.xs),
          Semantics(
            label: signedLabel(d.net, trKey('dashboardOverviewNet')),
            child: AnimatedTextSwap(
              text: signed(d.net),
              style: theme.textTheme.displaySmall?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                color: d.net >= 0 ? tokens.net : tokens.expense,
              ),
            ),
          ),
          const SizedBox(height: ApSpace.lg),
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
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 2),
        AnimatedTextSwap(
          text: value,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: theme.colorScheme.onSurface,
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
  _CatGroup({required this.name, required this.color}) : total = 0;
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

  /// 扇區百分比標籤畫在使用者自訂的分類色上，依亮度選黑或白確保對比。
  Color _onSliceColor(Color slice) =>
      slice.computeLuminance() > 0.55 ? const Color(0xFF1A1D26) : Colors.white;

  @override
  Widget build(BuildContext context) {
    if (nodes.isEmpty) return const SizedBox.shrink();
    final shown = _groupByParent();
    final total = shown.fold<num>(0, (s, n) => s + n.total);
    final summary = shown.map((n) => '${n.name} ${twd(n.total)}').join(', ');
    return LedgerCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: trKey('dashboardSectionsExpenseCategories')),
          const SizedBox(height: ApSpace.lg),
          Semantics(
            container: true,
            label: summary,
            child: SizedBox(
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
                          color: _onSliceColor(parseColor(n.color)),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: ApSpace.md),
          Wrap(
            spacing: ApSpace.md,
            runSpacing: ApSpace.xs + 2,
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
                    const SizedBox(width: ApSpace.xs),
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
    );
  }
}

class _RecentTile extends StatelessWidget {
  final Txn t;
  const _RecentTile({required this.t});

  @override
  Widget build(BuildContext context) {
    final isIncome = t.type == 'income';
    final isTransfer = t.type == 'transfer';
    final color = isTransfer
        ? Theme.of(context).colorScheme.onSurfaceVariant
        : flowColor(income: isIncome, context: context);
    final icon = isTransfer
        ? Icons.swap_horiz
        : (isIncome ? Icons.south_west : Icons.north_east);
    final sign = isTransfer ? '' : (isIncome ? '+' : '-');
    return LedgerCard(
      margin: const EdgeInsets.only(bottom: ApSpace.sm),
      padding: EdgeInsets.zero,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: ApSpace.md + 2,
          vertical: ApSpace.xs,
        ),
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.14),
          child: Icon(icon, color: color, size: 18),
        ),
        title: Text(
          t.catName?.isNotEmpty == true
              ? t.catName!
              : (t.note.isEmpty ? trKey('dashboardUncategorized') : t.note),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(t.date),
        trailing: AnimatedTextSwap(
          // 外幣交易顯示原幣別金額，TWD 交易維持台幣金額。
          text: sign + money(t.originalAmount, t.currency),
          style: TextStyle(fontWeight: FontWeight.w700, color: color),
        ),
      ),
    );
  }
}