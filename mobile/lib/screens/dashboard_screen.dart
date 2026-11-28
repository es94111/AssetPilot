import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app_widget_sync.dart';
import '../format.dart';
import '../models.dart';
import '../platform/widget_snapshot_service.dart';
import '../widgets.dart';
import '../l10n.dart';
import '../theme.dart';
import 'transaction_form_screen.dart';
import 'reports_screen.dart';

class DashboardScreen extends StatefulWidget {
  final VoidCallback? onShowTransactions;
  final VoidCallback? onTransactionsChanged;
  final int transactionsRevision;

  const DashboardScreen({
    super.key,
    this.onShowTransactions,
    this.onTransactionsChanged,
    this.transactionsRevision = 0,
  });

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
    // 桌面小工具與背景 Worker 只反映個人帳本（issue #281）：切到共享帳本時不覆寫
    // 小工具快照，否則會把共享帳本數字與個人快取混在一起。
    if (ApiClient.instance.activeLedgerId.isEmpty) {
      await AppWidgetSync.updateDashboard(dashboard);
      // iOS WidgetKit 摘要快照（快速記帳 + 本月收支摘要）。
      // 同樣只反映個人帳本，避免共享帳本數字與個人快取混在一起。
      unawaited(
        WidgetSnapshotService.updateFromDashboard(
          dashboard,
          isPersonalLedger: true,
        ),
      );
      unawaited(_refreshSecondaryWidgetSnapshots(yearMonth));
    }
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
  void didUpdateWidget(covariant DashboardScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.transactionsRevision != oldWidget.transactionsRevision) {
      _future = _load(_ym);
    }
  }

  void _openReports() {
    final month = _month;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ReportsScreen(
          initialRange: DateTimeRange(
            start: DateTime(month.year, month.month, 1),
            end: DateTime(month.year, month.month + 1, 0),
          ),
        ),
      ),
    );
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
      floatingActionButton: ApiClient.instance.activeLedgerReadOnly
          ? null
          : RecordButton(onPressed: _openNewTxn),
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragEnd: (details) {
          final velocity = details.primaryVelocity;
          if (velocity == null) return;
          // 右滑切換至上個月，左滑切換至下個月
          if (velocity > 250) {
            _shiftMonth(-1);
          } else if (velocity < -250) {
            _shiftMonth(1);
          }
        },
        child: AsyncView<Dashboard>(
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
                if (ApiClient.instance.activeLedgerReadOnly)
                  Padding(
                    padding: const EdgeInsets.only(bottom: ApSpace.sm),
                    child: Text(trKey('ledgerReadOnlyNotice')),
                  ),
                _AssetRow(d: d),
                const SizedBox(height: ApSpace.md),
                _SummaryGrid(d: d),
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton.icon(
                    onPressed: _openReports,
                    icon: const Icon(Icons.bar_chart_outlined),
                    label: Text(trKey('uxViewReports')),
                  ),
                ),
                const SizedBox(height: ApSpace.md),
                Semantics(
                  header: true,
                  child: Text(
                    trKey('dashboardSectionsRecentTransactions'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const SizedBox(height: ApSpace.sm),
                if (d.recent.isEmpty)
                  LedgerCard(
                    child: Text(
                      trKey(
                        ApiClient.instance.activeLedgerReadOnly
                            ? 'ledgerReadOnlyNotice'
                            : 'uxEmptyLedgerHint',
                      ),
                    ),
                  )
                else ...[
                  ...d.recent
                      .take(10)
                      .map((transaction) => _RecentTile(t: transaction)),
                  if (widget.onShowTransactions != null)
                    Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: TextButton(
                        onPressed: widget.onShowTransactions,
                        child: Text(trKey('uxViewAllTransactions')),
                      ),
                    ),
                ],
                const SizedBox(height: ApSpace.lg),
                OptionGroup(
                  label: trKey('uxDashboardDetails'),
                  children: [_CategoryPie(nodes: d.catBreakdown)],
                ),
                const SizedBox(height: 72),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openNewTxn() async {
    if (ApiClient.instance.activeLedgerReadOnly) return;
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const TransactionFormScreen()),
    );
    if (changed != true || !mounted) return;
    final onChanged = widget.onTransactionsChanged;
    if (onChanged == null) {
      _reload();
    } else {
      onChanged();
    }
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
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w700, color: color),
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
          // 暖赭實心背景上的文字固定用暖白／奶油白，確保對比
          //（亮色模式的 heroGradient 為深赭→淡赭）。
          Text(
            trKey('mobileLegacyNetThisMonth'),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: const Color(0xFFEFDFD2),
            ),
          ),
          const SizedBox(height: ApSpace.xs),
          Semantics(
            label: signedLabel(d.net, trKey('dashboardOverviewNet')),
            child: AnimatedTextSwap(
              text: signed(d.net),
              style: theme.textTheme.displaySmall?.copyWith(
                fontWeight: FontWeight.w800,
                fontFeatures: const [FontFeature.tabularFigures()],
                // 暖底上不以語義色表達淨額正負（規範：金額可讀性優先），
                // 改以符號表達方向。
                color: const Color(0xFFFFF4E8),
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
    // 位於暖赭 hero 底上：文字固定暖白／奶油白以確保對比。
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: const Color(0xCCEFE0D2),
          ),
        ),
        const SizedBox(height: 2),
        AnimatedTextSwap(
          text: value,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            fontFeatures: const [FontFeature.tabularFigures()],
            color: const Color(0xFFFFF4E8),
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
      slice.computeLuminance() > 0.55 ? const Color(0xFF26221C) : Colors.white;

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
